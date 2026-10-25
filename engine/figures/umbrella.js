import { len2, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * An umbrella standing on its tip, handle down: a thin shaft with a crooked handle, and a canopy that rides up the
 * shaft's length. Move up it and the canopy opens from a furled spike into a scalloped dome, its rim spreading and
 * rising as it goes. At rest it is furled. The shaft and handle are cut once; the canopy is cut again as it opens.
 */
const BRELLA_TOP = 0.6, SKIN = 0.03;                                    // where the canopy's apex stays, and how thick its skin is

/** the canopy at openness o: a paraboloid skin that widens and shortens as it opens, with an eight-lobed rim */
const canopy = (x, y, z, { o }) => {
  const r = len2(x, y), R = (0.1 + 0.46 * o) * (1 + 0.05 * o * Math.cos(8 * Math.atan2(y, x))), h = 0.7 - 0.45 * o;
  const rOut = R * Math.sqrt(Math.max(0, (BRELLA_TOP - z) / h)), rIn = R * Math.sqrt(Math.max(0, (BRELLA_TOP - SKIN - z) / h));
  return Math.max(r - rOut, -(r - rIn), BRELLA_TOP - h - z, z - BRELLA_TOP);                                   // between the outer and the inner paraboloid
};

export const umbrella = {
  T: 4, zr: [-0.82, 0.7], S: 270, zm: -0.06,
  active: [0, 2.2],                                              // the canopy opens; the pose at 0 is the rest pose, furled
  drive: (x, y) => clamp((480 - y) / 300, 0, 1),                 // up the umbrella
  hint: "move up the umbrella to open it",
  parts: [
    { id: "shaft", order: 0, cell: 0.007, box: { x: [-0.2, 0.2], y: [-0.12, 0.12] }, planes: planes(-0.84, 0.7, 0.01), sdf: (x, y, z) => {
      const hook = Math.max(Math.hypot(len2(x - 0.075, z + 0.72) - 0.075, y) - 0.025, z + 0.72);              // a half ring below the shaft: the crook
      return Math.min(rcyl(len2(x, y), z, 0.024, -0.72, 0.62, 0.01), hook, Math.hypot(x, y, z - 0.66) - 0.028);   // the shaft, the crook, a ferrule at the tip
    } },
    { id: "canopy", order: 1, dynamic: true, cell: 0.01, key: (p) => p.o.toFixed(2), box: { x: [-0.62, 0.62], y: [-0.62, 0.62] }, planes: planes(-0.12, BRELLA_TOP, 0.03), sdf: canopy },
  ],
  /**
   * k, the intensity: how wide it opens.
   * 0: part open · 0.5: well open · 1: wide open
   */
  step(t, abs, k = 0.5) {
    const wide = byIntensity(k, [0.6, 0.85, 1]), e = sm(0, 1.6, t) * (1 - sm(2.8, 3.8, t));
    return { shaft: {}, canopy: { prm: { o: Math.round((0.06 + (wide - 0.06) * e) * 40) / 40 } } };
  },
};
