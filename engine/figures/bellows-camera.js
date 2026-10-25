import { len2, subtract, roundBox, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A folding plate camera lying level along x, lens to the right: a flat bed, a framed back, a front standard with a
 * ringed lens riding on a post, and a square pleated bellows between them. Move across it and the front standard runs
 * out along the bed while the bellows unfolds, its pleats opening up. At rest it is folded flat. The bed, back and
 * front standard are cut once and the front only slides; the bellows are cut again as they stretch.
 */
const BELLOWS_X = -0.42, BELLOWS_FOLDS = 7;                              // where the bellows start, and how many pleats they have

export const bellowsCamera = {
  T: 4, zr: [-0.41, 0.24], S: 400, zm: -0.03,
  active: [0, 2.2],                                              // the front runs out and the bellows open; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 130) / 340, 0, 1),                    // across the camera
  hint: "move across the camera to open the bellows",
  parts: [
    { id: "body", order: 0, box: { x: [-0.7, 0.65], y: [-0.35, 0.35] }, planes: planes(-0.41, 0.24, 0.02), sdf: (x, y, z) => {
      const bed = Math.min(roundBox(x, y, z + 0.3, 0.5, 0.1, 0.02, 0.015), rcyl(len2(x + 0.35, y), z, 0.06, -0.4, -0.31, 0.01));   // the bed, and a tripod boss under it
      const back = subtract(roundBox(x + 0.45, y, z, 0.015, 0.2, 0.2, 0.02), Math.max(Math.abs(y) - 0.15, Math.abs(z) - 0.15));       // the back: a frame round a window
      return Math.min(bed, back);
    } },
    { id: "front", order: 1, box: { x: [-0.32, 0.02], y: [-0.3, 0.3] }, planes: planes(-0.3, 0.22, 0.025), sdf: (x, y, z) => {
      const board = roundBox(x + 0.2, y, z, 0.015, 0.19, 0.19, 0.02), r = len2(y, z);
      const lens = Math.min(rcyl(r, x, 0.085, -0.17, -0.04, 0.012), rcyl(r, x, 0.11, -0.17, -0.14, 0.01));                    // the lens barrel, and a ring behind it
      return Math.min(board, subtract(lens, rcyl(r, x, 0.05, -0.08, 0.0, 0)), roundBox(x + 0.2, y, z + 0.26, 0.02, 0.04, 0.035, 0.01));   // the glass is recessed; a post carries it
    } },
    { id: "bellows", order: 2, dynamic: true, cell: 0.007, key: (p) => p.L.toFixed(2), box: { x: [-0.5, 0.4], y: [-0.3, 0.3] }, planes: planes(-0.26, 0.26, 0.03), sdf: (x, y, z, { L }) => {
      const u = clamp((x - BELLOWS_X) / L, 0, 1), f = (u * BELLOWS_FOLDS) % 1, pitch = L / BELLOWS_FOLDS;
      const hw = 0.2 - 0.06 * u + Math.min(0.035, 0.8 * pitch) * Math.abs(2 * f - 1);                              // narrowing to the front, zigzagging with the pleats
      return Math.max(Math.abs(y) - hw, Math.abs(z) - hw, BELLOWS_X - x, x - BELLOWS_X - L);
    } },
  ],
  /**
   * k, the intensity: how far the bellows open.
   * 0: part-way · 0.5: well out · 1: fully extended
   */
  step(t, abs, k = 0.5) {
    const reach = byIntensity(k, [0.4, 0.55, 0.7]), e = sm(0, 1.7, t) * (1 - sm(2.8, 3.8, t)), L = 0.2 + (reach - 0.2) * e;
    return { body: {}, front: { off: [L - 0.2, 0, 0] }, bellows: { prm: { L: Math.round(L * 100) / 100 } } };
  },
};
