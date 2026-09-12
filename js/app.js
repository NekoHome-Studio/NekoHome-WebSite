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

/* ---------- 启动 ---------- */
(async function init() {
  $("#year").textContent = new Date().getFullYear();
  initTheme();
  initNav();
  initParallax();
  initReveal();
  initRepos();
  initCopy();

  const cfg = await loadConfig();
  applyConfig(cfg);
  // 文案填充后导航宽度可能变化，重新定位指示器
  moveIndicator($(".nav-link.is-active"));
})();
