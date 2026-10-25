import { len2, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A funnel on three legs over a tray, brimming with grains. Move up it and the grains drain: the level drops with a
 * swirl opening in the middle, and a beaded stream runs out of the spout into the tray. At rest the funnel is full
 * and still. The funnel, legs and tray are cut once; the grains in the funnel and the stream are cut again as they move.
 */
const funnelIn = (z) => (z >= 0.3 ? 0.07 + (0.5 * (z - 0.3)) / 0.6 : 0.07);   // the inside radius of the funnel at height z

/** the distance from a point to a rod between two points, as a thin leg */
const funnelLeg = (x, y, z, [ax, ay, az], [bx, by, bz], r) => {
  const dx = bx - ax, dy = by - ay, dz = bz - az, t = clamp(((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / (dx * dx + dy * dy + dz * dz), 0, 1);
  return Math.hypot(x - ax - t * dx, y - ay - t * dy, z - az - t * dz) - r;
};

export const funnel = {
  T: 4, zr: [-0.56, 0.94], S: 320, zm: 0.18,
  active: [0, 2.4],                                              // the grains drain; the pose at 0 is the rest pose, full
  drive: (x, y) => clamp((500 - y) / 320, 0, 1),                 // up the funnel
  hint: "move up the funnel to drain it",
  parts: [
    { id: "funnel", order: 0, cell: 0.013, box: { x: [-0.7, 0.7], y: [-0.7, 0.7] }, planes: planes(-0.16, 0.94, 0.02), sdf: (x, y, z) => {
      const r = len2(x, y), wall = Math.max(r - funnelIn(z) - 0.035, -(r - funnelIn(z)), z - 0.9, -0.15 - z);      // a hollow cone and spout, open at both ends
      return Math.min(wall, Math.max(rcyl(r, z, 0.64, 0.88, 0.93, 0.012), -(r - 0.57)));                          // and a rim round the mouth
    } },
    { id: "stand", order: 1, cell: 0.013, box: { x: [-0.55, 0.55], y: [-0.55, 0.55] }, planes: planes(-0.56, 0.6, 0.015), sdf: (x, y, z) => {
      let d = Math.min(rcyl(len2(x, y), z, 0.42, -0.56, -0.5, 0.015), Math.max(Math.abs(len2(x, y) - 0.36) - 0.02, Math.abs(z + 0.48) - 0.03));   // a tray with a raised lip
      for (let k = 0; k < 3; k++) { const a = Math.PI / 2 + (k * 2 * Math.PI) / 3; d = Math.min(d, funnelLeg(x, y, z, [0.34 * Math.cos(a), 0.34 * Math.sin(a), 0.56], [0.4 * Math.cos(a), 0.4 * Math.sin(a), -0.5], 0.03)); }
      return d;                                                                                                    // and three legs from the cone to the tray
    } },
    { id: "grain", order: 2, dynamic: true, cell: 0.02, key: (p) => p.L.toFixed(2) + ":" + p.ph.toFixed(1), box: { x: [-0.6, 0.6], y: [-0.6, 0.6] }, planes: planes(-0.1, 0.88, 0.02), sdf: (x, y, z, { L, ph }) => {
      const r = len2(x, y), flowing = L < 0.84 ? 1 : 0;
      const top = L - flowing * 0.12 * Math.exp(-r / 0.14) + flowing * 0.012 * Math.cos(2 * Math.atan2(y, x) - 16 * r + ph);   // a surface with a swirl opening in it
      return Math.max(r - funnelIn(z) + 0.01, z - top, -0.1 - z);
    } },
    { id: "stream", order: 3, dynamic: true, cell: 0.006, key: (p) => p.ph.toFixed(1), box: { x: [-0.07, 0.07], y: [-0.07, 0.07] }, planes: planes(-0.5, -0.12, 0.01), sdf: (x, y, z, { ph }) =>
      rcyl(len2(x, y), z, 0.03 + 0.01 * Math.cos(60 * z - ph), -0.5, -0.12, 0.008) },
  ],
  /**
   * k, the intensity: how far it drains.
   * 0: a third of the way down · 0.5: most of the way · 1: down to the neck
   */
  step(t, abs, k = 0.5) {
    const drain = byIntensity(k, [0.35, 0.8, 1]), e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t)), f = drain * e, q = (v, n) => Math.round(v * n) / n;
    return {
      funnel: {}, stand: {}, grain: { prm: { L: q(0.85 - 0.5 * f, 50), ph: q(f * 40, 4) } },
      stream: { prm: f > 0.03 ? { ph: q(f * 40, 4) } : null },
    };
  },
};
