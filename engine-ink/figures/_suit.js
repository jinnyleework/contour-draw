import { sdCircle, sdPolygon, clamp } from "../src/math.js";

/*
 * Shared by the four suit figures (heart, spade, diamond, club): the outlines as sdfs, about 1.45 tall and centred, drawn
 * sleek to sit beside Didot: sharp points, slim curves, and a foot like a Didot serif (a hairline stem flaring into a thin
 * curved base). Plain solids. Not a figure itself (the index skips files starting with "_").
 */

/**
 * The heart's outline: the classic parametric heart (x = 16 sin³t, y = 13 cos t - 5 cos 2t - 2 cos 3t - cos 4t), narrowed,
 * fitted to `height` with its tip at `tipY`, pointing down (or up, flip = true).
 */
function suitHeartOutline(height, tipY, narrow, flip) {
  const raw = [];
  for (let i = 0; i < 160; i++) {
    const t = (i / 160) * Math.PI * 2, s = Math.sin(t);
    raw.push([16 * s * s * s, 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)]);
  }
  const ys = raw.map((p) => p[1]), lo = Math.min(...ys), k = height / (Math.max(...ys) - lo);
  return raw.map(([x, y]) => [x * k * narrow, flip ? tipY - (y - lo) * k : tipY + (y - lo) * k]);
}
const SUIT_HEART = suitHeartOutline(1.3, -0.68, 0.88, false);
const SUIT_SPADE_BODY = suitHeartOutline(1.12, 0.74, 0.86, true);
export const suitHeart = (x, y) => sdPolygon(x, y, SUIT_HEART);

/** the foot: a hairline stem flaring, ever faster, into a thin base whose underside arches up a little */
const SUIT_FOOT = (() => {
  const top = -0.1, bottom = -0.7, right = [];
  for (let i = 0; i <= 16; i++) { const t = i / 16; right.push([0.016 + 0.225 * Math.pow(t, 3.2), top + (bottom - top) * t]); }
  const base = [];
  for (let i = 1; i < 12; i++) { const u = i / 12; base.push([0.241 - 0.482 * u, bottom + 0.028 * Math.sin(u * Math.PI)]); }
  return [...right, ...base, ...right.slice().reverse().map(([x, y]) => [-x, y])];
})();
export const suitFoot = (x, y) => sdPolygon(x, y, SUIT_FOOT);

export const suitSpade = (x, y) => Math.min(sdPolygon(x, y, SUIT_SPADE_BODY), suitFoot(x, y));

/** smooth union: two shapes joined with a fillet of radius k */
export const suitSmin = (a, b, k) => { const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); };

/** the diamond: slim, its four sides curved well in, so the points are sharp */
const SUIT_DIAMOND = (() => {
  const c = [[0, 0.74], [0.44, 0], [0, -0.74], [-0.44, 0]], pts = [];
  for (let s = 0; s < 4; s++) {
    const [ax, ay] = c[s], [bx, by] = c[(s + 1) % 4];
    for (let i = 0; i < 16; i++) {
      const t = i / 16, bow = Math.sin(t * Math.PI) * 0.075;                    // toward the centre
      const px = ax + (bx - ax) * t, py = ay + (by - ay) * t, len = Math.hypot(px, py) || 1;
      pts.push([px - (px / len) * bow, py - (py / len) * bow]);
    }
  }
  return pts;
})();
export const suitDiamond = (x, y) => sdPolygon(x, y, SUIT_DIAMOND);

/** the club: three tight balls on a small centre, and the same foot */
export const suitClub = (x, y) => {
  const balls = Math.min(sdCircle(x, y, 0, 0.38, 0.225), sdCircle(x, y, -0.255, -0.02, 0.225), sdCircle(x, y, 0.255, -0.02, 0.225));
  return Math.min(suitSmin(balls, sdCircle(x, y, 0, 0.06, 0.15), 0.04), suitFoot(x, y));
};
