/*
 * Marching squares on a rectangular grid. No DOM.
 *
 * `f` holds (nx + 1) * (ny + 1) values, row by row. A point is inside where f >= L. The result is a
 * list of closed loops, each a list of [i, j] positions in grid units (fractional, interpolated along
 * the cell edges). Loops that pass through a hole come out as separate loops: draw them together with
 * the even-odd fill rule and the hole appears.
 *
 * Every grid edge is a node named by where it is; each cell joins the nodes where the value crosses L,
 * and a loop is walked by following those joins. A cell with four crossings (a saddle) is settled by
 * the average of its corners.
 */
export function contour(f, nx, ny, L) {
  const W = nx + 1, at = (i, j) => f[j * W + i], adj = new Map(), pos = new Map();
  const point = (key) => {
    let p = pos.get(key); if (p) return p;
    const [k, i, j] = key.split(",").map((s, n) => n ? +s : s), [i2, j2] = k === "h" ? [i + 1, j] : [i, j + 1];
    const v0 = at(i, j), v1 = at(i2, j2), t = (L - v0) / (v1 - v0);
    p = [i + (i2 - i) * t, j + (j2 - j) * t]; pos.set(key, p); return p;
  };
  const link = (a, b) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); };
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = at(i, j) >= L, b = at(i + 1, j) >= L, c = at(i + 1, j + 1) >= L, d = at(i, j + 1) >= L;
    if (a === b && b === c && c === d) continue;
    const top = `h,${i},${j}`, right = `v,${i + 1},${j}`, bottom = `h,${i},${j + 1}`, left = `v,${i},${j}`, cross = [];
    if (a !== b) cross.push(top); if (b !== c) cross.push(right); if (d !== c) cross.push(bottom); if (a !== d) cross.push(left);
    if (cross.length === 2) link(cross[0], cross[1]);
    else if (cross.length === 4) {
      const mid = (at(i, j) + at(i + 1, j) + at(i + 1, j + 1) + at(i, j + 1)) / 4 >= L;
      if (mid === a) { link(top, right); link(left, bottom); } else { link(top, left); link(right, bottom); }
    }
  }
  const loops = [], seen = new Set();
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop = []; let prev = null, cur = start;
    while (cur && !seen.has(cur)) {
      seen.add(cur); loop.push(point(cur));
      const next = adj.get(cur).find((n) => n !== prev && !seen.has(n)); prev = cur; cur = next;
    }
    if (loop.length > 3) loops.push(loop);
  }
  return loops;
}
