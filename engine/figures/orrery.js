import { len2, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * An orrery: a round plinth, a column with the sun on top, and five planets each on its own arm from the column, the
 * arms stacked at different heights, one planet ringed and one with a moon. Move across it and the planets go round
 * the sun, the inner ones fastest. At rest they are lined up on one side. The plinth, column and sun are cut once; the
 * arms and planets are cut again as they turn.
 */
const ORBITS = [                                                         // the arm's height, the orbit's radius, the planet's radius, its speed, and whether it has a ring or a moon
  { z: 0.12, R: 0.22, p: 0.03, w: 4.1, d: "" }, { z: 0.2, R: 0.32, p: 0.04, w: 1.6, d: "" }, { z: 0.28, R: 0.43, p: 0.045, w: 1.0, d: "moon" },
  { z: 0.36, R: 0.54, p: 0.055, w: 0.53, d: "ring" }, { z: 0.44, R: 0.64, p: 0.04, w: 0.3, d: "" },
];

export const orrery = {
  T: 4, zr: [-0.08, 0.72], S: 330, zm: 0.28,
  active: [0, 2.4],                                              // the planets go round; the pose at 0 is the rest pose, lined up
  drive: (x) => clamp((x - 130) / 340, 0, 1),                    // across the orrery
  hint: "move across the orrery to run the planets",
  parts: [
    { id: "stand", order: 0, cell: 0.01, box: { x: [-0.45, 0.45], y: [-0.45, 0.45] }, planes: planes(-0.08, 0.72, 0.012), sdf: (x, y, z) => {
      const r = len2(x, y);
      return Math.min(rcyl(r, z, 0.36, -0.08, 0, 0.02), rcyl(r, z, 0.035, 0, 0.56, 0.01), Math.hypot(x, y, z - 0.62) - 0.09);   // a plinth, a column, the sun
    } },
    { id: "planets", order: 1, dynamic: true, cell: 0.02, key: (p) => p.a.toFixed(3), box: { x: [-0.76, 0.76], y: [-0.76, 0.76] }, planes: planes(0.08, 0.56, 0.016), sdf: (x, y, z, { a }) => {
      let d = 1;
      for (const o of ORBITS) {
        if (Math.abs(z - o.z - 0.05) > 0.13 || len2(x, y) > o.R + 0.13) continue;                                     // too far to matter
        const th = o.w * a, px = o.R * Math.cos(th), py = o.R * Math.sin(th), t = clamp((x * px + y * py) / (o.R * o.R), 0, 1);
        const arm = Math.hypot(x - t * px, y - t * py, z - o.z) - 0.016;                                              // the arm, from the column to the planet
        const post = rcyl(len2(x - px, y - py), z, 0.012, o.z, o.z + 0.05, 0);
        const ball = Math.hypot(x - px, y - py, z - o.z - 0.05 - o.p) - o.p;                                          // the planet, on a short post at the arm's end
        d = Math.min(d, arm, post, ball);
        if (o.d === "ring") d = Math.min(d, Math.max(Math.abs(len2(x - px, y - py) - o.p * 1.8) - 0.018, Math.abs(z - o.z - 0.05 - o.p) - 0.006));
        if (o.d === "moon") d = Math.min(d, Math.hypot(x - px - 0.08 * Math.cos(4 * th), y - py - 0.08 * Math.sin(4 * th), z - o.z - 0.05 - o.p) - 0.018);
      }
      return d;
    } },
  ],
  /**
   * k, the intensity: how far the planets go round.
   * 0: the innermost half way round · 0.5: once round · 1: twice round
   */
  step(t, abs, k = 0.5) {
    const turns = byIntensity(k, [0.5, 1, 2]), e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t));
    return { stand: {}, planets: { prm: { a: Math.round((turns * 2 * Math.PI * e) / 4.1 * 300) / 300 } } };
  },
};
