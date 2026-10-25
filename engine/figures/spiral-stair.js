import { len2, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A spiral stair round a central column: twelve wedge-shaped treads, each a little higher than the last. Move up it and
 * the treads unwind: folded, they sit nearly stacked in a tight stack; opened, each is turned a step further than the
 * one below and the stair spirals up more than a full turn. At rest it is folded. The column and base are cut once;
 * the treads are cut again as they turn.
 */
const STAIRS = 12, RISE = 0.075;                                         // the number of treads and the height of each

export const spiralStair = {
  T: 4, zr: [-0.06, 1.0], S: 280, zm: 0.45,
  active: [0, 2.4],                                              // the treads unwind; the pose at 0 is the rest pose
  drive: (x, y) => clamp((480 - y) / 300, 0, 1),                 // up the stair
  hint: "move up the stair to unwind it",
  parts: [
    { id: "column", order: 0, cell: 0.012, box: { x: [-0.7, 0.7], y: [-0.7, 0.7] }, planes: planes(-0.06, 1.0, 0.02), sdf: (x, y, z) => {
      const r = len2(x, y);
      return Math.min(rcyl(r, z, 0.6, -0.06, 0.0, 0.015), rcyl(r, z, 0.08, 0, 0.98, 0.02), Math.hypot(x, y, z - 0.98) - 0.1);   // a round base, the column, a knob on top
    } },
    { id: "treads", order: 1, dynamic: true, cell: 0.018, key: (p) => p.turn.toFixed(2), box: { x: [-0.56, 0.56], y: [-0.56, 0.56] }, planes: planes(0.0, 1.0, 0.015), sdf: (x, y, z, { turn }) => {
      const i = clamp(Math.round((z - 0.04) / RISE), 0, STAIRS - 1), r = len2(x, y);
      const a = ((Math.atan2(y, x) - i * turn + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;                       // angle from tread i's middle
      return Math.max(r - 0.5, 0.07 - r, Math.abs(a) - 0.3, Math.abs(z - 0.04 - i * RISE) - 0.022);            // a wedge of a tread
    } },
  ],
  /**
   * k, the intensity: how far each tread turns from the last when it is opened.
   * 0: a gentle spiral (0.4 rad) · 0.5: 0.55 rad · 1: 0.7 rad, well over a full turn
   */
  step(t, abs, k = 0.5) {
    const open = byIntensity(k, [0.4, 0.55, 0.7]), e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t));
    return { column: {}, treads: { prm: { turn: Math.round((0.1 + (open - 0.1) * e) * 50) / 50 } } };
  },
};
