/* brand-name.js 名称配置解析 / 渲染测试（无真实 DOM 依赖）
   运行：node --test tests/ */
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { resolveBrandName, renderBrandName, prefixSvgIds } = require("../js/brand-name.js");

test("resolveBrandName: 未配置时跟随 studioName", () => {
  assert.deepStrictEqual(resolveBrandName(undefined, "NekoHome"), { kind: "text", text: "NekoHome" });
  assert.deepStrictEqual(resolveBrandName(null, "NekoHome"), { kind: "text", text: "NekoHome" });
});

test("resolveBrandName: 空字符串或纯空白回退到 studioName", () => {
  assert.deepStrictEqual(resolveBrandName("", "NekoHome"), { kind: "text", text: "NekoHome" });
  assert.deepStrictEqual(resolveBrandName("   ", "NekoHome"), { kind: "text", text: "NekoHome" });
});

test("resolveBrandName: {name} 占位符替换为 studioName", () => {
  assert.deepStrictEqual(resolveBrandName("{name}", "NekoHome"), { kind: "text", text: "NekoHome" });
  assert.deepStrictEqual(resolveBrandName("{name} Studio", "NekoHome"), { kind: "text", text: "NekoHome Studio" });
  assert.deepStrictEqual(resolveBrandName("{name}·{name}", "NekoHome"), { kind: "text", text: "NekoHome·NekoHome" });
});

test("resolveBrandName: 自定义文字原样保留", () => {
  assert.deepStrictEqual(resolveBrandName("NEKO HOME", "NekoHome"), { kind: "text", text: "NEKO HOME" });
});

test("resolveBrandName: 位图对象解析出 src / alt / height", () => {
  assert.deepStrictEqual(
    resolveBrandName({ image: "assets/brand.webp", alt: "Neko 品牌", height: 32 }, "NekoHome"),
    { kind: "image", src: "assets/brand.webp", alt: "Neko 品牌", height: 32 }
  );
});

test("resolveBrandName: svg 标记为 svg 类型（需内联注入以继承主题变量）", () => {
  assert.deepStrictEqual(
    resolveBrandName({ image: "assets/logo-title.svg" }, "NekoHome"),
    { kind: "svg", src: "assets/logo-title.svg", alt: "NekoHome", height: null }
  );
  assert.strictEqual(resolveBrandName({ image: "assets/LOGO.SVG?v=2" }, "NekoHome").kind, "svg");
  assert.strictEqual(resolveBrandName({ image: "https://example.com/logo.svg#x" }, "NekoHome").kind, "svg");
  assert.strictEqual(resolveBrandName({ image: "assets/logo.webp" }, "NekoHome").kind, "image");
  assert.strictEqual(resolveBrandName({ image: "assets/logo.png?x=.svg" }, "NekoHome").kind, "image");
});

test("resolveBrandName: 图片对象省略 alt / height 时用默认值", () => {
  assert.deepStrictEqual(
    resolveBrandName({ image: "  assets/brand.svg  " }, "NekoHome"),
    { kind: "svg", src: "assets/brand.svg", alt: "NekoHome", height: null }
  );
  assert.deepStrictEqual(
    resolveBrandName({ image: "assets/brand.svg", alt: "  ", height: 0 }, "NekoHome"),
    { kind: "svg", src: "assets/brand.svg", alt: "NekoHome", height: null }
  );
  assert.deepStrictEqual(
    resolveBrandName({ image: "assets/brand.webp", height: "32" }, "NekoHome"),
    { kind: "image", src: "assets/brand.webp", alt: "NekoHome", height: null }
  );
});

test("resolveBrandName: 非法图片对象回退到 studioName", () => {
  assert.deepStrictEqual(resolveBrandName({}, "NekoHome"), { kind: "text", text: "NekoHome" });
  assert.deepStrictEqual(resolveBrandName({ image: "" }, "NekoHome"), { kind: "text", text: "NekoHome" });
  assert.deepStrictEqual(resolveBrandName({ image: 123 }, "NekoHome"), { kind: "text", text: "NekoHome" });
});

test("resolveBrandName: 非字符串非对象回退到 studioName", () => {
  assert.deepStrictEqual(resolveBrandName(42, "NekoHome"), { kind: "text", text: "NekoHome" });
  assert.deepStrictEqual(resolveBrandName(true, "NekoHome"), { kind: "text", text: "NekoHome" });
  assert.deepStrictEqual(resolveBrandName(["brand"], "NekoHome"), { kind: "text", text: "NekoHome" });
});

test("resolveBrandName: studioName 缺失时回退为空字符串", () => {
  assert.deepStrictEqual(resolveBrandName("{name}", undefined), { kind: "text", text: "" });
  assert.deepStrictEqual(resolveBrandName(undefined, null), { kind: "text", text: "" });
  assert.deepStrictEqual(
    resolveBrandName({ image: "assets/brand.svg" }, undefined),
    { kind: "svg", src: "assets/brand.svg", alt: "", height: null }
  );
});

/* ---------- prefixSvgIds：父子两处内联同一 SVG 时避免 id / filter 冲突 ---------- */

test("prefixSvgIds: id 定义与 url(#id) / href=\"#id\" 引用一起加前缀", () => {
  const src = '<svg><filter id="boldMain"></filter><linearGradient id="bg"></linearGradient>'
    + '<g filter="url(#boldMain)"/><rect fill="url(#bg)"/><use href="#boldMain"/></svg>';
  const out = prefixSvgIds(src, "neko-name-7");
  assert.match(out, /id="neko-name-7-boldMain"/);
  assert.match(out, /id="neko-name-7-bg"/);
  assert.match(out, /url\(#neko-name-7-boldMain\)/);
  assert.match(out, /url\(#neko-name-7-bg\)/);
  assert.match(out, /href="#neko-name-7-boldMain"/);
  assert.doesNotMatch(out, /id="boldMain"/);
  assert.doesNotMatch(out, /url\(#boldMain\)/);
});

test("prefixSvgIds: 无 id 的 SVG 原样返回", () => {
  const src = '<svg><path d="M0 0"/></svg>';
  assert.strictEqual(prefixSvgIds(src, "neko-name-1"), src);
});

test("prefixSvgIds: 非字符串安全返回空字符串", () => {
  assert.strictEqual(prefixSvgIds(null, "p"), "");
  assert.strictEqual(prefixSvgIds(undefined, "p"), "");
});

/* ---------- renderBrandName：DOM 写入（用最小 fake DOM 验证行为） ---------- */

function makeFakeElement(tag) {
  return {
    nodeName: String(tag).toUpperCase(),
    tagName: String(tag).toUpperCase(),
    textContent: "",
    children: [],
    style: {},
    attributes: {},
    removed: false,
    imported: false,
    handlers: {},
    appendChild(child) { this.children.push(child); return child; },
    remove() { this.removed = true; },
    addEventListener(type, fn) { this.handlers[type] = fn; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
    },
    removeAttribute(name) { delete this.attributes[name]; }
  };
}

function makeFakeDocument() {
  const created = [];
  return {
    created,
    createElement(tag) {
      const el = makeFakeElement(tag);
      created.push(el);
      return el;
    },
    importNode(node) {
      node.imported = true;
      return node;
    }
  };
}

function withFakeDocument(fn) {
  const prev = global.document;
  const doc = makeFakeDocument();
  global.document = doc;
  try {
    fn(doc);
  } finally {
    global.document = prev;
  }
}

test("renderBrandName: 文字模式只写 textContent，不创建图片", () => {
  withFakeDocument(doc => {
    const el = doc.createElement("span");
    renderBrandName(el, { kind: "text", text: "NekoHome Studio" }, "NekoHome");
    assert.strictEqual(el.textContent, "NekoHome Studio");
    assert.strictEqual(el.children.length, 0);
    assert.strictEqual(doc.created.length, 1); // 仅测试自身创建的 span
  });
});

test("renderBrandName: 位图模式清空文字并插入带 alt 的 img", () => {
  withFakeDocument(doc => {
    const el = doc.createElement("span");
    el.textContent = "旧文字";
    renderBrandName(el, { kind: "image", src: "assets/brand.webp", alt: "Neko 品牌", height: 32 }, "NekoHome");
    assert.strictEqual(el.textContent, "");
    assert.strictEqual(el.children.length, 1);
    const img = el.children[0];
    assert.strictEqual(img.tagName, "IMG");
    assert.strictEqual(img.src, "assets/brand.webp");
    assert.strictEqual(img.alt, "Neko 品牌");
    assert.strictEqual(img.style.height, "32px");
  });
});

test("renderBrandName: 位图无 height 时不写内联高度（交给 CSS）", () => {
  withFakeDocument(doc => {
    const el = doc.createElement("span");
    renderBrandName(el, { kind: "image", src: "assets/brand.webp", alt: "NekoHome", height: null }, "NekoHome");
    assert.strictEqual(el.children[0].style.height, undefined);
  });
});

test("renderBrandName: 位图加载失败时移除图片并退回文字", () => {
  withFakeDocument(doc => {
    const el = doc.createElement("span");
    renderBrandName(el, { kind: "image", src: "assets/gone.webp", alt: "Neko 品牌", height: null }, "NekoHome");
    const img = el.children[0];
    img.handlers.error();
    assert.strictEqual(img.removed, true);
    assert.strictEqual(el.textContent, "Neko 品牌");
  });
});

test("renderBrandName: 位图失败且无 alt 时退回 studioName", () => {
  withFakeDocument(doc => {
    const el = doc.createElement("span");
    renderBrandName(el, { kind: "image", src: "assets/gone.webp", alt: "", height: null }, "NekoHome");
    el.children[0].handlers.error();
    assert.strictEqual(el.textContent, "NekoHome");
  });
});

/* ---------- 内联 SVG 渲染：fake fetch / DOMParser ---------- */

async function withFakeSvgEnv({ ok = true, svgText = "<svg/>", documentElement = null, parsed = [] }, fn) {
  const prevDoc = global.document;
  const prevParser = global.DOMParser;
  const prevFetch = global.fetch;
  const doc = makeFakeDocument();
  global.document = doc;
  global.DOMParser = class {
    parseFromString(text) {
      parsed.push(text);
      return { documentElement: documentElement || makeFakeElement("parsererror") };
    }
  };
  global.fetch = async () => ({ ok, status: ok ? 200 : 500, text: async () => svgText });
  try {
    await fn(doc);
  } finally {
    global.document = prevDoc;
    global.DOMParser = prevParser;
    global.fetch = prevFetch;
  }
}

test("renderBrandName: svg 内联注入、去掉固定宽高、id 加前缀并设置无障碍属性", async () => {
  const svgNode = makeFakeElement("svg");
  svgNode.attributes.width = "100%";
  svgNode.attributes.height = "100%";
  const parsed = [];
  await withFakeSvgEnv({
    documentElement: svgNode,
    svgText: '<svg><filter id="boldMain"/><g filter="url(#boldMain)"/></svg>',
    parsed
  }, async doc => {
    const el = doc.createElement("span");
    el.textContent = "旧文字";
    await renderBrandName(el, { kind: "svg", src: "assets/logo-title.svg", alt: "NekoHome", height: 28 }, "NekoHome");
    assert.strictEqual(el.textContent, "");
    assert.strictEqual(el.children.length, 1);
    assert.strictEqual(el.children[0], svgNode);
    assert.strictEqual(svgNode.imported, true);
    assert.strictEqual(svgNode.getAttribute("width"), null);
    assert.strictEqual(svgNode.getAttribute("height"), null);
    assert.strictEqual(svgNode.style.height, "28px");
    assert.strictEqual(svgNode.getAttribute("role"), "img");
    assert.strictEqual(svgNode.getAttribute("aria-label"), "NekoHome");
    assert.match(parsed[0], /id="neko-name-\d+-boldMain"/);
    assert.match(parsed[0], /url\(#neko-name-\d+-boldMain\)/);
  });
});

test("renderBrandName: svg 无 alt 时标记为装饰性图像", async () => {
  const svgNode = makeFakeElement("svg");
  await withFakeSvgEnv({ documentElement: svgNode }, async doc => {
    const el = doc.createElement("span");
    await renderBrandName(el, { kind: "svg", src: "assets/logo.svg", alt: "", height: null }, "NekoHome");
    assert.strictEqual(svgNode.getAttribute("aria-hidden"), "true");
    assert.strictEqual(svgNode.getAttribute("role"), null);
  });
});

test("renderBrandName: svg 读取失败时退回文字", async () => {
  await withFakeSvgEnv({ ok: false }, async doc => {
    const el = doc.createElement("span");
    await renderBrandName(el, { kind: "svg", src: "assets/gone.svg", alt: "Neko 品牌", height: null }, "NekoHome");
    assert.strictEqual(el.textContent, "Neko 品牌");
    assert.strictEqual(el.children.length, 0);
  });
});

test("renderBrandName: svg 解析失败时退回文字", async () => {
  await withFakeSvgEnv({ documentElement: makeFakeElement("parsererror") }, async doc => {
    const el = doc.createElement("span");
    await renderBrandName(el, { kind: "svg", src: "assets/bad.svg", alt: "", height: null }, "NekoHome");
    assert.strictEqual(el.textContent, "NekoHome");
    assert.strictEqual(el.children.length, 0);
  });
});
