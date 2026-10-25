import { len2, rcyl, subtract, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A seedling in a clay pot: a tapered pot with a rim and a mound of soil, and out of the soil a stem. Move up it and the
 * plant grows, the stem lengthening and each pair of leaves unfolding as the stem passes it, until a bud closes the top.
 * At rest it is a bare sprout with two seed leaves. The pot is cut once; the plant is cut again as it grows.
 */
const SEED_NODES = [0.06, 0.28, 0.5, 0.72];                              // the heights of the leaf pairs on the stem

/** one leaf: a flat ellipse lying out from the stem along angle `a`, `s` grown (0 to 1), at height zc */
const seedLeaf = (x, y, z, a, zc, s) => {
  const c = Math.cos(a), sn = Math.sin(a), u = x * c + y * sn - 0.16 * s, v = -x * sn + y * c;
  const ea = 0.17 * s, eb = 0.08 * s, ec = 0.03;                                                              // length, width and thickness
  return (Math.hypot(u / ea, v / eb, (z - zc - 0.45 * u) / ec) - 1) * ec;                                  // an ellipsoid, rising a little toward its tip
};

/** the plant at height h: a stem, a pair of leaves at each node it has passed, and a bud on top */
const seedPlant = (x, y, z, { h }) => {
  let d = Math.max(len2(x, y) - 0.03 * (1 - 0.3 * z / Math.max(h, 0.1)), z - h, -0.1 - z);
  SEED_NODES.forEach((zn, i) => {
    const s = clamp((h - zn + 0.03) / 0.25, 0, 1);
    if (s <= 0 || Math.abs(z - zn - 0.1) > 0.16) return;
    d = Math.min(d, seedLeaf(x, y, z, i * 1.57, zn + 0.02, s), seedLeaf(x, y, z, i * 1.57 + Math.PI, zn + 0.02, s));   // two leaves, opposite, each pair a quarter turn on the last
  });
  return Math.min(d, Math.hypot(x, y, (z - h) * 1.3) - 0.05 * clamp(h / 0.3, 0.3, 1));                           // a bud
};

export const seedling = {
  T: 4, zr: [-0.4, 1.0], S: 340, zm: 0.3,
  active: [0, 2.4],                                              // the sprout grows into a plant; the pose at 0 is the rest pose
  drive: (x, y) => clamp((480 - y) / 300, 0, 1),                 // up the pot
  hint: "move up the plant to make it grow",
  parts: [
    { id: "pot", order: 0, box: { x: [-0.5, 0.5], y: [-0.5, 0.5] }, planes: planes(-0.4, 0, 0.025), sdf: (x, y, z) => {
      const r = len2(x, y), wall = 0.22 + (0.08 * (z + 0.4)) / 0.4;
      const body = subtract(Math.max(r - wall, -0.4 - z, z), Math.max(r - (wall - 0.03), -0.34 - z));          // a tapered pot, hollow
      const soil = Math.max(r - 0.27, z + 0.1 - 0.03 * (1 - r / 0.27), -0.3 - z);                              // a low mound of soil in it
      return Math.min(body, soil, rcyl(r, z, 0.33, -0.09, 0, 0.02));                                           // and a rim
    } },
    { id: "plant", order: 1, dynamic: true, cell: 0.015, key: (p) => p.h.toFixed(2), box: { x: [-0.36, 0.36], y: [-0.36, 0.36] }, planes: planes(-0.1, 1.0, 0.014), sdf: seedPlant },
  ],
  /**
   * k, the intensity: how tall it grows.
   * 0: a young plant of two leaf pairs · 0.5: three pairs and a bud · 1: the full four pairs
   */
  step(t, abs, k = 0.5) {
    const tall = byIntensity(k, [0.45, 0.7, 0.95]), e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t));
    return { pot: {}, plant: { prm: { h: Math.round((0.08 + (tall - 0.08) * e) * 40) / 40 } } };
  },
};
