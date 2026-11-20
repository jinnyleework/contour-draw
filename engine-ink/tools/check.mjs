#!/usr/bin/env node
/*
 * Checks figures: `node tools/check.mjs [name] [--quiet]` (default: all). FAIL stops you; warn is for you to read.
 * It checks a figure's declaration, every shape's ink and mark, that an sdf shape is paper on its box edge (or its ink cannot
 * close), that step() poses every frame, and the budgets: markup per frame and the time to pose and paint one. A card picture
 * (a figure with a `frame`) is warned when its ink is cut flat by the frame: it should end on its own marks, inside it.
 */
import { SCENES } from "../figures/index.js";
import { frame, prepare, pose, frameBox } from "../src/figure.js";
import { PALETTE, RULE } from "../src/painter.js";
import { VIEW } from "../src/view.js";

const args = process.argv.slice(2), quiet = args.includes("--quiet"), only = args.find((a) => !a.startsWith("--"));
const names = Object.keys(SCENES).filter((n) => !only || n === only);
if (only && !names.length) { console.log(`FAIL: no figure called ${only}; have ${Object.keys(SCENES).join(", ")}`); process.exit(1); }
let fails = 0;
const fail = (n, msg) => { fails++; console.log(`FAIL ${n}: ${msg}`); };
const warn = (n, msg) => { if (!quiet) console.log(`warn ${n}: ${msg}`); };
const MARKS = ["fill", "line", "hatch"];

for (const n of names) {
  const fig = SCENES[n];
  for (const key of ["T", "S", "active", "drive", "hint", "shapes", "step"]) if (fig[key] === undefined) fail(n, `no ${key}`);
  if (fig.active && !(fig.active[1] > fig.active[0])) fail(n, "active must run forward");
  const ids = new Set();
  for (const s of fig.shapes || []) {
    if (ids.has(s.id)) fail(n, `shape id ${s.id} twice`);
    ids.add(s.id);
    if (!PALETTE[s.ink || "black"]) fail(n, `${s.id}: ink "${s.ink}" is not in PALETTE`);
    if (!MARKS.includes(s.mark || "fill")) fail(n, `${s.id}: mark "${s.mark}" is not one of ${MARKS.join(", ")}`);
    if (!s.sdf && !s.bitmap) { fail(n, `${s.id}: no sdf and no bitmap`); continue; }
    if (s.sdf) {
      if (!s.box) { fail(n, `${s.id}: an sdf shape needs a box`); continue; }
      const [x0, x1, y0, y1] = s.box, edge = [];
      if (x0 < -1.3 || x1 > 1.3 || y0 < -1.3 || y1 > 1.3) warn(n, `${s.id}: box reaches far past -1..1`);
      for (let i = 0; i <= 24; i++) edge.push([x0 + ((x1 - x0) * i) / 24, y0], [x0 + ((x1 - x0) * i) / 24, y1], [x0, y0 + ((y1 - y0) * i) / 24], [x1, y0 + ((y1 - y0) * i) / 24]);
      if (edge.some(([x, y]) => s.sdf(x, y) <= 0)) fail(n, `${s.id}: the sdf is inside its box edge, so the ink will not close`);
    }
  }
  if (fails) continue;
  const t0 = performance.now();
  prepare(fig);
  const inkMs = performance.now() - t0;
  const ts = [];
  for (let i = 0; i <= 8; i++) ts.push(fig.active[0] + ((fig.active[1] - fig.active[0]) * i) / 8);
  let bytes = 0, worst = 0;
  for (const k of [0, 0.5, 1]) for (const t of ts) {
    const a = performance.now(), m = frame(fig, t, t, VIEW, RULE, null, k);
    worst = Math.max(worst, performance.now() - a);
    bytes = Math.max(bytes, m.length);
    if (m.includes("NaN")) fail(n, `NaN in the markup at t ${t.toFixed(2)}, intensity ${k}`);
  }
  if (bytes > 450000) fail(n, `markup is ${Math.round(bytes / 1000)} kB a frame: the budget is 450 kB`);
  else if (bytes > 200000) warn(n, `markup is ${Math.round(bytes / 1000)} kB a frame: heavy, the budget is 450 kB`);
  if (worst > 25) warn(n, `a frame took ${worst.toFixed(1)} ms: the budget is 25 ms`);
  // a card picture ends on its own marks, inside its frame: ink cut flat by the frame edge is flagged (see /draw-ink, card rules)
  const fb = frameBox(fig);
  if (fb) {
    const sides = { left: 0, right: 0, top: 0, bottom: 0 };
    for (const { loops } of pose(fig, fig.active[0], 0.5, RULE)) for (const l of loops) for (const [x, y] of l) {
      if (x - fb[0] < 0.5) sides.left++; if (fb[2] - x < 0.5) sides.right++; if (y - fb[1] < 0.5) sides.top++; if (fb[3] - y < 0.5) sides.bottom++;
    }
    const cut = Object.entries(sides).filter(([, k]) => k > 0).map(([side]) => side);
    if (cut.length) warn(n, `ink is cut flat by the frame on the ${cut.join(", ")}: end the picture on its own marks, inside the frame`);
  }
  if (fig.rule) warn(n, `figure overrides the look (${Object.keys(fig.rule).join(", ")}): each one goes on STYLE.md`);
  console.log(`ok   ${n}: ${fig.shapes.length} shapes, inked in ${Math.round(inkMs)} ms, frames ${worst.toFixed(1)} ms, ${Math.round(bytes / 1000)} kB`);
}
if (fails) { console.log(`${fails} failure(s)`); process.exit(1); }
