import { roundBox, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A stack of ten square tiles, squared up in one column, each with a shallow square recess in its face. Move the cursor
 * over the stack and the tile under it lifts out to stand alone: the tile rises, and every tile above it rises twice as
 * far, leaving a clear gap above and below it. Slide the cursor up or down and the lift passes from tile to tile. At rest it is one neat column. Every tile is cut once and only moves. It uses the cursor's position (the fourth
 * argument of step) to find which tile is under it, and wanders up and down the stack by itself when there is no cursor.
 */
const STACK = 10, TILE_PITCH = 0.06, tileZ = (i) => 0.03 + TILE_PITCH * i;   // how many tiles, how far apart they lie, and the height of tile i

/** a tile at height zc: a flat rounded square with a shallow square recess in its top */
const stackTile = (zc) => (x, y, z) => {
  const slab = Math.max(roundBox(x, y, 0, 0.19, 0.19, 0, 0.03), Math.abs(z - zc) - 0.024);
  return Math.max(slab, -Math.max(Math.max(Math.abs(x), Math.abs(y)) - 0.14, zc + 0.008 - z));
};

export const tileStack = {
  T: 4, zr: [0, 0.8], S: 340, zm: 0.34,
  active: [0, 2.4],                                              // with no cursor (the demo), the lift runs up the stack; the pose at 0 is the rest pose
  drive: (x, y) => clamp(1.5 - Math.hypot(x - 300, y - 300) / 200, 0, 1),   // 1 over the stack, 0 away from it: where the cursor is picks the tile
  hint: "move over the stack to lift out a tile",
  parts: Array.from({ length: STACK }, (_, i) => ({
    id: "tile" + i, order: i, box: { x: [-0.3, 0.3], y: [-0.3, 0.3] }, planes: planes(tileZ(i) - 0.03, tileZ(i) + 0.03, 0.01), sdf: stackTile(tileZ(i)),
  })),
  /**
   * k, the intensity: how far the lifted tile rises, and so how wide the gap round it.
   * 0: a small gap · 0.5: a clear gap · 1: a wide one
   */
  step(t, abs, k = 0.5, pointer = null) {
    const gap = byIntensity(k, [0.06, 0.1, 0.15]), out = {};
    let f, s;                                                      // which tile is under the cursor (a fractional index), and how strongly
    if (pointer && pointer.s > 0.002) {
      const a = pointer.ground(0), b = pointer.ground(1), rise = Math.hypot(b[0] - a[0], b[1] - a[1]), vx = (b[0] - a[0]) / rise, vy = (b[1] - a[1]) / rise;   // up the page is toward the viewer: this is the way the cursor's line of sight moves as the height changes
      const depth = a[0] * vx + a[1] * vy, side = Math.abs(-a[0] * vy + a[1] * vx);
      f = ((0.2 - depth) / rise - 0.03 - gap) / TILE_PITCH;                                                       // less the lift itself, so the tile that rises stays under the cursor                                                           // the height at which the line of sight meets a tile's front face, as a tile number
      s = pointer.s * (1 - sm(0.22, 0.34, side)) * sm(-0.9, -0.3, f) * (1 - sm(9.3, 9.9, f));                // not over the stack: no lift
    } else { f = 9 * sm(0, 2.4, t); s = sm(0, 0.4, t) * (1 - sm(2.9, 3.8, t)); }
    f = Math.floor(f) + sm(0.35, 0.65, f - Math.floor(f));                                                    // settle on the nearest tile, changing quickly between two
    for (let i = 0; i < STACK; i++) out["tile" + i] = { off: [0, 0, 2 * gap * s * sm(-0.5, 0.5, i - f)] };   // the tile itself rises a gap; those above rise two
    return out;
  },
};
