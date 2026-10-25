import { byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A tower of nine square frames, each a little smaller than the one below, stacked with a gap between them. Move up
 * it and the frames twist, each turned further than the one below, until the tower spirals. At rest the frames are
 * lined up as a stepped pyramid. All nine are one dynamic part, cut again as they turn.
 */
const FRAMES = 9, FRAME_STEP = 0.07;                                     // how many frames, and the height of each step up

export const ringTower = {
  T: 4, zr: [0, 0.7], S: 270, zm: 0.3,
  active: [0, 2.2],                                              // the frames twist; the pose at 0 is the rest pose, lined up
  drive: (x, y) => clamp((480 - y) / 300, 0, 1),                 // up the tower
  hint: "move up the tower to twist it",
  parts: [
    { id: "frames", order: 0, dynamic: true, cell: 0.018, key: (p) => p.tw.toFixed(2), box: { x: [-0.8, 0.8], y: [-0.8, 0.8] }, planes: planes(0.0, 0.68, 0.014), sdf: (x, y, z, { tw }) => {
      const i = clamp(Math.round((z - 0.04) / FRAME_STEP), 0, FRAMES - 1), psi = i * tw, c = Math.cos(psi), s = Math.sin(psi);
      const sq = Math.max(Math.abs(x * c + y * s), Math.abs(-x * s + y * c)), size = 0.5 - 0.035 * i;           // how far out, in the frame's own turned square
      return Math.max(sq - size, size - 0.07 - sq, Math.abs(z - 0.04 - i * FRAME_STEP) - 0.025);               // a square frame, a thin slab
    } },
  ],
  /**
   * k, the intensity: how far each frame twists from the one below.
   * 0: a gentle twist (0.12 rad) · 0.5: 0.22 rad · 1: 0.36 rad, a tight spiral
   */
  step(t, abs, k = 0.5) {
    const twist = byIntensity(k, [0.12, 0.22, 0.36]), e = sm(0, 2.2, t) * (1 - sm(2.9, 3.8, t));
    return { frames: { prm: { tw: Math.round(twist * e * 50) / 50 } } };
  },
};
