import test from "node:test";
import assert from "node:assert/strict";
import { makeProjector, toViewer } from "../src/camera.js";
import { paint, RULE, VIEW } from "../src/painter.js";

const scene = { S: 100, zm: 0, zr: [0, 1] };

test("camera: the middle of the page, and which way each axis goes", () => {
  const P = makeProjector({ azimuth: 0, tilt: 0.5 }, scene);
  assert.deepEqual(P(0, 0, 0), [300, 300]);
  assert.deepEqual(P(1, 0, 0), [400, 300]);                                    // x runs right
  assert.deepEqual(P(0, 1, 0), [300, 350]);                                    // y runs toward the viewer, squashed by tilt
  const up = P(0, 0, 1);
  assert.ok(up[1] < 300 && Math.abs(up[1] - (300 - 100 * Math.sqrt(0.75))) < 1e-9);   // z runs up the page
});

test("camera: zm is the height that lands mid-page", () => {
  const P = makeProjector(VIEW, { ...scene, zm: 0.4 });
  assert.equal(P(0, 0, 0.4)[1], 300);
});

test("toViewer: at azimuth 0 the viewer is along +y", () => {
  const [s, c] = toViewer({ azimuth: 0 });
  assert.ok(Math.abs(s) < 1e-12 && Math.abs(c - 1) < 1e-12);
});

const square = (z) => ({ z, loops: [[[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]] });
const count = (s, re) => (s.match(re) || []).length;

test("painter: a sheet is one fill and at least one stroke, with no NaN", () => {
  const out = paint([{ sh: square(0.5), off: [0, 0, 0] }], scene);
  assert.equal(count(out, /class="fill"/g), 1);
  assert.ok(count(out, /class="ln"/g) >= 1);
  assert.ok(!/NaN|undefined/.test(out));
});

test("painter: a hole is a second subpath of the same fill", () => {
  const ring = { z: 0.5, loops: [square(0).loops[0], square(0).loops[0].map(([x, y]) => [x * 0.4, y * 0.4])] };
  const fill = paint([{ sh: ring, off: [0, 0, 0] }], scene).match(/class="fill" d="([^"]*)"/)[1];
  assert.equal(count(fill, /M/g), 2);
});

test("painter: sheets that are far off the page are skipped", () => {
  assert.equal(paint([{ sh: square(0.5), off: [0, 0, 20] }], scene), "");
});

test("painter: a pulse makes strokes heavier", () => {
  const widest = (s) => Math.max(...[...s.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => +m[1]));
  const calm = widest(paint([{ sh: square(0.5), off: [0, 0, 0] }], scene, VIEW, RULE, 1));
  const flash = widest(paint([{ sh: square(0.5), off: [0, 0, 0] }], scene, VIEW, RULE, 2));
  assert.ok(flash > calm);
});

test("painter: lower sheets are fainter than higher ones when fade is on", () => {
  const opacities = (s) => [...s.matchAll(/stroke-opacity="([\d.]+)"/g)].map((m) => +m[1]);
  const low = Math.max(...opacities(paint([{ sh: square(0.02), off: [0, 0, 0] }], scene, VIEW, { ...RULE, fade: 1 })));
  const high = Math.max(...opacities(paint([{ sh: square(0.98), off: [0, 0, 0] }], scene, VIEW, { ...RULE, fade: 1 })));
  assert.ok(low < high);
});

test("painter: an edge along a diagonal turn draws, and does not hang (a facing a hair over 1 once made the stroke weight NaN)", () => {
  // the edge from the sewing machine that did it: at -135° it faces you by 1.0000000000000002
  const d = [0.005190888719525777, -0.005190888719525763], diamond = { z: 0.5, loops: [[[0, 0], d, [d[0] + d[1], d[1] - d[0]], [d[1], -d[0]]]] };
  for (const azimuth of [-135, -45, 45, 135]) {
    const out = paint([{ sh: diamond, off: [0, 0, 0] }], scene, { azimuth, tilt: 0.5 });
    assert.ok(count(out, /class="ln"/g) >= 1 && !/NaN|undefined/.test(out), `azimuth ${azimuth}`);
  }
});
