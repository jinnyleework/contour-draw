import { len2, subtract, roundBox, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A typewriter: a low body with three rows of round keys on posts, a half-round basket of typebars lying in a well
 * behind them, and a carriage at the back with a platen roller, two knobs, a return lever and a sheet of paper
 * standing up behind it. Move across it and it types: one typebar after another swings up out of the basket to strike
 * the platen, and the carriage steps to the left with every letter. At rest the bars lie in the basket and the
 * carriage is at the right. The body is cut once; the carriage is rigid and only slides; the typebars are cut again
 * as they strike.
 */
const TYPE_C = [0, -0.08], TYPE_BARS = 9, TYPE_FIRST = 0.25, TYPE_STEP = (Math.PI - 0.5) / (TYPE_BARS - 1);   // the middle of the basket, and where the bars lie round it
const TYPE_ORDER = [3, 7, 1, 5, 8, 0, 4, 2, 6];                         // the order the bars strike in

/** the distance to a rod between two points in space */
const typeRod = (x, y, z, [ax, ay, az], [bx, by, bz], r) => {
  const dx = bx - ax, dy = by - ay, dz = bz - az, t = clamp(((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / (dx * dx + dy * dy + dz * dz), 0, 1);
  return Math.hypot(x - ax - t * dx, y - ay - t * dy, z - az - t * dz) - r;
};

/** typebar m, swung up by angle a: from its pivot on the rim of the basket, in toward the middle and up toward the platen */
const typeBar = (x, y, z, m, a) => {
  const ang = TYPE_FIRST + m * TYPE_STEP, px = TYPE_C[0] + 0.19 * Math.cos(ang), py = TYPE_C[1] + 0.19 * Math.sin(ang);
  const ix = -Math.cos(ang), iy = -Math.sin(ang), L = 0.25;
  return typeRod(x, y, z, [px, py, 0.105], [px + L * Math.cos(a) * ix, py + L * Math.cos(a) * iy, 0.105 + L * Math.sin(a)], 0.016);
};

export const typewriter = {
  T: 4, zr: [-0.02, 0.68], S: 360, zm: 0.22,
  active: [0, 2.4],                                              // it types a line; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 130) / 340, 0, 1),                    // across the typewriter
  hint: "move across the typewriter to type",
  parts: [
    { id: "body", order: 0, cell: 0.008, box: { x: [-0.65, 0.65], y: [-0.5, 0.48] }, planes: planes(-0.02, 0.3, 0.01), sdf: (x, y, z) => {
      let d = Math.min(roundBox(x, y, z - 0.05, 0.5, 0.36, 0.04, 0.03), roundBox(x, y + 0.3, z - 0.16, 0.48, 0.08, 0.1, 0.03));   // a low base, and a raised back that carries the carriage
      d = subtract(d, Math.max(len2(x - TYPE_C[0], y - TYPE_C[1]) - 0.22, 0.09 - z, -0.2 - y));                                  // the well the typebars lie in
      for (let r = 0; r < 3; r++) for (let k = 0; k < 9; k++) {                                                                  // three rows of keys, each row higher and set back
        const kx = -0.34 + 0.085 * k + 0.02 * r, ky = 0.32 - 0.08 * r, top = 0.17 + 0.035 * r, rr = len2(x - kx, y - ky);
        d = Math.min(d, rcyl(rr, z, 0.032, top - 0.025, top, 0.012), rcyl(rr, z, 0.013, 0.1, top - 0.02, 0));
      }
      return d;
    } },
    { id: "bars", order: 1, dynamic: true, cell: 0.008, key: (p) => p.j + ":" + p.a.toFixed(2), box: { x: [-0.25, 0.25], y: [-0.3, 0.14] }, planes: planes(0.085, 0.35, 0.012), sdf: (x, y, z, { j, a }) => {
      const m = clamp(Math.round((Math.atan2(y - TYPE_C[1], x - TYPE_C[0]) - TYPE_FIRST) / TYPE_STEP), 0, TYPE_BARS - 1);       // only the nearest resting bar can matter
      const flat = m === j && a > 0.02 ? 1 : typeBar(x, y, z, m, 0);
      return Math.min(flat, a > 0.02 ? typeBar(x, y, z, j, a) : 1);                                                               // and the bar that is striking
    } },
    { id: "carriage", order: 2, cell: 0.007, box: { x: [-0.55, 0.9], y: [-0.62, 0.0] }, planes: planes(0.27, 0.68, 0.01), sdf: (x, y, z) => {
      const cx = x - 0.18, r = len2(y + 0.24, z - 0.36);
      let d = Math.min(rcyl(r, cx, 0.07, -0.42, 0.42, 0.02), rcyl(r, Math.abs(cx), 0.09, 0.42, 0.5, 0.02));                      // the platen, and a knob at each end
      const w = (y + 0.26) * 0.707 + (z - 0.42) * 0.707, s = -(y + 0.26) * 0.707 + (z - 0.42) * 0.707;                            // the paper, leaning back from the platen
      d = Math.min(d, Math.max(Math.abs(w) - 0.008, Math.abs(cx) - 0.27, -s, s - 0.3));
      return Math.min(d, typeRod(cx, y, z, [-0.47, -0.24, 0.4], [-0.43, -0.06, 0.5], 0.016));                                    // and the return lever
    } },
  ],
  /**
   * k, the intensity: how many letters it types, and so how far the carriage travels.
   * 0: four · 0.5: eight · 1: twelve
   */
  step(t, abs, k = 0.5) {
    const letters = Math.round(byIntensity(k, [4, 8, 12])), q = letters * sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t)), n = Math.floor(q);
    const a = n < letters ? 1.3 * Math.sin(Math.PI * (q - n)) : 0;                                                              // the bar swings up and back for each letter
    return { body: {}, carriage: { off: [-0.035 * q, 0, 0] }, bars: { prm: { j: TYPE_ORDER[n % TYPE_BARS], a: Math.round(a * 20) / 20 } } };
  },
};
