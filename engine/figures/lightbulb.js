import { len2, smin, subtract, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A lightbulb: a glass bulb on a neck, a screw base with a real helical thread, and a filament on two posts.
 * Move up the bulb and it warms: rings of light spread out from the filament, one shell at a time, and the
 * lines flicker a little the way a filament does. At rest it is dark.
 *
 * The glass, the base and the filament are cut once; the halo is cut again as it grows. The filament and the halo are
 * overlays: the glass is drawn as stacked rings, which would hide them, so they are painted on top and show through.
 */

const CENTRE = 0.3;                                                    // the middle of the round part of the glass
/** the glass: a sphere melted into a neck. `wall` thins it, so the inside is the same shape smaller */
const glass = (x, y, z, wall) => {
  const rho = len2(x, y), t = clamp((z + 0.25) / 0.3, 0, 1);
  const bulb = Math.hypot(x, y, z - CENTRE) - (0.42 - wall);
  const neck = Math.max(rho - (0.17 + 0.15 * t * t - wall), -0.28 - z, z - 0.15);
  return smin(bulb, neck, 0.1);
};

export const lightbulb = {
  T: 4, zr: [-0.72, 0.72], S: 190, zm: 0,
  active: [0, 2],                                                      // cold to fully lit
  drive: (x, y) => clamp((430 - y) / 260, 0, 1),                       // up the bulb
  hint: "move up the bulb to switch it on",
  parts: [
    { id: "glass", order: 0, box: { x: [-0.5, 0.5], y: [-0.5, 0.5] }, planes: planes(-0.28, 0.72, 0.025),
      sdf: (x, y, z) => subtract(glass(x, y, z, 0), glass(x, y, z, 0.03)) },
    { id: "base", order: 1, box: { x: [-0.26, 0.26], y: [-0.26, 0.26] }, planes: planes(-0.72, -0.2, 0.02), sdf: (x, y, z) => {
      const rho = len2(x, y), th = Math.atan2(y, x);
      const screw = Math.max(rho - (0.185 + 0.02 * Math.cos((2 * Math.PI * z) / 0.075 - th)), -0.62 - z, z + 0.2);   // one thread, wound round the cap
      return Math.min(screw, rcyl(rho, z, 0.075, -0.72, -0.6, 0.03));                                                // the contact at the foot
    } },
    { id: "filament", order: 2, overlay: true, cell: 0.005, box: { x: [-0.12, 0.12], y: [-0.06, 0.06] }, planes: planes(-0.15, 0.33, 0.015), sdf: (x, y, z) => {
      const post = (px) => rcyl(len2(x - px, y), z, 0.02, -0.15, 0.3, 0.01);
      const coil = rcyl(len2(y, z - 0.3), x, 0.02 + 0.008 * Math.cos(x * 220), -0.075, 0.075, 0.01);                  // the coiled wire between the posts
      return Math.min(post(-0.075), post(0.075), coil);
    } },
    { id: "halo", order: 3, overlay: true, dynamic: true, cell: 0.015, key: (p) => (p ? p.n.toFixed(2) : ""),
      box: { x: [-0.4, 0.4], y: [-0.4, 0.4] }, planes: planes(-0.1, 0.7, 0.04), sdf: (x, y, z, { n }) => {
        const d = Math.hypot(x, y, z - CENTRE), whole = Math.floor(n), part = n - whole;
        let best = 1;
        for (let i = 0; i <= whole && i < 7; i++) best = Math.min(best, Math.abs(d - (0.06 + 0.05 * i)) - 0.014 * (i < whole ? 1 : part));   // shells, the outermost still forming
        return best;
      } },
  ],
  /**
   * k, the intensity: how many shells of light spread out, and how hard the filament flickers.
   * 0: a dim glow of three shells · 0.5: six shells · 1: seven shells and a hard flicker
   */
  step(t, abs, k = 0.5) {
    const g = sm(0, 2, t), shells = g * byIntensity(k, [3, 6, 7]), flicker = byIntensity(k, [0.15, 0.35, 0.6]);
    return {
      glass: {}, base: {}, filament: {},
      halo: { prm: shells > 0.25 ? { n: Math.round(shells * 4) / 4 } : null },
      pulse: 1 + flicker * g * (0.5 + 0.5 * Math.sin(abs * 21)),
    };
  },
};
