import { len2, smin, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * Still water with a drop of water hanging over it, with no tank around it: the water runs out past every edge of the page.
 * Move up and the drop falls and lands, and ripples spread out from where it hit in rings, each a contour of the water's
 * height, fainter as they go. At rest the surface is flat and the drop waits. The drop is cut once and only falls; the
 * water is cut again as it ripples.
 */
const tankLevel = 0.03;

export const rippleTank = {
  T: 4, zr: [-0.17, 0.72], S: 300, zm: 0.25,
  active: [0, 2.2],                                              // the drop falls and the ripples spread; the pose at 0 is the rest pose
  drive: (x, y) => clamp((480 - y) / 300, 0, 1),                 // up the water
  hint: "move up to drop the drop",
  parts: [
    { id: "water", order: 1, dynamic: true, cell: 0.024, key: (p) => p.tm.toFixed(2) + ":" + p.a.toFixed(2) + ":" + (p.q ?? 0).toFixed(2), box: { x: [-2.3, 2.3], y: [-2.3, 2.3] }, planes: planes(-0.09, 0.15, 0.01), sdf: (x, y, z, { tm, a, q }) => {
      const r = len2(x, y), front = 1.6 * tm, still = q === undefined ? 1 : clamp((r - q) / 0.3, 0, 1);     // q, when given, is a radius inside which the water has gone still
      const ripple = a * still * clamp((front - r) / 0.12, 0, 1) * Math.exp(-0.6 * r) * Math.cos((2 * Math.PI * (r - front)) / 0.17);
      return Math.max(z - (tankLevel + ripple), Math.max(Math.abs(x), Math.abs(y)) - 2.3, -0.1 - z);                       // water to a level that ripples, out past the page's edges
    } },
    { id: "drop", order: 2, cell: 0.007, box: { x: [-0.1, 0.1], y: [-0.1, 0.1] }, planes: planes(0.5, 0.74, 0.012), sdf: (x, y, z) =>
      smin(Math.hypot(x, y, z - 0.58) - 0.055, Math.max(len2(x, y) - 0.05 * clamp((0.72 - z) / 0.12, 0, 1), z - 0.72, 0.6 - z), 0.04) },   // a teardrop
  ],
  /**
   * k, the intensity: how big the ripples are.
   * 0: gentle rings · 0.5: clear rings · 1: deep ones
   */
  step(t, abs, k = 0.5) {
    const amp = byIntensity(k, [0.025, 0.045, 0.065]), fall = sm(0, 0.9, t), back = sm(2.9, 3.8, t), landed = t > 0.9 && t < 2.9;
    return {
      drop: { off: [0, 0, t > 2.9 ? 0 : -0.46 * fall * fall], hide: landed },
      water: { prm: { tm: Math.round(Math.max(0, t - 0.9) * 25) / 25, a: Math.round(amp * (1 - back) * 200) / 200 } },
    };
  },
};
