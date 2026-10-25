import { len2, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A cluster of seven six-sided crystals, each a prism under a pointed tip, standing on a ragged rock. Move up it and
 * the crystals grow, the tall ones first and the small ones after, each leaning a little more as it lengthens. At rest
 * they are small stubs on the rock. The rock is cut once; the crystals are cut again as they grow.
 */
const CRYSTALS = [                                                       // x, y, full height, half width, lean, the moment it starts growing
  [0, 0, 0.9, 0.1, 0.05, 0], [0.22, 0.1, 0.65, 0.075, -0.1, 0.08], [-0.2, 0.15, 0.7, 0.08, 0.12, 0.12], [0.1, -0.23, 0.55, 0.07, 0.08, 0.18],
  [-0.18, -0.18, 0.5, 0.065, -0.05, 0.22], [0.33, -0.12, 0.35, 0.055, 0.15, 0.26], [-0.35, 0, 0.38, 0.06, -0.12, 0.3],
];

export const crystalCluster = {
  T: 4, zr: [-0.1, 1.0], S: 300, zm: 0.4,
  active: [0, 2.4],                                              // the crystals grow; the pose at 0 is the rest pose, stubs
  drive: (x, y) => clamp((480 - y) / 300, 0, 1),                 // up the cluster
  hint: "move up the cluster to grow the crystals",
  parts: [
    { id: "rock", order: 0, box: { x: [-0.7, 0.7], y: [-0.7, 0.7] }, planes: planes(-0.1, 0.06, 0.015), sdf: (x, y, z) => {
      const th = Math.atan2(y, x);
      return Math.max(len2(x, y) - (0.5 + 0.05 * Math.cos(5 * th) + 0.03 * Math.cos(9 * th + 1)), -0.1 - z, z - 0.06);   // a ragged slab of rock
    } },
    { id: "crystals", order: 1, dynamic: true, cell: 0.022, key: (p) => p.e.toFixed(2) + ":" + p.g.toFixed(2), box: { x: [-0.55, 0.55], y: [-0.5, 0.5] }, planes: planes(0.0, 1.0, 0.015), sdf: (x, y, z, { e, g }) => {
      let d = 1;
      for (const [cx, cy, h0, a, lean, start] of CRYSTALS) {
        const lx = x - cx - lean * z, ly = y - cy;
        if (Math.abs(lx) > a * 1.6 || Math.abs(ly) > a * 1.6) continue;                                            // too far from this crystal to matter
        const h = h0 * g * (0.25 + 0.75 * clamp((e - start) / 0.6, 0, 1)), tip = 1.3 * a;
        const width = z > h - tip ? (a * (h - z)) / tip : a;                                                       // a prism, then a pointed tip
        d = Math.min(d, Math.max(Math.max(Math.abs(ly), 0.866 * Math.abs(lx) + 0.5 * Math.abs(ly)) - width, -z));   // a hexagon in section
      }
      return d;
    } },
  ],
  /**
   * k, the intensity: how tall the crystals grow.
   * 0: two thirds of full height · 0.5: full height · 1: a third as tall again
   */
  step(t, abs, k = 0.5) {
    const g = byIntensity(k, [0.65, 1, 1.3]), e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t));
    return { rock: {}, crystals: { prm: { e: Math.round(e * 1.0 * 40) / 40, g } } };
  },
};
