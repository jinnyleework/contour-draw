import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { sampleShape, inkLoops, inkField, loopArea, decodeMask, bitmapSdf } from "../src/ink.js";
import { sdCircle, sdBox, subtract } from "../src/math.js";
import { paint, RULE, PALETTE } from "../src/painter.js";
import { frame, prepare, pose, frameBox } from "../src/figure.js";
import { VIEW } from "../src/view.js";
import { SCENES } from "../figures/index.js";
import { encodeMask } from "../tools/trace.mjs";
import { modules } from "../tools/build.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
/** a look with every hand mark off: the ink is the shape itself */
const CLEAN = { ...RULE, pool: 0, spread: 0, wobble: 0, rough: 0, speckle: 0, dry: 0, scratch: 0 };
const P = 200;
const inked = (shape, rule = CLEAN) => inkLoops(sampleShape(shape, P), shape, rule);
const inkArea = (loops) => Math.abs(loops.reduce((a, l) => a + loopArea(l), 0));

test("a clean fill inks to the shape: one loop of about its area", () => {
  const loops = inked({ id: "disc", box: [-0.6, 0.6, -0.6, 0.6], sdf: (x, y) => sdCircle(x, y, 0, 0, 0.5) });
  assert.equal(loops.length, 1);
  assert.ok(Math.abs(Math.abs(loopArea(loops[0])) - Math.PI * 0.25) < 0.01);
});

test("a hole in a fill is a second loop: the painter's even-odd leaves it paper", () => {
  const ring = (x, y) => subtract(sdCircle(x, y, 0, 0, 0.5), sdCircle(x, y, 0, 0, 0.25));
  assert.equal(inked({ id: "ring", box: [-0.6, 0.6, -0.6, 0.6], sdf: ring }).length, 2);
});

test("a line is a band along the outline, about the line weight wide", () => {
  const loops = inked({ id: "o", mark: "line", box: [-0.6, 0.6, -0.6, 0.6], sdf: (x, y) => sdCircle(x, y, 0, 0, 0.5) }, { ...CLEAN, pressure: 0 });
  assert.equal(loops.length, 2);
  const band = inkArea(loops.slice(0, 1)) - inkArea(loops.slice(1)), expect = 2 * Math.PI * 0.5 * (RULE.line / P);
  assert.ok(Math.abs(Math.abs(band) - expect) / expect < 0.15, `band ${band} vs ${expect}`);
});

test("a hatch is many strokes, all inside the shape, covering part of it", () => {
  const box = { id: "h", mark: "hatch", box: [-0.6, 0.6, -0.6, 0.6], sdf: (x, y) => sdBox(x, y, 0, 0, 0.4, 0.4) };
  const loops = inked(box);
  assert.ok(loops.length > 10, `${loops.length} strokes`);
  for (const l of loops) for (const [x, y] of l) assert.ok(Math.abs(x) < 0.42 && Math.abs(y) < 0.42);
  const cover = inkArea(loops) / 0.64;
  assert.ok(cover > 0.15 && cover < 0.6, `covers ${cover}`);
});

test("hatching stays open under a heavy line and much spread", () => {
  const box = { id: "h", mark: "hatch", tone: 0.8, box: [-0.6, 0.6, -0.6, 0.6], sdf: (x, y) => sdBox(x, y, 0, 0, 0.4, 0.4) };
  const cover = inkArea(inked(box, { ...RULE, line: 12, spread: 3 })) / 0.64;
  assert.ok(cover < 0.75, `covers ${cover}`);
});

test("fine detail kept: a thin paper slit in a solid stays open under heavy ink", () => {
  const slit = { id: "s", box: [-0.6, 0.6, -0.6, 0.6], sdf: (x, y) => subtract(sdBox(x, y, 0, 0, 0.4, 0.4), sdBox(x, y, 0, 0, 0.3, 0.008)) };
  const heavy = { ...RULE, pool: 3.4, spread: 1, wobble: 2, dry: 0 }, s = sampleShape(slit, P);
  /** the share of the slit's centre line that is still paper */
  const openShare = (rule) => {
    const g = inkField(s, slit, rule), j = Math.round((0 - s.y0) / s.cell);
    let open = 0, n = 0;
    for (let x = -0.25; x <= 0.25; x += 0.01, n++) if (g[j * s.nx + Math.round((x - s.x0) / s.cell)] > 0) open++;
    return open / n;
  };
  const kept = openShare({ ...heavy, keep: 6 }), lost = openShare({ ...heavy, keep: 0.5 });
  assert.ok(kept > 0.8, `kept open ${kept}`);
  assert.ok(lost < kept, `without the rule ${lost}`);
});

test("a mask survives encoding, and a bitmap's sdf is negative on its ink", () => {
  const w = 20, h = 10, m = new Uint8Array(w * h);
  for (let y = 3; y < 7; y++) for (let x = 5; x < 15; x++) m[y * w + x] = 1;
  const back = decodeMask(encodeMask(m, w, h));
  assert.deepEqual([...back.m], [...m]);
  const sdf = bitmapSdf({ area: [-1, 1, -0.5, 0.5], mask: encodeMask(m, w, h) });
  assert.ok(sdf(0, 0) < 0 && sdf(0.9, 0.4) > 0 && sdf(3, 3) > 0);
});

test("the style: paper first, black true, a coloured plate multiplied, grain on ink only", () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const markup = paint([{ id: "a", ink: "black", loops: [sq] }, { id: "b", ink: "red", loops: [sq] }, { id: "c", ink: "paper", loops: [sq] }], { ...RULE, grain: 0.5, density: 0.9, misreg: 2 });
  assert.ok(markup.startsWith(`<rect width="600" height="600" fill="${PALETTE.paper}"/>`));
  assert.match(markup, new RegExp(`fill="${PALETTE.black}" fill-rule="evenodd" filter="url\\(#ink-grain\\)"`));
  assert.match(markup, /fill="#d8252c"[^>]*fill-opacity="0.9"[^>]*mix-blend-mode:multiply[^>]*translate/);
  assert.match(markup, new RegExp(`fill="${PALETTE.paper}" fill-rule="evenodd"/>$`));
});

test("every figure inks and renders with no NaN", () => {
  for (const [name, fig] of Object.entries(SCENES)) {
    prepare(fig);
    const markup = frame(fig, fig.active[0], fig.active[0], VIEW, RULE, null);
    assert.ok(markup.includes("<path"), `${name} draws`);
    assert.ok(!markup.includes("NaN"), `${name} has no NaN`);
  }
});

test("the checker passes and the build has no name declared twice", () => {
  execFileSync("node", [join(root, "tools/check.mjs"), "--quiet"], { stdio: "pipe" });
  assert.ok(modules().length > 6);
});

test("a framed picture is clipped to its frame, and ink that reaches the frame touches its edge", () => {
  const fig = { T: 1, S: 250, active: [0, 1], frame: [474, 500], step: () => ({}),
    shapes: [{ id: "big", box: [-1.2, 1.2, -1.2, 1.2], sdf: (x, y) => sdBox(x, y, 0, 0, 1.1, 1.1) },
      { id: "small", box: [-0.4, 0.4, -0.4, 0.4], sdf: (x, y) => sdBox(x, y, 0, 0, 0.3, 0.3) }] };
  const [x0, y0, x1, y1] = frameBox(fig), [big, small] = pose(fig, 0, 0.5, RULE);
  const pts = (s) => s.loops.flat();
  for (const [x, y] of pts(big)) assert.ok(x >= x0 - 1e-6 && x <= x1 + 1e-6 && y >= y0 - 1e-6 && y <= y1 + 1e-6);
  assert.ok(pts(big).some(([x]) => x - x0 < 0.5), "a shape past the frame is cut flat along it");
  assert.ok(!pts(small).some(([x, y]) => x - x0 < 0.5 || x1 - x < 0.5 || y - y0 < 0.5 || y1 - y < 0.5), "a shape inside it never touches it");
});

test("a shape that is Infinity away from most of its box still inks (the pooling blur is not poisoned)", () => {
  const loops = inked({ id: "far", box: [-0.6, 0.6, -0.6, 0.6], sdf: (x, y) => (Math.abs(x) < 0.3 ? sdCircle(x, y, 0, 0, 0.2) : Infinity) }, { ...RULE });
  assert.ok(loops.length >= 1);
});

test("small marks next to a shape that says 'far' with a big number still ink (the field is clamped before pooling)", () => {
  const tiles = (x, y) => { const t = 0.05, i = Math.floor(x / t), j = Math.floor(y / t); return (i + j) % 2 ? 1 : sdBox(x, y, (i + 0.5) * t, (j + 0.5) * t, 0.015, 0.015); };
  const loops = inked({ id: "tiles", box: [-0.3, 0.3, -0.3, 0.3], sdf: (x, y) => Math.max(tiles(x, y), sdBox(x, y, 0, 0, 0.2, 0.2)) }, { ...RULE });
  assert.ok(loops.length >= 25, `${loops.length} tiles`);   // 32 cells in the box are tiles
});
