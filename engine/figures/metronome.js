import { subtract, roundBox, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A metronome: a tall tapering case on a plinth with a slot down its front, and in the slot a pendulum on a pivot near
 * the foot, a weight clamped part way up its rod. Move across it and it ticks: the pendulum swings from side to side
 * in its slot, a little wider each beat as it gets going. At rest it stands upright. The case is cut once; the
 * pendulum is cut again as it swings. The slot is cut right through the front so the pendulum is seen in it, never
 * behind the case.
 */
const METRO_PIVOT = 0.12, METRO_Y = 0.1;                                 // the height of the pivot, and how far forward the pendulum swings

/** how far out the case's front is at height z: it leans back as it rises */
const metroFront = (z) => 0.2 - (0.1 * z) / 0.9;

export const metronome = {
  T: 4, zr: [-0.06, 0.92], S: 380, zm: 0.4,
  active: [0, 2.4],                                              // the pendulum swings, wider each beat, ending out at one side; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 130) / 340, 0, 1),                    // across the metronome
  hint: "move across the metronome to set it ticking",
  parts: [
    { id: "case", order: 0, cell: 0.009, box: { x: [-0.5, 0.5], y: [-0.4, 0.4] }, planes: planes(-0.06, 0.92, 0.015), sdf: (x, y, z) => {
      const half = 0.28 - (0.18 * z) / 0.9, front = metroFront(z), back = -0.2 + (0.1 * z) / 0.9;
      let d = Math.max(Math.abs(x) - half, y - front, back - y, -z, z - 0.9);                                            // a tapering case
      d = subtract(d, Math.max(Math.abs(x) - (0.04 + 0.34 * clamp((z - METRO_PIVOT) / 0.7, 0, 1)), METRO_Y - 0.06 - y, 0.06 - z, z - 0.84));   // a slot down the front, wide enough for the swing
      return Math.min(d, roundBox(x, y, z + 0.03, 0.33, 0.25, 0.02, 0.012));                                              // and a plinth
    } },
    { id: "pendulum", order: 1, dynamic: true, cell: 0.006, key: (p) => p.a.toFixed(3), box: { x: [-0.42, 0.42], y: [0.03, 0.17] }, planes: planes(0.08, 0.86, 0.01), sdf: (x, y, z, { a }) => {
      const dx = x, dz = z - METRO_PIVOT, u = dx * Math.sin(a) + dz * Math.cos(a), v = dx * Math.cos(a) - dz * Math.sin(a);   // along the rod, and across it
      const rod = Math.max(Math.hypot(v, y - METRO_Y) - 0.012, -u, u - 0.7);
      const weight = roundBox(v, y - METRO_Y, u - 0.48, 0.035, 0.02, 0.035, 0.012);                                       // the weight, clamped on the rod
      return Math.min(rod, weight, Math.hypot(x, y - METRO_Y, z - METRO_PIVOT) - 0.03);                                  // and the pivot boss
    } },
  ],
  /**
   * k, the intensity: how wide it swings.
   * 0: a small swing · 0.5: a full one · 1: as wide as the slot
   */
  step(t, abs, k = 0.5) {
    const amp = byIntensity(k, [0.15, 0.3, 0.42]), beats = 4.25, e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t));
    return { case: {}, pendulum: { prm: { a: Math.round(amp * Math.min(1, e * 1.6) * Math.sin(2 * Math.PI * beats * e) * 200) / 200 } } };
  },
};
