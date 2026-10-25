import { len2, subtract, roundBox, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A brass telescope on a tripod, lying level along x with its eyepiece at the left: a main tube, two draw tubes nested
 * in it, a focusing knob, and a hooded lens at the far end. Move across it and the draw tubes slide out in two stages
 * while the focusing knob turns. At rest it is collapsed. The tripod and tubes are cut once and the tubes only move;
 * the knob is cut again as its teeth turn.
 */
const FOCUS_X = -0.4;                                                    // where the focusing knob sits along the tube

/** a leg: the distance to a rod from (ax, ay, az) to (bx, by, bz), thinner than a tube */
const scopeRod = (x, y, z, [ax, ay, az], [bx, by, bz], r) => {
  const dx = bx - ax, dy = by - ay, dz = bz - az, t = clamp(((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / (dx * dx + dy * dy + dz * dz), 0, 1);
  return Math.hypot(x - ax - t * dx, y - ay - t * dy, z - az - t * dz) - r;
};
const scopeTube = (r, x0, x1) => (x, y, z) => rcyl(len2(y, z), x, r, x0, x1, 0.015);

export const telescope = {
  T: 4, zr: [-0.65, 0.14], S: 360, zm: -0.25,
  active: [0, 2],                                                // the draw tubes slide out and the knob turns; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 120) / 360, 0, 1),                    // across the telescope
  hint: "move across the telescope to draw it out and focus",
  parts: [
    { id: "stand", order: 0, cell: 0.009, box: { x: [-0.65, 0.35], y: [-0.55, 0.55] }, planes: planes(-0.65, -0.12, 0.01), sdf: (x, y, z) => {
      let d = Math.min(roundBox(x + 0.15, y, z + 0.15, 0.08, 0.08, 0.015, 0.015), rcyl(len2(x + 0.15, y), z, 0.045, -0.3, -0.12, 0.01));   // a saddle on a column
      for (let k = 0; k < 3; k++) {                                                                                                         // three splayed legs
        const a = Math.PI / 2 + (k * 2 * Math.PI) / 3;
        d = Math.min(d, scopeRod(x, y, z, [-0.15, 0, -0.27], [-0.15 + 0.4 * Math.cos(a), 0.4 * Math.sin(a), -0.62], 0.028));
      }
      return d;
    } },
    { id: "main", order: 1, box: { x: [-0.9, 0.1], y: [-0.2, 0.2] }, planes: planes(-0.14, 0.14, 0.02), sdf: (x, y, z) =>
      Math.min(scopeTube(0.13, -0.6, 0)(x, y, z), scopeTube(0.05, -0.76, -0.58)(x, y, z), scopeTube(0.07, -0.76, -0.72)(x, y, z)) },              // the main tube, its eyepiece and its eye cup
    { id: "draw1", order: 2, box: { x: [-0.4, 0.4], y: [-0.17, 0.17] }, planes: planes(-0.11, 0.11, 0.02), sdf: scopeTube(0.1, -0.3, 0.2) },
    { id: "draw2", order: 3, box: { x: [-0.2, 0.4], y: [-0.14, 0.14] }, planes: planes(-0.1, 0.1, 0.02), sdf: (x, y, z) =>
      subtract(Math.min(scopeTube(0.075, -0.1, 0.3)(x, y, z), scopeTube(0.095, 0.24, 0.3)(x, y, z)), scopeTube(0.06, 0.26, 0.4)(x, y, z)) },        // the last stage and its hood, open at the end
    { id: "knob", order: 4, dynamic: true, cell: 0.007, key: (p) => p.ph.toFixed(2), box: { x: [FOCUS_X - 0.09, FOCUS_X + 0.09], y: [0.1, 0.3] }, planes: planes(-0.07, 0.07, 0.015), sdf: (x, y, z, { ph }) => {
      const a = Math.atan2(z, x - FOCUS_X) + ph, teeth = 0.05 + 0.008 * Math.cos(10 * a);
      return Math.min(rcyl(len2(x - FOCUS_X, z), y, teeth, 0.17, 0.25, 0.01), rcyl(len2(x - FOCUS_X, z), y, 0.02, 0.1, 0.18, 0));   // a toothed knob on its spindle
    } },
  ],
  /**
   * k, the intensity: how far each draw tube slides out.
   * 0: a short draw · 0.5: as drawn · 1: nearly half again as far
   */
  step(t, abs, k = 0.5) {
    const reach = byIntensity(k, [0.1, 0.2, 0.26]), e = sm(0, 1.6, t) * (1 - sm(2.8, 3.8, t));
    return {
      stand: {}, main: {}, draw1: { off: [reach * e, 0, 0] }, draw2: { off: [2 * reach * e, 0, 0] },
      knob: { prm: { ph: Math.round((e * 5 * Math.PI) / 0.04) * 0.04 } },
    };
  },
};
