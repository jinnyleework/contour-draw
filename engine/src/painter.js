import { clamp, r2 } from "./math.js";
import { makeProjector, toViewer } from "./camera.js";

/*
 * The painter: sheets in, svg markup out. No DOM, so it can be tested.
 *
 * Sheets are drawn bottom up, each with an opaque fill, so a higher sheet covers a lower one. Then the
 * drawing rule is applied edge by edge (rule A: weight and depth):
 *   - an edge seen side-on (a silhouette) is heavy; one facing you is light      (`contrast`)
 *   - farther edges are thinner and fainter                                     (`depth`)
 *   - lower sheets are fainter than higher ones                                 (`fade`)
 * Weights and opacities are bucketed, so a sheet is a handful of paths and not one per edge.
 *
 * `shift`, when given, is called with a sheet's middle height on the page and returns how far to move the whole
 * sheet up or down (the hover split). A moved sheet keeps its place in the painting order.
 */

/** the defaults for rule A: heavy silhouettes and light faces, far edges receding, lower sheets only a little fainter */
export const RULE = { base: 0.9, contrast: 0.4, depth: 0.8, fade: 0 };
/** the camera: `azimuth` turns the object (degrees), `tilt` is the sine of the elevation (0.5 is the 2:1 view) */
export const VIEW = { azimuth: 35, tilt: 0.5 };

const WBINS = 8, OBINS = 4, WMAX = 3.2;

/** the page height of a sheet's middle: the average of a sample of its points */
function middleOf(sh, off, z, P) {
  let t = 0, n = 0;
  for (const l of sh.loops) for (let i = 0; i < l.length; i += 6) { t += P(l[i][0] + off[0], l[i][1] + off[1], z)[1]; n++; }
  return t / n;
}

/**
 * items: [{ sh: { z, loops }, off: [dx, dy, dz] }], already in painting order.
 * scene: { S, zm, zr: [zmin, zmax] }. `pulse` scales every stroke weight (a flash). Returns markup for the inside of an svg.
 */
export function paint(items, scene, view = VIEW, rule = RULE, pulse = 1, shift = null) {
  const [s, c] = toViewer(view), P = makeProjector(view, scene), [z0, z1] = scene.zr;
  let out = "";
  for (const { sh, off } of items) {
    const z = sh.z + off[2], sy = P(off[0], off[1], z)[1];
    if (sy < -260 || sy > 900) continue;                                    // far off the page
    const lift = shift ? shift(middleOf(sh, off, z, P)) : 0;
    const pts = (l) => l.map(([x, y]) => { const q = P(x + off[0], y + off[1], z); return r2(q[0]) + " " + r2(q[1] + lift); });
    const fadeO = 1 - rule.fade * (1 - clamp((z - z0) / (z1 - z0), 0, 1)), buckets = new Map();
    out += `<path class="fill" d="${sh.loops.map((l) => "M" + pts(l).join("L") + "Z").join("")}"/>`;
    for (const l of sh.loops) {
      const n = l.length, key = l.map((p, i) => {
        const q = l[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], m = Math.hypot(dx, dy) || 1;
        const facing = Math.abs((-dy * s + dx * c) / m);                    // 0 on a silhouette, 1 facing you
        const near = clamp(0.5 + ((p[0] + q[0]) * s + (p[1] + q[1]) * c) / 4.8, 0, 1);   // 0 far, 1 near
        const w = rule.base * pulse * (0.3 + 2.3 * Math.pow(1 - facing, 1.5) * rule.contrast + 0.45 * (1 - rule.contrast)) * (1 - rule.depth * 0.6 * (1 - near));
        const o = clamp(fadeO * (1 - rule.depth * 0.7 * (1 - near)), 0.1, 1);
        return clamp(Math.round(((w - 0.2) / (WMAX)) * (WBINS - 1)), 0, WBINS - 1) * OBINS + clamp(Math.round(o * (OBINS - 1)), 0, OBINS - 1);
      });
      const P2 = pts(l), emit = (id, run, closed) => { const a = buckets.get(id) || []; a.push("M" + run.join("L") + (closed ? "Z" : "")); buckets.set(id, a); };
      const k = key.findIndex((v, i) => v !== key[(i + n - 1) % n]);
      if (k < 0) { emit(key[0], P2, true); continue; }
      for (let i = 0; i < n;) {
        const v = key[(k + i) % n], run = [P2[(k + i) % n]];
        while (i < n && key[(k + i) % n] === v) { i++; run.push(P2[(k + i) % n]); }
        emit(v, run, false);
      }
    }
    for (const [id, d] of buckets) {
      const w = 0.2 + (Math.floor(id / OBINS) / (WBINS - 1)) * WMAX, o = (id % OBINS) / (OBINS - 1);
      out += `<path class="ln" stroke-width="${r2(w)}" stroke-opacity="${r2(0.1 + 0.9 * o)}" d="${d.join("")}"/>`;
    }
  }
  return out;
}
