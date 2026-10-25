import { len2, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A stovetop percolator: a pot that bellies and narrows, with a ribbed band, a loop handle on one side and a spout on
 * the other, a domed lid, and a glass knob on top. Move up it and it starts to perk: bubbles rise one after another
 * through the glass knob and gather at its crown. At rest the knob is clear. The pot and glass are cut once; the
 * bubbles are overlays (the glass is drawn as rings, which would hide them) and are cut again as they rise.
 */
const KNOB_Z = 0.94;                                                     // the middle of the glass knob

/** the pot's radius at height z */
const potRadius = (z) => (z < 0.2 ? 0.3 + 0.02 * (z / 0.2) : z < 0.55 ? 0.32 - 0.06 * ((z - 0.2) / 0.35) : 0.26 - 0.07 * clamp((z - 0.55) / 0.2, 0, 1));

export const percolator = {
  T: 4, zr: [0, 1.05], S: 380, zm: 0.5,
  active: [0, 2.2],                                              // the bubbles start and rise; the pose at 0 is the rest pose
  drive: (x, y) => clamp((480 - y) / 300, 0, 1),                 // up the percolator
  hint: "move up the percolator to start it perking",
  parts: [
    { id: "pot", order: 0, cell: 0.01, box: { x: [-0.7, 0.65], y: [-0.4, 0.4] }, planes: planes(0, 0.9, 0.012), sdf: (x, y, z) => {
      const r = len2(x, y);
      let d = Math.max(r - potRadius(z), -z, z - 0.86);                                                              // the body
      d = Math.min(d, rcyl(r, z, 0.23, 0.74, 0.86, 0.03), Math.max(Math.abs(r - (potRadius(z) + 0.01)) - 0.012, Math.abs(z - 0.5) - 0.025));   // a domed lid, a band round the waist
      d = Math.min(d, Math.hypot(len2(x + 0.42, z - 0.42) - 0.2, y) - 0.032);                                       // a loop handle
      const sx = x - 0.3, sz = z - 0.66, t = clamp((sx * 0.14 + sz * 0.16) / 0.0452, 0, 1);                         // and a spout, sloping up and out
      return Math.min(d, Math.hypot(sx - t * 0.14, y, sz - t * 0.16) - 0.045);
    } },
    { id: "glass", order: 1, cell: 0.006, box: { x: [-0.16, 0.16], y: [-0.16, 0.16] }, planes: planes(0.84, 1.06, 0.014), sdf: (x, y, z) =>
      Math.max(Math.hypot(x, y, z - KNOB_Z) - 0.1, -(Math.hypot(x, y, z - KNOB_Z) - 0.088), 0.86 - z) },       // a hollow glass dome
    { id: "bubbles", order: 2, overlay: true, dynamic: true, cell: 0.005, key: (p) => p ? p.n.toFixed(1) : "", box: { x: [-0.1, 0.1], y: [-0.1, 0.1] }, planes: planes(0.86, 1.02, 0.012), sdf: (x, y, z, { n }) => {
      let d = 1;
      for (let i = 0; i < 12; i++) {
        const p = clamp(n - i, 0, 1) * 0.5 + clamp(n - i - 1, 0, 1) * 0.5;                                          // how far bubble i has risen, once it has been let go
        if (n <= i) continue;
        d = Math.min(d, Math.hypot(x - 0.045 * Math.sin(i * 2.4), y - 0.045 * Math.cos(i * 1.7), z - (0.89 + 0.1 * p + 0.01 * (i % 3))) - (0.014 + 0.004 * (i % 3)));
      }
      return d;
    } },
  ],
  /**
   * k, the intensity: how many bubbles it perks.
   * 0: four · 0.5: eight · 1: twelve
   */
  step(t, abs, k = 0.5) {
    const count = byIntensity(k, [4, 8, 12]), n = sm(0, 2.2, t) * (1 - sm(2.9, 3.8, t)) * (count + 1);
    return { pot: {}, glass: {}, bubbles: { prm: n > 0.5 ? { n: Math.round(n * 2) / 2 } : null } };
  },
};
