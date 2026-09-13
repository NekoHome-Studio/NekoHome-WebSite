/* hero-grid.js 运动数学的纯函数测试（无 DOM 依赖）
   运行：node --test tests/ */
"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { falloff, springStep } = require("../js/hero-grid.js");

test("falloff: 圆心处为 1，半径及范围外为 0", () => {
  assert.strictEqual(falloff(0, 150), 1);
  assert.strictEqual(falloff(150, 150), 0);
  assert.strictEqual(falloff(500, 150), 0);
  assert.strictEqual(falloff(-10, 150), 1);
});

test("falloff: 半径内单调不增，且最大位移不超过 MAX_SHIFT 的系数上限", () => {
  let prev = Infinity;
  for (let d = 0; d <= 150; d += 5) {
    const v = falloff(d, 150);
    assert.ok(v <= prev + 1e-12, `d=${d} 应不增`);
    assert.ok(v >= 0 && v <= 1, `d=${d} 应在 [0,1]`);
    prev = v;
  }
});

test("falloff: 非法半径安全返回 0", () => {
  assert.strictEqual(falloff(10, 0), 0);
  assert.strictEqual(falloff(10, -5), 0);
});

test("springStep: 从静止出发、目标为 0 时保持静止（不自发渲染）", () => {
  const [v, vel] = springStep(0, 0, 0, 0.09, 0.78);
  assert.strictEqual(v, 0);
  assert.strictEqual(vel, 0);
});

test("springStep: 向目标收敛且低过振幅阈值后可视为静止", () => {
  let v = 0, vel = 0;
  for (let i = 0; i < 300; i++) [v, vel] = springStep(v, vel, 1, 0.09, 0.78);
  assert.ok(Math.abs(v - 1) < 0.0015, `收敛后 v=${v} 应贴近 1`);
  assert.ok(Math.abs(vel) < 0.0015, `收敛后 vel=${vel} 应贴近 0`);
});

test("springStep: 回弹过程稳定不发散", () => {
  let v = 1, vel = 0;
  for (let i = 0; i < 500; i++) {
    [v, vel] = springStep(v, vel, 0, 0.09, 0.78);
    assert.ok(Number.isFinite(v) && Number.isFinite(vel));
    assert.ok(Math.abs(v) <= 2, `第 ${i} 步越界: ${v}`);
  }
  assert.ok(Math.abs(v) < 0.0015, "最终应回弹到 0 附近");
});
