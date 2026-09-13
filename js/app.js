/* ============================================================
   NekoHome 工作室 · app.js
   主题切换 / 配置加载 / 导航指示器 / 首页视差 / GitHub 解析 / 复制
   ============================================================ */

"use strict";

/* ---------- 工具 ---------- */
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, ch => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[ch]));
const getPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Toast 提示 ---------- */
let toastTimer = null;
function showToast(msg) {
  const toast = $("#toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

/* ---------- 深浅色主题切换 ---------- */
const THEME_KEY = "neko-theme";
let themeTimer = null;

function applyTheme(theme, animate = true) {
  const root = document.documentElement;
  if (animate && !reduceMotion) {
    root.classList.add("theme-anim");
    clearTimeout(themeTimer);
    themeTimer = setTimeout(() => root.classList.remove("theme-anim"), 500);
  }
  root.setAttribute("data-bs-theme", theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* 隐私模式下忽略 */ }
}

function initTheme() {
  $("#theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-bs-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    showToast(next === "dark" ? "已切换到深色模式" : "已切换到浅色模式");
  });
  // 用户未手动选择过主题时，跟随系统变化
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch { /* 忽略 */ }
  if (!saved) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", e => {
      applyTheme(e.matches ? "dark" : "light");
    });
  }
}

/* ---------- 加入页图标（config.json 的 join.cards[].icon 按名取用） ---------- */
const JOIN_ICONS = {
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
};

/* ---------- 站点配置（data/config.json） ---------- */
async function loadConfig() {
  try {
    const res = await fetch("data/config.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch (err) {
    console.warn("[config] 读取 data/config.json 失败：", err);
    return null;
  }
}

function applyConfig(cfg) {
  if (!cfg) return;
  $$("[data-cfg]").forEach(el => {
    const v = getPath(cfg, el.dataset.cfg);
    if (typeof v === "string") el.textContent = v;
  });
  $$("[data-cfg-list]").forEach(el => {
    const v = getPath(cfg, el.dataset.cfgList);
    if (Array.isArray(v)) el.innerHTML = v.map(p => `<p>${esc(p)}</p>`).join("");
  });
  $$("[data-cfg-tags]").forEach(el => {
    const v = getPath(cfg, el.dataset.cfgTags);
    if (Array.isArray(v)) el.innerHTML = v.map(t => `<li>${esc(t)}</li>`).join("");
  });
  if (cfg.studioName) document.title = cfg.studioName;
  if (cfg.qqGroup) {
    $("#qq-number").textContent = cfg.qqGroup;
    $("#copy-qq").dataset.text = cfg.qqGroup;
  }
  if (cfg.qqJoinUrl) $("#qq-join").href = cfg.qqJoinUrl;
  if (cfg.icp) $("#icp-link").textContent = cfg.icp;

  // 背景图路径与遮罩强度（首页 / 其它页分开可调，0~1）
  // 注意：Chromium 按「使用变量的样式表」解析变量内相对 url()，必须先转绝对路径
  const rootEl = document.documentElement;
  if (typeof cfg.background === "string" && cfg.background) {
    const abs = new URL(cfg.background, document.baseURI).href;
    rootEl.style.setProperty("--bg-image", `url("${abs}")`);
  }
  if (cfg.mask) {
    if (typeof cfg.mask.hero === "number") rootEl.style.setProperty("--mask-hero-op", String(cfg.mask.hero));
    if (typeof cfg.mask.panel === "number") rootEl.style.setProperty("--panel-op", String(cfg.mask.panel));
  }

  // 图片路径（顶栏 / 页脚图标分离可配）
  $$("[data-cfg-src]").forEach(el => {
    const v = getPath(cfg, el.dataset.cfgSrc);
    if (typeof v === "string") el.src = v;
  });

  // 首页主标题字号（clamp 三段：最小值 / 视口比例 / 最大值）
  if (cfg.hero) {
    const h = cfg.hero;
    const clamp = `clamp(${h.titleMinPx ?? 44}px, ${h.titleVw ?? 10}vw, ${h.titleMaxPx ?? 100}px)`;
    document.documentElement.style.setProperty("--hero-title-size", clamp);
  }

  // 版权声明模板：{year} / {name} 占位符自动替换
  if (typeof cfg.copyright === "string") {
    const text = cfg.copyright
      .split("{year}").join(String(new Date().getFullYear()))
      .split("{name}").join(cfg.studioName || "");
    $$('[data-cfg="copyright"]').forEach(el => (el.textContent = text));
  }

  // 加入页：理由卡片（icon 支持 chat / code / eye 等内置图标名）
  const cards = getPath(cfg, "join.cards");
  const joinGrid = $("#join-cards");
  if (Array.isArray(cards) && joinGrid) {
    joinGrid.innerHTML = cards.map((c, i) => `
      <div class="col-md-4 reveal" style="--d: ${(i * 0.08).toFixed(2)}s">
        <div class="join-card">
          <span class="join-icon">${JOIN_ICONS[c.icon] || JOIN_ICONS.chat}</span>
          <h3>${esc(c.title)}</h3>
          <p>${esc(c.text)}</p>
        </div>
      </div>`).join("");
  }
}

/* ---------- 顶栏滑动指示器 & 当前页高亮 ---------- */
const topbar = $("#topbar");
const navLinks = $$(".nav-link");
const indicator = $(".nav-indicator");
const navSections = navLinks.map(l => $(l.getAttribute("href")));

function moveIndicator(link) {
  if (!link) return;
  indicator.style.left = link.offsetLeft + "px";
  indicator.style.width = link.offsetWidth + "px";
  indicator.style.opacity = "1";
}

function setActive(id) {
  const link = navLinks.find(l => l.getAttribute("href") === "#" + id);
  if (!link || link.classList.contains("is-active")) return;
  navLinks.forEach(l => l.classList.toggle("is-active", l === link));
  moveIndicator(link);
}

function updateActive() {
  const mid = window.scrollY + window.innerHeight / 2;
  let current = navSections[0].id;
  for (const sec of navSections) {
    if (sec.offsetTop <= mid) current = sec.id;
  }
  setActive(current);
}

function initNav() {
  const reposition = () => moveIndicator($(".nav-link.is-active"));
  window.addEventListener("resize", reposition);
  window.addEventListener("load", reposition);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(reposition);
  reposition();
}

/* ---------- 首页大字视差：滚动时缩小、上移、渐隐 ---------- */
function initParallax() {
  const heroInner = $(".hero-inner");
  const scrollHint = $(".scroll-hint");
  let ticking = false;

  function frame() {
    const y = window.scrollY;
    topbar.classList.toggle("scrolled", y > 8);
    if (!reduceMotion) {
      const vh = window.innerHeight;
      const p = Math.min(Math.max(y / vh, 0), 1);
      heroInner.style.transform = `translate3d(0, ${(-y * 0.42).toFixed(1)}px, 0) scale(${(1 - p * 0.42).toFixed(3)})`;
      heroInner.style.opacity = Math.max(0, 1 - p * 1.05).toFixed(3);
      scrollHint.style.opacity = Math.max(0, 1 - p * 3).toFixed(3);
    }
    updateActive();
    ticking = false;
  }

  window.addEventListener("scroll", () => {
    if (!ticking) { ticking = true; requestAnimationFrame(frame); }
  }, { passive: true });
  frame();
}

/* ---------- 惯性平滑滚动（Lenis）+ 页面吸附 ----------
   - 滚轮带惯性；触摸保持原生（移动端自带惯性）
   - 停稳后轻微吸附到最近的整屏页面
   - 第 4 页「加入我们」与页脚不参与吸附
   - 降级：Lenis 未加载 / 用户偏好减少动效 → 原生平滑 + CSS 吸附 */
function initSmoothScroll(cfg) {
  // 滚动手感参数：config.json 的 scroll 段优先，缺项用默认值兜底
  const sc = Object.assign({
    lerp: 0.1,             // 惯性系数（0~1，越小越"糯"）
    wheelMultiplier: 1,    // 滚轮速度倍率
    anchorDuration: 1.15,  // 导航锚点跳转时长（秒）
    snapMaxDist: 0.2,      // 吸附触发距离（单位：视口高度）
    snapDelay: 150,        // 停稳判定延迟（毫秒）
    snapVelocity: 0.05,    // 吸附速度阈值
    snapDuration: 0.9      // 吸附动画时长（秒）
  }, (cfg && cfg.scroll) || {});

  if (reduceMotion || typeof Lenis === "undefined") {
    document.documentElement.classList.add("native-scroll");
    return;
  }

  const lenis = new Lenis({ lerp: sc.lerp, wheelMultiplier: sc.wheelMultiplier });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // 锚点跳转交给 Lenis，保证惯性滚动体验一致
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener("click", e => {
      const hash = a.getAttribute("href");
      if (hash.length < 2) return;
      const el = $(hash);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, { duration: sc.anchorDuration, easing: t => 1 - Math.pow(1 - t, 4) });
    });
  });

  // 吸附点：仅前三个整屏页面（首页/关于/产品）
  const snapTargets = ["#home", "#about", "#products"].map(s => $(s).offsetTop);
  let lastVelocity = 0;
  let snapTimer = null;

  lenis.on("scroll", e => {
    lastVelocity = e.velocity;
    clearTimeout(snapTimer);
    // 停稳后判断是否需要吸附
    snapTimer = setTimeout(() => {
      if (Math.abs(lastVelocity) > sc.snapVelocity) return;
      const y = window.scrollY;
      const vh = window.innerHeight;
      let nearest = null, dist = Infinity;
      for (const top of snapTargets) {
        const d = Math.abs(top - y);
        if (d < dist) { dist = d; nearest = top; }
      }
      if (nearest == null || dist < 10 || dist > vh * sc.snapMaxDist) return;
      lenis.scrollTo(nearest, { duration: sc.snapDuration, easing: t => 1 - Math.pow(1 - t, 3) });
    }, sc.snapDelay);
  });
}

/* ---------- 各页面进场动画 ---------- */
function initReveal() {

  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add("in-view"); io.unobserve(e.target); }
    }
  }, { threshold: 0.15 });
  $$(".reveal").forEach(el => io.observe(el));
}

/* ---------- 产品页：读取 data/repos.json，经 GitHub API 解析仓库 ---------- */
const ICONS = {
  book: '<svg class="repo-book" viewBox="0 0 16 16" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.875-1.75a.25.25 0 0 0-.25-.25h-8a.25.25 0 0 0-.25.25V6.5h8.5V.75Z"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>',
  fork: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="4" cy="3" r="1.8" fill="currentColor" stroke="none"/><circle cx="4" cy="13" r="1.8" fill="currentColor" stroke="none"/><circle cx="12" cy="13" r="1.8" fill="currentColor" stroke="none"/><path d="M4 4.8v4.4M4 9.2c0 2.2 8-1.1 8 1.8v.9"/></svg>'
};

const fmtNum = n => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n));

function parseRepoUrl(url) {
  const m = String(url).trim().match(/github\.com\/([^/\s]+)\/([^/#?\s]+)/i);
  return m ? { owner: m[1], repo: m[2].replace(/\.git$/i, "") } : null;
}

async function fetchRepo(url) {
  const parsed = parseRepoUrl(url);
  if (!parsed) return { error: "链接格式不是 GitHub 仓库：" + url };
  try {
    const res = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`);
    if (res.status === 404) return { error: `仓库不存在：${parsed.owner}/${parsed.repo}` };
    if (res.status === 403) return { error: "GitHub API 访问频率受限，请稍后再试" };
    if (!res.ok) return { error: `请求失败（HTTP ${res.status}）` };
    const d = await res.json();
    return {
      name: d.full_name,
      desc: d.description || "这个仓库还没有简介 ~",
      stars: d.stargazers_count,
      forks: d.forks_count,
      url: d.html_url
    };
  } catch {
    return { error: "网络异常，无法连接 GitHub API" };
  }
}

function repoCard(r) {
  if (r.error) {
    return `<div class="col-md-6 col-lg-4"><div class="repo-card repo-error"><strong>加载失败</strong><p>${esc(r.error)}</p></div></div>`;
  }
  return `<div class="col-md-6 col-lg-4">
    <a class="repo-card" href="${esc(r.url)}" target="_blank" rel="noopener">
      <div class="repo-head">${ICONS.book}<span class="repo-name">${esc(r.name)}</span></div>
      <p class="repo-desc">${esc(r.desc)}</p>
      <div class="repo-foot">
        <span class="repo-stat">${ICONS.star}${fmtNum(r.stars)}</span>
        <span class="repo-stat">${ICONS.fork}${fmtNum(r.forks)}</span>
        <span class="repo-link">GitHub ↗</span>
      </div>
    </a></div>`;
}

function errorCard(title, msg, retry) {
  return `<div class="col-12"><div class="repo-card repo-error"><strong>${esc(title)}</strong><p>${esc(msg)}</p>${retry ? '<button class="btn-ghost btn-sm" type="button" data-retry>重试</button>' : ""}</div></div>`;
}

function skeletons(n) {
  return Array.from({ length: n }, () => `<div class="col-md-6 col-lg-4"><div class="repo-card skeleton" aria-hidden="true">
    <div class="sk sk-title"></div>
    <div class="sk sk-line"></div>
    <div class="sk sk-line short"></div>
    <div class="sk sk-foot"></div>
  </div></div>`).join("");
}

async function loadRepos() {
  const grid = $("#repo-grid");
  let urls;
  try {
    const res = await fetch("data/repos.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    urls = await res.json();
  } catch {
    grid.innerHTML = errorCard("读取 data/repos.json 失败", "请通过本地服务器访问页面（直接双击以 file:// 打开时，浏览器会拦截本地文件请求）", true);
    return;
  }
  if (!Array.isArray(urls) || urls.length === 0) {
    grid.innerHTML = errorCard("暂无产品", "请在 data/repos.json 中添加 GitHub 仓库链接");
    return;
  }
  grid.innerHTML = skeletons(urls.length);
  const results = await Promise.all(urls.map(fetchRepo));
  grid.innerHTML = results.map(repoCard).join("");
}

function initRepos() {
  $("#repo-grid").addEventListener("click", e => {
    if (e.target.closest("[data-retry]")) loadRepos();
  });
  loadRepos();
}

/* ---------- QQ 群号复制 ---------- */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* 忽略 */ }
    ta.remove();
    return ok;
  }
}

function initCopy() {
  $("#copy-qq").addEventListener("click", async e => {
    const text = e.currentTarget.dataset.text || $("#qq-number").textContent.trim();
    const ok = await copyText(text);
    showToast(ok ? "QQ 群号已复制到剪贴板" : "复制失败，请手动复制");
  });
}

/* ---------- 首屏加载遮罩 ----------
   由 index.html 顶部内联常量 NK_LOADING_ENABLED 控制是否存在（关闭时节点渲染前即被隐藏）。
   存在则等 window load（3s 兜底防资源挂起）淡出移除。 */
function initLoader() {
  const overlay = $("#page-loading-overlay");
  if (!overlay) return;
  if (reduceMotion) { overlay.remove(); return; }

  const loaded = new Promise(res => {
    if (document.readyState === "complete") res();
    else window.addEventListener("load", res, { once: true });
  });
  const timeout = new Promise(res => setTimeout(res, 3000));
  Promise.race([loaded, timeout]).then(() => {
    overlay.classList.add("page-loading-overlay-hidden");
    setTimeout(() => overlay.remove(), 400);
  });
}

/* ---------- 启动 ---------- */
(async function init() {
  const cfgPromise = loadConfig();
  initTheme();
  initLoader();

  const cfg = await cfgPromise;
  applyConfig(cfg);

  initNav();
  initSmoothScroll(cfg);
  initParallax();
  initReveal();
  initRepos();
  initCopy();

  // 文案填充后导航宽度可能变化，重新定位指示器
  moveIndicator($(".nav-link.is-active"));
})();
