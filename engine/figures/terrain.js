import { len2, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A square block of ground cut away to show its top: a rugged landscape of ridges and hollows, drawn as contour rings,
 * and the cut sides showing its profile. Move the cursor over it and the land reshapes: a peak rises under the cursor
 * and follows it round, the ground folding up into rings round the point. At rest it is the quiet landscape. The block
 * under the land is cut once; the land is cut again as the peak moves. It uses the cursor's position (the fourth
 * argument of step), not just how far through the action it is.
 */
const terrSide = 0.55;                                                   // half the side of the block

/** the land with no peak: ridges and hollows, and a broad rise toward the back */
const terrBase = (x, y) => 0.24 + 0.09 * Math.sin(5 * x + 2) * Math.cos(4 * y) + 0.07 * Math.sin(9 * x - 3 * y + 1) + 0.05 * Math.sin(13 * y + 2 * x) + 0.22 * Math.exp(-((x + 0.2) ** 2 + (y + 0.25) ** 2) / 0.15);

export const terrain = {
  T: 4, zr: [-0.45, 1.0], S: 270, zm: 0.25,
  active: [0, 2.4],                                              // with no cursor (the demo), a peak wanders over the land; the pose at 0 is the rest pose
  drive: (x, y) => clamp(1.5 - Math.hypot(x - 300, y - 330) / 200, 0, 1),   // 1 over the land, 0 away from it: the cursor's place is what shapes it
  hint: "move over the land to raise a peak under the cursor",
  parts: [
    { id: "block", order: 0, box: { x: [-0.7, 0.7], y: [-0.7, 0.7] }, planes: planes(-0.45, 0.0, 0.015), sdf: (x, y) => Math.max(Math.abs(x), Math.abs(y)) - terrSide },
    { id: "land", order: 1, dynamic: true, cell: 0.022, key: (p) => (p.a ? p.px.toFixed(2) + ":" + p.py.toFixed(2) + ":" + p.a.toFixed(2) : "0"), box: { x: [-0.7, 0.7], y: [-0.7, 0.7] }, planes: planes(0.0, 1.06, 0.02), sdf: (x, y, z, { px, py, a }) => {
      const d2 = (x - px) ** 2 + (y - py) ** 2, peak = a ? a * Math.exp(-d2 / 0.03) * (1 + 0.12 * Math.sin(23 * x + 17 * y)) : 0;   // a ridged peak
      return Math.max(z - terrBase(x, y) - peak, Math.abs(x) - terrSide, Math.abs(y) - terrSide);
    } },
  ],
  /**
   * k, the intensity: how high the peak rises.
   * 0: a low rise · 0.5: a clear peak · 1: a tall one
   */
  step(t, abs, k = 0.5, pointer = null) {
    const rise = byIntensity(k, [0.3, 0.5, 0.7]), q = (v) => Math.round(v / 0.03) * 0.03;
    let px = 0, py = 0, s = 0;
    if (pointer && pointer.s > 0.002) { [px, py] = pointer.ground(0.35); s = pointer.s; }                      // the peak is under the cursor
    else { s = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t)); px = 0.3 * Math.cos(1 + t * 1.3); py = 0.3 * Math.sin(1 + t * 1.3); }   // with no cursor, it wanders
    const a = Math.round(rise * s * 40) / 40;
    return { block: {}, land: { prm: { px: a ? q(clamp(px, -0.5, 0.5)) : 0, py: a ? q(clamp(py, -0.5, 0.5)) : 0, a } } };
  },
};
