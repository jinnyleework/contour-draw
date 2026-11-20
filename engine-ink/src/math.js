/*
 * Numbers, noise, and the signed distance pieces a flat shape is built from. No DOM.
 * Every sdf is negative inside its shape and positive outside, in world units (a figure's box is about -1..1, y up).
 */

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** a circle */
export const sdCircle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r;

/** an ellipse with radii rx, ry (close to a true distance near its edge) */
export const sdEllipse = (x, y, cx, cy, rx, ry) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);

/** a box of half-sizes hw, hh with corners rounded by r */
export function sdBox(x, y, cx, cy, hw, hh, r = 0) {
  const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/** the distance from a point to the segment a-b (never negative) */
export function sdSegment(x, y, ax, ay, bx, by) {
  const pax = x - ax, pay = y - ay, bax = bx - ax, bay = by - ay;
  const len = bax * bax + bay * bay, h = len ? clamp((pax * bax + pay * bay) / len, 0, 1) : 0;
  return Math.hypot(pax - bax * h, pay - bay * h);
}

/** a closed polygon, pts = [[x, y], ...]: negative inside */
export function sdPolygon(x, y, pts) {
  let d = Infinity, inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    d = Math.min(d, sdSegment(x, y, xi, yi, xj, yj));
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside ? -d : d;
}

/** an open polyline drawn as a band of thickness w */
export function sdPath(x, y, pts, w) {
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) d = Math.min(d, sdSegment(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
  return d - w / 2;
}

export const union = (a, b) => Math.min(a, b);
export const subtract = (a, b) => Math.max(a, -b);
export const intersect = (a, b) => Math.max(a, b);

/** a stable pseudo-random number in 0..1 for an integer pair and a seed */
export function hash2(i, j, seed) {
  let h = (i * 374761393 + j * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** smooth value noise in 0..1, period about 1 */
export function noise2(x, y, seed = 0) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(i, j, seed), b = hash2(i + 1, j, seed), c = hash2(i, j + 1, seed), d = hash2(i + 1, j + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** two octaves of noise, 0..1 */
export const fbm2 = (x, y, seed = 0) => noise2(x, y, seed) * 0.65 + noise2(x * 2.13 + 7.1, y * 2.13 - 3.3, seed + 11) * 0.35;

/** a stable seed from a string */
export const seedOf = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 1000003, 17);
