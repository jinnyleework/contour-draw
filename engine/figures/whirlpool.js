import { len2, subtract, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A round dish of still water. Move up and a whirlpool opens in the middle: the surface sinks into a funnel and spiral
 * arms wind in toward it, turning as they go, each one a contour of the water's height. At rest the water is flat. The
 * dish is cut once; the water is cut again as it swirls.
 */
const whirlLevel = 0.03;

export const whirlpool = {
  T: 4, zr: [-0.2, 0.1], S: 300, zm: -0.05,
  active: [0, 2.4],                                              // the vortex opens and turns; the pose at 0 is the rest pose, flat
  drive: (x, y) => clamp((480 - y) / 300, 0, 1),                 // up the dish
  hint: "move up the dish to stir a whirlpool",
  parts: [
    { id: "dish", order: 0, box: { x: [-0.8, 0.8], y: [-0.8, 0.8] }, planes: planes(-0.2, 0.09, 0.012), sdf: (x, y, z) => {
      const r = len2(x, y);
      return subtract(Math.max(r - 0.62, -0.2 - z, z - 0.08), Math.max(r - 0.54, -0.17 - z));                        // a round dish, hollow, with a thick rim
    } },
    { id: "water", order: 1, dynamic: true, cell: 0.018, key: (p) => p.d.toFixed(2) + ":" + p.ph.toFixed(1), box: { x: [-0.6, 0.6], y: [-0.6, 0.6] }, planes: planes(-0.17, 0.08, 0.012), sdf: (x, y, z, { d, ph }) => {
      const r = len2(x, y), dip = d * Math.exp(-Math.pow(r / 0.22, 1.5)), arms = d > 0.01 ? 0.016 * (d / (d + 0.05)) * (1 - Math.exp(-r / 0.08)) * Math.exp(-r / 0.5) * Math.cos(2 * Math.atan2(y, x) - 11 * r + ph) : 0;
      return Math.max(z - (whirlLevel - dip + arms), r - 0.53, -0.17 - z);                                          // water to a level that sinks and spirals
    } },
  ],
  /**
   * k, the intensity: how deep the vortex goes.
   * 0: a shallow dimple · 0.5: a clear funnel · 1: nearly to the floor
   */
  step(t, abs, k = 0.5) {
    const depth = byIntensity(k, [0.08, 0.15, 0.19]), e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t));
    return { dish: {}, water: { prm: { d: Math.round(depth * e * 100) / 100, ph: Math.round(e * 14 * 5) / 5 } } };
  },
};
