import { len2, smin, subtract, roundBox, rcyl, segDist, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A record player: a plinth, a platter with a ring of strobe teeth, a record with its label and a mark on the
 * label, and a tonearm on a pivot. Move across it and the tonearm swings in over the record and drops, then the
 * platter spins up: the teeth and the mark turn so you can see it. At rest the arm is parked and the platter still.
 *
 * The plinth and the pivot are cut once; the platter is cut again as it turns, the arm as it swings.
 */

const PIVOT = [0.42, -0.36], ARM = 0.62, PARKED = Math.PI / 2, PLAYING = Math.PI - 0.35;   // the arm's angle, in plan, parked and over the record
const FINE = 0.015;

export const recordPlayer = {
  T: 5, zr: [-0.05, 0.34], S: 290, zm: 0.14,
  active: [0, 3.2],
  drive: (x) => clamp((x - 130) / 340, 0, 1),                          // across the turntable
  hint: "move across the turntable to drop the needle",
  parts: [
    { id: "plinth", order: 0, box: { x: [-0.75, 0.75], y: [-0.65, 0.65] }, planes: planes(-0.05, 0.13, FINE),
      sdf: (x, y, z) => roundBox(x, y, z - 0.04, 0.58, 0.46, 0.04, 0.05) },
    { id: "pivot", order: 1, box: { x: [0.3, 0.56], y: [-0.5, -0.22] }, planes: planes(0.12, 0.3, FINE), sdf: (x, y, z) => {
      const r = len2(x - PIVOT[0], y - PIVOT[1]);
      return Math.min(rcyl(r, z, 0.075, 0.12, 0.16, 0.01), rcyl(r, z, 0.045, 0.12, 0.3, 0.012));
    } },
    { id: "platter", order: 2, dynamic: true, cell: 0.012, key: (p) => p.ph.toFixed(2), box: { x: [-0.44, 0.44], y: [-0.44, 0.44] }, planes: planes(0.1, 0.24, 0.015),
      sdf: (x, y, z, { ph }) => {
        const r = len2(x, y), th = Math.atan2(y, x) - ph;
        const platter = Math.max(r - (0.38 + 0.016 * Math.cos(12 * th)), Math.abs(z - 0.13) - 0.03);        // twelve strobe teeth round the rim
        const record = Math.max(r - 0.33, Math.abs(z - 0.1675) - 0.0075);
        const label = Math.max(r - 0.1, Math.abs(z - 0.1875) - 0.0125);
        const mark = rcyl(len2(x - 0.065 * Math.cos(ph), y - 0.065 * Math.sin(ph)), z, 0.02, 0.19, 0.215, 0.005);   // a bump on the label that shows the turn
        const spindle = rcyl(r, z, 0.016, 0.2, 0.24, 0.005);
        return Math.min(platter, record, label, mark, spindle);
      } },
    { id: "arm", order: 3, dynamic: true, cell: 0.01, key: (p) => p.a.toFixed(3), box: { x: [-0.3, 0.7], y: [-0.65, 0.4] }, planes: planes(0.26, 0.36, 0.025),
      sdf: (x, y, z, { a }) => {
        const bx = PIVOT[0] + ARM * Math.cos(a), by = PIVOT[1] + ARM * Math.sin(a);
        const tube = Math.hypot(segDist(x, y, PIVOT[0], PIVOT[1], bx, by), z - 0.31) - 0.022;
        const head = rcyl(len2(x - bx, y - by), z, 0.045, 0.27, 0.32, 0.01);                                  // the headshell, over the groove
        const weight = rcyl(len2(x - (PIVOT[0] - 0.12 * Math.cos(a)), y - (PIVOT[1] - 0.12 * Math.sin(a))), z, 0.045, 0.28, 0.34, 0.015);   // the counterweight behind the pivot
        return Math.min(tube, head, weight);
      } },
  ],
  /**
   * k, the intensity: how fast the platter spins up, in turns.
   * 0: one turn · 0.5: three · 1: six (the arm swings the same in all three)
   */
  step(t, abs, k = 0.5) {
    const swing = sm(0, 1.6, t), turns = byIntensity(k, [1, 3, 6]);
    const ph = Math.round((turns * 2 * Math.PI * sm(1.0, 3.2, t)) / 0.02) * 0.02, a = PARKED + (PLAYING - PARKED) * swing;
    return { plinth: {}, pivot: {}, platter: { prm: { ph } }, arm: { prm: { a: Math.round(a / 0.01) * 0.01 } } };
  },
};
