import { len2, smin, subtract, roundBox, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A lighthouse on a rock: a tapering tower in banded stripes with a door and spiral windows, a gallery with a railing,
 * a glass lantern room with a lamp in it, and a conical roof. Move across it and the lamp lights: two flat fans of
 * light grow out of the lantern, opposite each other, and sweep round as the cursor moves. At rest the lamp is dark.
 *
 * The rock, tower, railing and lantern are cut once; the beams are cut again as they turn.
 */

const FACE = 0.96;                                                       // the direction the door and windows face: the default view
const LAMP = 0.61;                                                       // the height of the lamp, and of the beams
const towerR = (z) => 0.26 - (0.09 * (z + 0.5)) / 1 + 0.009 * (Math.sin((2 * Math.PI * z) / 0.4) > 0 ? 1 : 0);   // tapers, and swells in stripes
/** in the frame of a direction `a` on the ground: u along it, v across it */
const along = (x, y, a) => [x * Math.cos(a) + y * Math.sin(a), -x * Math.sin(a) + y * Math.cos(a)];

/** one fan of light along direction `a`: narrow at the lamp, widening to length L */
const wedge = (x, y, a, L) => { const [u, v] = along(x, y, a); return Math.max(0.15 - u, u - L, Math.abs(v) - (0.04 + 0.21 * u)); };

export const lighthouse = {
  T: 5, zr: [-0.78, 0.92], S: 150, zm: 0.07,
  active: [0, 2.4],                                                      // dark, to the beams at full length, sweeping
  drive: (x) => clamp((x - 120) / 360, 0, 1),                            // across the lighthouse
  hint: "move across the lighthouse to sweep its beam",
  parts: [
    { id: "rock", order: 0, box: { x: [-0.7, 0.7], y: [-0.7, 0.7] }, planes: planes(-0.78, -0.5, 0.025), sdf: (x, y, z) => {
      const th = Math.atan2(y, x), shrink = 1 - 0.35 * clamp((z + 0.78) / 0.28, 0, 1);       // a mound with ragged edges that narrows as it rises
      return Math.max(len2(x, y) - (0.5 + 0.05 * Math.cos(5 * th) + 0.035 * Math.cos(9 * th + 1)) * shrink, -0.78 - z, z + 0.5);
    } },
    { id: "tower", order: 1, box: { x: [-0.4, 0.4], y: [-0.4, 0.4] }, planes: planes(-0.5, 0.5, 0.03), sdf: (x, y, z) => {
      let d = Math.max(len2(x, y) - towerR(z), -0.5 - z, z - 0.5);
      const [uf, vf] = along(x, y, FACE);
      d = subtract(d, roundBox(uf - towerR(-0.38), vf, z + 0.38, 0.05, 0.045, 0.07, 0.01));                                 // the door
      for (let k = 0; k < 3; k++) {                                                                                         // windows, climbing round the tower
        const zk = -0.18 + 0.28 * k, [u, v] = along(x, y, FACE + 0.8 + k * 1.4);
        d = subtract(d, rcyl(len2(v, z - zk), u, 0.03, towerR(zk) - 0.035, towerR(zk) + 0.05, 0.004));
      }
      return d;
    } },
    { id: "gallery", order: 2, cell: 0.005, box: { x: [-0.32, 0.32], y: [-0.32, 0.32] }, planes: planes(0.46, 0.6, 0.012), sdf: (x, y, z) => {
      const r = len2(x, y), th = Math.atan2(y, x);
      const floor = rcyl(r, z, 0.29, 0.46, 0.51, 0.01);
      const post = Math.max(len2(x - 0.26 * Math.cos(Math.round((th * 14) / (2 * Math.PI)) * ((2 * Math.PI) / 14)), y - 0.26 * Math.sin(Math.round((th * 14) / (2 * Math.PI)) * ((2 * Math.PI) / 14))) - 0.011, 0.51 - z, z - 0.58);   // fourteen railing posts
      const rail = Math.max(Math.abs(r - 0.26) - 0.012, Math.abs(z - 0.585) - 0.012);
      return Math.min(floor, post, rail);
    } },
    { id: "lantern", order: 3, cell: 0.006, box: { x: [-0.2, 0.2], y: [-0.2, 0.2] }, planes: planes(0.51, 0.9, 0.02), sdf: (x, y, z) => {
      const r = len2(x, y), roofR = 0.17 * (1 - clamp((z - 0.72) / 0.16, 0, 1));
      const room = subtract(rcyl(r, z, 0.13, 0.51, 0.72, 0.01), rcyl(r, z, 0.115, 0.52, 0.71, 0.005));                      // a glass shell
      const roof = z > 0.72 ? Math.max(r - roofR, 0.72 - z, z - 0.88) : 1;
      return Math.min(room, roof, Math.hypot(x, y, z - 0.9) - 0.025);                                                       // and a finial on the roof
    } },
    { id: "lamp", order: 4, overlay: true, cell: 0.006, box: { x: [-0.08, 0.08], y: [-0.08, 0.08] }, planes: planes(0.55, 0.67, 0.012),
      sdf: (x, y, z) => Math.hypot(x, y, z - LAMP) - 0.05 },
    { id: "beams", order: 5, dynamic: true, cell: 0.016, key: (p) => (p ? p.a.toFixed(2) + ":" + p.L.toFixed(2) : ""),
      box: { x: [-1.25, 1.25], y: [-1.25, 1.25] }, planes: planes(LAMP - 0.08, LAMP + 0.08, 0.02), sdf: (x, y, z, { a, L }) =>
        Math.max(Math.min(wedge(x, y, a, L), wedge(x, y, a + Math.PI, L)), Math.abs(z - LAMP) - 0.09) },
  ],
  /**
   * k, the intensity: how far the beams sweep round.
   * 0: a quarter turn · 0.5: two thirds of a turn · 1: well over a full turn
   */
  step(t, abs, k = 0.5) {
    const sweep = byIntensity(k, [1.5, 4.2, 8.4]), L = 1.08 * sm(0, 0.5, t);
    const a = -0.6 + sweep * sm(0.3, 2.4, t);
    return {
      rock: {}, tower: {}, gallery: {}, lantern: {}, lamp: {},
      beams: { prm: L > 0.3 ? { a: Math.round(a / 0.03) * 0.03, L: Math.round(L / 0.04) * 0.04 } : null },
    };
  },
};
