/*
 * The inker: a shape becomes ink. No DOM.
 *
 * Ink is a field over the paper: where the field is below zero there is ink. A shape's sdf is sampled once on a fine grid in
 * page px (`sampleShape`); then, for a look (`RULE`), the field is made from it and traced into closed loops (`inkLoops`):
 *
 *   mark     fill: the shape itself. line: a band along its edge, wider where the pen pressed. hatch: parallel strokes inside it,
 *            each its own weight and broken where the nib skipped (`scratch`).
 *   pool     the field is blurred, so ink pools into inside corners and fine gaps close, as it does on soft paper
 *   spread   the ink gains: every edge moves out (or in, below zero)
 *   wobble   the edge drifts slowly, as a hand does
 *   rough    the edge is torn finely by the paper's tooth (`tooth` is its grain, in px)
 *   speckle  small islands of ink spatter just off the edges
 *   dry      small voids open inside solid ink, where the brush ran dry
 *   keep     fine detail survives: in a fill, where the ink or the paper between it is thinner than `keep` px, all of the
 *            above (pooling included) is turned down in step, so a thin white highlight or a fine line stays open
 *
 * Noise is anchored to the shape, so when a shape moves its marks move with it, and the same shape always inks the same way.
 * `phase` picks another set of noise (the boil: a hand redrawing the same line). The sdf and the noise are sampled once and
 * kept; a new look only recombines grids and traces again, which is what makes the sliders live.
 */
import { clamp, noise2, fbm2, seedOf, sdBox, hash2 } from "./math.js";

/** page px per grid cell: fine enough for a torn edge, coarse enough to trace fast */
export const INK_CELL = 1.5;
/** the sampled field is clamped to this many px either side of an edge: farther than this, no mark can reach */
const INK_FAR = 10;
/** how far past a shape's box the grid reaches, in px: room for spread, wobble and speckle */
const INK_MARGIN = 20;

/* ---------- bitmaps: a drawing given as an image becomes an sdf ---------- */

/** a run-length mask ("w.h.r0.r1...", base 36, runs alternate paper then ink, row by row from the top) to a 0/1 array */
export function decodeMask(code) {
  const nums = code.split(".").map((s) => parseInt(s, 36)), [w, h] = nums, m = new Uint8Array(w * h);
  let at = 0, on = 0;
  for (let r = 2; r < nums.length; r++) { if (on) m.fill(1, at, at + nums[r]); at += nums[r]; on ^= 1; }
  return { w, h, m };
}

/** the signed distance of a 0/1 mask in mask px (chamfer 3-4, two passes each way): negative on ink */
function maskDistance({ w, h, m }) {
  const far = 1e6, inD = new Float32Array(w * h), outD = new Float32Array(w * h);
  for (let k = 0; k < w * h; k++) { inD[k] = m[k] ? far : 0; outD[k] = m[k] ? 0 : far; }
  for (const D of [inD, outD]) {
    const at = (i, j) => (i < 0 || j < 0 || i >= w || j >= h ? (D === inD ? 0 : far) : D[j * w + i]);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = j * w + i; if (!D[k]) continue;
      D[k] = Math.min(D[k], at(i - 1, j) + 3, at(i, j - 1) + 3, at(i - 1, j - 1) + 4, at(i + 1, j - 1) + 4);
    }
    for (let j = h - 1; j >= 0; j--) for (let i = w - 1; i >= 0; i--) {
      const k = j * w + i; if (!D[k]) continue;
      D[k] = Math.min(D[k], at(i + 1, j) + 3, at(i, j + 1) + 3, at(i + 1, j + 1) + 4, at(i - 1, j + 1) + 4);
    }
  }
  const s = new Float32Array(w * h);
  for (let k = 0; k < w * h; k++) s[k] = m[k] ? -(inD[k] / 3) + 0.5 : outD[k] / 3 - 0.5;
  return s;
}

/**
 * An sdf in world units for a mask laid over `area` [x0, x1, y0, y1] (the image's top row at y1). Outside the image it is
 * paper. Cached on the bitmap object, so a figure's frames that share a bitmap share the work.
 */
const bitmaps = new WeakMap();
export function bitmapSdf(bitmap) {
  if (bitmaps.has(bitmap)) return bitmaps.get(bitmap);
  const mask = decodeMask(bitmap.mask), { w, h } = mask, D = maskDistance(mask), [x0, x1, y0, y1] = bitmap.area;
  const sx = w / (x1 - x0), sy = h / (y1 - y0), unit = 1 / Math.max(sx, sy);
  const sdf = (x, y) => {
    const u = (x - x0) * sx - 0.5, v = (y1 - y) * sy - 0.5;
    // past the picture's edge, the nearest edge pixel's distance plus the way out to here: no seam along the rim
    const out = Math.max(0, sdBox(x, y, (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 - unit, (y1 - y0) / 2 - unit));
    const cu = clamp(u, 0, w - 1.001), cv = clamp(v, 0, h - 1.001);
    const i = Math.floor(cu), j = Math.floor(cv), fu = cu - i, fv = cv - j, k = j * w + i;
    const top = D[k] + (D[k + 1] - D[k]) * fu, bot = D[k + w] + (D[k + w + 1] - D[k + w]) * fu;
    return Math.max((top + (bot - top) * fv) * unit + out, out ? unit : -Infinity);
  };
  bitmaps.set(bitmap, sdf);
  return sdf;
}

/** the sdf of a shape: its own, or its bitmap's */
export const shapeSdf = (shape) => shape.sdf || bitmapSdf(shape.bitmap);

/* ---------- sampling: once per shape ---------- */

/** the shape's sdf on a grid in page px (P px per world unit), with room for the noise grids to come */
export function sampleShape(shape, P) {
  const [bx0, bx1, by0, by1] = shape.box || shape.bitmap.area, sdf = shapeSdf(shape), cell = INK_CELL / P, pad = INK_MARGIN / P;
  const x0 = bx0 - pad, y0 = by0 - pad, nx = Math.ceil((bx1 - bx0 + 2 * pad) / cell) + 1, ny = Math.ceil((by1 - by0 + 2 * pad) / cell) + 1;
  const f = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v = sdf(x0 + i * cell, y0 + j * cell) * P;
    // only the field near an edge matters (the pooling blur reaches a few px): clamping it keeps a shape that says "far" with a
    // big number, or with Infinity, from swamping the small marks next to it when the field is blurred
    f[j * nx + i] = Number.isFinite(v) ? clamp(v, -INK_FAR, INK_FAR) : v < 0 ? -INK_FAR : INK_FAR;
  }
  return { x0, y0, nx, ny, cell, P, f, seed: seedOf(shape.id) + (shape.seed || 0) * 7919, cache: new Map() };
}

/** a grid of noise over the sample, period `period` px, for one phase of the boil (cached) */
function noiseGrid(s, name, period, phase, octaves) {
  const key = `${name}:${period}:${phase}`;
  if (s.cache.has(key)) return s.cache.get(key);
  const g = new Float32Array(s.nx * s.ny), seed = s.seed + phase * 131 + name.length * 977, k = INK_CELL / period;
  const ox = (s.x0 * s.P) / period, oy = (s.y0 * s.P) / period, fn = octaves > 1 ? fbm2 : noise2;
  for (let j = 0; j < s.ny; j++) for (let i = 0; i < s.nx; i++) g[j * s.nx + i] = fn(ox + i * k, oy + j * k, seed);
  s.cache.set(key, g);
  return g;
}

/** the sampled sdf blurred by a radius in px (two box passes each way): ink pooling into corners */
function pooled(s, radius) {
  const r = Math.round(radius / INK_CELL), key = `pool:${r}`;
  if (r <= 0) return s.f;
  if (s.cache.has(key)) return s.cache.get(key);
  const { nx, ny } = s, a = Float32Array.from(s.f), b = new Float32Array(nx * ny);
  const pass = (src, dst, n, m, idx) => {
    for (let q = 0; q < m; q++) {
      let sum = 0;
      for (let p = -r; p <= r; p++) sum += src[idx(clamp(p, 0, n - 1), q)];
      for (let p = 0; p < n; p++) {
        dst[idx(p, q)] = sum / (2 * r + 1);
        sum += src[idx(Math.min(n - 1, p + r + 1), q)] - src[idx(Math.max(0, p - r), q)];
      }
    }
  };
  const H = (p, q) => q * nx + p, V = (p, q) => p * nx + q;
  for (let k = 0; k < 2; k++) { pass(a, b, nx, ny, H); pass(b, a, ny, nx, V); }
  s.cache.set(key, a);
  return a;
}

/**
 * How fine the drawing is at each cell, in px: the thinner of the thickest ink and the widest paper within a small window
 * (a max filter over the sdf each way). A thin stroke, or a thin highlight cut into a solid, reads small; open ground and
 * broad solids read large. Cached: it depends on the shape only.
 */
function fineness(s) {
  if (s.cache.has("fine")) return s.cache.get("fine");
  const { nx, ny, f } = s, r = Math.round(10 / INK_CELL), n = nx * ny;
  const maxFilter = (src) => {
    const a = new Float32Array(n), b = new Float32Array(n);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      let m = -Infinity;
      for (let d = Math.max(0, i - r); d <= Math.min(nx - 1, i + r); d++) m = Math.max(m, src[j * nx + d]);
      a[j * nx + i] = m;
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      let m = -Infinity;
      for (let d = Math.max(0, j - r); d <= Math.min(ny - 1, j + r); d++) m = Math.max(m, a[d * nx + i]);
      b[j * nx + i] = m;
    }
    return b;
  };
  const inside = maxFilter(f.map((v) => -v)), outside = maxFilter(f), fine = new Float32Array(n);
  for (let k = 0; k < n; k++) fine[k] = Math.max(0, Math.min(inside[k], outside[k]));
  s.cache.set("fine", fine);
  return fine;
}

/* ---------- the ink field, and tracing it ---------- */

/** the ink field for a shape under a look: below zero is ink. Values in px. */
export function inkField(s, shape, rule, phase = 0) {
  const { nx, ny, P } = s, n = nx * ny, pool = pooled(s, rule.pool), g = new Float32Array(n);
  const lo = noiseGrid(s, "lo", 42, phase, 2), hi = noiseGrid(s, "hi", Math.max(1.6, rule.tooth), phase, 2);
  const spk = noiseGrid(s, "spk", 2.4, phase, 1), dry = noiseGrid(s, "dry", 2.8, phase, 1);
  const mark = shape.mark || "fill", weight = shape.weight ?? 1, fine = mark === "fill" ? fineness(s) : null;
  const press = mark === "line" ? noiseGrid(s, "press", 70, 0, 1) : null;
  const ang = ((shape.angle ?? 40) * Math.PI) / 180, ca = Math.cos(ang), sa = Math.sin(ang);
  const spacing = rule.hatch * (1.7 - (shape.tone ?? 0.5) * 1.2), hw = Math.max(0.5, Math.min(rule.line * 0.32 * weight, spacing * 0.24));   // a stroke never fills its spacing
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, sc = fine ? clamp(fine[k] / rule.keep, 0.08, 1) : 1, f0 = s.f[k] + (pool[k] - s.f[k]) * sc;
    let v;
    if (mark === "line") {
      const w = rule.line * weight * Math.max(0.15, 1 + rule.pressure * (press[k] * 2 - 1) * 1.6);
      v = Math.abs(f0) - w / 2;
    } else if (mark === "hatch") {
      const X = s.x0 * P + i * INK_CELL, Y = s.y0 * P + j * INK_CELL;
      const u = X * ca + Y * sa + (lo[k] - 0.5) * rule.wobble * 2.5, along = Y * ca - X * sa;
      const q = u / spacing, n = Math.floor(q), r1 = hash2(n, 7, s.seed), r2 = hash2(n, 13, s.seed);
      const w = hw * (1 + rule.scratch * (r1 * 1.5 - 0.75)), gap = rule.scratch * 0.42 - noise2(along / 24, n * 1.7, s.seed + 5);
      v = Math.max(f0, Math.abs(q - n - 0.5 - (r2 - 0.5) * 0.3 * rule.scratch) * spacing - w, gap * 30);
    } else v = f0;
    const gain = mark === "hatch" ? Math.min(rule.spread, spacing * 0.08) : rule.spread;   // hatching gains ink, but never shuts
    v += sc * (-gain + rule.wobble * (lo[k] * 2 - 1) + rule.rough * (hi[k] * 2 - 1));
    if (v > 0 && rule.speckle > 0) v -= sc * rule.speckle * 9 * Math.max(0, spk[k] - 0.8) * 5 * Math.exp(-v / 7);
    if (v < -1.2 && rule.dry > 0 && mark === "fill") v += sc * rule.dry * 10 * Math.max(0, dry[k] - 0.82) * 5.5;
    g[k] = v;
  }
  for (let i = 0; i < nx; i++) g[i] = g[(ny - 1) * nx + i] = 1;                 // the rim of the grid is paper, so loops close
  for (let j = 0; j < ny; j++) g[j * nx] = g[j * nx + nx - 1] = 1;
  return g;
}

/** marching squares over a field: closed loops of [x, y] in world units where it crosses zero */
export function traceField(g, { x0, y0, nx, ny, cell }) {
  const E = nx * ny * 2, px = new Float32Array(E), py = new Float32Array(E), l1 = new Int32Array(E).fill(-1), l2 = new Int32Array(E).fill(-1);
  const at = (i, j) => g[j * nx + i];
  const hEdge = (i, j) => (j * nx + i) * 2, vEdge = (i, j) => (j * nx + i) * 2 + 1;
  const place = (e, ia, ja, ib, jb) => {
    const a = at(ia, ja), b = at(ib, jb), t = a / (a - b);
    px[e] = x0 + (ia + (ib - ia) * t) * cell; py[e] = y0 + (ja + (jb - ja) * t) * cell;
  };
  const link = (a, b) => { if (l1[a] < 0) l1[a] = b; else l2[a] = b; if (l1[b] < 0) l1[b] = a; else l2[b] = a; };
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = at(i, j) < 0, b = at(i + 1, j) < 0, c = at(i + 1, j + 1) < 0, d = at(i, j + 1) < 0;
    if (a === b && b === c && c === d) continue;
    const e0 = hEdge(i, j), e1 = vEdge(i + 1, j), e2 = hEdge(i, j + 1), e3 = vEdge(i, j);
    const has = [a !== b, b !== c, d !== c, a !== d], es = [e0, e1, e2, e3];
    if (has[0]) place(e0, i, j, i + 1, j);
    if (has[1]) place(e1, i + 1, j, i + 1, j + 1);
    if (has[2]) place(e2, i, j + 1, i + 1, j + 1);
    if (has[3]) place(e3, i, j, i, j + 1);
    const on = es.filter((_, q) => has[q]);
    if (on.length === 2) link(on[0], on[1]);
    else if (on.length === 4) {
      const centre = at(i, j) + at(i + 1, j) + at(i + 1, j + 1) + at(i, j + 1) < 0;
      if (centre === a) { link(e0, e1); link(e2, e3); } else { link(e0, e3); link(e1, e2); }
    }
  }
  const seen = new Uint8Array(E), loops = [];
  for (let e = 0; e < E; e++) {
    if (l1[e] < 0 || seen[e]) continue;
    const loop = [];
    let prev = -1, cur = e;
    while (cur >= 0 && !seen[cur]) {
      seen[cur] = 1; loop.push([px[cur], py[cur]]);
      const next = l1[cur] !== prev && !seen[l1[cur]] ? l1[cur] : l2[cur];
      prev = cur; cur = next;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

/** a closed loop's area (signed) */
export const loopArea = (loop) => loop.reduce((a, [x, y], i) => { const [u, v] = loop[(i + 1) % loop.length]; return a + x * v - u * y; }, 0) / 2;

/** drops points that sit within tol of the line through their neighbours: a traced edge has many more points than it needs */
function thin(loop, tol) {
  if (loop.length < 8) return loop;
  const out = [loop[0]];
  for (let i = 1; i < loop.length - 1; i++) {
    const [ax, ay] = out[out.length - 1], [bx, by] = loop[i], [cx, cy] = loop[i + 1];
    const cross = Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) / (Math.hypot(cx - ax, cy - ay) || 1);
    if (cross > tol) out.push(loop[i]);
  }
  out.push(loop[loop.length - 1]);
  return out;
}

/**
 * A shape's ink under a look: closed loops in world units, the dust dropped (a loop smaller than `rule.dust` px² goes), and each
 * loop thinned to a tenth of a px (straight runs lose points, curves keep them at print size). Holes are loops inside loops: paint them even-odd.
 */
export function inkLoops(s, shape, rule, phase = 0) {
  const P = s.P, minArea = rule.dust / (P * P), tol = 0.1 / P;
  return traceField(inkField(s, shape, rule, phase), s).filter((l) => Math.abs(loopArea(l)) >= minArea).map((l) => thin(l, tol));
}
