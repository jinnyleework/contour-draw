import { len2, roundBox, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A jack-in-the-box: a square box with a crank on its side and a hinged lid, and inside it a clown's head with a pointed
 * hat on a coil spring. Move across it and the crank turns, the lid flips back, and the head springs up past its height
 * and settles. At rest it is shut and the crank hangs. The box is cut once; the lid, the crank and the spring are cut
 * again as they change; the head is rigid and only rises.
 */
const BOX_TOP = 0.5, HINGE_Y = -0.35, CRANK_Z = 0.25;

export const jackInTheBox = {
  T: 4, zr: [0, 1.2], S: 280, zm: 0.58,
  active: [0, 2.4],                                              // the crank turns, the lid opens, the head springs; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 150) / 300, 0, 1),                    // across the box
  hint: "move across the box to wind the crank",
  parts: [
    { id: "box", order: 0, box: { x: [-0.5, 0.5], y: [-0.5, 0.5] }, planes: planes(0, BOX_TOP, 0.025), sdf: (x, y, z) => {
      const shell = roundBox(x, y, z - BOX_TOP / 2, 0.31, 0.31, 0.21, 0.04), cavity = Math.max(Math.abs(x) - 0.3, Math.abs(y) - 0.3, 0.04 - z);   // a hollow cube, open on top
      return Math.max(Math.min(shell, roundBox(x, y, z - BOX_TOP + 0.03, 0.33, 0.33, 0.005, 0.02)), -cavity);                                   // with a rim round the open top
    } },
    { id: "head", order: 1, box: { x: [-0.25, 0.25], y: [-0.25, 0.25] }, planes: planes(0.06, 0.5, 0.02), sdf: (x, y, z) => {
      const r = len2(x, y), ball = Math.hypot(x, y, z - 0.2) - 0.12, hat = Math.max(r - 0.1 * (1 - (z - 0.28) / 0.2), 0.28 - z, z - 0.48);    // a ball of a head and a cone of a hat
      return Math.min(ball, hat, rcyl(r, z, 0.15, 0.28, 0.31, 0.012), Math.hypot(x, y, z - 0.49) - 0.025, Math.hypot(x, y - 0.1, z - 0.22) - 0.03);                                // a brim, a pompom and a nose
    } },
    { id: "spring", order: 2, dynamic: true, cell: 0.006, key: (p) => p.len.toFixed(2), box: { x: [-0.1, 0.1], y: [-0.1, 0.1] }, planes: planes(0.04, 1.1, 0.02), sdf: (x, y, z, { len }) => {
      if (z < 0.04 || z > 0.04 + len) return 1;
      const pitch = Math.max(0.02, len / 6), dz = (((z - 0.04 - (Math.atan2(y, x) * pitch) / (2 * Math.PI)) % pitch) + pitch * 1.5) % pitch - pitch / 2;   // six turns of wire, stretched with the head
      return Math.hypot(len2(x, y) - 0.06, dz) - 0.012;
    } },
    { id: "lid", order: 3, dynamic: true, key: (p) => p.a.toFixed(2), box: { x: [-0.5, 0.5], y: [-0.85, 0.45] }, planes: planes(BOX_TOP - 0.02, 1.25, 0.025), sdf: (x, y, z, { a }) => {
      const py = y - HINGE_Y, pz = z - BOX_TOP - 0.02, u = py * Math.cos(a) + pz * Math.sin(a), w = -py * Math.sin(a) + pz * Math.cos(a);   // the lid turned back about its hinge
      return roundBox(x, u - 0.35, w, 0.34, 0.33, 0.01, 0.02);
    } },
    { id: "crank", order: 4, dynamic: true, cell: 0.007, key: (p) => p.ph.toFixed(2), box: { x: [0.3, 0.62], y: [-0.2, 0.2] }, planes: planes(CRANK_Z - 0.17, CRANK_Z + 0.17, 0.02), sdf: (x, y, z, { ph }) => {
      const ty = 0.12 * Math.cos(ph), tz = CRANK_Z + 0.12 * Math.sin(ph), t = clamp((y * ty + (z - CRANK_Z) * (tz - CRANK_Z)) / 0.0144, 0, 1);
      const arm = Math.hypot(y - t * ty, z - CRANK_Z - t * (tz - CRANK_Z));                                                                 // the arm, from the shaft to its knob
      return Math.min(rcyl(len2(y, z - CRANK_Z), x, 0.025, 0.33, 0.47, 0.01), Math.max(arm - 0.016, Math.abs(x - 0.46) - 0.02), rcyl(len2(y - ty, z - tz), x, 0.035, 0.46, 0.54, 0.015));
    } },
  ],
  /**
   * k, the intensity: how far the head springs up, and how many times the crank turns.
   * 0: a short hop, one turn · 0.5: as drawn, two turns · 1: a tall spring, three turns
   */
  step(t, abs, k = 0.5) {
    const rise = byIntensity(k, [0.25, 0.45, 0.65]), turns = byIntensity(k, [1, 2, 3]), back = sm(2.9, 3.8, t), live = 1 - back;
    const u = clamp((t - 1.2) / 0.9, 0, 1), v = u - 1, e = 1 + 2.7 * v * v * v + 1.7 * v * v;                         // springs past its height and settles
    const lift = rise * e * live;
    return {
      box: {}, head: { off: [0, 0, lift] }, spring: { prm: { len: Math.round((0.04 + lift) * 50) / 50 } },
      lid: { prm: { a: Math.round((2 * sm(0.9, 1.4, t) * live) * 25) / 25 } },
      crank: { prm: { ph: Math.round((-Math.PI / 2 + turns * 2 * Math.PI * sm(0, 1.2, t) * live) / 0.05) * 0.05 } },
    };
  },
};
