import { len2, smin, subtract, rcyl, byIntensity, clamp } from "../src/math.js";
import { planes } from "../src/slice.js";

const tube = (s) => (x, y, z) => {                                          // body, objective bell and eyepiece, with both lenses recessed
  const cx = s * 0.36, R = (rad, y0, y1, rr) => rcyl(len2(x - cx, z), y, rad, y0, y1, rr);
  let d = smin(R(0.3, -0.4, 0.4, 0.06), R(0.35, 0.3, 0.78, 0.05), 0.05);
  d = smin(d, R(0.2, -0.72, -0.3, 0.04), 0.05);
  return subtract(subtract(d, R(0.29, 0.7, 0.95, 0)), R(0.12, -0.9, -0.64, 0));
};

/*
 * The barrels slide apart and together to fit the eyes while the knurled focus wheel turns, one way and back.
 * The barrels and hinge are cut once and only move; the wheel is cut again as its teeth turn.
 */
export const binoculars = {
  T: 12, zr: [-0.42, 0.5], S: 195, zm: 0.04,
  active: [0, 6],                                               // the barrels slide out and the wheel turns, from the closed pose
  drive: (x) => clamp((x - 150) / 300, 0, 1),                    // across the binoculars, left to right
  hint: "move across the binoculars to focus and adjust",
  parts: [
    { id: "hinge", order: 0, box: { x: [-0.16, 0.16], y: [-0.36, 0.36] }, planes: planes(-0.03, 0.19), sdf: (x, y, z) => rcyl(len2(x, z - 0.08), y, 0.1, -0.3, 0.3, 0.05) },
    { id: "tubeL", order: 1, box: { x: [-0.8, 0.08], y: [-0.8, 0.86] }, planes: planes(-0.4, 0.4), sdf: tube(-1) },
    { id: "tubeR", order: 2, box: { x: [-0.08, 0.8], y: [-0.8, 0.86] }, planes: planes(-0.4, 0.4), sdf: tube(1) },
    { id: "wheel", order: 3, dynamic: true, key: (p) => p.ph.toFixed(2), box: { x: [-0.26, 0.26], y: [-0.18, 0.18] }, planes: planes(0.14, 0.46), sdf: (x, y, z, { ph }) => {
      const dz = z - 0.3, rad = 0.125 + 0.02 * Math.cos(10 * (Math.atan2(dz, y) + ph));      // ten teeth, turned by ph
      return Math.max(len2(y, dz) - rad, Math.abs(x) - 0.2);
    } },
  ],
  /**
   * k, the intensity: how far the barrels slide apart, and how far the wheel turns.
   * 0: barely adjusting · 0.5: as first drawn · 1: a wide adjustment and nearly a full turn of the wheel each way
   */
  step(t, abs, k = 0.5) {
    const apart = byIntensity(k, [0.03, 0.07, 0.1]), turn = byIntensity(k, [1.5, 3, 5]);
    const ipd = apart * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 12)), ph = Math.round(turn * Math.sin((2 * Math.PI * t) / 8) / 0.03) * 0.03;
    return { hinge: {}, tubeL: { off: [-ipd, 0, 0] }, tubeR: { off: [ipd, 0, 0] }, wheel: { prm: { ph } } };
  },
};
