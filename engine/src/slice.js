import { contour } from "./contour.js";

/*
 * Slicing a part: cut it at a list of heights, and keep each cut as a "sheet" of closed loops in world
 * coordinates. No DOM.
 *
 * A part is { id, sdf(x, y, z, prm), box: { x: [min, max], y: [min, max] }, planes: [z, ...], order, dynamic?, key? }.
 * `box` is the area it is sampled in (leave a margin: the sdf must be positive outside the shape); `planes` the
 * heights it is cut at; `order` breaks ties between parts at the same height (higher draws later, so nearer).
 * A static part is cut once. A dynamic part takes parameters, and is cut again whenever `key(prm)` changes.
 * `cell` sets the grid cell for a part with thin features (a filament, a tonearm); thinner than about two cells
 * and a line will not trace cleanly, so use a cell about a third of the thinnest feature. The default is CELL.
 * (A finer cell also thins its loops less, so thin features keep their shape.)
 * `overlay` marks a part that sits inside a transparent shell (a filament in glass): it is painted after everything
 * else, so it shows through, whatever its height.
 */

/** the grid cell size, in world units: finer is smoother and slower */
export const CELL = 0.0144;
/** the spacing between slices, in world units */
export const GAP = 0.03;

/** how far a loop may drift from its original shape when thinned, in world units: a third of a pixel at the usual scale */
export const TOLERANCE = 0.0012;

/**
 * Thin a closed loop with Ramer-Douglas-Peucker: keep the two ends of the loop, then keep adding the point that
 * strays furthest from the line drawn so far, until nothing strays by more than `tol`. No point is moved, and the
 * shape never drifts by more than `tol`. Straight and gently curved runs lose most of their points, so the markup
 * shrinks several times over. A loop that would shrink below four points is left as it is.
 */
export function simplifyLoop(loop, tol = TOLERANCE) {
  const n = loop.length;
  if (n < 8) return loop;
  let far = 0, best = -1;
  for (let i = 1; i < n; i++) { const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]); if (d > best) { best = d; far = i; } }
  const keep = new Uint8Array(n); keep[0] = keep[far] = 1;
  const stack = [[0, far], [far, n]];                                    // ranges along the loop; n wraps round to point 0
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b - a < 2) continue;
    const A = loop[a % n], B = loop[b % n], dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy);
    let worst = -1, at = -1;
    for (let i = a + 1; i < b; i++) {
      const p = loop[i % n], d = len < 1e-12 ? Math.hypot(p[0] - A[0], p[1] - A[1]) : Math.abs((p[0] - A[0]) * dy - (p[1] - A[1]) * dx) / len;
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > tol) { keep[at % n] = 1; stack.push([a, at], [at, b]); }
  }
  const out = loop.filter((_, i) => keep[i]);
  return out.length >= 4 ? out : loop;
}

/** `n` heights evenly spread between a and b, each in the middle of its band, about `gap` apart */
export function planes(a, b, gap = GAP) {
  const n = Math.max(2, Math.round((b - a) / gap));
  return Array.from({ length: n }, (_, k) => a + ((k + 0.5) / n) * (b - a));
}

/** cut a part at all its planes; returns [{ z, loops: [[x, y], ...][] }] with empty cuts left out */
export function slicePart(part, prm) {
  const [x0, x1] = part.box.x, [y0, y1] = part.box.y;
  const cell = part.cell || CELL;
  const nx = Math.max(4, Math.round((x1 - x0) / cell)), ny = Math.max(4, Math.round((y1 - y0) / cell));
  const cx = (x1 - x0) / nx, cy = (y1 - y0) / ny, size = (nx + 1) * (ny + 1);
  const f = part.buf && part.buf.length === size ? part.buf : (part.buf = new Float32Array(size)), out = [];
  for (const z of part.planes) {
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) f[j * (nx + 1) + i] = -part.sdf(x0 + i * cx, y0 + j * cy, z, prm);
    const loops = contour(f, nx, ny, 0).map((l) => simplifyLoop(l.map(([i, j]) => [x0 + i * cx, y0 + j * cy]), Math.min(TOLERANCE, cell * 0.1)));
    if (loops.length) out.push({ z, loops });
  }
  return out;
}

/** the sheets of a part for the given parameters: cut once if it is static, re-cut when its key changes if dynamic */
export function sheetsOf(part, prm) {
  if (!part.dynamic) return part.sheets ||= slicePart(part);
  const key = part.key(prm);
  if (part.cacheKey !== key) { part.cacheKey = key; part.cache = prm ? slicePart(part, prm) : []; }
  return part.cache;
}
