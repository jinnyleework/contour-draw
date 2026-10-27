import { len2, subtract, roundBox, rcyl, segDist, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A rotary phone seen from above: a rounded body with the handset lying across its back on two cradle prongs, and
 * the dial at the front: a plate of ten dots under a turning finger wheel with ten holes, a centre cap, and a finger
 * stop at the lower right. Move across it and the dial turns clockwise until a hole meets the stop; let go and it
 * springs home. At rest the holes sit over their dots and the dial is still.
 *
 * The body, plate, cap, stop and handset are cut once; the finger wheel is cut again as it turns.
 */
const PHONE_DIAL = [0, 0.12], PHONE_STOP = (50 * Math.PI) / 180, PHONE_HOLE0 = (-10 * Math.PI) / 180, PHONE_STEP = Math.PI / 6;
const PHONE_HOLE_R = 0.19, PHONE_HZ = -0.3;

/** the angle of hole j (j = 0 is the one nearest the stop), counter-clockwise from it */
const phoneHoleA = (j) => PHONE_HOLE0 - j * PHONE_STEP;

/** the finger wheel turned by `ph`: a disc with ten holes on a ring, measuring only the nearest hole */
const phoneWheel = (x, y, z, { ph }) => {
  const dx = x - PHONE_DIAL[0], dy = y - PHONE_DIAL[1], r = len2(dx, dy), th = Math.atan2(dy, dx) - ph;
  const rel = ((((PHONE_HOLE0 - th) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)), j = clamp(Math.round(rel / PHONE_STEP), 0, 9);
  let hole = 1;
  for (const i of [j, 0, 9]) { const a = phoneHoleA(i) + ph; hole = Math.min(hole, len2(dx - PHONE_HOLE_R * Math.cos(a), dy - PHONE_HOLE_R * Math.sin(a)) - 0.042); }   // the nearest, and the two either side of the gap
  return subtract(rcyl(r, z, 0.27, 0.16, 0.19, 0.008), hole);
};

export const rotaryPhone = {
  T: 4, zr: [-0.22, 0.38], S: 300, zm: 0.08,
  active: [0, 2],                                                    // the dial turns to the stop; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 160) / 280, 0, 1),                        // across the phone
  hint: "move across the phone to turn the dial",
  parts: [
    { id: "body", order: 0, box: { x: [-0.62, 0.62], y: [-0.6, 0.6] }, planes: planes(-0.22, 0.13), sdf: (x, y, z) =>
      roundBox(x, y, z + 0.05, 0.38, 0.34, 0.06, 0.12) },
    { id: "plate", order: 1, cell: 0.006, box: { x: [-0.34, 0.34], y: [-0.22, 0.46] }, planes: planes(0.12, 0.165, 0.012), sdf: (x, y, z) => {
      const dx = x - PHONE_DIAL[0], dy = y - PHONE_DIAL[1];
      let d = rcyl(len2(dx, dy), z, 0.275, 0.1, 0.15, 0.01);
      for (let j = 0; j < 10; j++) d = Math.min(d, rcyl(len2(dx - PHONE_HOLE_R * Math.cos(phoneHoleA(j)), dy - PHONE_HOLE_R * Math.sin(phoneHoleA(j))), z, 0.014, 0.14, 0.162, 0.004));   // a dot under each hole
      return d;
    } },
    { id: "wheel", order: 2, dynamic: true, cell: 0.008, key: (p) => p.ph.toFixed(2), box: { x: [-0.32, 0.32], y: [-0.2, 0.44] }, planes: planes(0.165, 0.19, 0.012), sdf: phoneWheel },
    { id: "cap", order: 3, box: { x: [-0.14, 0.14], y: [-0.02, 0.26] }, planes: planes(0.18, 0.216, 0.012), sdf: (x, y, z) =>
      rcyl(len2(x - PHONE_DIAL[0], y - PHONE_DIAL[1]), z, 0.085, 0.17, 0.21, 0.012) },
    { id: "stop", order: 3, cell: 0.006, box: { x: [0.06, 0.3], y: [0.2, 0.42] }, planes: planes(0.18, 0.23, 0.01), sdf: (x, y, z) => {
      const c = Math.cos(PHONE_STOP), s = Math.sin(PHONE_STOP);
      return Math.max(segDist(x, y, PHONE_DIAL[0] + 0.23 * c, PHONE_DIAL[1] + 0.23 * s, PHONE_DIAL[0] + 0.3 * c, PHONE_DIAL[1] + 0.3 * s) - 0.018, Math.abs(z - 0.205) - 0.02);
    } },
    { id: "handset", order: 4, cell: 0.009, box: { x: [-0.56, 0.56], y: [-0.48, -0.12] }, planes: planes(0.12, 0.38, 0.015), sdf: (x, y, z) => {
      const dy = y - PHONE_HZ, cups = Math.min(rcyl(len2(x - 0.34, dy), z, 0.1, 0.13, 0.27, 0.035), rcyl(len2(x + 0.34, dy), z, 0.1, 0.13, 0.27, 0.035));
      const arch = 0.3 + 0.05 * (1 - (x / 0.34) ** 2), handle = Math.hypot(dy / 1.3, z - arch) - 0.045;                     // the handle arches between the cups
      const prongs = Math.min(rcyl(len2(x - 0.16, dy), z, 0.03, 0.12, 0.31, 0.01), rcyl(len2(x + 0.16, dy), z, 0.03, 0.12, 0.31, 0.01));
      return Math.min(cups, Math.max(handle, Math.abs(x) - 0.34), prongs);
    } },
  ],
  /**
   * k, the intensity: which hole is dialled, so how far the wheel turns to the stop.
   * 0: the nearest hole, a sixth of a turn · 0.5: the fifth, half a turn · 1: the last, eleven twelfths of a turn
   */
  step(t, abs, k = 0.5) {
    const turn = PHONE_STOP - phoneHoleA(byIntensity(k, [0, 4, 9])) - 0.1;
    return { body: {}, plate: {}, cap: {}, stop: {}, handset: {}, wheel: { prm: { ph: Math.round((turn * sm(0, 1.8, t) * (1 - sm(2.6, 3.6, t))) / 0.02) * 0.02 } } };
  },
};
