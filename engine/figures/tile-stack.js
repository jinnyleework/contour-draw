import { roundBox, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A stack of ten square tiles, squared up in one column, each with a shallow square recess in its face. Move across
 * it and the tiles slide sideways, each a step further than the one below, until the column has become a staircase
 * running through the middle of the page. At rest it is one neat column. Every tile is cut once and only slides.
 */
const STACK = 10, TILE_PITCH = 0.06, tileZ = (i) => 0.03 + TILE_PITCH * i;   // how many tiles, how far apart they lie, and the height of tile i

/** a tile at height zc: a flat rounded square with a shallow square recess in its top */
const stackTile = (zc) => (x, y, z) => {
  const slab = Math.max(roundBox(x, y, 0, 0.19, 0.19, 0, 0.03), Math.abs(z - zc) - 0.024);
  return Math.max(slab, -Math.max(Math.max(Math.abs(x), Math.abs(y)) - 0.14, zc + 0.008 - z));
};

export const tileStack = {
  T: 4, zr: [0, 0.62], S: 340, zm: 0.3,
  active: [0, 2.2],                                              // the tiles slide into a staircase; the pose at 0 is the rest pose, squared
  drive: (x) => clamp((x - 130) / 340, 0, 1),                    // across the stack
  hint: "move across the tiles to spread the stack",
  parts: Array.from({ length: STACK }, (_, i) => ({
    id: "tile" + i, order: i, box: { x: [-0.3, 0.3], y: [-0.3, 0.3] }, planes: planes(tileZ(i) - 0.03, tileZ(i) + 0.03, 0.01), sdf: stackTile(tileZ(i)),
  })),
  /**
   * k, the intensity: how far each tile slides past the one below.
   * 0: a small step · 0.5: a clear staircase · 1: a wide one
   */
  step(t, abs, k = 0.5) {
    const slide = byIntensity(k, [0.04, 0.08, 0.12]), e = sm(0, 2.2, t) * (1 - sm(2.9, 3.8, t)), out = {};
    for (let i = 0; i < STACK; i++) out["tile" + i] = { off: [(i - (STACK - 1) / 2) * slide * e, 0, 0] };
    return out;
  },
};
