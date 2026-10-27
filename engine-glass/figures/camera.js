import { len2, smin, subtract, roundBox, rcyl, sm, byIntensity, clamp } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * The lens zooms out on two telescoping stages, the shutter button dips, the whole drawing goes heavier for a beat,
 * the lens comes back. The body is cut once; the lens is cut again as it extends; the button only moves.
 */
export const camera = {
  T: 6.5, zr: [-0.4, 0.56], S: 195, zm: 0.08,
  active: [1.0, 3.2],                                           // the lens zooms out, the shutter fires, the button lets go
  drive: (x) => clamp((x - 170) / 260, 0, 1),                    // across the camera, left to right
  hint: "move across the camera to zoom and shoot",
  parts: [
    { id: "body", order: 0, box: { x: [-0.9, 0.9], y: [-0.3, 0.32] }, planes: planes(-0.4, 0.56), sdf: (x, y, z) => {
      let d = smin(roundBox(x, y, z, 0.74, 0.18, 0.3, 0.06), roundBox(x, y + 0.02, z - 0.38, 0.18, 0.12, 0.1, 0.05), 0.03);     // body and prism hump
      d = smin(d, roundBox(x - 0.62, y - 0.2, z, 0.1, 0.06, 0.28, 0.04), 0.04);                                                 // grip
      d = smin(d, rcyl(len2(x - 0.12, z), y, 0.31, 0.1, 0.26, 0.04), 0.03);                                                     // lens mount
      d = subtract(d, roundBox(x + 0.55, y - 0.24, z - 0.12, 0.08, 0.03, 0.05, 0.01));                                          // rangefinder window
      return Math.min(d, rcyl(len2(x + 0.5, y), z, 0.12, 0.26, 0.36, 0.03));                                                    // mode dial
    } },
    { id: "lens", order: 1, dynamic: true, key: (p) => p.zoom.toFixed(2), box: { x: [-0.2, 0.44], y: [0.04, 1.1] }, planes: planes(-0.3, 0.3), sdf: (x, y, z, { zoom }) => {
      const lr = len2(x - 0.12, z), L1 = 0.42 + 0.14 * zoom, L2 = L1 + 0.16 * zoom;
      let d = Math.min(rcyl(lr, y, 0.26, 0.1, L1, 0.05), rcyl(lr, y, 0.21, L1 - 0.1, L2, 0.04));                                // two stages
      d = subtract(d, rcyl(lr, y, 0.17, L2 - 0.07, L2 + 0.3, 0));                                                               // recessed glass
      return Math.min(d, rcyl(lr, y, 0.1, L2 - 0.11, L2 - 0.01, 0.03));
    } },
    { id: "button", order: 2, box: { x: [0.44, 0.66], y: [-0.11, 0.11] }, planes: planes(0.22, 0.4), sdf: (x, y, z) => rcyl(len2(x - 0.55, y), z, 0.07, 0.26, 0.36, 0.02) },
  ],
  /**
   * k, the intensity: how far the lens zooms, and how hard the flash lands.
   * 0: a short zoom and a faint flash · 0.5: as first drawn · 1: half again as far, and a flash that almost triples the weight
   */
  step(t, abs, k = 0.5) {
    const reach = byIntensity(k, [0.5, 1, 1.5]), flash = byIntensity(k, [0.5, 1.4, 2.4]);
    const zoom = reach * sm(1.2, 2.2, t) * (1 - sm(3.8, 4.8, t)), press = sm(2.55, 2.7, t) * (1 - sm(2.85, 3.2, t));
    return { body: {}, lens: { prm: { zoom } }, button: { off: [0, 0, -0.04 * press] }, pulse: 1 + flash * Math.exp(-(((t - 2.75) / 0.09) ** 2)) };
  },
};
