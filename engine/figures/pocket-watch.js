import { len2, subtract, rcyl, segDist, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A pocket watch lying face up, twelve o'clock away from you: a thick case with a raised bezel, twelve hour studs on
 * the dial, a crown and a bow behind it, and two hands showing ten past ten. Move across it and the hands run, the
 * minute hand round many times for each turn of the hour hand. At rest it is stopped. The case and bow are cut once;
 * the hands are cut again as they turn.
 */
const WATCH_TOP = 0.2, STUD = 0.16;                                      // the top of the case, and the dial it rings
const bearing = (a) => [Math.sin(a), -Math.cos(a)];                      // a clockwise angle from twelve, as a direction on the ground

/** a tapered hand from the middle out to `len` along angle a, `w` wide at the root */
const hand = (x, y, a, len, w) => {
  const [dx, dy] = bearing(a), t = clamp((x * dx + y * dy) / len, 0, 1);
  return segDist(x, y, 0, 0, dx * len, dy * len) - w * (1 - 0.6 * t);
};

export const pocketWatch = {
  T: 4, zr: [0, 0.3], S: 300, zm: 0.12,
  active: [0, 2.4],                                              // the hands run from ten past ten; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 150) / 300, 0, 1),                    // across the watch
  hint: "move across the watch to run the hands",
  parts: [
    { id: "case", order: 0, box: { x: [-0.65, 0.65], y: [-0.65, 0.65] }, planes: planes(0, WATCH_TOP + 0.02, 0.02), sdf: (x, y, z) => {
      const r = len2(x, y);
      let d = subtract(rcyl(r, z, 0.5, 0, WATCH_TOP, 0.05), rcyl(r, z, 0.42, STUD, 0.5, 0));                       // a thick case, its face sunk inside the bezel
      for (let k = 0; k < 12; k++) {                                                                                // twelve hour studs, the quarters larger
        const [dx, dy] = bearing((k * Math.PI) / 6);
        d = Math.min(d, rcyl(len2(x - 0.34 * dx, y - 0.34 * dy), z, k % 3 ? 0.022 : 0.034, STUD, STUD + 0.045, 0.01));
      }
      return d;
    } },
    { id: "bow", order: 1, cell: 0.007, box: { x: [-0.12, 0.12], y: [-0.82, -0.44] }, planes: planes(-0.06, 0.26, 0.01), sdf: (x, y, z) =>
      Math.min(len2(len2(y + 0.67, z - 0.1) - 0.11, x) - 0.022, rcyl(len2(x, z - 0.1), y, 0.06, -0.58, -0.47, 0.015)) },       // the bow ring, and the crown it sits on
    { id: "hands", order: 2, dynamic: true, cell: 0.008, key: (p) => p.a.toFixed(2), box: { x: [-0.4, 0.4], y: [-0.4, 0.4] }, planes: planes(0.215, 0.275, 0.015), sdf: (x, y, z, { a }) => {
      const minute = Math.max(hand(x, y, a + 1.05, 0.37, 0.018), Math.abs(z - 0.26) - 0.014);                      // the minute hand lies over the hour hand
      const hour = Math.max(Math.min(hand(x, y, a / 12 + 5.32, 0.25, 0.03), len2(x, y) - 0.045), Math.abs(z - 0.23) - 0.014);
      return Math.min(minute, hour);
    } },
  ],
  /**
   * k, the intensity: how many times the minute hand goes round.
   * 0: once · 0.5: three times · 1: six times
   */
  step(t, abs, k = 0.5) {
    const turns = byIntensity(k, [1, 3, 6]), back = sm(3, 4, t);
    return { case: {}, bow: {}, hands: { prm: { a: Math.round((turns * 2 * Math.PI * sm(0, 2.4, t) * (1 - back)) / 0.04) * 0.04 } } };
  },
};
