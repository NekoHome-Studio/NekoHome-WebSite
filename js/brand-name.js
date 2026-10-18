/* ============================================================
   NekoHome 工作室 · brand-name.js
   顶栏 / 页脚名称的配置解析与渲染：文字 / 跟随 studioName /
   位图（webp / png …，<img>）/ SVG（内联 <svg>，可继承页面主题变量）。

   为什么 SVG 要内联：<img src="x.svg"> 里的 SVG 是独立文档，页面
   的 CSS 变量（--text / --accent）和 data-bs-theme 都进不去，SVG
   里写 var(--text) 只会取兜底色，主题切换自然跟不动。内联成 <svg>
   后它就是页面 DOM 的一部分，主题变量随 CSS 级联实时生效。

   纯函数 + fake DOM 可测：浏览器下挂到 window.NekoBrandName，
   Node 下作为 CommonJS 模块导出（供 tests/brand-name.test.cjs）。

   配置写法（brandName / footerName 同规则）：
     "brandName": "{name}"                          // 跟随 studioName（省略亦可）
     "brandName": "NekoHome 工作室"                  // 自定义文字，支持 {name} 占位
     "brandName": { "image": "assets/brand.webp" }  // 位图；可选 alt / height(px)
     "brandName": { "image": "assets/brand.svg" }   // SVG 自动内联；可选 alt / height(px)
   ============================================================ */

"use strict";

(function () {

  /** 是否为 SVG 资源（忽略 query / hash） */
  function isSvgSource(src) {
    return /\.svg$/i.test(String(src).split(/[?#]/)[0]);
  }

  /**
   * 解析名称配置。
   * @param {*} value           config.json 中 brandName / footerName 的原始值
   * @param {string} studioName 工作室名，用于 {name} 占位与图片 alt 兜底
   * @returns {{kind: "text", text: string} |
   *           {kind: "image"|"svg", src: string, alt: string, height: number|null}}
   */
  function resolveBrandName(value, studioName) {
    const name = typeof studioName === "string" ? studioName : "";
    const asText = text => ({ kind: "text", text });

    // 省略 / 空值 / 空白：跟随 studioName
    if (value == null) return asText(name);
    if (typeof value === "string") {
      if (!value.trim()) return asText(name);
      return asText(value.split("{name}").join(name));
    }

    // 图片模式：{ image: "...", alt?: "...", height?: 数字 }
    if (typeof value === "object" && !Array.isArray(value)) {
      const image = typeof value.image === "string" ? value.image.trim() : "";
      if (!image) return asText(name);
      const alt = typeof value.alt === "string" && value.alt.trim() ? value.alt.trim() : name;
      const height = typeof value.height === "number" && Number.isFinite(value.height) && value.height > 0
        ? value.height
        : null;
      return { kind: isSvgSource(image) ? "svg" : "image", src: image, alt, height };
    }

    // 其余类型（数字 / 布尔 / 数组等）视为配置错误，安全回退
    return asText(name);
  }

  /**
   * 给 SVG 源码里的 id 及引用统一加前缀。
   * 顶栏和页脚会内联同一份 SVG，filter / gradient 的 id 必须唯一，
   * 否则后插入的会引用到先插入的节点。
   * @param {string} svgText
   * @param {string} prefix
   * @returns {string}
   */
  function prefixSvgIds(svgText, prefix) {
    if (typeof svgText !== "string") return "";
    let out = svgText;
    const ids = new Set([...svgText.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
    for (const id of ids) {
      const token = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const renamed = `${prefix}-${id}`;
      out = out
        .replace(new RegExp(`id="${token}"`, "g"), `id="${renamed}"`)
        .replace(new RegExp(`url\\(#${token}\\)`, "g"), `url(#${renamed})`)
        .replace(new RegExp(`href="#${token}"`, "g"), `href="#${renamed}"`);
    }
    return out;
  }

  /**
   * 把解析结果写入名称元素：
   *   文字 → textContent；
   *   位图 → <img>（error 时退回文字）；
   *   SVG  → fetch 后内联 <svg>（失败退回文字）。
   * @param {HTMLElement} el
   * @param {{kind: string, [key: string]: *}} resolved
   * @param {string} fallbackName 图片失败且无 alt 时退回的名字
   * @returns {void|Promise<void>} SVG 模式返回 Promise（调用方可忽略）
   */
  function renderBrandName(el, resolved, fallbackName) {
    if (resolved.kind === "text") {
      el.textContent = resolved.text;
      return;
    }

    if (resolved.kind === "image") {
      const img = document.createElement("img");
      img.src = resolved.src;
      img.alt = resolved.alt;
      if (resolved.height) img.style.height = resolved.height + "px";
      img.addEventListener("error", () => {
        img.remove();
        el.textContent = resolved.alt || fallbackName || "";
      }, { once: true });
      el.textContent = "";
      el.appendChild(img);
      return;
    }

    // SVG：内联注入，才能继承页面主题变量
    const fallback = () => { el.textContent = resolved.alt || fallbackName || ""; };
    if (typeof fetch !== "function" || typeof DOMParser !== "function") {
      fallback();
      return;
    }
    const prefix = "neko-name-" + (++svgSeq);
    return fetch(resolved.src, { cache: "no-cache" })
      .then(res => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(text => {
        const doc = new DOMParser().parseFromString(prefixSvgIds(text, prefix), "image/svg+xml");
        const svg = doc && doc.documentElement;
        if (!svg || String(svg.nodeName).toLowerCase() !== "svg") throw new Error("不是有效的 SVG");
        // 固定宽高交给 CSS / config.height，避免撑破顶栏与页脚
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        if (resolved.height) svg.style.height = resolved.height + "px";
        if (resolved.alt) {
          svg.setAttribute("role", "img");
          svg.setAttribute("aria-label", resolved.alt);
        } else {
          svg.setAttribute("aria-hidden", "true");
        }
        const node = document.importNode(svg, true);
        el.textContent = "";
        el.appendChild(node);
      })
      .catch(fallback);
  }

  let svgSeq = 0; // 同一页面内多次内联时的 id 前缀序号

  // Node 环境下仅导出纯函数（CommonJS），不触碰 DOM
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { resolveBrandName, renderBrandName, prefixSvgIds };
    return;
  }

  window.NekoBrandName = { resolve: resolveBrandName, render: renderBrandName };
})();
