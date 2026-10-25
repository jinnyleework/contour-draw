import { len2, subtract, roundBox, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A vault door seen from above, lying flat in its square frame: a round door with a raised ring, a hub, a six-spoke
 * wheel, and four locking bars laid radially on its face. Move across it and the wheel turns while the bars draw in
 * toward the hub. At rest the wheel is still and the bars are shot home. Lying flat, the slices are the rings of the
 * door itself. The frame and door are cut once; the wheel is cut again as it turns; the bars are rigid and only move.
 */
const DOOR_TOP = 0.2, BAR_Z = 0.27;                                     // the door's face, and the height of the bars' axes

/** a bar along x or y, `sign` picking its side: a rod with a thicker head at the outer end */
const bar = (axis, sign) => (x, y, z) => {
  const u = sign * (axis === "x" ? x : y), ra = len2(axis === "x" ? y : x, z - BAR_Z);
  return Math.min(rcyl(ra, u, 0.04, 0.22, 0.4, 0.015), rcyl(ra, u, 0.065, 0.36, 0.42, 0.02));
};
const alongX = { x: [0.1, 0.52], y: [-0.1, 0.1] }, alongY = { x: [-0.1, 0.1], y: [0.1, 0.52] };   // the boxes of a bar along x, and of one along y

/** the wheel on the door, spun by `ph`: six spokes, a rim, a hub */
const wheel = (x, y, z, { ph }) => {
  const r = len2(x, y), aa = ((((Math.atan2(y, x) + ph + Math.PI / 6) % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3)) - Math.PI / 6;   // angle to the nearest spoke
  const flat = Math.min(Math.max(r * Math.abs(Math.sin(aa)) - 0.018, r - 0.22), Math.abs(r - 0.2) - 0.016, r - 0.07);
  return Math.max(flat, Math.abs(z - 0.41) - 0.025);
};

export const vaultDoor = {
  T: 4, zr: [-0.14, 0.48], S: 250, zm: 0.17,
  active: [0, 2.2],                                              // the wheel turns and the bars draw in; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 150) / 300, 0, 1),                    // across the door
  hint: "move across the door to turn the wheel and draw the bolts",
  parts: [
    { id: "frame", order: 0, box: { x: [-0.85, 0.85], y: [-0.85, 0.85] }, planes: planes(-0.14, 0.2, 0.015), sdf: (x, y, z) => {
      let d = subtract(roundBox(x, y, z, 0.62, 0.62, 0.08, 0.05), rcyl(len2(x, y), z, 0.47, -1, 1, 0));           // a square frame around a round opening
      for (const sx of [-0.56, 0.56]) for (const sy of [-0.56, 0.56]) d = Math.min(d, rcyl(len2(x - sx, y - sy), z, 0.04, 0.13, 0.19, 0.015));   // four rivets
      return d;
    } },
    { id: "door", order: 1, box: { x: [-0.55, 0.55], y: [-0.55, 0.55] }, planes: planes(-0.12, 0.38), sdf: (x, y, z) => {
      const r = len2(x, y), face = rcyl(r, z, 0.44, -0.12, DOOR_TOP, 0.03);
      const ring = Math.max(Math.abs(r - 0.34) - 0.025, Math.abs(z - DOOR_TOP) - 0.03);                          // a raised ring
      return Math.min(face, ring, rcyl(r, z, 0.07, DOOR_TOP, 0.36, 0.02));                                        // and the hub
    } },
    { id: "boltR", order: 2, box: alongX, planes: planes(0.2, 0.34, 0.02), sdf: bar("x", 1) },
    { id: "boltL", order: 2, box: { x: [-0.52, -0.1], y: alongX.y }, planes: planes(0.2, 0.34, 0.02), sdf: bar("x", -1) },
    { id: "boltN", order: 2, box: alongY, planes: planes(0.2, 0.34, 0.02), sdf: bar("y", 1) },
    { id: "boltS", order: 2, box: { x: alongY.x, y: [-0.52, -0.1] }, planes: planes(0.2, 0.34, 0.02), sdf: bar("y", -1) },
    { id: "wheel", order: 3, dynamic: true, cell: 0.009, key: (p) => p.ph.toFixed(2), box: { x: [-0.3, 0.3], y: [-0.3, 0.3] }, planes: planes(0.38, 0.44, 0.015), sdf: wheel },
  ],
  /**
   * k, the intensity: how far the wheel turns, and how far the bars draw in.
   * 0: a third of a turn, bars drawn in a little · 0.5: one turn · 1: two turns, bars drawn right in
   */
  step(t, abs, k = 0.5) {
    const turn = byIntensity(k, [0.35, 1, 2]) * 2 * Math.PI, draw = byIntensity(k, [0.05, 0.1, 0.14]);
    const back = sm(2.8, 3.8, t), ph = Math.round((-turn * sm(0, 1.5, t) * (1 - back)) / 0.03) * 0.03, d = draw * sm(0.8, 1.8, t) * (1 - back);
    return { frame: {}, door: {}, wheel: { prm: { ph } }, boltR: { off: [-d, 0, 0] }, boltL: { off: [d, 0, 0] }, boltN: { off: [0, -d, 0] }, boltS: { off: [0, d, 0] } };
  },
};
