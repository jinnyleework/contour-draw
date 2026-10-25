import { len2, smin, roundBox, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A carousel: a stepped plinth with a turntable, a central column under a scalloped canopy, and six horses on poles
 * ringing the turntable. Move across it and the horses spin up round the column, each bobbing on its pole a little
 * after the one before. At rest everything is still. The plinth and canopy are cut once; the ring of horses is cut
 * again as it turns.
 */
const RIDE = 0.34, POLES = 6;

/** one horse on its pole, at angle th round the column: a body, a head on a neck, and the pole through them */
const horse = (x, y, z, th, bob) => {
  const c = Math.cos(th), s = Math.sin(th), dx = x - RIDE * c, dy = y - RIDE * s, v = -dx * s + dy * c, u = dx * c + dy * s, w = z - (0.32 + bob);
  const body = roundBox(v, u, w, 0.07, 0.025, 0.03, 0.03), head = roundBox(v - 0.1, u, w - 0.05, 0.012, 0.02, 0.04, 0.02);
  return Math.min(smin(body, head, 0.03), Math.max(len2(u, v) - 0.027, 0.04 - z, z - 0.62));
};

export const carousel = {
  T: 4, zr: [-0.1, 0.92], S: 260, zm: 0.4,
  active: [0, 2.4],                                              // the ride spins up from standing; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 150) / 300, 0, 1),                    // across the carousel
  hint: "move across the carousel to spin it up",
  parts: [
    { id: "base", order: 0, box: { x: [-0.7, 0.7], y: [-0.7, 0.7] }, planes: planes(-0.1, 0.62), sdf: (x, y, z) => {
      const r = len2(x, y);
      return Math.min(rcyl(r, z, 0.6, -0.1, 0, 0.02), rcyl(r, z, 0.52, 0, 0.04, 0.015), rcyl(r, z, 0.07, 0, 0.62, 0.02));   // plinth, turntable, column
    } },
    { id: "canopy", order: 1, box: { x: [-0.7, 0.7], y: [-0.7, 0.7] }, planes: planes(0.62, 0.9), sdf: (x, y, z) => {
      const r = len2(x, y), scallop = 0.026 * Math.cos(10 * Math.atan2(y, x)), t = clamp((z - 0.68) / 0.18, 0, 1);
      const roof = Math.max(r - (0.55 + scallop) * (1 - 0.9 * t * t), 0.64 - z, z - 0.86);                          // a scalloped skirt rising to a cone
      return Math.min(roof, Math.hypot(x, y, z - 0.88) - 0.03, rcyl(r, z, 0.07, 0.62, 0.68, 0.02));
    } },
    { id: "ride", order: 2, dynamic: true, cell: 0.015, key: (p) => p.ph.toFixed(2), box: { x: [-0.5, 0.5], y: [-0.5, 0.5] }, planes: planes(0.04, 0.62, 0.02), sdf: (x, y, z, { ph }) => {
      const step = (2 * Math.PI) / POLES, i = Math.round((Math.atan2(y, x) - ph) / step);                     // only the nearest horse can matter, so only it is measured
      return horse(x, y, z, ph + i * step, 0.07 * Math.sin(2 * ph + (((i % POLES) + POLES) % POLES) * 1.3));
    } },
  ],
  /**
   * k, the intensity: how many turns it spins up through.
   * 0: one turn · 0.5: two · 1: four
   */
  step(t, abs, k = 0.5) {
    const turns = byIntensity(k, [1, 2, 4]), back = sm(3, 4, t), ph = Math.round((turns * 2 * Math.PI * sm(0, 2.4, t) * (1 - back)) / 0.04) * 0.04;
    return { base: {}, canopy: {}, ride: { prm: { ph } } };
  },
};
