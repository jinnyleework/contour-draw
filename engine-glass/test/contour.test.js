import test from "node:test";
import assert from "node:assert/strict";
import { contour } from "../src/contour.js";

/** a grid of n x n cells sampling f(i, j) */
const grid = (n, f) => { const a = new Float32Array((n + 1) * (n + 1)); for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) a[j * (n + 1) + i] = f(i, j); return a; };
const area = (l) => Math.abs(l.reduce((s, p, i) => { const q = l[(i + 1) % l.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;

test("an empty field has no loops", () => {
  assert.deepEqual(contour(grid(10, () => -1), 10, 10, 0), []);
});

test("a disc is one loop, at the right radius", () => {
  const n = 60, c = n / 2, R = 15, loops = contour(grid(n, (i, j) => R - Math.hypot(i - c, j - c)), n, n, 0);
  assert.equal(loops.length, 1);
  for (const [i, j] of loops[0]) assert.ok(Math.abs(Math.hypot(i - c, j - c) - R) < 0.05);
  assert.ok(Math.abs(area(loops[0]) - Math.PI * R * R) / (Math.PI * R * R) < 0.01);
});

test("a ring is two loops: the outside and the hole", () => {
  const n = 60, c = n / 2, loops = contour(grid(n, (i, j) => { const r = Math.hypot(i - c, j - c); return Math.min(20 - r, r - 8); }), n, n, 0);
  assert.equal(loops.length, 2);
  const [a, b] = loops.map(area).sort((x, y) => y - x);
  assert.ok(Math.abs(a - Math.PI * 400) / (Math.PI * 400) < 0.02);
  assert.ok(Math.abs(b - Math.PI * 64) / (Math.PI * 64) < 0.03);
});

test("two separate blobs are two loops", () => {
  const n = 60, f = (i, j) => Math.max(6 - Math.hypot(i - 15, j - 30), 6 - Math.hypot(i - 45, j - 30));
  assert.equal(contour(grid(n, f), n, n, 0).length, 2);
});

test("a rectangular grid works", () => {
  const nx = 40, ny = 20, a = new Float32Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) a[j * (nx + 1) + i] = 6 - Math.hypot(i - 20, j - 10);
  const loops = contour(a, nx, ny, 0);
  assert.equal(loops.length, 1);
  for (const [i, j] of loops[0]) assert.ok(i >= 0 && i <= nx && j >= 0 && j <= ny);
});

test("a saddle cell is settled by its centre, without hanging", () => {
  // two blobs touching at the corners of one cell; the border is outside, so every line closes
  const f = grid(3, (i, j) => ((i === 1 && j === 1) || (i === 2 && j === 2) ? 1 : -1));
  const joined = contour(f, 3, 3, -0.5);                                       // centre value 0 is above -0.5: the blobs join
  const apart = contour(f, 3, 3, 0.5);                                         // centre value 0 is below 0.5: they stay two
  assert.equal(joined.length, 1);
  assert.equal(apart.length, 2);
  for (const l of [...joined, ...apart]) assert.ok(l.length > 3 && l.every((p) => p.every(Number.isFinite)));
});
