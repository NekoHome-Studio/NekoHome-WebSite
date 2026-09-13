/* ============================================================
   NekoHome 工作室 · hero-grid.js
   首页淡网格的动态增强：精细指针（鼠标）悬停时，指针附近的
   网格线轻微弯曲（半径 150px、单点最大位移 6px，弹簧缓动），
   离开后平滑回弹、静止后完全停止渲染；无光晕 / 粒子 / 拖尾。
   滚动 / 失焦清零后，指针仍在 hero 内的一次移动即就地重新激活，
   无需重新进入或点击；页面隐藏或 hero 滚出视口时立即停摆归零。
   触屏 / 粗指针 / prefers-reduced-motion 始终保持静态 CSS 网格
   （css/style.css 的 .hero::after），本文件加载失败亦同。
   ============================================================ */

"use strict";

(function () {

  /* ---------- 可调参数（未接入 config.json，改动集中于此） ---------- */
  const SPACING = 64;        // 网格间距（CSS px），与 .hero::after 的 background-size 一致
  const LINE_FALLBACK = "rgba(235, 233, 228, .06)"; // 与 --grid-line 同值，取不到变量时兜底
  const RADIUS = 150;        // 扰动半径（CSS px）
  const MAX_SHIFT = 6;       // 单点最大位移（CSS px）
  const SAMPLE_STEP = 14;    // 沿线采样步长（CSS px），越小曲线越顺滑
  const SPRING_STIFF = 0.09; // 弹簧刚度（0~1，越大回弹越快）
  const SPRING_DAMP = 0.78;  // 弹簧阻尼（0~1）
  const MOUSE_LERP = 0.35;   // 指针位置平滑系数
  const DPR_CAP = 2;         // 画布像素比上限
  const SETTLE_EPS = 0.0015; // 低于此振幅视为静止，停止渲染

  /* ---------- 纯函数（无 DOM 依赖，供 tests/hero-grid.test.cjs 使用） ---------- */

  /** 余弦衰减：圆心处 1，半径边缘平滑落到 0；范围外恒为 0 */
  function falloff(dist, radius) {
    if (radius <= 0) return 0;
    if (dist <= 0) return 1;
    if (dist >= radius) return 0;
    return 0.5 * (1 + Math.cos(Math.PI * dist / radius));
  }

  /** 显式欧拉弹簧步进：返回 [新位置, 新速度] */
  function springStep(value, velocity, target, stiff, damp) {
    velocity = (velocity + (target - value) * stiff) * damp;
    return [value + velocity, velocity];
  }

  // Node 环境下仅导出纯函数（CommonJS），不触碰 DOM
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { falloff, springStep };
    return;
  }

  /* ---------- 环境判定与元素 ---------- */
  const hero = document.querySelector(".hero");
  const canvas = document.getElementById("hero-grid");
  if (!hero || !canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return; // 无 2D 上下文：静态网格兜底

  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- 运行状态 ---------- */
  let cssW = 0, cssH = 0;
  let lineColor = "";
  let energy = 0, velocity = 0, target = 0; // 扰动能量（弹簧状态）
  let mx = 0, my = 0;                        // 平滑后的指针位置（相对 hero）
  let tx = 0, ty = 0;                        // 目标指针位置
  let hovering = false;
  let rafId = 0, running = false;

  function gridColor() {
    const v = getComputedStyle(hero).getPropertyValue("--grid-line").trim();
    return v || LINE_FALLBACK;
  }

  /** 重建画布尺寸；重设 DPR 变换后内容被清空，由调用方决定是否重绘 */
  function rebuild() {
    const rect = hero.getBoundingClientRect();
    cssW = Math.max(1, Math.round(rect.width));
    cssH = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** 点 (px, py) 的位移偏移量：沿远离指针方向，余弦衰减 × 弹簧能量。
      能量钳制到 [0,1]：欠阻尼回弹会过冲（>1 或 <0），渲染位移绝不超上限、不倒向 */
  function disturb(px, py) {
    const amp = Math.min(1, Math.max(0, energy));
    if (amp === 0) return [0, 0];
    const dx = px - mx, dy = py - my;
    const dist = Math.hypot(dx, dy);
    const f = falloff(dist, RADIUS) * amp;
    if (f === 0) return [0, 0];
    const s = (f * MAX_SHIFT) / (dist || 1);
    return [dx * s, dy * s];
  }

  /** 完整绘制一次网格（含与 .hero::after 相同的径向渐隐蒙版） */
  function draw() {
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    ctx.beginPath();

    const reach = RADIUS + MAX_SHIFT; // 两端各多采样一点，弯曲不截断
    // 垂直线：固定 x，沿 y 采样
    for (let x = 0; x <= cssW; x += SPACING) {
      const n = Math.ceil((cssH + reach * 2) / SAMPLE_STEP);
      for (let i = 0; i <= n; i++) {
        const y = i * SAMPLE_STEP - reach;
        const [ox, oy] = disturb(x, y);
        if (i === 0) ctx.moveTo(x + ox, y + oy);
        else ctx.lineTo(x + ox, y + oy);
      }
    }
    // 水平线：固定 y，沿 x 采样
    for (let y = 0; y <= cssH; y += SPACING) {
      const n = Math.ceil((cssW + reach * 2) / SAMPLE_STEP);
      for (let i = 0; i <= n; i++) {
        const x = i * SAMPLE_STEP - reach;
        const [ox, oy] = disturb(x, y);
        if (i === 0) ctx.moveTo(x + ox, y + oy);
        else ctx.lineTo(x + ox, y + oy);
      }
    }
    ctx.stroke();

    // 径向渐隐（ellipse 70% 62% at 32% 45%，black 20% → transparent 80%）
    ctx.save();
    ctx.globalCompositeOperation = "destination-in";
    ctx.translate(cssW * 0.32, cssH * 0.45);
    ctx.scale(cssW * 0.7, cssH * 0.62);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, "rgba(0, 0, 0, 1)");
    g.addColorStop(0.2, "rgba(0, 0, 0, 1)");
    g.addColorStop(0.8, "rgba(0, 0, 0, 0)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  /* ---------- 渲染循环：移动与回弹期间绘制，静止即停 ---------- */
  let inView = true;

  function canDraw() {
    return hero.classList.contains("grid-live") && inView && !document.hidden;
  }

  function resetMotion() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    running = false;
    hovering = false;
    target = energy = velocity = 0;
    if (hero.classList.contains("grid-live") && !document.hidden) draw();
  }

  function tick() {
    rafId = 0;
    if (!canDraw()) {
      resetMotion();
      return;
    }
    [energy, velocity] = springStep(energy, velocity, target, SPRING_STIFF, SPRING_DAMP);
    mx += (tx - mx) * MOUSE_LERP;
    my += (ty - my) * MOUSE_LERP;
    const settled = Math.abs(energy - target) < SETTLE_EPS &&
      Math.abs(velocity) < SETTLE_EPS && Math.hypot(tx - mx, ty - my) < 0.05;
    if (settled) {
      energy = target;
      velocity = 0;
      mx = tx;
      my = ty;
    }
    draw();
    if (settled) {
      running = false;
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  function kick() {
    if (!running && canDraw()) {
      running = true;
      rafId = requestAnimationFrame(tick);
    }
  }

  /* ---------- 事件处理 ---------- */
  function toLocal(e) {
    const r = hero.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  function onEnter(e) {
    onMove(e);
  }

  function onMove(e) {
    if (e.pointerType !== "mouse" || !canDraw()) return;
    [tx, ty] = toLocal(e);
    if (!hovering) {
      hovering = true;
      target = 1;
      mx = tx;
      my = ty;
    }
    kick();
  }

  function onLeave() {
    if (!hovering) return;
    hovering = false;
    target = 0;
    kick();
  }

  // 滚动后坐标失效，回弹；下一次 pointermove 可直接重新激活。
  function onScroll() {
    onLeave();
  }

  function onVisibility() {
    if (document.hidden) resetMotion();
    else if (canDraw()) draw();
  }

  /* ---------- 监听器的挂载 / 移除 ---------- */
  function bind(on) {
    const m = on ? "addEventListener" : "removeEventListener";
    hero[m]("pointerenter", onEnter);
    hero[m]("pointermove", onMove);
    hero[m]("pointerleave", onLeave);
    window[m]("scroll", onScroll, { passive: true });
    window[m]("blur", resetMotion);
    document[m]("visibilitychange", onVisibility);
  }

  /* ---------- 启用 / 停用（媒体查询或初始化时调用） ---------- */
  function enable() {
    if (hero.classList.contains("grid-live")) return;
    lineColor = gridColor();
    rebuild();
    draw();
    hero.classList.add("grid-live");
    bind(true);
  }

  function disable() {
    if (!hero.classList.contains("grid-live")) return;
    hero.classList.remove("grid-live");
    bind(false);
    resetMotion();
  }

  function suitable() {
    return finePointer.matches && !reduceMotion.matches;
  }

  function sync() {
    if (suitable()) enable();
    else disable();
  }

  /* ---------- 尺寸与主题响应 ---------- */
  const ro = new ResizeObserver(() => {
    if (!hero.classList.contains("grid-live")) return;
    rebuild();
    resetMotion();
  });
  ro.observe(hero);

  new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    if (!inView) resetMotion();
    else if (canDraw()) draw();
  }).observe(hero);

  new MutationObserver(() => {
    if (!hero.classList.contains("grid-live")) return;
    const c = gridColor();
    if (c !== lineColor) {
      lineColor = c;
      if (canDraw()) draw();
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-bs-theme"] });

  /* ---------- 初始化 ---------- */
  finePointer.addEventListener("change", sync);
  reduceMotion.addEventListener("change", sync);
  sync();

})();
