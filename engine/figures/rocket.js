import { len2, smin, subtract, rcyl, byIntensity, clamp } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * The rocket sits, ignites and shakes, rises a short way on a flame that swells, hovers on it, then settles
 * as the flame withdraws. The body is cut once; the flame is cut again as it changes, a few times a second.
 */
export const rocket = {
  T: 9, zr: [-0.86, 0.98], S: 150, zm: 0.1,
  /** the stretch of the loop the cursor scrubs: from the pad to the full hover. The pose at its start is the rest pose. */
  active: [1.2, 5.8],
  /** the cursor's page position -> how far through that stretch, 0 to 1: up the rocket is a launch */
  drive: (x, y) => clamp((450 - y) / 320, 0, 1),
  hint: "move up the rocket to launch it",
  parts: [
    { id: "body", order: 0, box: { x: [-0.7, 0.7], y: [-0.7, 0.7] }, planes: planes(-0.86, 0.98), sdf: (x, y, z) => {
      const rho = len2(x, y), t = (z - 0.3) / 0.67;
      const r = z > 0.3 ? 0.28 * Math.pow(Math.max(0, 1 - t), 0.65) : z > -0.6 ? 0.28 : 0.17 + (-0.6 - z) * 0.4;   // ogive nose, body, flared skirt
      let d = subtract(Math.max(rho - r, z - 0.97, -0.85 - z), Math.max(rho - 0.12, z + 0.72));                    // hollow nozzle
      const f = 0.96, u0 = x * Math.cos(f) + y * Math.sin(f), v0 = -x * Math.sin(f) + y * Math.cos(f);              // portholes face the default view
      d = subtract(subtract(d, rcyl(len2(v0, z - 0.1), u0, 0.12, 0.2, 0.5, 0)), rcyl(len2(v0, z + 0.2), u0, 0.07, 0.2, 0.5, 0));
      for (let k = 0; k < 3; k++) {                                                                                  // three swept fins
        const a = f + Math.PI / 3 + (k * 2 * Math.PI) / 3, u = x * Math.cos(a) + y * Math.sin(a), v = -x * Math.sin(a) + y * Math.cos(a);
        d = smin(d, Math.max(Math.abs(v) - 0.03, 0.15 - u, -0.7 - z, z + 0.1, (u - (0.62 - 0.55 * (z + 0.7))) * 0.8), 0.04);
      }
      return d;
    } },
    { id: "flame", order: 1, dynamic: true, key: (p) => (p ? p.L.toFixed(2) + ":" + p.tm.toFixed(2) : ""),
      box: { x: [-0.26, 0.26], y: [-0.26, 0.26] }, planes: planes(-2.6, -0.86), sdf: (x, y, z, { L, tm }) => {
        const s = (-0.85 - z) / L;                                          // 0 at the nozzle, 1 at the tip of the flame
        if (s < 0 || s > 1) return 1;
        const rho = len2(x, y);
        const rad = 0.11 * (0.8 + 0.4 * L) * Math.pow(1 - s, 0.9) * (1 + s * (0.18 * Math.sin(s * 16 - tm * 28) + 0.25 * Math.sin(Math.atan2(y, x) * 3 + tm * 11)));
        return rho - rad;
      } },
  ],
  /**
   * k, the intensity: how far it rises, and how big the flame swells.
   * 0: a low hop on a modest flame · 0.5: as first drawn · 1: a high hover on a flame twice the length
   */
  step(t, abs, k = 0.5) {
    const rise = byIntensity(k, [0.1, 0.3, 0.55]), fl = byIntensity(k, [0.7, 1.24, 1.6]) / 1.24;      // fl scales every flame length
    let z = 0, L = 0, amp = 0;
    if (t < 1.2) { /* waiting on the pad */ }
    else if (t < 2.6) { const u = (t - 1.2) / 1.4; L = 0.62 * u * fl; amp = 0.005 * u; }                                                          // ignition: the flame catches and grows
    else if (t < 5.2) { const u = (t - 2.6) / 2.6, e = u * u * (3 - 2 * u); z = rise * e; L = (0.62 + 0.62 * e) * fl; amp = 0.006 * (1 - e) + 0.0015; }   // a short, heavy lift while the flame swells
    else if (t < 6.4) { z = rise; L = (1.24 + 0.05 * Math.sin((t - 5.2) * 9)) * fl; amp = 0.0015; }                                                        // hovering on a full, throbbing flame
    else if (t < 8.2) { const u = (t - 6.4) / 1.8, e = u * u * (3 - 2 * u); z = rise * (1 - e); L = 1.24 * fl * (1 - e); amp = 0.0015 * (1 - e); }         // it settles and the flame withdraws
    const off = [amp * Math.sin(abs * 70), amp * 0.7 * Math.cos(abs * 53), z];
    return { body: { off }, flame: { off, prm: L > 0.03 ? { L: Math.round(L * 50) / 50, tm: Math.floor(abs * 24) / 24 } : null } };
  },
};
