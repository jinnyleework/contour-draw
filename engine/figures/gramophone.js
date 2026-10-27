import { len2, roundBox, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A gramophone: a square cabinet with a turntable and record, a column at the back corner carrying the tonearm out
 * to a soundbox on the record, and a flared horn rising from the column, its mouth open to the sky. Move up it and
 * the record turns while rings of sound rise out of the horn one after another, spreading as they climb. At rest the
 * record is still and the air above the horn is empty. The horn is a hollow shell, so you look down into its throat.
 *
 * The cabinet, column, arm and horn are cut once; the record is cut again as it turns, the sound as it rises.
 */
const GRAM_REC = [0.06, 0.08], GRAM_THROAT = [-0.3, -0.3], GRAM_MOUTH = [-0.18, -0.18], GRAM_HZ = [0.2, 0.98];

/** the distance from (x, y, z) to the 3D segment a-b */
const gramophoneSeg = (x, y, z, a, b) => {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], p = [x - a[0], y - a[1], z - a[2]];
  const t = clamp((p[0] * d[0] + p[1] * d[1] + p[2] * d[2]) / (d[0] ** 2 + d[1] ** 2 + d[2] ** 2), 0, 1);
  return Math.hypot(p[0] - t * d[0], p[1] - t * d[1], p[2] - t * d[2]);
};

/** the horn: a thin shell whose centre drifts forward and whose radius flares as it rises, with a rolled rim */
const gramophoneHorn = (x, y, z) => {
  const u = clamp((z - GRAM_HZ[0]) / (GRAM_HZ[1] - GRAM_HZ[0]), 0, 1), drift = 0.12 * u * u, R = 0.05 + 0.33 * u * u;
  const rho = len2(x - GRAM_THROAT[0] - drift, y - GRAM_THROAT[1] - drift);
  const shell = Math.max(Math.abs(rho - R) - 0.012, GRAM_HZ[0] - z, z - GRAM_HZ[1]);
  const rim = Math.hypot(len2(x - GRAM_MOUTH[0], y - GRAM_MOUTH[1]) - 0.38, z - GRAM_HZ[1]) - 0.02;
  return Math.min(shell, rim);
};

export const gramophone = {
  T: 4, zr: [-0.23, 1.4], S: 225, zm: 0.55,
  active: [0, 2.4],                                                  // the record turns and the sound rises; the pose at 0 is the rest pose
  drive: (x, y) => clamp((470 - y) / 330, 0, 1),                     // up the gramophone, from the cabinet to the horn
  hint: "move up the gramophone to play a record",
  parts: [
    { id: "cabinet", order: 0, box: { x: [-0.62, 0.62], y: [-0.62, 0.62] }, planes: planes(-0.23, 0.05), sdf: (x, y, z) =>
      Math.min(roundBox(x, y, z + 0.09, 0.4, 0.4, 0.11, 0.03), roundBox(x, y, z + 0.205, 0.44, 0.44, 0.005, 0.02)) },   // the box on a wider foot
    { id: "column", order: 1, box: { x: [-0.42, -0.18], y: [-0.42, -0.18] }, planes: planes(0.05, 0.21, 0.01), sdf: (x, y, z) =>
      Math.min(rcyl(len2(x - GRAM_THROAT[0], y - GRAM_THROAT[1]), z, 0.05, 0.05, 0.21, 0.012), rcyl(len2(x - GRAM_THROAT[0], y - GRAM_THROAT[1]), z, 0.075, 0.05, 0.08, 0.012)) },
    { id: "record", order: 2, dynamic: true, cell: 0.011, key: (p) => p.ph.toFixed(2), box: { x: [-0.32, 0.44], y: [-0.3, 0.46] }, planes: planes(0.05, 0.13, 0.015),
      sdf: (x, y, z, { ph }) => {
        const dx = x - GRAM_REC[0], dy = y - GRAM_REC[1], r = len2(dx, dy);
        const platter = rcyl(r, z, 0.33, 0.04, 0.08, 0.01), record = Math.max(r - 0.31, Math.abs(z - 0.0875) - 0.0075);
        const label = Math.max(r - 0.1, Math.abs(z - 0.105) - 0.01);
        const mark = rcyl(len2(dx - 0.065 * Math.cos(ph), dy - 0.065 * Math.sin(ph)), z, 0.02, 0.1, 0.125, 0.005);   // a bump on the label that shows the turn
        return Math.min(platter, record, label, mark, rcyl(r, z, 0.015, 0.1, 0.13, 0.005));
      } },
    { id: "arm", order: 3, cell: 0.008, box: { x: [-0.42, 0.36], y: [-0.42, 0.36] }, planes: planes(0.1, 0.23, 0.01), sdf: (x, y, z) =>
      Math.min(gramophoneSeg(x, y, z, [-0.3, -0.3, 0.19], [0.2, 0.18, 0.17]) - 0.022, rcyl(len2(x - 0.21, y - 0.19), z, 0.06, 0.1, 0.17, 0.015)) },   // the tonearm and its soundbox
    { id: "horn", order: 4, cell: 0.007, box: { x: [-0.66, 0.3], y: [-0.66, 0.3] }, planes: [...planes(0.2, 0.5, 0.01), ...planes(0.53, 1.0)], sdf: gramophoneHorn },
    { id: "sound", order: 5, overlay: true, dynamic: true, cell: 0.009, key: (p) => p.us.map((u) => u.toFixed(2)).join(),
      box: { x: [-0.86, 0.5], y: [-0.86, 0.5] }, planes: planes(1.01, 1.4),
      sdf: (x, y, z, { us }) => {
        const rho = len2(x - GRAM_MOUTH[0], y - GRAM_MOUTH[1]);
        let d = 1;
        for (const u of us) d = Math.min(d, Math.max(Math.abs(rho - (0.36 + 0.3 * u)) - 0.012, Math.abs(z - (1.03 + 0.34 * u)) - 0.016));   // a flat ring, wider as it climbs
        return d;
      } },
  ],
  /**
   * k, the intensity: how many rings of sound rise out of the horn (the record turns the same in all three).
   * 0: two · 0.5: four · 1: six
   */
  step(t, abs, k = 0.5) {
    const n = Math.round(byIntensity(k, [2, 4, 6])), back = 1 - sm(2.8, 3.8, t), play = sm(0.4, 2.4, t) * back;
    const ph = Math.round((2 * 2 * Math.PI * sm(0, 2.4, t) * back) / 0.02) * 0.02;
    const us = [];
    for (let i = 0; i < n; i++) { const u = Math.round(clamp(play - i / n, 0, 1) * 50) / 50; if (u > 0.02) us.push(u); }   // ring i leaves the mouth at play = i/n
    return { cabinet: {}, column: {}, arm: {}, horn: {}, record: { prm: { ph } }, sound: { prm: us.length ? { us } : null } };
  },
};
