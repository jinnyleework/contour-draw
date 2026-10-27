import test from "node:test";
import assert from "node:assert/strict";
import { planes, slicePart, sheetsOf, simplifyLoop, TOLERANCE, GAP } from "../src/slice.js";

const area = (l) => Math.abs(l.reduce((s, p, i) => { const q = l[(i + 1) % l.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const sphere = (R) => ({ id: "s", order: 0, box: { x: [-1, 1], y: [-1, 1] }, planes: planes(-1, 1), sdf: (x, y, z) => Math.hypot(x, y, z) - R });

test("planes: about `gap` apart, inside the range, never fewer than two", () => {
  const p = planes(-1, 1);
  assert.ok(Math.abs(p.length - 2 / GAP) <= 1);
  assert.ok(p.every((z) => z > -1 && z < 1));
  assert.ok(Math.abs(p[1] - p[0] - 2 / p.length) < 1e-9);
  assert.equal(planes(0, 0.001).length, 2);
});

test("a sphere's sheets are circles that shrink toward the poles", () => {
  const R = 0.8, sheets = slicePart(sphere(R));
  assert.ok(sheets.length > 40);
  for (const sh of sheets) {
    assert.equal(sh.loops.length, 1);
    const r = Math.sqrt(R * R - sh.z * sh.z);
    if (r < 0.1) continue;                                                    // tiny caps are too coarse to measure
    assert.ok(Math.abs(area(sh.loops[0]) - Math.PI * r * r) / (Math.PI * r * r) < 0.05, `z ${sh.z}`);
  }
  assert.ok(sheets.every((sh) => Math.abs(sh.z) < R));                         // nothing is cut where the sphere is not
});

test("a hollow shell gives two loops through its middle", () => {
  const shell = { ...sphere(0.8), sdf: (x, y, z) => Math.max(Math.hypot(x, y, z) - 0.8, 0.7 - Math.hypot(x, y, z)) };
  const mid = slicePart(shell).find((sh) => Math.abs(sh.z) < 0.05);
  assert.equal(mid.loops.length, 2);
});

test("a static part is cut once; a dynamic part is cut again only when its key changes", () => {
  const stat = sphere(0.5);
  assert.equal(sheetsOf(stat), sheetsOf(stat));
  const dyn = { ...sphere(0.5), dynamic: true, key: (p) => (p ? String(p.r) : ""), sdf: (x, y, z, p) => Math.hypot(x, y, z) - p.r };
  const a = sheetsOf(dyn, { r: 0.4 }), b = sheetsOf(dyn, { r: 0.4 }), c = sheetsOf(dyn, { r: 0.6 });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.ok(c.length > a.length);                                              // the bigger sphere is cut at more heights
  assert.deepEqual(sheetsOf(dyn, null), []);                                   // switched off
});

const circle = (r, n) => Array.from({ length: n }, (_, i) => [r * Math.cos((i / n) * 2 * Math.PI), r * Math.sin((i / n) * 2 * Math.PI)]);

test("simplifyLoop: far fewer points, and the shape moves by less than the tolerance", () => {
  const dense = circle(0.3, 400), thin = simplifyLoop(dense);
  assert.ok(thin.length < dense.length / 4, `${thin.length} of ${dense.length}`);
  const distTo = (p) => Math.min(...dense.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1])));
  assert.ok(thin.every((p) => distTo(p) < 1e-9));                                                       // it only drops points, never moves one
  assert.ok(Math.abs(area(thin) - area(dense)) / area(dense) < 0.01);                                   // and the area is about the same
});

test("simplifyLoop: a straight run collapses, a small loop is left alone, a corner survives", () => {
  const square = [];
  for (let i = 0; i < 40; i++) square.push([i / 40, 0]);
  for (let i = 0; i < 40; i++) square.push([1, i / 40]);
  for (let i = 0; i < 40; i++) square.push([1 - i / 40, 1]);
  for (let i = 0; i < 40; i++) square.push([0, 1 - i / 40]);
  const thin = simplifyLoop(square);
  assert.ok(thin.length <= 8, String(thin.length));                                                    // four corners, and a point or so besides
  assert.ok(thin.some((p) => p[0] === 1 && p[1] === 0) && thin.some((p) => p[0] === 0 && p[1] === 1));
  const tiny = circle(0.1, 6);
  assert.equal(simplifyLoop(tiny), tiny);
  assert.ok(TOLERANCE > 0 && TOLERANCE < 0.005);
});

test("a thin part needs a finer cell: a rod a few cells wide traces cleanly only when its part asks for one", () => {
  const rod = { id: "r", order: 0, box: { x: [-0.1, 0.1], y: [-0.1, 0.1] }, planes: planes(0, 0.1), sdf: (x, y) => Math.hypot(x, y) - 0.012 };
  const fine = slicePart({ ...rod, cell: 0.004 });
  assert.ok(fine.length > 0);
  for (const sh of fine) assert.ok(Math.abs(area(sh.loops[0]) - Math.PI * 0.012 ** 2) / (Math.PI * 0.012 ** 2) < 0.1);
});
