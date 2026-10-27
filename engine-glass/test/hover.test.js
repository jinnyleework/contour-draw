import test from "node:test";
import assert from "node:assert/strict";
import { createCursor, aim, release, stepCursor } from "../src/pointer.js";
import { SPLIT, LEVELS, splitShift } from "../src/split.js";
import { paint, RULE, VIEW } from "../src/painter.js";

const run = (c, seconds, reduced = false) => { let moving = true; for (let t = 0; t < seconds * 60 && moving; t++) moving = stepCursor(c, 1 / 60, reduced); return moving; };

test("cursor: on entering it appears under the pointer instead of flying in", () => {
  const c = createCursor();
  aim(c, 500, 80);
  assert.equal(c.x, 500);
  assert.equal(c.y, 80);
  assert.equal(c.ts, 1);
});

test("cursor: it follows the pointer, lagging first and then settling on it", () => {
  const c = createCursor();
  aim(c, 100, 100); run(c, 2);
  aim(c, 300, 200);
  stepCursor(c, 1 / 60);
  assert.ok(c.x > 100 && c.x < 300);                                            // lags
  assert.equal(run(c, 4), false);                                               // and comes to rest
  assert.ok(Math.abs(c.x - 300) < 0.2 && Math.abs(c.y - 200) < 0.2);
});

test("cursor: strength rises on entering and falls on leaving", () => {
  const c = createCursor();
  aim(c, 200, 200); run(c, 2);
  assert.ok(Math.abs(c.s - 1) < 0.01);
  release(c); run(c, 3);
  assert.ok(Math.abs(c.s) < 0.01);
});

test("cursor: a long frame does not make it blow up", () => {
  const c = createCursor();
  aim(c, 0, 0); aim(c, 600, 600);
  for (let i = 0; i < 200; i++) stepCursor(c, 0.05);
  assert.ok(Number.isFinite(c.x) && Math.abs(c.x - 600) < 1);
});

test("cursor: under reduced motion it lands at once", () => {
  const c = createCursor();
  aim(c, 100, 100); aim(c, 400, 250);
  assert.equal(stepCursor(c, 1 / 60, true), false);
  assert.deepEqual([c.x, c.y, c.s], [400, 250, 1]);
});

test("split: layers above the cursor lift, layers below drop, equally", () => {
  const up = splitShift(280, 300, 1), down = splitShift(320, 300, 1);
  assert.ok(up < 0 && down > 0);
  assert.ok(Math.abs(up + down) < 1e-9);
});

test("split: it is local, and it is off when the cursor is not there", () => {
  assert.equal(splitShift(300 + SPLIT.radius * 1.6 + 1, 300, 1), 0);            // beyond its reach
  assert.equal(splitShift(310, 300, 0), 0);                                     // no strength
  assert.ok(Math.abs(splitShift(310, 300, 1)) > Math.abs(splitShift(380, 300, 1)));   // weaker with distance
});

test("split: a higher intensity opens the gap wider", () => {
  const w = (i) => splitShift(320, 300, 1, { radius: 60, intensity: i });
  assert.ok(w(LEVELS.low) < w(LEVELS.medium) && w(LEVELS.medium) < w(LEVELS.high));
  assert.ok(Math.abs(w(0.5) - splitShift(320, 300, 1, { radius: 60, intensity: "0.5" })) < 1e-12);   // a numeric string is read
  assert.equal(w(NaN), w(0.5));                                                                         // not a number: the default
});

test("split: layers never cross, at any gap or reach", () => {
  for (const radius of [20, 60, 140]) for (const intensity of [0, 0.25, 0.5, 0.75, 1]) {
    let prev = -Infinity;
    for (let cy = 300 - radius * 1.7; cy <= 300 + radius * 1.7; cy += 0.5) {
      const moved = cy + splitShift(cy, 300, 1, { radius, intensity });
      assert.ok(moved > prev, `radius ${radius} intensity ${intensity} at ${cy}`);
      prev = moved;
    }
  }
});

const square = (z) => ({ z, loops: [[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]] });
const scene = { S: 100, zm: 0, zr: [0, 1] };
const ys = (out) => [...out.match(/class="fill" d="([^"]*)"/)[1].matchAll(/ (-?[\d.]+)(?=[LZ])/g)].map((m) => +m[1]);

test("painter: a shift moves the whole sheet by that much, and nothing else", () => {
  const still = paint([{ sh: square(0.5), off: [0, 0, 0] }], scene, VIEW, RULE, 1, null);
  const moved = paint([{ sh: square(0.5), off: [0, 0, 0] }], scene, VIEW, RULE, 1, () => 12);
  const a = ys(still), b = ys(moved);
  assert.equal(a.length, 4);
  a.forEach((y, i) => assert.ok(Math.abs(b[i] - y - 12) < 0.011));
  assert.equal(paint([{ sh: square(0.5), off: [0, 0, 0] }], scene, VIEW, RULE, 1, () => 0), still);
});

test("painter: the shift is given the sheet's middle height on the page", () => {
  let seen = null;
  paint([{ sh: square(0.5), off: [0, 0, 0] }], scene, VIEW, RULE, 1, (cy) => { seen = cy; return 0; });
  assert.ok(seen > 200 && seen < 400);
});
