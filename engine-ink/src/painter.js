/*
 * The painter: inked shapes to svg markup, as a print is laid down. No DOM.
 *
 * Each shape is one ink: its loops are one path, filled even-odd (a loop inside a loop is a void). Shapes are laid in order, a
 * later one over an earlier one, and `paper` is the ground colour laid over ink: a highlight carved out of a solid, as a cut
 * block leaves it. A coloured ink is a second plate: it prints a little out of register (`misreg`) and a little translucent
 * (`density`), so where it crosses black or another colour the two show. The tooth of the paper breaks every ink a little
 * (`grain`, an svg filter that opens pin holes in the ink).
 */

import { hash2 } from "./math.js";

/** the colours: a figure names an ink by key (ink: "red"), never by hex */
export const PALETTE = { paper: "#f2eee3", black: "#1b1917", red: "#d8252c", blue: "#2b4c9b" };

/** each coloured plate's direction out of register, as a unit vector (black is the key plate and sits true) */
const PLATE_SHIFT = { black: [0, 0], paper: [0, 0], red: [0.8, -0.6], blue: [-0.7, -0.7] };

/** the look: every knob has a slider in RULE_CONTROLS; the studio and the page build their rows from it */
export const RULE = {
  line: 9.7, pressure: 0.3, hatch: 7.8, scratch: 0.55, pool: 3.4, spread: 0.65, wobble: 1.3, rough: 0.9, tooth: 4.2,
  speckle: 0.5, dry: 1.5, keep: 6, dust: 1.2, grain: 0.66, misreg: 0, density: 1,
};
export const RULE_CONTROLS = [
  ["line", "line weight", [0.8, 12, 0.1]],
  ["pressure", "pen pressure", [0, 1, 0.01]],
  ["hatch", "hatch spacing", [3, 20, 0.1]],
  ["scratch", "scratchy hatch", [0, 1, 0.01]],
  ["pool", "ink pooling", [0, 6, 0.1]],
  ["spread", "ink spread", [-2, 3, 0.05]],
  ["wobble", "hand wobble", [0, 5, 0.05]],
  ["rough", "torn edge", [0, 3, 0.05]],
  ["tooth", "paper tooth", [1.6, 8, 0.1]],
  ["speckle", "spatter", [0, 1.5, 0.01]],
  ["dry", "dry brush", [0, 3, 0.01]],
  ["keep", "fine detail kept", [0.5, 16, 0.1]],
  ["dust", "smallest speck", [0.2, 8, 0.1]],
  ["grain", "print grain", [0, 1, 0.01]],
  ["misreg", "out of register", [0, 5, 0.05]],
  ["density", "ink density", [0.6, 1, 0.01]],
];

/** the pin-hole filter for print grain: fractal noise, its brightest specks cut out of the ink */
function grainFilter(grain) {
  const thr = (0.74 - grain * 0.16).toFixed(3), K = 9;
  return `<filter id="ink-grain" x="0" y="0" width="600" height="600" filterUnits="userSpaceOnUse"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="n"/>` +
    `<feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ${K} 0 0 0 ${(-K * thr).toFixed(3)}" result="holes"/>` +
    `<feComposite in="SourceGraphic" in2="holes" operator="out"/></filter>`;
}

const pathOf = (loops) => loops.map((l) => "M" + l.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L") + "Z").join("");

/**
 * The markup for posed shapes, in the order they are laid: [{ id, ink, loops }] with each loop in page px.
 * The paper is the first thing drawn, so a still and the page look the same.
 */
export function paint(shapes, rule = RULE) {
  const grain = rule.grain > 0.001;
  const out = [`<rect width="600" height="600" fill="${PALETTE.paper}"/>`];
  if (grain) out.push(`<defs>${grainFilter(rule.grain)}</defs>`);
  for (const { ink, loops } of shapes) {
    if (!loops.length) continue;
    const [dx, dy] = (PLATE_SHIFT[ink] || [0, 0]).map((v) => v * rule.misreg);
    const plate = ink !== "black" && ink !== "paper";
    const attrs = [`d="${pathOf(loops)}"`, `fill="${PALETTE[ink] || PALETTE.black}"`, `fill-rule="evenodd"`];
    if (plate) attrs.push(`fill-opacity="${rule.density}"`, `style="mix-blend-mode:multiply"`);
    if (dx || dy) attrs.push(`transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)})"`);
    if (grain && ink !== "paper") attrs.push(`filter="url(#ink-grain)"`);
    out.push(`<path ${attrs.join(" ")}/>`);
  }
  return out.join("");
}

/**
 * The markup for a design tool (Figma, Illustrator): plain filled paths, no background, no filters. Print grain is baked into the
 * geometry instead, as small irregular pin holes cut into the ink (each a loop inside the ink, so even-odd leaves it open), and
 * the drawing is cropped to its own bounds. Returns { body, box: [x, y, w, h] } in page px. Paper shapes stay paper-coloured.
 * `grainSize` scales the pin holes and their spacing: for art that will be shown much smaller than it is drawn (a suit
 * scaled down onto a card), so the grain still reads at that size.
 */
export function paintFlat(shapes, rule = RULE, { grainSize = 1 } = {}) {
  const out = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const { ink, loops } of shapes) {
    if (!loops.length) continue;
    for (const l of loops) for (const [x, y] of l) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const holes = ink === "paper" || rule.grain <= 0.001 ? [] : paintGrainHoles(loops, rule.grain, grainSize);
    out.push(`<path d="${pathOf([...loops, ...holes])}" fill="${PALETTE[ink] || PALETTE.black}" fill-rule="evenodd"/>`);
  }
  const pad = 4;
  return { body: out.join(""), box: [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad] };
}

/** pin holes for the grain: on a 3.2 px lattice (times `size`), a share of cells (more with `grain`) gets a speck, kept only where it is in ink */
function paintGrainHoles(loops, grain, size = 1) {
  // edges bucketed by bands of y, so an even-odd test looks only at the edges that can cross its row
  const band = 4 * size, buckets = new Map();
  let ymin = Infinity, ymax = -Infinity, xmin = Infinity, xmax = -Infinity;
  for (const l of loops) for (let i = 0; i < l.length; i++) {
    const a = l[i], b = l[(i + 1) % l.length], lo = Math.floor(Math.min(a[1], b[1]) / band), hi = Math.floor(Math.max(a[1], b[1]) / band);
    for (let k = lo; k <= hi; k++) { if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push([a, b]); }
    ymin = Math.min(ymin, a[1]); ymax = Math.max(ymax, a[1]); xmin = Math.min(xmin, a[0]); xmax = Math.max(xmax, a[0]);
  }
  const inInk = (x, y) => {
    let inside = false;
    for (const [[ax, ay], [bx, by]] of buckets.get(Math.floor(y / band)) || []) if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
    return inside;
  };
  const cell = 3.2 * size, share = 0.08 + grain * 0.22, holes = [];
  for (let j = Math.floor(ymin / cell); j <= ymax / cell; j++) for (let i = Math.floor(xmin / cell); i <= xmax / cell; i++) {
    if (hash2(i, j, 71) > share) continue;
    const cx = (i + hash2(i, j, 72)) * cell, cy = (j + hash2(i, j, 73)) * cell, r = (0.35 + hash2(i, j, 74) * 0.55 * (0.6 + grain)) * size;
    if (!inInk(cx, cy) || !inInk(cx + r * 1.6, cy) || !inInk(cx - r * 1.6, cy) || !inInk(cx, cy + r * 1.6) || !inInk(cx, cy - r * 1.6)) continue;
    const spin = hash2(i, j, 75) * 6.28, stretch = 0.6 + hash2(i, j, 76) * 0.8;
    holes.push([0, 1, 2, 3, 4, 5, 6, 7].map((v) => {                     // eight corners: a fleck, not a polygon, at any size
      const a = spin + (v / 8) * 6.28, rr = r * (0.75 + hash2(i * 8 + v, j, 77) * 0.45);
      return [cx + Math.cos(a) * rr * stretch, cy + Math.sin(a) * rr];
    }));
  }
  return holes;
}
