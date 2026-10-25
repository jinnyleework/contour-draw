import { len2, rcyl, roundBox, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A tower windmill: an eight-sided tower that narrows as it rises, with a gallery round its waist, a door, a domed cap,
 * and four latticed sails on a shaft that points at you. Move across it and the sails turn, faster and then slowing,
 * and settle where they began. At rest they hang still in an X. The tower and cap are cut once; the sails are cut again
 * as they turn.
 */
const HUB_Z = 0.88, SAIL_Y = 0.3;                                       // the height of the shaft, and how far forward the sails sit

/** how far a point is outside the tower's eight sides at height z */
const mill = (x, y, z) => {
  let d = -1e9;
  for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4 + Math.PI / 8; d = Math.max(d, x * Math.cos(a) + y * Math.sin(a)); }
  return d;
};

/** the sails in the plane of the shaft, turned by ph: fold the angle onto one arm, then measure that arm's stock and lattice */
const sails = (x, y, z, { ph }) => {
  const dz = z - HUB_Z, r = len2(x, dz), q = Math.PI / 2, a = ((((Math.atan2(dz, x) - ph + q / 2) % q) + q) % q) - q / 2, u = r * Math.cos(a), v = r * Math.sin(a);
  const stock = Math.max(Math.abs(v) - 0.018, u - 0.8, 0.03 - u);
  const slat = ((((u - 0.2) % 0.15) + 0.15) % 0.15), hole = Math.max(Math.abs(slat - 0.075) - 0.035, Math.abs(v - 0.11) - 0.055);
  const blade = Math.max(Math.abs(v - 0.11) - 0.08, Math.abs(u - 0.49) - 0.29, -hole);                         // a frame with slats, on one side of the stock
  return Math.max(Math.min(stock, blade, r - 0.05), Math.abs(y - SAIL_Y) - 0.02);
};

export const windmill = {
  T: 4, zr: [-0.32, 1.7], S: 270, zm: 0.68,
  active: [0, 2.4],                                              // the sails turn up and slow again; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 150) / 300, 0, 1),                    // across the windmill
  hint: "move across the windmill to turn its sails",
  parts: [
    { id: "tower", order: 0, box: { x: [-0.55, 0.55], y: [-0.55, 0.55] }, planes: planes(-0.32, 1.08, 0.025), sdf: (x, y, z) => {
      const apothem = 0.3 - (0.12 * (z + 0.3)) / 1.1;
      let d = Math.max(mill(x, y, z) - apothem, -0.3 - z, z - 0.8);                                                // an eight-sided tower that tapers
      d = Math.max(d, -Math.max(Math.abs(x) - 0.05, Math.abs(y - 0.3) - 0.12, Math.abs(z + 0.12) - 0.13) * (y > 0.1 ? 1 : -1));   // a door in the front face
      const gallery = Math.max(Math.abs(len2(x, y) - 0.34) - 0.045, Math.abs(z - 0.04) - 0.012);                  // a gallery ring round the waist
      return Math.min(d, gallery);
    } },
    { id: "cap", order: 1, box: { x: [-0.3, 0.3], y: [-0.3, 0.4] }, planes: planes(0.78, 1.08, 0.02), sdf: (x, y, z) =>
      Math.min(Math.max(Math.hypot(x, y, z - 0.8) - 0.21, 0.8 - z), rcyl(len2(x, z - HUB_Z), y, 0.045, 0.1, 0.34, 0.015)) },   // a dome, and the shaft pointing at you
    { id: "sails", order: 2, dynamic: true, cell: 0.012, key: (p) => p.ph.toFixed(2), box: { x: [-0.86, 0.86], y: [0.22, 0.38] }, planes: planes(0.1, 1.66, 0.022), sdf: sails },
  ],
  /**
   * k, the intensity: how far the sails turn.
   * 0: half a turn · 0.5: a turn and a half · 1: three turns
   */
  step(t, abs, k = 0.5) {
    const turns = byIntensity(k, [0.5, 1.5, 3]), back = sm(3, 4, t);
    return { tower: {}, cap: {}, sails: { prm: { ph: Math.round((Math.PI / 4 + turns * 2 * Math.PI * sm(0, 2.4, t) * (1 - back)) / 0.04) * 0.04 } } };
  },
};
