/*
 * Small maths shared by every shape and by the painter. No DOM.
 * Shapes are signed distance functions (SDFs): they return how far a point is from the
 * surface, negative inside. These helpers build them.
 */

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const r2 = (n) => Math.round(n * 100) / 100;
/** smoothstep from a to b */
export const sm = (a, b, t) => { const u = clamp((t - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
export const len2 = (a, b) => Math.hypot(a, b);

/**
 * An intensity from anything: 0 (subtle) to 1 (strong), 0.5 by default. Numeric strings are read; what is not a
 * finite number is the default; the rest is clamped.
 */
export const intensity = (v) => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? clamp(n, 0, 1) : 0.5;
};
/**
 * The figure's own number for an intensity: two straight lines that meet at 0.5, where the number is what the figure
 * did before it had an intensity, with its limits at 0 and 1. `[lo, mid, hi]` can fall as well as rise.
 */
export const byIntensity = (v, [lo, mid, hi]) => {
  const i = intensity(v);
  return i <= 0.5 ? lo + (i / 0.5) * (mid - lo) : mid + ((i - 0.5) / 0.5) * (hi - mid);
};

/** the distance from the point (px, py) to the segment from (ax, ay) to (bx, by): the core of a thin tube or arm */
export const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

/** union of two SDFs, with the join rounded over a distance k */
export const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
/** a with b cut out of it */
export const subtract = (a, b) => Math.max(a, -b);

/** a box with rounded edges: half-sizes bx, by, bz plus the rounding r on every side */
export const roundBox = (x, y, z, bx, by, bz, r) => {
  const qx = Math.abs(x) - bx, qy = Math.abs(y) - by, qz = Math.abs(z) - bz;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
};

/**
 * A rounded cylinder. `ra` is the distance from its axis and `c` the position along it, so the caller
 * chooses the axis: along y, `rcyl(len2(x - cx, z - cz), y, ...)`. It runs from c0 to c1, radius r,
 * edges rounded by rr.
 */
export const rcyl = (ra, c, r, c0, c1, rr) => {
  const q1 = ra - (r - rr), q2 = Math.abs(c - (c0 + c1) / 2) - ((c1 - c0) / 2 - rr);
  return Math.hypot(Math.max(q1, 0), Math.max(q2, 0)) + Math.min(Math.max(q1, q2), 0) - rr;
};
