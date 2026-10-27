import { len2, subtract, roundBox, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A film projector: a body on short feet with a lens to the right, and two reels lying flat on posts above it, the
 * feed reel and the take-up reel, each with three round windows through its web. Move across it and it runs: both
 * reels turn and a flat fan of light opens out of the lens across the page. At rest it is dark and still. The body is
 * cut once; the reels are cut again as they turn, and the beam as it opens.
 */
const PROJ_X = -0.25, PROJ_LENS = [0.18, 0.13];                          // where the body sits, and the lens's end and height
const PROJ_REELS = [{ x: -0.42, r: 0.2, z: 0.42 }, { x: -0.06, r: 0.17, z: 0.34 }];   // the feed reel, high, and the take-up reel, lower

export const filmProjector = {
  T: 4, zr: [0, 0.5], S: 330, zm: 0.18,
  active: [0, 2.4],                                              // the reels turn and the beam opens; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 130) / 340, 0, 1),                    // across the projector
  hint: "move across the projector to run the film",
  parts: [
    { id: "body", order: 0, cell: 0.009, box: { x: [-0.75, 0.4], y: [-0.35, 0.35] }, planes: planes(0, 0.42, 0.012), sdf: (x, y, z) => {
      let d = roundBox(x - PROJ_X, y, z - 0.15, 0.28, 0.15, 0.1, 0.035);                                              // the body
      d = Math.min(d, subtract(rcyl(len2(y, z - PROJ_LENS[1]), x, 0.07, 0.0, PROJ_LENS[0], 0.015), rcyl(len2(y, z - PROJ_LENS[1]), x, 0.045, 0.12, 0.3, 0)));   // the lens, its glass recessed
      for (const fx of [-0.45, -0.05]) for (const fy of [-0.1, 0.1]) d = Math.min(d, rcyl(len2(x - fx, y - fy), z, 0.03, 0, 0.06, 0.01));   // feet
      for (const r of PROJ_REELS) d = Math.min(d, rcyl(len2(x - r.x, y), z, 0.018, 0.2, r.z, 0.006));                  // a post for each reel
      return d;
    } },
    { id: "reels", order: 1, dynamic: true, cell: 0.009, key: (p) => p.ph.toFixed(2), box: { x: [-0.66, 0.15], y: [-0.25, 0.25] }, planes: planes(0.3, 0.46, 0.01), sdf: (x, y, z, { ph }) => {
      let d = 1;
      for (const r of PROJ_REELS) {
        const dx = x - r.x, rr = len2(dx, y);
        if (rr > r.r + 0.02 || Math.abs(z - r.z) > 0.04) continue;
        let reel = rcyl(rr, z, r.r, r.z - 0.02, r.z + 0.02, 0.008);                                                    // a flat reel
        for (let k = 0; k < 3; k++) { const a = ph * (0.17 / r.r) + (k * 2 * Math.PI) / 3; reel = Math.max(reel, -(len2(dx - r.r * 0.55 * Math.cos(a), y - r.r * 0.55 * Math.sin(a)) - r.r * 0.27)); }
        d = Math.min(d, reel);                                                                                          // with three round windows, turning with it
      }
      return d;
    } },
    { id: "beam", order: 2, dynamic: true, cell: 0.016, key: (p) => (p ? p.L.toFixed(2) : ""), box: { x: [0.1, 1.0], y: [-0.35, 0.35] }, planes: planes(PROJ_LENS[1] - 0.05, PROJ_LENS[1] + 0.05, 0.012), sdf: (x, y, z, { L }) => {
      const u = x - PROJ_LENS[0];
      return Math.max(-u, u - L, Math.abs(y) - (0.05 + 0.32 * u), Math.abs(z - PROJ_LENS[1]) - (0.02 + 0.04 * u));    // a flat fan of light, widening away from the lens
    } },
  ],
  /**
   * k, the intensity: how far the beam reaches.
   * 0: a short throw · 0.5: across the page · 1: to the edge
   */
  step(t, abs, k = 0.5) {
    const reach = byIntensity(k, [0.35, 0.55, 0.72]), e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t)), L = reach * sm(0, 0.5, e * 2.4);
    return { body: {}, reels: { prm: { ph: Math.round(-e * 12 * 25) / 25 } }, beam: { prm: L > 0.04 ? { L: Math.round(L * 40) / 40 } : null } };
  },
};
