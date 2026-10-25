import { roundBox, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A stepped pyramid of square tiles, six tiers high, each tier a square of rounded tiles with a gap between them.
 * Move up it and the tiers lift apart, the higher the tier the further, like an exploded drawing. At rest it is
 * one solid pyramid. Every tier is cut once and only lifts.
 */
const TIERS = 6, TILE = 0.2, TIER_Z = (i) => 0.03 + 0.055 * i;           // tiles per side in the lowest tier, the pitch of a tile, the height of tier i

/** tier i: an (n x n) square of tiles, each a flat rounded block; the nearest tile's distance, so the gaps read */
const tileTier = (i) => {
  const n = TIERS - i, w = (n * TILE) / 2, zc = TIER_Z(i);
  return (x, y, z) => {
    const ix = clamp(Math.floor((x + w) / TILE), 0, n - 1), iy = clamp(Math.floor((y + w) / TILE), 0, n - 1);
    return roundBox(x + w - (ix + 0.5) * TILE, y + w - (iy + 0.5) * TILE, z - zc, 0.07, 0.07, 0.015, 0.015);
  };
};

export const tilePyramid = {
  T: 4, zr: [0, 1.0], S: 270, zm: 0.38,
  active: [0, 2.2],                                              // the tiers lift apart from the bottom; the pose at 0 is the rest pose
  drive: (x, y) => clamp((480 - y) / 300, 0, 1),                 // up the pyramid
  hint: "move up the pyramid to lift its tiers",
  parts: Array.from({ length: TIERS }, (_, i) => {
    const half = (TIERS - i) * 0.1 + 0.06, zc = TIER_Z(i);
    return { id: "tier" + i, order: i, box: { x: [-half, half], y: [-half, half] }, planes: planes(zc - 0.035, zc + 0.035, 0.012), sdf: tileTier(i) };
  }),
  /**
   * k, the intensity: how far each tier lifts.
   * 0: a small lift per tier · 0.5: a clear gap · 1: a wide exploded view
   */
  step(t, abs, k = 0.5) {
    const lift = byIntensity(k, [0.05, 0.09, 0.13]), e = sm(0, 2.2, t) * (1 - sm(2.9, 3.8, t)), out = {};
    for (let i = 0; i < TIERS; i++) out["tier" + i] = { off: [0, 0, i * lift * e] };
    return out;
  },
};
