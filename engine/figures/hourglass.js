import { len2, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * An hourglass between two plates held by two posts: two glass bulbs joined at a narrow neck, sand in the top one.
 * Move across it and the sand runs: the top level drops with a funnel opening in it, a thin stream falls through the
 * neck, and a mound builds in the lower bulb. At rest the top is full. The glass, plates and posts are cut once; the
 * sand is cut again as it runs. The posts stand at the sides, not in front of or behind the glass: the painter orders by
 * height alone, so a post that overlapped the glass on the page would be hidden by it.
 */
const glassRadius = (z) => 0.035 + 0.345 * Math.pow(Math.sin(Math.PI * clamp(Math.abs(z) / 0.9, 0, 1)), 0.7);   // the inside radius of the glass at height z

export const hourglass = {
  T: 4, zr: [-0.97, 0.97], S: 290, zm: 0,
  active: [0, 2.4],                                              // the sand runs; the pose at 0 is the rest pose, top full
  drive: (x) => clamp((x - 150) / 300, 0, 1),                    // across the hourglass
  hint: "move across the hourglass to run the sand",
  parts: [
    { id: "glass", order: 0, cell: 0.014, box: { x: [-0.5, 0.5], y: [-0.5, 0.5] }, planes: planes(-0.97, 0.97, 0.035), sdf: (x, y, z) => {
      const r = len2(x, y), shell = Math.max(r - glassRadius(z) - 0.022, -(r - glassRadius(z)), Math.abs(z) - 0.9);    // hollow glass, two bulbs on a neck
      return Math.min(shell, rcyl(r, z, 0.46, 0.9, 0.97, 0.02), rcyl(r, z, 0.46, -0.97, -0.9, 0.02));                 // and a plate at each end
    } },
    { id: "posts", order: 1, cell: 0.014, box: { x: [-0.55, 0.55], y: [-0.55, 0.55] }, planes: planes(-0.9, 0.9, 0.016), sdf: (x, y, z) => {
      let d = 1;
      for (const a of [2.53, -0.61]) d = Math.min(d, rcyl(len2(x - 0.42 * Math.cos(a), y - 0.42 * Math.sin(a)), z, 0.028, -0.91, 0.91, 0.01));
      return d;                                                                                                       // two posts between the plates, at the sides as you first see it
    } },
    { id: "sand", order: 2, dynamic: true, cell: 0.022, key: (p) => p.f.toFixed(2), box: { x: [-0.42, 0.42], y: [-0.42, 0.42] }, planes: planes(-0.88, 0.85, 0.03), sdf: (x, y, z, { f }) => {
      const r = len2(x, y), inside = r - glassRadius(z) + 0.015;
      const topLevel = 0.82 - 0.76 * f - 0.1 * Math.exp(-(r * r) / 0.01) * clamp(f * 20, 0, 1);                          // the top surface, dipping at the middle
      const top = Math.max(inside, z - topLevel, 0.04 - z);
      const mound = Math.max(inside, z - (-0.86 + 0.7 * f * Math.pow(Math.max(0, 1 - r / 0.34), 0.9) + 0.03 * f), -0.88 - z, z);   // the pile below
      const stream = f > 0.02 && f < 0.97 ? Math.max(r - 0.02, z - 0.06, -0.86 + 0.7 * f - z) : 1;                       // a thin stream between them
      return Math.min(top, mound, stream);
    } },
  ],
  /**
   * k, the intensity: how much sand runs.
   * 0: two fifths · 0.5: most of it · 1: nearly all
   */
  step(t, abs, k = 0.5) {
    const run = byIntensity(k, [0.4, 0.7, 0.95]), e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t));
    return { glass: {}, posts: {}, sand: { prm: { f: Math.round(run * e * 50) / 50 } } };
  },
};
