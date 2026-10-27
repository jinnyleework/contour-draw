/* built by site/build.mjs from engine/: do not edit */
(() => {
/* ===== src/math.js ===== */
/*
 * Small maths shared by every shape and by the painter. No DOM.
 * Shapes are signed distance functions (SDFs): they return how far a point is from the
 * surface, negative inside. These helpers build them.
 */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r2 = (n) => Math.round(n * 100) / 100;
/** smoothstep from a to b */
const sm = (a, b, t) => { const u = clamp((t - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const len2 = (a, b) => Math.hypot(a, b);

/**
 * An intensity from anything: 0 (subtle) to 1 (strong), 0.5 by default. Numeric strings are read; what is not a
 * finite number is the default; the rest is clamped.
 */
const intensity = (v) => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? clamp(n, 0, 1) : 0.5;
};
/**
 * The figure's own number for an intensity: two straight lines that meet at 0.5, where the number is what the figure
 * did before it had an intensity, with its limits at 0 and 1. `[lo, mid, hi]` can fall as well as rise.
 */
const byIntensity = (v, [lo, mid, hi]) => {
  const i = intensity(v);
  return i <= 0.5 ? lo + (i / 0.5) * (mid - lo) : mid + ((i - 0.5) / 0.5) * (hi - mid);
};

/** the distance from the point (px, py) to the segment from (ax, ay) to (bx, by): the core of a thin tube or arm */
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay, t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};

/** union of two SDFs, with the join rounded over a distance k */
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
/** a with b cut out of it */
const subtract = (a, b) => Math.max(a, -b);

/** a box with rounded edges: half-sizes bx, by, bz plus the rounding r on every side */
const roundBox = (x, y, z, bx, by, bz, r) => {
  const qx = Math.abs(x) - bx, qy = Math.abs(y) - by, qz = Math.abs(z) - bz;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
};

/**
 * A rounded cylinder. `ra` is the distance from its axis and `c` the position along it, so the caller
 * chooses the axis: along y, `rcyl(len2(x - cx, z - cz), y, ...)`. It runs from c0 to c1, radius r,
 * edges rounded by rr.
 */
const rcyl = (ra, c, r, c0, c1, rr) => {
  const q1 = ra - (r - rr), q2 = Math.abs(c - (c0 + c1) / 2) - ((c1 - c0) / 2 - rr);
  return Math.hypot(Math.max(q1, 0), Math.max(q2, 0)) + Math.min(Math.max(q1, q2), 0) - rr;
};

/* ===== src/contour.js ===== */
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
function contour(f, nx, ny, L) {
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

/* ===== src/slice.js ===== */
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
const CELL = 0.0144;
/** the spacing between slices, in world units */
const GAP = 0.03;

/** how far a loop may drift from its original shape when thinned, in world units: a third of a pixel at the usual scale */
const TOLERANCE = 0.0012;

/**
 * Thin a closed loop with Ramer-Douglas-Peucker: keep the two ends of the loop, then keep adding the point that
 * strays furthest from the line drawn so far, until nothing strays by more than `tol`. No point is moved, and the
 * shape never drifts by more than `tol`. Straight and gently curved runs lose most of their points, so the markup
 * shrinks several times over. A loop that would shrink below four points is left as it is.
 */
function simplifyLoop(loop, tol = TOLERANCE) {
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
function planes(a, b, gap = GAP) {
  const n = Math.max(2, Math.round((b - a) / gap));
  return Array.from({ length: n }, (_, k) => a + ((k + 0.5) / n) * (b - a));
}

/** cut a part at all its planes; returns [{ z, loops: [[x, y], ...][] }] with empty cuts left out */
function slicePart(part, prm) {
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
function sheetsOf(part, prm) {
  if (!part.dynamic) return part.sheets ||= slicePart(part);
  const key = part.key(prm);
  if (part.cacheKey !== key) { part.cacheKey = key; part.cache = prm ? slicePart(part, prm) : []; }
  return part.cache;
}

/* ===== src/camera.js ===== */
/*
 * The camera: world (x, y, z) to the page. No DOM.
 *
 * World space has x and y on the ground and z up. The camera is orthographic: it turns the ground by
 * `azimuth` (degrees), squashes y by `tilt` (the sine of the elevation; 0.5 is the 2:1 view), and lifts
 * z by cos(elevation). `scene.S` is the scale in page units per world unit, `scene.zm` the height that
 * lands at the page's middle. The page is a 600 x 600 box.
 */

/** the direction on the ground that points at the viewer, as [sin az, cos az]: used to tell edges that face you from edges seen edge-on */
const toViewer = (view) => { const az = (view.azimuth * Math.PI) / 180; return [Math.sin(az), Math.cos(az)]; };

/**
 * The ground point under a page position, for a point at height z: the inverse of the projector. A figure that follows
 * the cursor (a peak that rises where it is) uses this to say where on its ground the cursor is.
 */
function groundPoint(view, scene, px, py, z) {
  const az = (view.azimuth * Math.PI) / 180, c = Math.cos(az), s = Math.sin(az), zf = Math.sqrt(1 - view.tilt ** 2);
  const X = (px - 300) / scene.S, Y = ((py - 300) / scene.S + (z - scene.zm) * zf) / view.tilt;
  return [X * c + Y * s, -X * s + Y * c];
}

/** returns project(x, y, z) -> [px, py] */
function makeProjector(view, scene) {
  const az = (view.azimuth * Math.PI) / 180, c = Math.cos(az), s = Math.sin(az), zf = Math.sqrt(1 - view.tilt ** 2), S = scene.S, zm = scene.zm;
  return (x, y, z) => [300 + S * (x * c - y * s), 300 + S * ((x * s + y * c) * view.tilt - (z - zm) * zf)];
}

/* ===== src/painter.js ===== */
/*
 * The painter: sheets in, svg markup out. No DOM, so it can be tested.
 *
 * Sheets are drawn bottom up, each with an opaque fill, so a higher sheet covers a lower one. Then the
 * drawing rule is applied edge by edge (rule A: weight and depth):
 *   - an edge seen side-on (a silhouette) is heavy; one facing you is light      (`contrast`)
 *   - farther edges are thinner and fainter                                     (`depth`)
 *   - lower sheets are fainter than higher ones                                 (`fade`)
 * Weights and opacities are bucketed, so a sheet is a handful of paths and not one per edge.
 *
 * `shift`, when given, is called with a sheet's middle height on the page and returns how far to move the whole
 * sheet up or down (the hover split). A moved sheet keeps its place in the painting order.
 */

/** the defaults for rule A: heavy silhouettes and light faces, far edges receding, lower sheets only a little fainter */
const RULE = { base: 0.9, contrast: 0.4, depth: 0.8, fade: 0 };
/** the camera: `azimuth` turns the object (degrees), `tilt` is the sine of the elevation (0.5 is the 2:1 view) */
const VIEW = { azimuth: 35, tilt: 0.5 };

const WBINS = 8, OBINS = 4, WMAX = 3.2;

/** the page height of a sheet's middle: the average of a sample of its points */
function middleOf(sh, off, z, P) {
  let t = 0, n = 0;
  for (const l of sh.loops) for (let i = 0; i < l.length; i += 6) { t += P(l[i][0] + off[0], l[i][1] + off[1], z)[1]; n++; }
  return t / n;
}

/**
 * items: [{ sh: { z, loops }, off: [dx, dy, dz] }], already in painting order.
 * scene: { S, zm, zr: [zmin, zmax] }. `pulse` scales every stroke weight (a flash). Returns markup for the inside of an svg.
 */
function paint(items, scene, view = VIEW, rule = RULE, pulse = 1, shift = null) {
  const [s, c] = toViewer(view), P = makeProjector(view, scene), [z0, z1] = scene.zr;
  let out = "";
  for (const { sh, off } of items) {
    const z = sh.z + off[2], sy = P(off[0], off[1], z)[1];
    if (sy < -260 || sy > 900) continue;                                    // far off the page
    const lift = shift ? shift(middleOf(sh, off, z, P)) : 0;
    const pts = (l) => l.map(([x, y]) => { const q = P(x + off[0], y + off[1], z); return r2(q[0]) + " " + r2(q[1] + lift); });
    const fadeO = 1 - rule.fade * (1 - clamp((z - z0) / (z1 - z0), 0, 1)), buckets = new Map();
    out += `<path class="fill" d="${sh.loops.map((l) => "M" + pts(l).join("L") + "Z").join("")}"/>`;
    for (const l of sh.loops) {
      const n = l.length, key = l.map((p, i) => {
        const q = l[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], m = Math.hypot(dx, dy) || 1;
        const facing = Math.abs((-dy * s + dx * c) / m);                    // 0 on a silhouette, 1 facing you
        const near = clamp(0.5 + ((p[0] + q[0]) * s + (p[1] + q[1]) * c) / 4.8, 0, 1);   // 0 far, 1 near
        const w = rule.base * pulse * (0.3 + 2.3 * Math.pow(1 - facing, 1.5) * rule.contrast + 0.45 * (1 - rule.contrast)) * (1 - rule.depth * 0.6 * (1 - near));
        const o = clamp(fadeO * (1 - rule.depth * 0.7 * (1 - near)), 0.1, 1);
        return clamp(Math.round(((w - 0.2) / (WMAX)) * (WBINS - 1)), 0, WBINS - 1) * OBINS + clamp(Math.round(o * (OBINS - 1)), 0, OBINS - 1);
      });
      const P2 = pts(l), emit = (id, run, closed) => { const a = buckets.get(id) || []; a.push("M" + run.join("L") + (closed ? "Z" : "")); buckets.set(id, a); };
      const k = key.findIndex((v, i) => v !== key[(i + n - 1) % n]);
      if (k < 0) { emit(key[0], P2, true); continue; }
      for (let i = 0; i < n;) {
        const v = key[(k + i) % n], run = [P2[(k + i) % n]];
        while (i < n && key[(k + i) % n] === v) { i++; run.push(P2[(k + i) % n]); }
        emit(v, run, false);
      }
    }
    for (const [id, d] of buckets) {
      const w = 0.2 + (Math.floor(id / OBINS) / (WBINS - 1)) * WMAX, o = (id % OBINS) / (OBINS - 1);
      out += `<path class="ln" stroke-width="${r2(w)}" stroke-opacity="${r2(0.1 + 0.9 * o)}" d="${d.join("")}"/>`;
    }
  }
  return out;
}

/* ===== src/scene.js ===== */
/*
 * A scene is an object and what it does. No DOM.
 *
 *   {
 *     T:     seconds in one loop,
 *     zr:    [zmin, zmax] the object's height range (rule A's height fade uses it),
 *     S, zm: camera scale and the height that lands mid-page,
 *     parts: [part, ...]        see slice.js,
 *     active: [t0, t1]          the stretch of the loop the cursor scrubs; the pose at t0 is the rest pose,
 *     drive(x, y) -> 0..1       the cursor's page position to how far through `active` it has taken the figure,
 *     hint:  a few words on where to move the pointer,
 *     step(t, abs, k, pointer) -> { [partId]: { prm?, off?, hide? }, pulse? }     (pointer is for figures that follow the cursor, else ignore it)
 *   }
 *
 * `step` says, for time t within the loop (and abs, the clock without the loop), what every part does, at
 * intensity k (0 to 1, 0.5 is the figure as first drawn; see byIntensity in math.js):
 * `off` moves it ([dx, dy, dz]), `prm` is handed to a dynamic part's sdf (null switches it off), and
 * `pulse` scales every stroke weight for a beat.
 */

/** how strongly the figures perform, 0 to 1: the page edits it in place, the player reads it on every frame */
const MOTION = { intensity: 0.5 };

/** the markup for a scene at time t; `shift` is the hover split (see painter.js), `k` the intensity of the motion */
function frame(scene, t, abs = t, view = VIEW, rule = RULE, shift = null, k = MOTION.intensity, cursor = null) {
  // a figure may follow the cursor: step gets a fourth argument, { s, x, y, ground(z) }, or null when nothing is pointing at it
  const pointer = cursor ? { s: clamp(cursor.s, 0, 1), x: cursor.x, y: cursor.y, ground: (z) => groundPoint(view, scene, cursor.x, cursor.y, z) } : null;
  const st = scene.step(t, abs, k, pointer), items = [];
  for (const part of scene.parts) {
    const a = st[part.id] || {};
    if (a.hide || (part.dynamic && !a.prm)) continue;
    for (const sh of sheetsOf(part, a.prm)) items.push({ sh, off: a.off || [0, 0, 0], order: part.order, over: part.overlay ? 1 : 0 });
  }
  items.sort((a, b) => a.over - b.over || (a.sh.z + a.off[2]) - (b.sh.z + b.off[2]) || a.order - b.order);   // overlays last, then bottom up
  return paint(items, scene, view, rule, st.pulse || 1, shift);
}

/**
 * The moment in the loop the cursor has taken the figure to. With the pointer away (strength 0) it is the rest pose;
 * as the pointer arrives it scrubs `active` by where it is. The strength is capped at 1 so the spring's overshoot
 * cannot carry the figure past its limit.
 */
function hoverTime(scene, cursor) {
  const [a0, a1] = scene.active;
  if (cursor.s < 0.002) return a0;
  return a0 + clamp(scene.drive(cursor.x, cursor.y), 0, 1) * Math.min(1, cursor.s) * (a1 - a0);
}

/** cut every static part now, so the first frame does not stall */
function prepare(scene) { for (const p of scene.parts) if (!p.dynamic) sheetsOf(p); }

/* ===== src/pointer.js ===== */
/*
 * The cursor as the drawing sees it: a point on a spring, so it lags the real pointer a little and settles
 * with a slight bounce, plus a "strength" on a spring that rises when the pointer is over the drawing and
 * falls when it leaves. No DOM, so it can be tested; the player feeds it the pointer.
 *
 * Positions are in page units (the 600 x 600 box).
 */

const K = 150, C = 15;      // spring stiffness and damping: slightly underdamped, so it settles with a small overshoot

const createCursor = () => ({ x: 300, y: 300, vx: 0, vy: 0, s: 0, vs: 0, tx: 300, ty: 300, ts: 0 });

/** the pointer is at (x, y): the cursor follows. On entering it appears there, it does not fly in from where it was. */
function aim(c, x, y) {
  if (c.ts === 0) { c.x = x; c.y = y; c.vx = c.vy = 0; }
  c.tx = x; c.ty = y; c.ts = 1;
}

/** the pointer left: the strength falls away */
function release(c) { c.ts = 0; }

/**
 * Advance by dt seconds. Returns whether it is still moving (the loop can sleep when it is not).
 * With `reduced` it lands on its target at once.
 */
function stepCursor(c, dt, reduced = false) {
  if (reduced) { c.x = c.tx; c.y = c.ty; c.s = c.ts; c.vx = c.vy = c.vs = 0; return false; }
  const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
  for (let i = 0; i < n; i++) {
    c.vx += (-K * (c.x - c.tx) - C * c.vx) * h; c.x += c.vx * h;
    c.vy += (-K * (c.y - c.ty) - C * c.vy) * h; c.y += c.vy * h;
    c.vs += (-K * (c.s - c.ts) - C * c.vs) * h; c.s += c.vs * h;
  }
  const moving = Math.abs(c.x - c.tx) + Math.abs(c.y - c.ty) > 0.1 || Math.abs(c.s - c.ts) > 0.002 || Math.abs(c.vx) + Math.abs(c.vy) + Math.abs(c.vs) > 0.05;
  if (!moving) { c.x = c.tx; c.y = c.ty; c.s = c.ts; c.vx = c.vy = c.vs = 0; }
  return moving;
}

/* ===== src/split.js ===== */
/*
 * The hover split. No DOM.
 *
 * The cursor opens a gap in the stack of layers at its height: layers above it lift, layers below drop. Each layer
 * moves as a unit, across its whole width, by an amount that depends only on how near the cursor's height it is.
 * The gap has a cap so that neighbouring layers can never cross.
 */

/** the settings: `radius` is how far the split reaches (page units, vertically 1.6 times that), `intensity` how wide it opens, 0 to 1 */
const SPLIT = { radius: 60, intensity: 0.5 };
/** how wide the gap opens, as a fraction of its cap, at intensity 0, 0.5 and 1 */
const GAP_RANGE = [0.35, 0.7, 1];
/** the three buttons of an intensity toggle */
const LEVELS = { low: 0, medium: 0.5, high: 1 };

/**
 * The shift for a layer whose middle is at page height `cy`, with the cursor at `cursorY` acting at `strength` (0 to 1):
 * negative lifts it, positive drops it, zero leaves it where it is.
 */
function splitShift(cy, cursorY, strength, cfg = SPLIT) {
  const H = cfg.radius * 1.6, dy = cy - cursorY, u = Math.abs(dy) / H;
  if (u >= 1 || strength < 0.002) return 0;
  const G = byIntensity(cfg.intensity, GAP_RANGE) * Math.min(60, 0.45 * H);
  return Math.tanh(dy / 5) * strength * G * (1 - u) * (1 - u);
}

/* ===== src/player.js ===== */
/*
 * The player: runs a figure in an svg. This is the only file that touches the page.
 *
 * Nothing moves until the pointer arrives. The pointer drives a sprung cursor (pointer.js), and what that does
 * depends on the hover mode:
 *   "animate"  the cursor scrubs the figure's action: where it is over the drawing sets how far through the action
 *              the figure is (`scene.drive`), and leaving lets it spring back to rest.
 *   "split"    the layers part at the cursor's height (split.js); the figure itself stays at rest.
 * Either way, `motion.intensity` (animate) and `split.intensity` say how strongly the figure answers.
 * `rule`, `split` and `motion` are read on every frame, so a page changes them by editing the objects and calling redraw().
 *
 * One animation loop, and it sleeps whenever nothing needs it: pointer away and settled, off screen, tab hidden, or
 * the reader asked for less motion (then the figure answers the pointer at once and nothing animates on its own).
 * A finger works as the pointer: it acts while it is down, and the pose is held for a moment after it lifts, so a
 * tap reads as a look and not a flash (`HOLD`). The drawing takes the finger for itself (touch-action: none), so the
 * page does not scroll under it.
 * `demo()` plays the figure's whole loop once, for a look at what it does; the pointer arriving ends it.
 * `seek(t)` holds the figure at one moment, which is how a still of the loop is made; `play()` lets go.
 */
/** how long a lifted finger's pose is held, in ms */
const HOLD = 1400;

function createPlayer(svg, scenes, { rule = RULE, view = VIEW, split = SPLIT, motion = MOTION } = {}) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let name = Object.keys(scenes)[0], mode = "animate", raf = 0, onScreen = true, last = performance.now(), held = null, demoFrom = null, speed = 1;
  const cursor = createCursor();

  const draw = (now) => {
    const sc = scenes[name];
    let t = hoverTime(sc, cursor);                                           // the rest pose until the pointer arrives
    if (mode === "split") t = sc.active[0];                                   // the figure itself never moves in split mode
    if (demoFrom !== null) {
      if (cursor.s > 0.05) demoFrom = null;                                   // the pointer took over
      else { t = ((now - demoFrom) / 1000) * speed; if (t >= sc.T) { demoFrom = null; t = sc.active[0]; } }
    }
    if (held !== null) t = held;
    const shift = mode === "split" && cursor.s > 0.002 ? (cy) => splitShift(cy, cursor.y, cursor.s, split) : null;
    const follow = mode === "animate" && cursor.s > 0.002 && demoFrom === null && held === null ? cursor : null;      // the cursor, for a figure that follows it
    svg.innerHTML = frame(sc, t % sc.T, now / 1000, view, rule, shift, motion.intensity, follow);
  };
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const moving = stepCursor(cursor, dt, reduce);
    draw(now);
    // the flame flickers and the camera shakes on the clock, so while the pointer is over the figure the loop keeps going
    const live = demoFrom !== null || moving || (mode === "animate" && cursor.s > 0.002 && held === null);
    raf = onScreen && !document.hidden && !reduce && live ? requestAnimationFrame(tick) : 0;
  };
  const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  const toPage = (e) => { const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse()); return [p.x, p.y]; };
  let hold = 0;
  const let_go = () => { release(cursor); wake(); };
  svg.style.touchAction = "none";
  svg.addEventListener("pointermove", (e) => { clearTimeout(hold); aim(cursor, ...toPage(e)); wake(); });
  svg.addEventListener("pointerdown", (e) => { clearTimeout(hold); aim(cursor, ...toPage(e)); wake(); });
  // a mouse leaving acts at once; a finger lifting holds its pose first
  svg.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") { clearTimeout(hold); let_go(); } });
  for (const ev of ["pointerup", "pointercancel"]) svg.addEventListener(ev, (e) => { if (e.pointerType !== "mouse") { clearTimeout(hold); hold = setTimeout(let_go, HOLD); } });
  new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; if (onScreen) wake(); }).observe(svg);
  document.addEventListener("visibilitychange", wake);

  return {
    names: () => Object.keys(scenes),
    get current() { return name; },
    get mode() { return mode; },
    get hint() { return scenes[name].hint || ""; },
    show(n) { name = n; demoFrom = null; held = null; prepare(scenes[n]); draw(performance.now()); wake(); },
    /** "animate" or "split": what the pointer does to the figure */
    setMode(m) { mode = m === "split" ? "split" : "animate"; demoFrom = null; draw(performance.now()); wake(); },
    /** play the whole loop once; nothing runs on its own otherwise */
    demo() { if (reduce) return; held = null; demoFrom = performance.now(); wake(); },
    setSpeed(v) { speed = v; },
    seek(t) { held = t; draw(performance.now()); },
    play() { held = null; wake(); },
    redraw() { draw(performance.now()); wake(); },
    cursor,
  };
}

/* ===== figures/bellows-camera.js ===== */
/*
 * A folding plate camera lying level along x, lens to the right: a flat bed, a framed back, a front standard with a
 * ringed lens riding on a post, and a square pleated bellows between them. Move across it and the front standard runs
 * out along the bed while the bellows unfolds, its pleats opening up. At rest it is folded flat. The bed, back and
 * front standard are cut once and the front only slides; the bellows are cut again as they stretch.
 */
const BELLOWS_X = -0.42, BELLOWS_FOLDS = 7;                              // where the bellows start, and how many pleats they have

const bellowsCamera = {
  T: 4, zr: [-0.41, 0.24], S: 400, zm: -0.03,
  active: [0, 2.2],                                              // the front runs out and the bellows open; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 130) / 340, 0, 1),                    // across the camera
  hint: "move across the camera to open the bellows",
  parts: [
    { id: "body", order: 0, box: { x: [-0.7, 0.65], y: [-0.35, 0.35] }, planes: planes(-0.41, 0.24, 0.02), sdf: (x, y, z) => {
      const bed = Math.min(roundBox(x, y, z + 0.3, 0.5, 0.1, 0.02, 0.015), rcyl(len2(x + 0.35, y), z, 0.06, -0.4, -0.31, 0.01));   // the bed, and a tripod boss under it
      const back = subtract(roundBox(x + 0.45, y, z, 0.015, 0.2, 0.2, 0.02), Math.max(Math.abs(y) - 0.15, Math.abs(z) - 0.15));       // the back: a frame round a window
      return Math.min(bed, back);
    } },
    { id: "front", order: 1, box: { x: [-0.32, 0.02], y: [-0.3, 0.3] }, planes: planes(-0.3, 0.22, 0.025), sdf: (x, y, z) => {
      const board = roundBox(x + 0.2, y, z, 0.015, 0.19, 0.19, 0.02), r = len2(y, z);
      const lens = Math.min(rcyl(r, x, 0.085, -0.17, -0.04, 0.012), rcyl(r, x, 0.11, -0.17, -0.14, 0.01));                    // the lens barrel, and a ring behind it
      return Math.min(board, subtract(lens, rcyl(r, x, 0.05, -0.08, 0.0, 0)), roundBox(x + 0.2, y, z + 0.26, 0.02, 0.04, 0.035, 0.01));   // the glass is recessed; a post carries it
    } },
    { id: "bellows", order: 2, dynamic: true, cell: 0.007, key: (p) => p.L.toFixed(2), box: { x: [-0.5, 0.4], y: [-0.3, 0.3] }, planes: planes(-0.26, 0.26, 0.03), sdf: (x, y, z, { L }) => {
      const u = clamp((x - BELLOWS_X) / L, 0, 1), f = (u * BELLOWS_FOLDS) % 1, pitch = L / BELLOWS_FOLDS;
      const hw = 0.2 - 0.06 * u + Math.min(0.035, 0.8 * pitch) * Math.abs(2 * f - 1);                              // narrowing to the front, zigzagging with the pleats
      return Math.max(Math.abs(y) - hw, Math.abs(z) - hw, BELLOWS_X - x, x - BELLOWS_X - L);
    } },
  ],
  /**
   * k, the intensity: how far the bellows open.
   * 0: part-way · 0.5: well out · 1: fully extended
   */
  step(t, abs, k = 0.5) {
    const reach = byIntensity(k, [0.4, 0.55, 0.7]), e = sm(0, 1.7, t) * (1 - sm(2.8, 3.8, t)), L = 0.2 + (reach - 0.2) * e;
    return { body: {}, front: { off: [L - 0.2, 0, 0] }, bellows: { prm: { L: Math.round(L * 100) / 100 } } };
  },
};

/* ===== figures/binoculars.js ===== */
const tube = (s) => (x, y, z) => {                                          // body, objective bell and eyepiece, with both lenses recessed
  const cx = s * 0.36, R = (rad, y0, y1, rr) => rcyl(len2(x - cx, z), y, rad, y0, y1, rr);
  let d = smin(R(0.3, -0.4, 0.4, 0.06), R(0.35, 0.3, 0.78, 0.05), 0.05);
  d = smin(d, R(0.2, -0.72, -0.3, 0.04), 0.05);
  return subtract(subtract(d, R(0.29, 0.7, 0.95, 0)), R(0.12, -0.9, -0.64, 0));
};

/*
 * The barrels slide apart and together to fit the eyes while the knurled focus wheel turns, one way and back.
 * The barrels and hinge are cut once and only move; the wheel is cut again as its teeth turn.
 */
const binoculars = {
  T: 12, zr: [-0.42, 0.5], S: 195, zm: 0.04,
  active: [0, 6],                                               // the barrels slide out and the wheel turns, from the closed pose
  drive: (x) => clamp((x - 150) / 300, 0, 1),                    // across the binoculars, left to right
  hint: "move across the binoculars to focus and adjust",
  parts: [
    { id: "hinge", order: 0, box: { x: [-0.16, 0.16], y: [-0.36, 0.36] }, planes: planes(-0.03, 0.19), sdf: (x, y, z) => rcyl(len2(x, z - 0.08), y, 0.1, -0.3, 0.3, 0.05) },
    { id: "tubeL", order: 1, box: { x: [-0.8, 0.08], y: [-0.8, 0.86] }, planes: planes(-0.4, 0.4), sdf: tube(-1) },
    { id: "tubeR", order: 2, box: { x: [-0.08, 0.8], y: [-0.8, 0.86] }, planes: planes(-0.4, 0.4), sdf: tube(1) },
    { id: "wheel", order: 3, dynamic: true, key: (p) => p.ph.toFixed(2), box: { x: [-0.26, 0.26], y: [-0.18, 0.18] }, planes: planes(0.14, 0.46), sdf: (x, y, z, { ph }) => {
      const dz = z - 0.3, rad = 0.125 + 0.02 * Math.cos(10 * (Math.atan2(dz, y) + ph));      // ten teeth, turned by ph
      return Math.max(len2(y, dz) - rad, Math.abs(x) - 0.2);
    } },
  ],
  /**
   * k, the intensity: how far the barrels slide apart, and how far the wheel turns.
   * 0: barely adjusting · 0.5: as first drawn · 1: a wide adjustment and nearly a full turn of the wheel each way
   */
  step(t, abs, k = 0.5) {
    const apart = byIntensity(k, [0.03, 0.07, 0.1]), turn = byIntensity(k, [1.5, 3, 5]);
    const ipd = apart * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 12)), ph = Math.round(turn * Math.sin((2 * Math.PI * t) / 8) / 0.03) * 0.03;
    return { hinge: {}, tubeL: { off: [-ipd, 0, 0] }, tubeR: { off: [ipd, 0, 0] }, wheel: { prm: { ph } } };
  },
};

/* ===== figures/camera.js ===== */
/*
 * The lens zooms out on two telescoping stages, the shutter button dips, the whole drawing goes heavier for a beat,
 * the lens comes back. The body is cut once; the lens is cut again as it extends; the button only moves.
 */
const camera = {
  T: 6.5, zr: [-0.4, 0.56], S: 195, zm: 0.08,
  active: [1.0, 3.2],                                           // the lens zooms out, the shutter fires, the button lets go
  drive: (x) => clamp((x - 170) / 260, 0, 1),                    // across the camera, left to right
  hint: "move across the camera to zoom and shoot",
  parts: [
    { id: "body", order: 0, box: { x: [-0.9, 0.9], y: [-0.3, 0.32] }, planes: planes(-0.4, 0.56), sdf: (x, y, z) => {
      let d = smin(roundBox(x, y, z, 0.74, 0.18, 0.3, 0.06), roundBox(x, y + 0.02, z - 0.38, 0.18, 0.12, 0.1, 0.05), 0.03);     // body and prism hump
      d = smin(d, roundBox(x - 0.62, y - 0.2, z, 0.1, 0.06, 0.28, 0.04), 0.04);                                                 // grip
      d = smin(d, rcyl(len2(x - 0.12, z), y, 0.31, 0.1, 0.26, 0.04), 0.03);                                                     // lens mount
      d = subtract(d, roundBox(x + 0.55, y - 0.24, z - 0.12, 0.08, 0.03, 0.05, 0.01));                                          // rangefinder window
      return Math.min(d, rcyl(len2(x + 0.5, y), z, 0.12, 0.26, 0.36, 0.03));                                                    // mode dial
    } },
    { id: "lens", order: 1, dynamic: true, key: (p) => p.zoom.toFixed(2), box: { x: [-0.2, 0.44], y: [0.04, 1.1] }, planes: planes(-0.3, 0.3), sdf: (x, y, z, { zoom }) => {
      const lr = len2(x - 0.12, z), L1 = 0.42 + 0.14 * zoom, L2 = L1 + 0.16 * zoom;
      let d = Math.min(rcyl(lr, y, 0.26, 0.1, L1, 0.05), rcyl(lr, y, 0.21, L1 - 0.1, L2, 0.04));                                // two stages
      d = subtract(d, rcyl(lr, y, 0.17, L2 - 0.07, L2 + 0.3, 0));                                                               // recessed glass
      return Math.min(d, rcyl(lr, y, 0.1, L2 - 0.11, L2 - 0.01, 0.03));
    } },
    { id: "button", order: 2, box: { x: [0.44, 0.66], y: [-0.11, 0.11] }, planes: planes(0.22, 0.4), sdf: (x, y, z) => rcyl(len2(x - 0.55, y), z, 0.07, 0.26, 0.36, 0.02) },
  ],
  /**
   * k, the intensity: how far the lens zooms, and how hard the flash lands.
   * 0: a short zoom and a faint flash · 0.5: as first drawn · 1: half again as far, and a flash that almost triples the weight
   */
  step(t, abs, k = 0.5) {
    const reach = byIntensity(k, [0.5, 1, 1.5]), flash = byIntensity(k, [0.5, 1.4, 2.4]);
    const zoom = reach * sm(1.2, 2.2, t) * (1 - sm(3.8, 4.8, t)), press = sm(2.55, 2.7, t) * (1 - sm(2.85, 3.2, t));
    return { body: {}, lens: { prm: { zoom } }, button: { off: [0, 0, -0.04 * press] }, pulse: 1 + flash * Math.exp(-(((t - 2.75) / 0.09) ** 2)) };
  },
};

/* ===== figures/card-fan.js ===== */
/*
 * Seven playing cards in a stack, each a different card: an ace of spades, a two of diamonds, a three of clubs, and so
 * on up to the five of hearts on top. A card is a rounded rectangle with its suit marked in two corners and its pips
 * standing up from the face, and no letters or numerals. Move up and the cards fan out about the stack's lower end, the
 * top card swinging furthest, until they make an arc. At rest they are squared into one stack. All seven are one dynamic
 * part, cut again as they fan.
 */
const CARDS = 7, CARD_PITCH = 0.05, CARD_FACE = 0.012;                  // how many cards, how far apart they lie, and half the thickness of one
const CARD_DECK = [[1, "spade"], [2, "diamond"], [3, "club"], [4, "spade"], [6, "diamond"], [2, "heart"], [5, "heart"]];   // the count and suit of each card, bottom to top
const CARD_PIPS = [[], [[0, 0]], [[0, 0.09], [0, -0.09]], [[0, 0.1], [0, 0], [0, -0.1]], [[-0.05, 0.09], [0.05, 0.09], [-0.05, -0.09], [0.05, -0.09]],
  [[-0.05, 0.09], [0.05, 0.09], [0, 0], [-0.05, -0.09], [0.05, -0.09]], [[-0.05, 0.1], [0.05, 0.1], [-0.05, 0], [0.05, 0], [-0.05, -0.1], [0.05, -0.1]]];   // where the pips sit on a card of each count

/** a suit mark as an inside-outside value (negative inside), in a unit frame about 2 wide, upright */
const cardSuit = (x, y, suit) => {
  const heart = (hx, hy) => Math.pow(hx * hx + hy * hy - 1, 3) - hx * hx * Math.pow(hy, 3);
  const stem = (sx, sy, top, bot) => Math.max(Math.abs(sx) - (0.1 + 0.3 * clamp((top - sy) / 0.5, 0, 1)), sy - top, bot - sy);
  if (suit === "heart") return heart(x * 0.95, y * 0.95 - 0.1) * 0.5;
  if (suit === "diamond") return (Math.abs(x) * 1.35 + Math.abs(y) - 1.05) * 0.5;
  if (suit === "spade") return Math.min(heart(x * 0.95, -y * 0.95 - 0.25) * 0.5, stem(x, y, -0.45, -1.15));
  const ball = (cx, cy) => Math.hypot(x - cx, y - cy) - 0.46;                                                       // a club: three round lobes and a stem
  return Math.min(ball(0, 0.5), ball(-0.5, -0.2), ball(0.5, -0.2), stem(x, y, -0.2, -1.1));
};

const cardFan = {
  T: 4, zr: [0, 0.4], S: 420, zm: 0.15,
  active: [0, 2.2],                                              // the cards fan out; the pose at 0 is the rest pose, squared
  drive: (x, y) => clamp((480 - y) / 300, 0, 1),                 // up the cards
  hint: "move up the cards to fan them out",
  parts: [
    { id: "cards", order: 0, dynamic: true, cell: 0.011, key: (p) => p.s.toFixed(2), box: { x: [-0.65, 0.65], y: [-0.4, 0.5] }, planes: planes(0.0, CARDS * CARD_PITCH, 0.01), sdf: (x, y, z, { s }) => {
      const i = clamp(Math.round((z - 0.025) / CARD_PITCH), 0, CARDS - 1), ang = (i - (CARDS - 1) / 2) * s, zc = 0.025 + i * CARD_PITCH;   // this card's height and its turn about the stack's lower end
      const dy = y + 0.2, c = Math.cos(ang), sn = Math.sin(ang), u = x * c + dy * sn, v = -x * sn + dy * c - 0.2;
      const slab = Math.max(roundBox(u, v, 0, 0.115, 0.185, 0, 0.03), Math.abs(z - zc) - CARD_FACE);                                           // the card itself, a rounded rectangle
      if (z < zc + CARD_FACE * 0.5 || slab > 0.04) return slab;                                                     // the pips only stand up from the face
      const [count, suit] = CARD_DECK[i];
      let pip = 1;
      for (const [px, py] of CARD_PIPS[count]) pip = Math.min(pip, cardSuit((u - px) / 0.034, (v - py) / 0.034, suit));
      pip = Math.min(pip, cardSuit((u + 0.078) / 0.016, (v - 0.14) / 0.016, suit), cardSuit((u - 0.078) / 0.016, (v + 0.14) / 0.016, suit));   // and a small mark in two corners
      return Math.min(slab, Math.max(pip * 0.03, z - zc - 0.022, zc + CARD_FACE - 0.004 - z));                      // a pip stands a little above the face
    } },
  ],
  /**
   * k, the intensity: how wide the fan opens.
   * 0: a narrow fan · 0.5: a wide one · 1: nearly a half circle
   */
  step(t, abs, k = 0.5) {
    const spread = byIntensity(k, [0.18, 0.28, 0.4]), e = sm(0, 2.2, t) * (1 - sm(2.9, 3.8, t));
    return { cards: { prm: { s: Math.round((0.02 + (spread - 0.02) * e) * 50) / 50 } } };
  },
};

/* ===== figures/carousel.js ===== */
/*
 * A carousel: a stepped plinth with a turntable, a central column under a scalloped canopy, and six horses on poles
 * ringing the turntable. Move across it and the horses spin up round the column, each bobbing on its pole a little
 * after the one before. At rest everything is still. The plinth and canopy are cut once; the ring of horses is cut
 * again as it turns.
 */
const RIDE = 0.34, POLES = 6;

/** one horse on its pole, at angle th round the column: a body, a head on a neck, and the pole through them */
const horse = (x, y, z, th, bob) => {
  const c = Math.cos(th), s = Math.sin(th), dx = x - RIDE * c, dy = y - RIDE * s, v = -dx * s + dy * c, u = dx * c + dy * s, w = z - (0.32 + bob);
  const body = roundBox(v, u, w, 0.07, 0.025, 0.03, 0.03), head = roundBox(v - 0.1, u, w - 0.05, 0.012, 0.02, 0.04, 0.02);
  return Math.min(smin(body, head, 0.03), Math.max(len2(u, v) - 0.027, 0.04 - z, z - 0.62));
};

const carousel = {
  T: 4, zr: [-0.1, 0.92], S: 260, zm: 0.4,
  active: [0, 2.4],                                              // the ride spins up from standing; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 150) / 300, 0, 1),                    // across the carousel
  hint: "move across the carousel to spin it up",
  parts: [
    { id: "base", order: 0, box: { x: [-0.7, 0.7], y: [-0.7, 0.7] }, planes: planes(-0.1, 0.62), sdf: (x, y, z) => {
      const r = len2(x, y);
      return Math.min(rcyl(r, z, 0.6, -0.1, 0, 0.02), rcyl(r, z, 0.52, 0, 0.04, 0.015), rcyl(r, z, 0.07, 0, 0.62, 0.02));   // plinth, turntable, column
    } },
    { id: "canopy", order: 1, box: { x: [-0.7, 0.7], y: [-0.7, 0.7] }, planes: planes(0.62, 0.9), sdf: (x, y, z) => {
      const r = len2(x, y), scallop = 0.026 * Math.cos(10 * Math.atan2(y, x)), t = clamp((z - 0.68) / 0.18, 0, 1);
      const roof = Math.max(r - (0.55 + scallop) * (1 - 0.9 * t * t), 0.64 - z, z - 0.86);                          // a scalloped skirt rising to a cone
      return Math.min(roof, Math.hypot(x, y, z - 0.88) - 0.03, rcyl(r, z, 0.07, 0.62, 0.68, 0.02));
    } },
    { id: "ride", order: 2, dynamic: true, cell: 0.015, key: (p) => p.ph.toFixed(2), box: { x: [-0.5, 0.5], y: [-0.5, 0.5] }, planes: planes(0.04, 0.62, 0.02), sdf: (x, y, z, { ph }) => {
      const step = (2 * Math.PI) / POLES, i = Math.round((Math.atan2(y, x) - ph) / step);                     // only the nearest horse can matter, so only it is measured
      return horse(x, y, z, ph + i * step, 0.07 * Math.sin(2 * ph + (((i % POLES) + POLES) % POLES) * 1.3));
    } },
  ],
  /**
   * k, the intensity: how many turns it spins up through.
   * 0: one turn · 0.5: two · 1: four
   */
  step(t, abs, k = 0.5) {
    const turns = byIntensity(k, [1, 2, 4]), back = sm(3, 4, t), ph = Math.round((turns * 2 * Math.PI * sm(0, 2.4, t) * (1 - back)) / 0.04) * 0.04;
    return { base: {}, canopy: {}, ride: { prm: { ph } } };
  },
};

/* ===== figures/cassette-deck.js ===== */
/*
 * A cassette deck lying flat: a body with a well holding a cassette, the cassette's two windows showing its reels, and
 * a row of five piano keys along the front. Move across it and it plays: the play key goes down, both reels turn, and
 * the tape winds from the left reel onto the right, one pack shrinking as the other grows. At rest the keys are up
 * and the tape is all on the left. The deck and cassette are cut once; the play key only moves; the reels are cut
 * again as they turn and wind.
 */
const DECK_REELS = [-0.18, 0.18], DECK_REEL_Y = 0.02;                   // where the two reels sit

/** a reel: a pack of tape of radius `pack` round a hub with six teeth, turned by `ph` */
const deckReel = (x, y, z, cx, pack, ph) => {
  const dx = x - cx, dy = y - DECK_REEL_Y, r = len2(dx, dy), th = Math.atan2(dy, dx) + ph;
  const tape = Math.max(r - pack, 0.045 - r, Math.abs(z + 0.045) - 0.012);                                         // the pack of tape, round the hub
  const ring = Math.max(r - 0.045, -(r - (0.026 + 0.007 * Math.cos(6 * th))), Math.abs(z + 0.04) - 0.016);         // a hub with six teeth inside
  return Math.min(tape, ring);
};

const cassetteDeck = {
  T: 4, zr: [-0.14, 0.04], S: 400, zm: -0.05,
  active: [0, 2.4],                                              // the play key goes down and the tape winds; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 130) / 340, 0, 1),                    // across the deck
  hint: "move across the deck to play the tape",
  parts: [
    { id: "deck", order: 0, cell: 0.008, box: { x: [-0.72, 0.72], y: [-0.55, 0.55] }, planes: planes(-0.14, 0.02, 0.01), sdf: (x, y, z) => {
      let d = roundBox(x, y, z + 0.07, 0.56, 0.4, 0.05, 0.02);                                                     // the body, top at z = 0
      d = subtract(d, Math.max(Math.abs(x) - 0.44, Math.abs(y + 0.02) - 0.27, -0.08 - z));                         // the well the cassette sits in
      for (let k = 0; k < 5; k++) if (k !== 1) d = Math.min(d, roundBox(x + 0.3 - 0.15 * k, y - 0.34, z - 0.01, 0.055, 0.035, 0.012, 0.008));   // the piano keys, but the play key
      return d;
    } },
    { id: "cassette", order: 1, cell: 0.007, box: { x: [-0.5, 0.5], y: [-0.36, 0.32] }, planes: planes(-0.08, -0.005, 0.01), sdf: (x, y, z) => {
      let d = roundBox(x, y + 0.02, z + 0.04, 0.4, 0.24, 0.025, 0.012);                                           // the shell
      for (const cx of DECK_REELS) d = subtract(d, Math.max(len2(x - cx, y - DECK_REEL_Y) - 0.1, -0.04 - z));       // two round windows onto the reels
      d = subtract(d, roundBox(x, y + 0.2, z, 0.25, 0.03, 0.03, 0.01));                                            // the opening along the bottom edge
      return d;
    } },
    { id: "play", order: 2, box: { x: [-0.25, -0.05], y: [0.22, 0.46] }, planes: planes(-0.01, 0.03, 0.01), sdf: (x, y, z) => roundBox(x + 0.15, y - 0.34, z - 0.01, 0.055, 0.035, 0.012, 0.008) },
    { id: "reels", order: 3, dynamic: true, cell: 0.005, key: (p) => p.f.toFixed(2) + ":" + p.ph.toFixed(2), box: { x: [-0.32, 0.32], y: [-0.13, 0.17] }, planes: planes(-0.065, -0.025, 0.01), sdf: (x, y, z, { f, ph }) => {
      const left = 0.095 - 0.045 * f, right = 0.05 + 0.045 * f;                                                     // the tape moves from the left pack to the right
      return Math.min(deckReel(x, y, z, DECK_REELS[0], left, ph * (0.07 / left)), deckReel(x, y, z, DECK_REELS[1], right, ph * (0.07 / right)));
    } },
  ],
  /**
   * k, the intensity: how much tape winds across.
   * 0: a third · 0.5: two thirds · 1: all of it
   */
  step(t, abs, k = 0.5) {
    const wind = byIntensity(k, [0.33, 0.66, 1]), e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t)), press = sm(0, 0.3, t) * (1 - sm(2.9, 3.4, t));
    return { deck: {}, cassette: {}, play: { off: [0, 0, -0.018 * press] }, reels: { prm: { f: Math.round(wind * e * 40) / 40, ph: Math.round(-wind * e * 30 * 25) / 25 } } };
  },
};

/* ===== figures/crystal-cluster.js ===== */
/*
 * A cluster of seven six-sided crystals, each a prism under a pointed tip, standing on a ragged rock. Move up it and
 * the crystals grow, the tall ones first and the small ones after, each leaning a little more as it lengthens. At rest
 * they are small stubs on the rock. The rock is cut once; the crystals are cut again as they grow.
 */
const CRYSTALS = [                                                       // x, y, full height, half width, lean, the moment it starts growing
  [0, 0, 0.9, 0.1, 0.05, 0], [0.22, 0.1, 0.65, 0.075, -0.1, 0.08], [-0.2, 0.15, 0.7, 0.08, 0.12, 0.12], [0.1, -0.23, 0.55, 0.07, 0.08, 0.18],
  [-0.18, -0.18, 0.5, 0.065, -0.05, 0.22], [0.33, -0.12, 0.35, 0.055, 0.15, 0.26], [-0.35, 0, 0.38, 0.06, -0.12, 0.3],
];

const crystalCluster = {
  T: 4, zr: [-0.1, 1.0], S: 300, zm: 0.4,
  active: [0, 2.4],                                              // the crystals grow; the pose at 0 is the rest pose, stubs
  drive: (x, y) => clamp((480 - y) / 300, 0, 1),                 // up the cluster
  hint: "move up the cluster to grow the crystals",
  parts: [
    { id: "rock", order: 0, box: { x: [-0.7, 0.7], y: [-0.7, 0.7] }, planes: planes(-0.1, 0.06, 0.015), sdf: (x, y, z) => {
      const th = Math.atan2(y, x);
      return Math.max(len2(x, y) - (0.5 + 0.05 * Math.cos(5 * th) + 0.03 * Math.cos(9 * th + 1)), -0.1 - z, z - 0.06);   // a ragged slab of rock
    } },
    { id: "crystals", order: 1, dynamic: true, cell: 0.022, key: (p) => p.e.toFixed(2) + ":" + p.g.toFixed(2), box: { x: [-0.55, 0.55], y: [-0.5, 0.5] }, planes: planes(0.0, 1.0, 0.015), sdf: (x, y, z, { e, g }) => {
      let d = 1;
      for (const [cx, cy, h0, a, lean, start] of CRYSTALS) {
        const lx = x - cx - lean * z, ly = y - cy;
        if (Math.abs(lx) > a * 1.6 || Math.abs(ly) > a * 1.6) continue;                                            // too far from this crystal to matter
        const h = h0 * g * (0.25 + 0.75 * clamp((e - start) / 0.6, 0, 1)), tip = 1.3 * a;
        const width = z > h - tip ? (a * (h - z)) / tip : a;                                                       // a prism, then a pointed tip
        d = Math.min(d, Math.max(Math.max(Math.abs(ly), 0.866 * Math.abs(lx) + 0.5 * Math.abs(ly)) - width, -z));   // a hexagon in section
      }
      return d;
    } },
  ],
  /**
   * k, the intensity: how tall the crystals grow.
   * 0: two thirds of full height · 0.5: full height · 1: a third as tall again
   */
  step(t, abs, k = 0.5) {
    const g = byIntensity(k, [0.65, 1, 1.3]), e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t));
    return { rock: {}, crystals: { prm: { e: Math.round(e * 1.0 * 40) / 40, g } } };
  },
};

/* ===== figures/drawer-chest.js ===== */
/*
 * A chest of four drawers on short feet, with a top that overhangs, and a round knob on every drawer. Move up it and
 * the drawers slide out toward you one after another from the bottom, each a little after the one below and a little
 * less far, so you look down into each open tray. At rest they are all shut. The carcass is cut once; each drawer is a rigid open tray and only slides.
 */
const DRAWER_Z = [0, 1, 2, 3].map((i) => -0.35 + 0.235 * i);              // the middle height of each drawer, bottom to top

/** a drawer at height zc: an open tray with a floor and four walls, a front panel standing a little proud of the carcass, and a knob */
const chestDrawer = (zc) => (x, y, z) => {
  const tray = subtract(roundBox(x, y - 0.02, z - zc, 0.385, 0.275, 0.06, 0.015), Math.max(Math.abs(x) - 0.365, Math.abs(y - 0.0275) - 0.2625, zc - 0.055 - z));
  return Math.min(tray, roundBox(x, y - 0.33, z - zc, 0.435, 0.015, 0.08, 0.015), rcyl(len2(x, z - zc), y, 0.03, 0.36, 0.43, 0.012));
};

const drawerChest = {
  T: 4, zr: [-0.62, 0.56], S: 300, zm: 0,
  active: [0, 2.4],                                              // the drawers slide out, bottom to top; the pose at 0 is the rest pose
  drive: (x, y) => clamp((490 - y) / 320, 0, 1),                 // up the chest
  hint: "move up the chest to open its drawers",
  parts: [
    { id: "carcass", order: 0, box: { x: [-0.7, 0.7], y: [-0.5, 0.5] }, planes: planes(-0.62, 0.56, 0.025), sdf: (x, y, z) => {
      let d = roundBox(x, y, z, 0.5, 0.3, 0.5, 0.03);                                                                        // the body
      for (const zc of DRAWER_Z) d = subtract(d, Math.max(Math.abs(x) - 0.43, Math.abs(z - zc) - 0.1, -0.28 - y));           // a slot for each drawer, open at the front
      d = Math.min(d, roundBox(x, y, z - 0.52, 0.52, 0.33, 0.02, 0.015));                                                    // the top, overhanging
      for (const fx of [-0.42, 0.42]) for (const fy of [-0.22, 0.22]) d = Math.min(d, rcyl(len2(x - fx, y - fy), z, 0.05, -0.62, -0.5, 0.015));   // four feet
      return d;
    } },
    ...DRAWER_Z.map((zc, i) => ({ id: "drawer" + i, order: 1 + i, box: { x: [-0.55, 0.55], y: [-0.4, 0.55] }, planes: planes(zc - 0.095, zc + 0.095, 0.015), sdf: chestDrawer(zc) })),
  ],
  /**
   * k, the intensity: how far each drawer slides out.
   * 0: a quarter of its depth · 0.5: two thirds · 1: almost all of it
   */
  step(t, abs, k = 0.5) {
    const reach = byIntensity(k, [0.25, 0.4, 0.55]), back = sm(2.9, 3.8, t), out = (i) => reach * (1 - 0.2 * i) * sm(0.15 + 0.4 * i, 0.9 + 0.4 * i, t) * (1 - back);   // the lower the drawer, the further out, so you can see into each
    return { carcass: {}, drawer0: { off: [0, out(0), 0] }, drawer1: { off: [0, out(1), 0] }, drawer2: { off: [0, out(2), 0] }, drawer3: { off: [0, out(3), 0] } };
  },
};

/* ===== figures/funnel.js ===== */
/*
 * A funnel on three legs over a tray, brimming with grains. Move up it and the grains drain: the level drops with a
 * swirl opening in the middle, and a beaded stream runs out of the spout into the tray. At rest the funnel is full
 * and still. The funnel, legs and tray are cut once; the grains in the funnel and the stream are cut again as they move.
 */
const funnelIn = (z) => (z >= 0.3 ? 0.07 + (0.5 * (z - 0.3)) / 0.6 : 0.07);   // the inside radius of the funnel at height z

/** the distance from a point to a rod between two points, as a thin leg */
const funnelLeg = (x, y, z, [ax, ay, az], [bx, by, bz], r) => {
  const dx = bx - ax, dy = by - ay, dz = bz - az, t = clamp(((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / (dx * dx + dy * dy + dz * dz), 0, 1);
  return Math.hypot(x - ax - t * dx, y - ay - t * dy, z - az - t * dz) - r;
};

const funnel = {
  T: 4, zr: [-0.56, 0.94], S: 320, zm: 0.18,
  active: [0, 2.4],                                              // the grains drain; the pose at 0 is the rest pose, full
  drive: (x, y) => clamp((500 - y) / 320, 0, 1),                 // up the funnel
  hint: "move up the funnel to drain it",
  parts: [
    { id: "funnel", order: 0, cell: 0.013, box: { x: [-0.7, 0.7], y: [-0.7, 0.7] }, planes: planes(-0.16, 0.94, 0.02), sdf: (x, y, z) => {
      const r = len2(x, y), wall = Math.max(r - funnelIn(z) - 0.035, -(r - funnelIn(z)), z - 0.9, -0.15 - z);      // a hollow cone and spout, open at both ends
      return Math.min(wall, Math.max(rcyl(r, z, 0.64, 0.88, 0.93, 0.012), -(r - 0.57)));                          // and a rim round the mouth
    } },
    { id: "stand", order: 1, cell: 0.013, box: { x: [-0.55, 0.55], y: [-0.55, 0.55] }, planes: planes(-0.56, 0.6, 0.015), sdf: (x, y, z) => {
      let d = Math.min(rcyl(len2(x, y), z, 0.42, -0.56, -0.5, 0.015), Math.max(Math.abs(len2(x, y) - 0.36) - 0.02, Math.abs(z + 0.48) - 0.03));   // a tray with a raised lip
      for (let k = 0; k < 3; k++) { const a = Math.PI / 2 + (k * 2 * Math.PI) / 3; d = Math.min(d, funnelLeg(x, y, z, [0.34 * Math.cos(a), 0.34 * Math.sin(a), 0.56], [0.4 * Math.cos(a), 0.4 * Math.sin(a), -0.5], 0.03)); }
      return d;                                                                                                    // and three legs from the cone to the tray
    } },
    { id: "grain", order: 2, dynamic: true, cell: 0.02, key: (p) => p.L.toFixed(2) + ":" + p.ph.toFixed(1), box: { x: [-0.6, 0.6], y: [-0.6, 0.6] }, planes: planes(-0.1, 0.88, 0.02), sdf: (x, y, z, { L, ph }) => {
      const r = len2(x, y), flowing = L < 0.84 ? 1 : 0;
      const top = L - flowing * 0.12 * Math.exp(-r / 0.14) + flowing * 0.012 * Math.cos(2 * Math.atan2(y, x) - 16 * r + ph);   // a surface with a swirl opening in it
      return Math.max(r - funnelIn(z) + 0.01, z - top, -0.1 - z);
    } },
    { id: "stream", order: 3, dynamic: true, cell: 0.006, key: (p) => p.ph.toFixed(1), box: { x: [-0.07, 0.07], y: [-0.07, 0.07] }, planes: planes(-0.5, -0.12, 0.01), sdf: (x, y, z, { ph }) =>
      rcyl(len2(x, y), z, 0.03 + 0.01 * Math.cos(60 * z - ph), -0.5, -0.12, 0.008) },
  ],
  /**
   * k, the intensity: how far it drains.
   * 0: a third of the way down · 0.5: most of the way · 1: down to the neck
   */
  step(t, abs, k = 0.5) {
    const drain = byIntensity(k, [0.35, 0.8, 1]), e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t)), f = drain * e, q = (v, n) => Math.round(v * n) / n;
    return {
      funnel: {}, stand: {}, grain: { prm: { L: q(0.85 - 0.5 * f, 50), ph: q(f * 40, 4) } },
      stream: { prm: f > 0.03 ? { ph: q(f * 40, 4) } : null },
    };
  },
};

/* ===== figures/gear-train.js ===== */
/*
 * A gear train: four spur gears of different sizes meshed together on a plate, each on its own axle, the larger ones
 * with round holes through their webs. Move across it and the largest gear turns, and the others turn with it, each
 * at its own speed and in the right direction, tooth in gap. At rest they are still. The plate and axles are cut once;
 * the gears are cut again as they turn.
 */
const GEAR_M = 0.015;                                                    // the module: a gear's pitch radius is its tooth count times this
/** each gear: its tooth count, and which gear it meshes with and at what angle from that gear's middle */
const GEARS = (() => {
  const list = [{ n: 16, x: 0, y: 0 }], add = (n, from, beta) => {
    const f = list[from], dist = (f.n + n) * GEAR_M;
    list.push({ n, x: f.x + dist * Math.cos(beta), y: f.y + dist * Math.sin(beta), from, beta });
  };
  add(10, 0, -0.35); add(12, 1, 0.95); add(8, 0, 2.6);
  const cx = list.reduce((s, g) => s + g.x, 0) / list.length, cy = list.reduce((s, g) => s + g.y, 0) / list.length;
  return list.map((g) => ({ ...g, x: g.x - cx, y: g.y - cy }));        // centred on the page
})();

/** every gear's turn, from the first gear's turn: each meshing gear turns the other way, tooth in gap at the contact */
const gearTurns = (phi0) => {
  const out = [phi0];
  for (let k = 1; k < GEARS.length; k++) {
    const g = GEARS[k], f = GEARS[g.from];
    out.push(g.beta + Math.PI - Math.PI / g.n + (f.n / g.n) * (g.beta - out[g.from]));
  }
  return out;
};

const gearTrain = {
  T: 4, zr: [-0.08, 0.12], S: 380, zm: 0.02,
  active: [0, 2.4],                                              // the gears turn; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 130) / 340, 0, 1),                    // across the gears
  hint: "move across the gears to turn them",
  parts: [
    { id: "plate", order: 0, box: { x: [-0.75, 0.75], y: [-0.65, 0.65] }, planes: planes(-0.08, 0.12, 0.012), sdf: (x, y, z) => {
      let d = roundBox(x, y, z + 0.055, 0.6, 0.48, 0.012, 0.02);                                                   // a flat plate
      for (const g of GEARS) d = Math.min(d, rcyl(len2(x - g.x, y - g.y), z, 0.028, -0.04, 0.1, 0.01));            // an axle for each gear
      return d;
    } },
    { id: "gears", order: 1, dynamic: true, cell: 0.011, key: (p) => p.phi.toFixed(3), box: { x: [-0.7, 0.7], y: [-0.6, 0.6] }, planes: planes(-0.005, 0.075, 0.012), sdf: (x, y, z, { phi }) => {
      const turns = gearTurns(phi);
      let d = 1;
      GEARS.forEach((g, k) => {
        const dx = x - g.x, dy = y - g.y, r = len2(dx, dy), R = g.n * GEAR_M;
        if (r > R + 0.04) return;                                                                                 // too far from this gear to matter
        const th = Math.atan2(dy, dx) - turns[k], tooth = R + 0.022 * clamp(2.2 * Math.cos(g.n * th), -1, 1);       // square-ish teeth round the pitch circle
        let gd = Math.max(r - tooth, 0.035 - r, Math.abs(z - 0.035) - 0.03);                                     // a toothed disc with a bore for the axle
        if (g.n >= 12) for (let h = 0; h < 4; h++) {                                                              // round holes through the larger webs, turning with them
          const ha = turns[k] + (h * Math.PI) / 2 + Math.PI / 4, hr = R * 0.55;
          gd = Math.max(gd, -(len2(dx - hr * Math.cos(ha), dy - hr * Math.sin(ha)) - R * 0.2));
        }
        d = Math.min(d, gd);
      });
      return d;
    } },
  ],
  /**
   * k, the intensity: how far the largest gear turns.
   * 0: half a turn · 0.5: one turn · 1: two turns
   */
  step(t, abs, k = 0.5) {
    const turns = byIntensity(k, [0.5, 1, 2]), e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t));
    return { plate: {}, gears: { prm: { phi: Math.round(turns * 2 * Math.PI * e * 200) / 200 } } };
  },
};

/* ===== figures/gyroscope.js ===== */
/*
 * A toy gyroscope: a heavy rotor, with a ring of round cut-outs, on a long axle whose pointed foot rests in a cup on a
 * plinth. Move across it and the rotor spins up while the axle leans over and sweeps round the cup, precessing as a
 * real one does. At rest it stands upright and still. The plinth is cut once; the rotor, leaning and spinning, is cut
 * again as it moves.
 */
const gyroHole = (x, y) => {                                              // six round cut-outs ringing the rotor, turning with it
  const k = (Math.round((Math.atan2(y, x) * 6) / (2 * Math.PI)) * (2 * Math.PI)) / 6;
  return Math.hypot(x - 0.24 * Math.cos(k), y - 0.24 * Math.sin(k)) - 0.065;
};

/** the rotor and axle in the frame of the leaning toy: `th` is the lean, `psi` the way it leans, `ph` the spin */
const gyroRotor = (x, y, z, { th, psi, ph }) => {
  const al = x * Math.cos(psi) + y * Math.sin(psi), pe = -x * Math.sin(psi) + y * Math.cos(psi);
  const a = al * Math.cos(th) - z * Math.sin(th), lz = al * Math.sin(th) + z * Math.cos(th);               // the point seen from the toy's own upright frame
  const lx = a * Math.cos(psi) - pe * Math.sin(psi), ly = a * Math.sin(psi) + pe * Math.cos(psi);
  const c = Math.cos(ph), s = Math.sin(ph), ux = lx * c + ly * s, uy = -lx * s + ly * c, r = len2(ux, uy);   // and turned by the spin
  const disc = Math.max(rcyl(r, lz, 0.4, 0.31, 0.39, 0.025), -gyroHole(ux, uy));
  const axle = Math.max(r - 0.04, lz - 0.52, -lz);
  return Math.min(disc, axle, rcyl(r, lz, 0.06, 0.28, 0.42, 0.01));                                       // a disc with cut-outs, an axle through it, a hub
};

const gyroscope = {
  T: 4, zr: [-0.3, 0.9], S: 260, zm: 0.3,
  active: [0, 2.4],                                              // the rotor spins up and the axle leans and sweeps; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 150) / 300, 0, 1),                    // across the gyroscope
  hint: "move across the gyroscope to spin it up",
  parts: [
    { id: "plinth", order: 0, box: { x: [-0.6, 0.6], y: [-0.6, 0.6] }, planes: planes(-0.3, 0.02, 0.02), sdf: (x, y, z) => {
      const r = len2(x, y);
      return Math.min(rcyl(r, z, 0.5, -0.3, -0.2, 0.03), rcyl(r, z, 0.05, -0.2, -0.06, 0.01), rcyl(r, z, 0.1, -0.08, 0.0, 0.015),   // a round plinth, a stem, a cup
        Math.max(Math.abs(r - 0.4) - 0.02, Math.abs(z + 0.17) - 0.03));                                                               // and a raised ring on the plinth
    } },
    { id: "rotor", order: 1, dynamic: true, cell: 0.022, key: (p) => p.th.toFixed(2) + ":" + p.psi.toFixed(2) + ":" + p.ph.toFixed(2), box: { x: [-0.65, 0.65], y: [-0.65, 0.65] }, planes: planes(0, 0.9, 0.022), sdf: gyroRotor },
  ],
  /**
   * k, the intensity: how far the axle leans as it spins.
   * 0: a slight lean · 0.5: a clear one · 1: well over
   */
  step(t, abs, k = 0.5) {
    const lean = byIntensity(k, [0.18, 0.35, 0.55]), e = sm(0, 1.4, t) * (1 - sm(2.9, 3.8, t)), q = (v) => Math.round(v / 0.05) * 0.05;
    return { plinth: {}, rotor: { prm: { th: q(lean * e), psi: q(2 * Math.PI * 1.5 * sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t))), ph: q(10 * Math.PI * sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t))) } } };
  },
};

/* ===== figures/honeycomb.js ===== */
/*
 * A patch of nineteen hexagonal cells, thin walls round each, in the shape of a larger hexagon. Move across it and the
 * cells fill with honey in a wave from the left, each cell rising to a domed surface a little after its neighbour.
 * At rest every cell is empty. The walls are cut once; the honey is cut again as the wave crosses.
 */
const COMB = 0.14;                                                       // the apothem of a cell: half the distance from one cell's middle to the next

/** the middle of the cell nearest a point, and whether that cell is in the patch: a flat-top hexagon grid, found by rounding in cube coordinates */
const combCell = (x, y) => {
  const fq = x / (1.732 * COMB), fr = (y - fq * COMB) / (2 * COMB), fs = -fq - fr;
  let q = Math.round(fq), r = Math.round(fr), s = Math.round(fs);
  const dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  return { cx: q * 1.732 * COMB, cy: (q + 2 * r) * COMB, in: Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r)) <= 2 };
};
const combNorm = (x, y) => Math.max(Math.abs(y), 0.866 * Math.abs(x) + 0.5 * Math.abs(y));   // distance to a hexagon's edge (its apothem is the value where the edge is)

const honeycomb = {
  T: 4, zr: [0, 0.27], S: 300, zm: 0.1,
  active: [0, 2.2],                                              // the honey wave crosses; the pose at 0 is the rest pose, empty
  drive: (x) => clamp((x - 130) / 340, 0, 1),                    // across the comb
  hint: "move across the comb to fill its cells",
  parts: [
    { id: "walls", order: 0, cell: 0.01, box: { x: [-0.85, 0.85], y: [-0.85, 0.85] }, planes: planes(0, 0.25, 0.02), sdf: (x, y) => {
      const c = combCell(x, y), n = combNorm(x - c.cx, y - c.cy);
      return c.in ? Math.max(n - COMB, COMB - 0.035 - n) : 1;                                                     // a thin hexagonal wall round every cell
    } },
    { id: "honey", order: 1, dynamic: true, cell: 0.014, key: (p) => p.e.toFixed(2) + ":" + p.h.toFixed(2), box: { x: [-0.85, 0.85], y: [-0.85, 0.85] }, planes: planes(0.02, 0.24, 0.015), sdf: (x, y, z, { e, h }) => {
      const c = combCell(x, y);
      if (!c.in) return 1;
      const n = combNorm(x - c.cx, y - c.cy), fill = clamp(e * 1.7 - (c.cx + 0.7) / 1.4, 0, 1);                    // how full this cell is: the wave reaches the left first
      return Math.max(n - (COMB - 0.04), z - (0.025 + h * fill * (1 - 0.5 * Math.pow(n / COMB, 2))), 0.015 - z);    // honey to a domed surface, a little below the walls
    } },
  ],
  /**
   * k, the intensity: how high the honey rises in each cell.
   * 0: a third of the wall · 0.5: nearly two thirds · 1: almost to the brim
   */
  step(t, abs, k = 0.5) {
    const high = byIntensity(k, [0.08, 0.15, 0.21]), e = sm(0, 2.2, t) * (1 - sm(2.9, 3.8, t));
    return { walls: {}, honey: { prm: e > 0.1 ? { e: Math.round(e * 40) / 40, h: high } : null } };
  },
};

/* ===== figures/hourglass.js ===== */
/*
 * An hourglass between two plates held by two posts: two glass bulbs joined at a narrow neck, sand in the top one.
 * Move across it and the sand runs: the top level drops with a funnel opening in it, a thin stream falls through the
 * neck, and a mound builds in the lower bulb. At rest the top is full. The glass, plates and posts are cut once; the
 * sand is cut again as it runs. The posts stand at the sides, not in front of or behind the glass: the painter orders by
 * height alone, so a post that overlapped the glass on the page would be hidden by it.
 */
const glassRadius = (z) => 0.035 + 0.345 * Math.pow(Math.sin(Math.PI * clamp(Math.abs(z) / 0.9, 0, 1)), 0.7);   // the inside radius of the glass at height z

const hourglass = {
  T: 4, zr: [-0.97, 0.97], S: 290, zm: 0,
  active: [0, 2.4],                                              // the sand runs; the pose at 0 is the rest pose, top full
  drive: (x) => clamp((x - 150) / 300, 0, 1),                    // across the hourglass
  hint: "move across the hourglass to run the sand",
  parts: [
    { id: "glass", order: 0, cell: 0.014, box: { x: [-0.5, 0.5], y: [-0.5, 0.5] }, planes: planes(-0.97, 0.97, 0.035), sdf: (x, y, z) => {
      const r = len2(x, y), shell = Math.max(r - glassRadius(z) - 0.022, -(r - glassRadius(z)), Math.abs(z) - 0.9);    // hollow glass, two bulbs on a neck
      return Math.min(shell, rcyl(r, z, 0.46, 0.9, 0.97, 0.02), rcyl(r, z, 0.46, -0.97, -0.9, 0.02));                 // and a plate at each end
    } },
    { id: "posts", order: 1, cell: 0.014, box: { x: [-0.55, 0.55], y: [-0.55, 0.55] }, planes: planes(-0.9, 0.9, 0.016), sdf: (x, y, z) => {
      let d = 1;
      for (const a of [2.53, -0.61]) d = Math.min(d, rcyl(len2(x - 0.42 * Math.cos(a), y - 0.42 * Math.sin(a)), z, 0.028, -0.91, 0.91, 0.01));
      return d;                                                                                                       // two posts between the plates, at the sides as you first see it
    } },
    { id: "sand", order: 2, dynamic: true, cell: 0.022, key: (p) => p.f.toFixed(2), box: { x: [-0.42, 0.42], y: [-0.42, 0.42] }, planes: planes(-0.88, 0.85, 0.03), sdf: (x, y, z, { f }) => {
      const r = len2(x, y), inside = r - glassRadius(z) + 0.015;
      const topLevel = 0.82 - 0.76 * f - 0.1 * Math.exp(-(r * r) / 0.01) * clamp(f * 20, 0, 1);                          // the top surface, dipping at the middle
      const top = Math.max(inside, z - topLevel, 0.04 - z);
      const mound = Math.max(inside, z - (-0.86 + 0.7 * f * Math.pow(Math.max(0, 1 - r / 0.34), 0.9) + 0.03 * f), -0.88 - z, z);   // the pile below
      const stream = f > 0.02 && f < 0.97 ? Math.max(r - 0.02, z - 0.06, -0.86 + 0.7 * f - z) : 1;                       // a thin stream between them
      return Math.min(top, mound, stream);
    } },
  ],
  /**
   * k, the intensity: how much sand runs.
   * 0: two fifths · 0.5: most of it · 1: nearly all
   */
  step(t, abs, k = 0.5) {
    const run = byIntensity(k, [0.4, 0.7, 0.95]), e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t));
    return { glass: {}, posts: {}, sand: { prm: { f: Math.round(run * e * 50) / 50 } } };
  },
};

/* ===== figures/jack-in-the-box.js ===== */
/*
 * A jack-in-the-box: a square box with a crank on its side and a hinged lid, and inside it a clown's head with a pointed
 * hat on a coil spring. Move across it and the crank turns, the lid flips back, and the head springs up past its height
 * and settles. At rest it is shut and the crank hangs. The box is cut once; the lid, the crank and the spring are cut
 * again as they change; the head is rigid and only rises.
 */
const BOX_TOP = 0.5, HINGE_Y = -0.35, CRANK_Z = 0.25;

const jackInTheBox = {
  T: 4, zr: [0, 1.2], S: 280, zm: 0.58,
  active: [0, 2.4],                                              // the crank turns, the lid opens, the head springs; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 150) / 300, 0, 1),                    // across the box
  hint: "move across the box to wind the crank",
  parts: [
    { id: "box", order: 0, box: { x: [-0.5, 0.5], y: [-0.5, 0.5] }, planes: planes(0, BOX_TOP, 0.025), sdf: (x, y, z) => {
      const shell = roundBox(x, y, z - BOX_TOP / 2, 0.31, 0.31, 0.21, 0.04), cavity = Math.max(Math.abs(x) - 0.3, Math.abs(y) - 0.3, 0.04 - z);   // a hollow cube, open on top
      return Math.max(Math.min(shell, roundBox(x, y, z - BOX_TOP + 0.03, 0.33, 0.33, 0.005, 0.02)), -cavity);                                   // with a rim round the open top
    } },
    { id: "head", order: 1, box: { x: [-0.25, 0.25], y: [-0.25, 0.25] }, planes: planes(0.06, 0.5, 0.02), sdf: (x, y, z) => {
      const r = len2(x, y), ball = Math.hypot(x, y, z - 0.2) - 0.12, hat = Math.max(r - 0.1 * (1 - (z - 0.28) / 0.2), 0.28 - z, z - 0.48);    // a ball of a head and a cone of a hat
      return Math.min(ball, hat, rcyl(r, z, 0.15, 0.28, 0.31, 0.012), Math.hypot(x, y, z - 0.49) - 0.025, Math.hypot(x, y - 0.1, z - 0.22) - 0.03);                                // a brim, a pompom and a nose
    } },
    { id: "spring", order: 2, dynamic: true, cell: 0.006, key: (p) => p.len.toFixed(2), box: { x: [-0.1, 0.1], y: [-0.1, 0.1] }, planes: planes(0.04, 1.1, 0.02), sdf: (x, y, z, { len }) => {
      if (z < 0.04 || z > 0.04 + len) return 1;
      const pitch = Math.max(0.02, len / 6), dz = (((z - 0.04 - (Math.atan2(y, x) * pitch) / (2 * Math.PI)) % pitch) + pitch * 1.5) % pitch - pitch / 2;   // six turns of wire, stretched with the head
      return Math.hypot(len2(x, y) - 0.06, dz) - 0.012;
    } },
    { id: "lid", order: 3, dynamic: true, key: (p) => p.a.toFixed(2), box: { x: [-0.5, 0.5], y: [-0.85, 0.45] }, planes: planes(BOX_TOP - 0.02, 1.25, 0.025), sdf: (x, y, z, { a }) => {
      const py = y - HINGE_Y, pz = z - BOX_TOP - 0.02, u = py * Math.cos(a) + pz * Math.sin(a), w = -py * Math.sin(a) + pz * Math.cos(a);   // the lid turned back about its hinge
      return roundBox(x, u - 0.35, w, 0.34, 0.33, 0.01, 0.02);
    } },
    { id: "crank", order: 4, dynamic: true, cell: 0.007, key: (p) => p.ph.toFixed(2), box: { x: [0.3, 0.62], y: [-0.2, 0.2] }, planes: planes(CRANK_Z - 0.17, CRANK_Z + 0.17, 0.02), sdf: (x, y, z, { ph }) => {
      const ty = 0.12 * Math.cos(ph), tz = CRANK_Z + 0.12 * Math.sin(ph), t = clamp((y * ty + (z - CRANK_Z) * (tz - CRANK_Z)) / 0.0144, 0, 1);
      const arm = Math.hypot(y - t * ty, z - CRANK_Z - t * (tz - CRANK_Z));                                                                 // the arm, from the shaft to its knob
      return Math.min(rcyl(len2(y, z - CRANK_Z), x, 0.025, 0.33, 0.47, 0.01), Math.max(arm - 0.016, Math.abs(x - 0.46) - 0.02), rcyl(len2(y - ty, z - tz), x, 0.035, 0.46, 0.54, 0.015));
    } },
  ],
  /**
   * k, the intensity: how far the head springs up, and how many times the crank turns.
   * 0: a short hop, one turn · 0.5: as drawn, two turns · 1: a tall spring, three turns
   */
  step(t, abs, k = 0.5) {
    const rise = byIntensity(k, [0.25, 0.45, 0.65]), turns = byIntensity(k, [1, 2, 3]), back = sm(2.9, 3.8, t), live = 1 - back;
    const u = clamp((t - 1.2) / 0.9, 0, 1), v = u - 1, e = 1 + 2.7 * v * v * v + 1.7 * v * v;                         // springs past its height and settles
    const lift = rise * e * live;
    return {
      box: {}, head: { off: [0, 0, lift] }, spring: { prm: { len: Math.round((0.04 + lift) * 50) / 50 } },
      lid: { prm: { a: Math.round((2 * sm(0.9, 1.4, t) * live) * 25) / 25 } },
      crank: { prm: { ph: Math.round((-Math.PI / 2 + turns * 2 * Math.PI * sm(0, 1.2, t) * live) / 0.05) * 0.05 } },
    };
  },
};

/* ===== figures/lightbulb.js ===== */
/*
 * A lightbulb: a glass bulb on a neck, a screw base with a real helical thread, and a filament on two posts.
 * Move up the bulb and it warms: rings of light spread out from the filament, one shell at a time, and the
 * lines flicker a little the way a filament does. At rest it is dark.
 *
 * The glass, the base and the filament are cut once; the halo is cut again as it grows. The filament and the halo are
 * overlays: the glass is drawn as stacked rings, which would hide them, so they are painted on top and show through.
 */

const CENTRE = 0.3;                                                    // the middle of the round part of the glass
/** the glass: a sphere melted into a neck. `wall` thins it, so the inside is the same shape smaller */
const glass = (x, y, z, wall) => {
  const rho = len2(x, y), t = clamp((z + 0.25) / 0.3, 0, 1);
  const bulb = Math.hypot(x, y, z - CENTRE) - (0.42 - wall);
  const neck = Math.max(rho - (0.17 + 0.15 * t * t - wall), -0.28 - z, z - 0.15);
  return smin(bulb, neck, 0.1);
};

const lightbulb = {
  T: 4, zr: [-0.72, 0.72], S: 190, zm: 0,
  active: [0, 2],                                                      // cold to fully lit
  drive: (x, y) => clamp((430 - y) / 260, 0, 1),                       // up the bulb
  hint: "move up the bulb to switch it on",
  parts: [
    { id: "glass", order: 0, box: { x: [-0.5, 0.5], y: [-0.5, 0.5] }, planes: planes(-0.28, 0.72, 0.025),
      sdf: (x, y, z) => subtract(glass(x, y, z, 0), glass(x, y, z, 0.03)) },
    { id: "base", order: 1, box: { x: [-0.26, 0.26], y: [-0.26, 0.26] }, planes: planes(-0.72, -0.2, 0.02), sdf: (x, y, z) => {
      const rho = len2(x, y), th = Math.atan2(y, x);
      const screw = Math.max(rho - (0.185 + 0.02 * Math.cos((2 * Math.PI * z) / 0.075 - th)), -0.62 - z, z + 0.2);   // one thread, wound round the cap
      return Math.min(screw, rcyl(rho, z, 0.075, -0.72, -0.6, 0.03));                                                // the contact at the foot
    } },
    { id: "filament", order: 2, overlay: true, cell: 0.005, box: { x: [-0.12, 0.12], y: [-0.06, 0.06] }, planes: planes(-0.15, 0.33, 0.015), sdf: (x, y, z) => {
      const post = (px) => rcyl(len2(x - px, y), z, 0.02, -0.15, 0.3, 0.01);
      const coil = rcyl(len2(y, z - 0.3), x, 0.02 + 0.008 * Math.cos(x * 220), -0.075, 0.075, 0.01);                  // the coiled wire between the posts
      return Math.min(post(-0.075), post(0.075), coil);
    } },
    { id: "halo", order: 3, overlay: true, dynamic: true, cell: 0.015, key: (p) => (p ? p.n.toFixed(2) : ""),
      box: { x: [-0.4, 0.4], y: [-0.4, 0.4] }, planes: planes(-0.1, 0.7, 0.04), sdf: (x, y, z, { n }) => {
        const d = Math.hypot(x, y, z - CENTRE), whole = Math.floor(n), part = n - whole;
        let best = 1;
        for (let i = 0; i <= whole && i < 7; i++) best = Math.min(best, Math.abs(d - (0.06 + 0.05 * i)) - 0.014 * (i < whole ? 1 : part));   // shells, the outermost still forming
        return best;
      } },
  ],
  /**
   * k, the intensity: how many shells of light spread out, and how hard the filament flickers.
   * 0: a dim glow of three shells · 0.5: six shells · 1: seven shells and a hard flicker
   */
  step(t, abs, k = 0.5) {
    const g = sm(0, 2, t), shells = g * byIntensity(k, [3, 6, 7]), flicker = byIntensity(k, [0.15, 0.35, 0.6]);
    return {
      glass: {}, base: {}, filament: {},
      halo: { prm: shells > 0.25 ? { n: Math.round(shells * 4) / 4 } : null },
      pulse: 1 + flicker * g * (0.5 + 0.5 * Math.sin(abs * 21)),
    };
  },
};

/* ===== figures/lighthouse.js ===== */
/*
 * A lighthouse on a rock: a tapering tower in banded stripes with a door and spiral windows, a gallery with a railing,
 * a glass lantern room with a lamp in it, and a conical roof. Move across it and the lamp lights: two flat fans of
 * light grow out of the lantern, opposite each other, and sweep round as the cursor moves. At rest the lamp is dark.
 *
 * The rock, tower, railing and lantern are cut once; the beams are cut again as they turn.
 */

const FACE = 0.96;                                                       // the direction the door and windows face: the default view
const LAMP = 0.61;                                                       // the height of the lamp, and of the beams
const towerR = (z) => 0.26 - (0.09 * (z + 0.5)) / 1 + 0.009 * (Math.sin((2 * Math.PI * z) / 0.4) > 0 ? 1 : 0);   // tapers, and swells in stripes
/** in the frame of a direction `a` on the ground: u along it, v across it */
const along = (x, y, a) => [x * Math.cos(a) + y * Math.sin(a), -x * Math.sin(a) + y * Math.cos(a)];

/** one fan of light along direction `a`: narrow at the lamp, widening to length L */
const wedge = (x, y, a, L) => { const [u, v] = along(x, y, a); return Math.max(0.15 - u, u - L, Math.abs(v) - (0.04 + 0.21 * u)); };

const lighthouse = {
  T: 5, zr: [-0.78, 0.92], S: 150, zm: 0.07,
  active: [0, 2.4],                                                      // dark, to the beams at full length, sweeping
  drive: (x) => clamp((x - 120) / 360, 0, 1),                            // across the lighthouse
  hint: "move across the lighthouse to sweep its beam",
  parts: [
    { id: "rock", order: 0, box: { x: [-0.7, 0.7], y: [-0.7, 0.7] }, planes: planes(-0.78, -0.5, 0.025), sdf: (x, y, z) => {
      const th = Math.atan2(y, x), shrink = 1 - 0.35 * clamp((z + 0.78) / 0.28, 0, 1);       // a mound with ragged edges that narrows as it rises
      return Math.max(len2(x, y) - (0.5 + 0.05 * Math.cos(5 * th) + 0.035 * Math.cos(9 * th + 1)) * shrink, -0.78 - z, z + 0.5);
    } },
    { id: "tower", order: 1, box: { x: [-0.4, 0.4], y: [-0.4, 0.4] }, planes: planes(-0.5, 0.5, 0.03), sdf: (x, y, z) => {
      let d = Math.max(len2(x, y) - towerR(z), -0.5 - z, z - 0.5);
      const [uf, vf] = along(x, y, FACE);
      d = subtract(d, roundBox(uf - towerR(-0.38), vf, z + 0.38, 0.05, 0.045, 0.07, 0.01));                                 // the door
      for (let k = 0; k < 3; k++) {                                                                                         // windows, climbing round the tower
        const zk = -0.18 + 0.28 * k, [u, v] = along(x, y, FACE + 0.8 + k * 1.4);
        d = subtract(d, rcyl(len2(v, z - zk), u, 0.03, towerR(zk) - 0.035, towerR(zk) + 0.05, 0.004));
      }
      return d;
    } },
    { id: "gallery", order: 2, cell: 0.005, box: { x: [-0.32, 0.32], y: [-0.32, 0.32] }, planes: planes(0.46, 0.6, 0.012), sdf: (x, y, z) => {
      const r = len2(x, y), th = Math.atan2(y, x);
      const floor = rcyl(r, z, 0.29, 0.46, 0.51, 0.01);
      const post = Math.max(len2(x - 0.26 * Math.cos(Math.round((th * 14) / (2 * Math.PI)) * ((2 * Math.PI) / 14)), y - 0.26 * Math.sin(Math.round((th * 14) / (2 * Math.PI)) * ((2 * Math.PI) / 14))) - 0.011, 0.51 - z, z - 0.58);   // fourteen railing posts
      const rail = Math.max(Math.abs(r - 0.26) - 0.012, Math.abs(z - 0.585) - 0.012);
      return Math.min(floor, post, rail);
    } },
    { id: "lantern", order: 3, cell: 0.006, box: { x: [-0.2, 0.2], y: [-0.2, 0.2] }, planes: planes(0.51, 0.9, 0.02), sdf: (x, y, z) => {
      const r = len2(x, y), roofR = 0.17 * (1 - clamp((z - 0.72) / 0.16, 0, 1));
      const room = subtract(rcyl(r, z, 0.13, 0.51, 0.72, 0.01), rcyl(r, z, 0.115, 0.52, 0.71, 0.005));                      // a glass shell
      const roof = z > 0.72 ? Math.max(r - roofR, 0.72 - z, z - 0.88) : 1;
      return Math.min(room, roof, Math.hypot(x, y, z - 0.9) - 0.025);                                                       // and a finial on the roof
    } },
    { id: "lamp", order: 4, overlay: true, cell: 0.006, box: { x: [-0.08, 0.08], y: [-0.08, 0.08] }, planes: planes(0.55, 0.67, 0.012),
      sdf: (x, y, z) => Math.hypot(x, y, z - LAMP) - 0.05 },
    { id: "beams", order: 5, dynamic: true, cell: 0.016, key: (p) => (p ? p.a.toFixed(2) + ":" + p.L.toFixed(2) : ""),
      box: { x: [-1.25, 1.25], y: [-1.25, 1.25] }, planes: planes(LAMP - 0.08, LAMP + 0.08, 0.02), sdf: (x, y, z, { a, L }) =>
        Math.max(Math.min(wedge(x, y, a, L), wedge(x, y, a + Math.PI, L)), Math.abs(z - LAMP) - 0.09) },
  ],
  /**
   * k, the intensity: how far the beams sweep round.
   * 0: a quarter turn · 0.5: two thirds of a turn · 1: well over a full turn
   */
  step(t, abs, k = 0.5) {
    const sweep = byIntensity(k, [1.5, 4.2, 8.4]), L = 1.08 * sm(0, 0.5, t);
    const a = -0.6 + sweep * sm(0.3, 2.4, t);
    return {
      rock: {}, tower: {}, gallery: {}, lantern: {}, lamp: {},
      beams: { prm: L > 0.3 ? { a: Math.round(a / 0.03) * 0.03, L: Math.round(L / 0.04) * 0.04 } : null },
    };
  },
};

/* ===== figures/percolator.js ===== */
/*
 * A stovetop percolator: a pot that bellies and narrows, with a ribbed band, a loop handle on one side and a spout on
 * the other, a domed lid, and a glass knob on top. Move up it and it starts to perk: bubbles rise one after another
 * through the glass knob and gather at its crown. At rest the knob is clear. The pot and glass are cut once; the
 * bubbles are overlays (the glass is drawn as rings, which would hide them) and are cut again as they rise.
 */
const KNOB_Z = 0.94;                                                     // the middle of the glass knob

/** the pot's radius at height z */
const potRadius = (z) => (z < 0.2 ? 0.3 + 0.02 * (z / 0.2) : z < 0.55 ? 0.32 - 0.06 * ((z - 0.2) / 0.35) : 0.26 - 0.07 * clamp((z - 0.55) / 0.2, 0, 1));

const percolator = {
  T: 4, zr: [0, 1.05], S: 380, zm: 0.5,
  active: [0, 2.2],                                              // the bubbles start and rise; the pose at 0 is the rest pose
  drive: (x, y) => clamp((480 - y) / 300, 0, 1),                 // up the percolator
  hint: "move up the percolator to start it perking",
  parts: [
    { id: "pot", order: 0, cell: 0.01, box: { x: [-0.7, 0.65], y: [-0.4, 0.4] }, planes: planes(0, 0.9, 0.012), sdf: (x, y, z) => {
      const r = len2(x, y);
      let d = Math.max(r - potRadius(z), -z, z - 0.86);                                                              // the body
      d = Math.min(d, rcyl(r, z, 0.23, 0.74, 0.86, 0.03), Math.max(Math.abs(r - (potRadius(z) + 0.01)) - 0.012, Math.abs(z - 0.5) - 0.025));   // a domed lid, a band round the waist
      d = Math.min(d, Math.hypot(len2(x + 0.42, z - 0.42) - 0.2, y) - 0.032);                                       // a loop handle
      const sx = x - 0.3, sz = z - 0.66, t = clamp((sx * 0.14 + sz * 0.16) / 0.0452, 0, 1);                         // and a spout, sloping up and out
      return Math.min(d, Math.hypot(sx - t * 0.14, y, sz - t * 0.16) - 0.045);
    } },
    { id: "glass", order: 1, cell: 0.006, box: { x: [-0.16, 0.16], y: [-0.16, 0.16] }, planes: planes(0.84, 1.06, 0.014), sdf: (x, y, z) =>
      Math.max(Math.hypot(x, y, z - KNOB_Z) - 0.1, -(Math.hypot(x, y, z - KNOB_Z) - 0.088), 0.86 - z) },       // a hollow glass dome
    { id: "bubbles", order: 2, overlay: true, dynamic: true, cell: 0.005, key: (p) => p ? p.n.toFixed(1) : "", box: { x: [-0.1, 0.1], y: [-0.1, 0.1] }, planes: planes(0.86, 1.02, 0.012), sdf: (x, y, z, { n }) => {
      let d = 1;
      for (let i = 0; i < 12; i++) {
        const p = clamp(n - i, 0, 1) * 0.5 + clamp(n - i - 1, 0, 1) * 0.5;                                          // how far bubble i has risen, once it has been let go
        if (n <= i) continue;
        d = Math.min(d, Math.hypot(x - 0.045 * Math.sin(i * 2.4), y - 0.045 * Math.cos(i * 1.7), z - (0.89 + 0.1 * p + 0.01 * (i % 3))) - (0.014 + 0.004 * (i % 3)));
      }
      return d;
    } },
  ],
  /**
   * k, the intensity: how many bubbles it perks.
   * 0: four · 0.5: eight · 1: twelve
   */
  step(t, abs, k = 0.5) {
    const count = byIntensity(k, [4, 8, 12]), n = sm(0, 2.2, t) * (1 - sm(2.9, 3.8, t)) * (count + 1);
    return { pot: {}, glass: {}, bubbles: { prm: n > 0.5 ? { n: Math.round(n * 2) / 2 } : null } };
  },
};

/* ===== figures/periscope-submarine.js ===== */
/*
 * A small submarine riding on the water, ringed by ripples, with a conning tower, a tail fin and a periscope folded
 * down into the tower. Move up it and the periscope rises out of the tower on its tube, its lens head turned toward
 * you, and slides back down as you leave. At rest the periscope is hidden. The hull, tower and ripples are cut once;
 * the periscope is rigid and only rises.
 */
const SUB_WATER = -0.1;                                                  // the waterline

/** an ellipse of half-sizes (a, b, c) about (0, 0, cz), as a rough distance */
const subEllipsoid = (x, y, z, a, b, c, cz) => {
  const px = x / a, py = y / b, pz = (z - cz) / c, k0 = Math.hypot(px, py, pz), k1 = Math.hypot(px / a, py / b, pz / c);
  return (k0 * (k0 - 1)) / (k1 || 1);
};

const periscopeSubmarine = {
  T: 4, zr: [-0.12, 0.85], S: 250, zm: 0.34,
  active: [0, 2],                                                // the periscope rises out of the tower; the pose at 0 is the rest pose
  drive: (x, y) => clamp((430 - y) / 260, 0, 1),                 // up the submarine
  hint: "move up the submarine to raise the periscope",
  parts: [
    { id: "ripples", order: 0, cell: 0.008, box: { x: [-1.2, 1.2], y: [-0.65, 0.65] }, planes: planes(SUB_WATER - 0.008, SUB_WATER + 0.008, 0.016), sdf: (x, y) => {
      const sd = Math.hypot(Math.max(Math.abs(x) - 0.65, 0), y) - 0.2;                                                    // distance out from the hull's waterline
      return Math.min(...[0.06, 0.16, 0.28].map((r) => Math.abs(sd - r) - 0.006));                                  // three rings spreading out from it
    } },
    { id: "hull", order: 1, box: { x: [-1.0, 1.0], y: [-0.4, 0.4] }, planes: planes(SUB_WATER, 0.24), sdf: (x, y, z) => {
      let d = Math.max(subEllipsoid(x, y, z, 0.85, 0.2, 0.22, -0.02), SUB_WATER - z);                                // a hull, cut at the waterline
      d = smin(d, roundBox(x + 0.8, y, z - 0.05, 0.05, 0.015, 0.12, 0.015), 0.04);                                    // a tail fin
      return Math.min(d, rcyl(len2(y, z - 0.05), x, 0.05, -0.97, -0.84, 0.015));                                    // and a propeller hub
    } },
    { id: "tower", order: 2, box: { x: [-0.4, 0.2], y: [-0.2, 0.2] }, planes: planes(0.1, 0.4), sdf: (x, y, z) => {
      const body = roundBox(x + 0.1, y, z - 0.22, 0.12, 0.04, 0.12, 0.05), hatch = rcyl(len2(x + 0.1, y), z, 0.05, 0.3, 0.38, 0.01);
      return Math.min(body, hatch);                                                                                 // a streamlined tower with a hatch ring on top
    } },
    { id: "scope", order: 3, cell: 0.007, box: { x: [-0.3, 0.1], y: [-0.1, 0.1] }, planes: planes(-0.08, 0.4, 0.01), sdf: (x, y, z) => {
      const tube = rcyl(len2(x + 0.1, y), z, 0.027, -0.08, 0.34, 0.01);                                              // the periscope tube, its foot just inside the hull, so it stays in the tower to full height
      const head = Math.min(roundBox(x + 0.1, y, z - 0.36, 0.03, 0.015, 0.02, 0.015), rcyl(len2(y, z - 0.36), x + 0.1, 0.03, -0.04, 0.05, 0.01));
      return Math.min(tube, head);                                                                                  // and a head with its lens toward you
    } },
  ],
  /**
   * k, the intensity: how far the periscope rises.
   * 0: a short way · 0.5: clear of the tower · 1: right up, its foot just inside
   */
  step(t, abs, k = 0.5) {
    const rise = byIntensity(k, [0.2, 0.35, 0.46]), e = sm(0, 1.6, t) * (1 - sm(2.8, 3.8, t));
    return { ripples: {}, hull: {}, tower: {}, scope: { off: [0, 0, rise * e] } };
  },
};

/* ===== figures/pocket-watch.js ===== */
/*
 * A pocket watch lying face up, twelve o'clock away from you: a thick case with a raised bezel, twelve hour studs on
 * the dial, a crown and a bow behind it, and two hands showing ten past ten. Move across it and the hands run, the
 * minute hand round many times for each turn of the hour hand. At rest it is stopped. The case and bow are cut once;
 * the hands are cut again as they turn.
 */
const WATCH_TOP = 0.2, STUD = 0.16;                                      // the top of the case, and the dial it rings
const bearing = (a) => [Math.sin(a), -Math.cos(a)];                      // a clockwise angle from twelve, as a direction on the ground

/** a tapered hand from the middle out to `len` along angle a, `w` wide at the root */
const hand = (x, y, a, len, w) => {
  const [dx, dy] = bearing(a), t = clamp((x * dx + y * dy) / len, 0, 1);
  return segDist(x, y, 0, 0, dx * len, dy * len) - w * (1 - 0.6 * t);
};

const pocketWatch = {
  T: 4, zr: [0, 0.3], S: 300, zm: 0.12,
  active: [0, 2.4],                                              // the hands run from ten past ten; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 150) / 300, 0, 1),                    // across the watch
  hint: "move across the watch to run the hands",
  parts: [
    { id: "case", order: 0, box: { x: [-0.65, 0.65], y: [-0.65, 0.65] }, planes: planes(0, WATCH_TOP + 0.02, 0.02), sdf: (x, y, z) => {
      const r = len2(x, y);
      let d = subtract(rcyl(r, z, 0.5, 0, WATCH_TOP, 0.05), rcyl(r, z, 0.42, STUD, 0.5, 0));                       // a thick case, its face sunk inside the bezel
      for (let k = 0; k < 12; k++) {                                                                                // twelve hour studs, the quarters larger
        const [dx, dy] = bearing((k * Math.PI) / 6);
        d = Math.min(d, rcyl(len2(x - 0.34 * dx, y - 0.34 * dy), z, k % 3 ? 0.022 : 0.034, STUD, STUD + 0.045, 0.01));
      }
      return d;
    } },
    { id: "bow", order: 1, cell: 0.007, box: { x: [-0.12, 0.12], y: [-0.82, -0.44] }, planes: planes(-0.06, 0.26, 0.01), sdf: (x, y, z) =>
      Math.min(len2(len2(y + 0.67, z - 0.1) - 0.11, x) - 0.022, rcyl(len2(x, z - 0.1), y, 0.06, -0.58, -0.47, 0.015)) },       // the bow ring, and the crown it sits on
    { id: "hands", order: 2, dynamic: true, cell: 0.008, key: (p) => p.a.toFixed(2), box: { x: [-0.4, 0.4], y: [-0.4, 0.4] }, planes: planes(0.215, 0.275, 0.015), sdf: (x, y, z, { a }) => {
      const minute = Math.max(hand(x, y, a + 1.05, 0.37, 0.018), Math.abs(z - 0.26) - 0.014);                      // the minute hand lies over the hour hand
      const hour = Math.max(Math.min(hand(x, y, a / 12 + 5.32, 0.25, 0.03), len2(x, y) - 0.045), Math.abs(z - 0.23) - 0.014);
      return Math.min(minute, hour);
    } },
  ],
  /**
   * k, the intensity: how many times the minute hand goes round.
   * 0: once · 0.5: three times · 1: six times
   */
  step(t, abs, k = 0.5) {
    const turns = byIntensity(k, [1, 3, 6]), back = sm(3, 4, t);
    return { case: {}, bow: {}, hands: { prm: { a: Math.round((turns * 2 * Math.PI * sm(0, 2.4, t) * (1 - back)) / 0.04) * 0.04 } } };
  },
};

/* ===== figures/printer.js ===== */
/*
 * A desktop printer: a boxy body with a paper tray leaning up behind it, an output tray in front, a slot across the top
 * where the print head runs on a rail, and three buttons. Move across it and it prints: the head shuttles back and
 * forth along the slot while a sheet feeds out of the mouth onto the output tray. At rest the head is parked at the
 * left and the tray is empty. The body is cut once; the head and the sheet are rigid and only move.
 */
const PRINT_SHEET_Z = 0.06;                                              // the height the sheet travels at

const printer = {
  T: 4, zr: [0, 0.52], S: 380, zm: 0.16,
  active: [0, 2.4],                                              // the head shuttles and the sheet feeds out; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 130) / 340, 0, 1),                    // across the printer
  hint: "move across the printer to print a page",
  parts: [
    { id: "body", order: 0, cell: 0.009, box: { x: [-0.62, 0.62], y: [-0.62, 0.7] }, planes: planes(0, 0.52, 0.015), sdf: (x, y, z) => {
      let d = roundBox(x, y, z - 0.12, 0.46, 0.28, 0.09, 0.03);                                                    // the body
      d = subtract(d, Math.max(Math.abs(x) - 0.4, Math.abs(y) - 0.06, 0.13 - z));                                  // the slot the head runs in, open on top
      d = subtract(d, Math.max(Math.abs(x) - 0.34, Math.abs(z - PRINT_SHEET_Z) - 0.022, 0.12 - y));                // the mouth the sheet comes out of
      d = Math.min(d, rcyl(len2(y + 0.03, z - 0.16), x, 0.012, -0.4, 0.4, 0.004));                                 // the rail in the slot
      d = Math.min(d, roundBox(x, y - 0.43, z - 0.012, 0.32, 0.13, 0.006, 0.006));                                 // the output tray
      const w = (y + 0.28) * 0.82 + (z - 0.22) * 0.57, s = -(y + 0.28) * 0.57 + (z - 0.22) * 0.82;                // the paper tray, leaning up behind
      d = Math.min(d, Math.max(Math.abs(w) - 0.025, Math.abs(x) - 0.33, -s, s - 0.32));
      for (const bx of [0.24, 0.31, 0.38]) d = Math.min(d, rcyl(len2(x - bx, y - 0.19), z, 0.022, 0.2, 0.25, 0.008));   // three buttons
      return d;
    } },
    { id: "head", order: 1, cell: 0.007, box: { x: [-0.45, -0.15], y: [-0.12, 0.12] }, planes: planes(0.13, 0.26, 0.01), sdf: (x, y, z) =>
      Math.min(roundBox(x + 0.3, y, z - 0.18, 0.04, 0.03, 0.035, 0.012), rcyl(len2(x + 0.3, y), z, 0.02, 0.21, 0.245, 0.006)) },   // a cartridge on the rail, its cap
    { id: "sheet", order: 2, box: { x: [-0.4, 0.4], y: [-0.32, 0.22] }, planes: planes(PRINT_SHEET_Z - 0.01, PRINT_SHEET_Z + 0.01, 0.01), sdf: (x, y, z) =>
      Math.max(roundBox(x, y + 0.05, 0, 0.29, 0.19, 0, 0.01), Math.abs(z - PRINT_SHEET_Z) - 0.006) },                // a flat sheet, inside the body at rest
  ],
  /**
   * k, the intensity: how much of the page comes out, and how many passes the head makes.
   * 0: a third of the page, two passes · 0.5: most of it, four · 1: all of it, six
   */
  step(t, abs, k = 0.5) {
    const feed = byIntensity(k, [0.18, 0.32, 0.42]), passes = Math.round(byIntensity(k, [2, 4, 6])), e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t));
    return { body: {}, head: { off: [0.3 - 0.3 * Math.cos(2 * Math.PI * passes * e), 0, 0] }, sheet: { off: [0, feed * e, 0] } };
  },
};

/* ===== figures/record.js ===== */
/*
 * A record player: a plinth, a platter with a ring of strobe teeth, a record with its label and a mark on the
 * label, and a tonearm on a pivot. Move across it and the tonearm swings in over the record and drops, then the
 * platter spins up: the teeth and the mark turn so you can see it. At rest the arm is parked and the platter still.
 *
 * The plinth and the pivot are cut once; the platter is cut again as it turns, the arm as it swings.
 */

const PIVOT = [0.42, -0.36], ARM = 0.62, PARKED = Math.PI / 2, PLAYING = Math.PI - 0.35;   // the arm's angle, in plan, parked and over the record
const FINE = 0.015;

const recordPlayer = {
  T: 5, zr: [-0.05, 0.34], S: 290, zm: 0.14,
  active: [0, 3.2],
  drive: (x) => clamp((x - 130) / 340, 0, 1),                          // across the turntable
  hint: "move across the turntable to drop the needle",
  parts: [
    { id: "plinth", order: 0, box: { x: [-0.75, 0.75], y: [-0.65, 0.65] }, planes: planes(-0.05, 0.13, FINE),
      sdf: (x, y, z) => roundBox(x, y, z - 0.04, 0.58, 0.46, 0.04, 0.05) },
    { id: "pivot", order: 1, box: { x: [0.3, 0.56], y: [-0.5, -0.22] }, planes: planes(0.12, 0.3, FINE), sdf: (x, y, z) => {
      const r = len2(x - PIVOT[0], y - PIVOT[1]);
      return Math.min(rcyl(r, z, 0.075, 0.12, 0.16, 0.01), rcyl(r, z, 0.045, 0.12, 0.3, 0.012));
    } },
    { id: "platter", order: 2, dynamic: true, cell: 0.012, key: (p) => p.ph.toFixed(2), box: { x: [-0.44, 0.44], y: [-0.44, 0.44] }, planes: planes(0.1, 0.24, 0.015),
      sdf: (x, y, z, { ph }) => {
        const r = len2(x, y), th = Math.atan2(y, x) - ph;
        const platter = Math.max(r - (0.38 + 0.016 * Math.cos(12 * th)), Math.abs(z - 0.13) - 0.03);        // twelve strobe teeth round the rim
        const record = Math.max(r - 0.33, Math.abs(z - 0.1675) - 0.0075);
        const label = Math.max(r - 0.1, Math.abs(z - 0.1875) - 0.0125);
        const mark = rcyl(len2(x - 0.065 * Math.cos(ph), y - 0.065 * Math.sin(ph)), z, 0.02, 0.19, 0.215, 0.005);   // a bump on the label that shows the turn
        const spindle = rcyl(r, z, 0.016, 0.2, 0.24, 0.005);
        return Math.min(platter, record, label, mark, spindle);
      } },
    { id: "arm", order: 3, dynamic: true, cell: 0.01, key: (p) => p.a.toFixed(3), box: { x: [-0.3, 0.7], y: [-0.65, 0.4] }, planes: planes(0.26, 0.36, 0.025),
      sdf: (x, y, z, { a }) => {
        const bx = PIVOT[0] + ARM * Math.cos(a), by = PIVOT[1] + ARM * Math.sin(a);
        const tube = Math.hypot(segDist(x, y, PIVOT[0], PIVOT[1], bx, by), z - 0.31) - 0.022;
        const head = rcyl(len2(x - bx, y - by), z, 0.045, 0.27, 0.32, 0.01);                                  // the headshell, over the groove
        const weight = rcyl(len2(x - (PIVOT[0] - 0.12 * Math.cos(a)), y - (PIVOT[1] - 0.12 * Math.sin(a))), z, 0.045, 0.28, 0.34, 0.015);   // the counterweight behind the pivot
        return Math.min(tube, head, weight);
      } },
  ],
  /**
   * k, the intensity: how fast the platter spins up, in turns.
   * 0: one turn · 0.5: three · 1: six (the arm swings the same in all three)
   */
  step(t, abs, k = 0.5) {
    const swing = sm(0, 1.6, t), turns = byIntensity(k, [1, 3, 6]);
    const ph = Math.round((turns * 2 * Math.PI * sm(1.0, 3.2, t)) / 0.02) * 0.02, a = PARKED + (PLAYING - PARKED) * swing;
    return { plinth: {}, pivot: {}, platter: { prm: { ph } }, arm: { prm: { a: Math.round(a / 0.01) * 0.01 } } };
  },
};

/* ===== figures/ring-tower.js ===== */
/*
 * A tower of nine square frames, each a little smaller than the one below, stacked with a gap between them. Move up
 * it and the frames twist, each turned further than the one below, until the tower spirals. At rest the frames are
 * lined up as a stepped pyramid. All nine are one dynamic part, cut again as they turn.
 */
const FRAMES = 9, FRAME_STEP = 0.07;                                     // how many frames, and the height of each step up

const ringTower = {
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

/* ===== figures/ripple-tank.js ===== */
/*
 * Still water with a drop of water hanging over it, with no tank around it: the water runs out past every edge of the page.
 * Move up and the drop falls and lands, and ripples spread out from where it hit in rings, each a contour of the water's
 * height, fainter as they go. At rest the surface is flat and the drop waits. The drop is cut once and only falls; the
 * water is cut again as it ripples.
 */
const tankLevel = 0.03;

const rippleTank = {
  T: 4, zr: [-0.17, 0.72], S: 300, zm: 0.25,
  active: [0, 2.2],                                              // the drop falls and the ripples spread; the pose at 0 is the rest pose
  drive: (x, y) => clamp((480 - y) / 300, 0, 1),                 // up the water
  hint: "move up to drop the drop",
  parts: [
    { id: "water", order: 1, dynamic: true, cell: 0.024, key: (p) => p.tm.toFixed(2) + ":" + p.a.toFixed(2) + ":" + (p.q ?? 0).toFixed(2), box: { x: [-2.3, 2.3], y: [-2.3, 2.3] }, planes: planes(-0.09, 0.15, 0.01), sdf: (x, y, z, { tm, a, q }) => {
      const r = len2(x, y), front = 1.6 * tm, still = q === undefined ? 1 : clamp((r - q) / 0.3, 0, 1);     // q, when given, is a radius inside which the water has gone still
      const ripple = a * still * clamp((front - r) / 0.12, 0, 1) * Math.exp(-0.6 * r) * Math.cos((2 * Math.PI * (r - front)) / 0.17);
      return Math.max(z - (tankLevel + ripple), Math.max(Math.abs(x), Math.abs(y)) - 2.3, -0.1 - z);                       // water to a level that ripples, out past the page's edges
    } },
    { id: "drop", order: 2, cell: 0.007, box: { x: [-0.1, 0.1], y: [-0.1, 0.1] }, planes: planes(0.5, 0.74, 0.012), sdf: (x, y, z) =>
      smin(Math.hypot(x, y, z - 0.58) - 0.055, Math.max(len2(x, y) - 0.05 * clamp((0.72 - z) / 0.12, 0, 1), z - 0.72, 0.6 - z), 0.04) },   // a teardrop
  ],
  /**
   * k, the intensity: how big the ripples are.
   * 0: gentle rings · 0.5: clear rings · 1: deep ones
   */
  step(t, abs, k = 0.5) {
    const amp = byIntensity(k, [0.025, 0.045, 0.065]), fall = sm(0, 0.9, t), back = sm(2.9, 3.8, t), landed = t > 0.9 && t < 2.9;
    return {
      drop: { off: [0, 0, t > 2.9 ? 0 : -0.46 * fall * fall], hide: landed },
      water: { prm: { tm: Math.round(Math.max(0, t - 0.9) * 25) / 25, a: Math.round(amp * (1 - back) * 200) / 200 } },
    };
  },
};

/* ===== figures/rocket.js ===== */
/*
 * The rocket sits, ignites and shakes, rises a short way on a flame that swells, hovers on it, then settles
 * as the flame withdraws. The body is cut once; the flame is cut again as it changes, a few times a second.
 */
const rocket = {
  T: 9, zr: [-0.86, 0.98], S: 150, zm: 0.1,
  /** the stretch of the loop the cursor scrubs: from the pad to the full hover. The pose at its start is the rest pose. */
  active: [1.2, 5.8],
  /** the cursor's page position -> how far through that stretch, 0 to 1: up the rocket is a launch */
  drive: (x, y) => clamp((450 - y) / 320, 0, 1),
  hint: "move up the rocket to launch it",
  parts: [
    { id: "body", order: 0, box: { x: [-0.7, 0.7], y: [-0.7, 0.7] }, planes: planes(-0.86, 0.98), sdf: (x, y, z) => {
      const rho = len2(x, y), t = (z - 0.3) / 0.67;
      const r = z > 0.3 ? 0.28 * Math.pow(Math.max(0, 1 - t), 0.65) : z > -0.6 ? 0.28 : 0.17 + (-0.6 - z) * 0.4;   // ogive nose, body, flared skirt
      let d = subtract(Math.max(rho - r, z - 0.97, -0.85 - z), Math.max(rho - 0.12, z + 0.72));                    // hollow nozzle
      const f = 0.96, u0 = x * Math.cos(f) + y * Math.sin(f), v0 = -x * Math.sin(f) + y * Math.cos(f);              // portholes face the default view
      d = subtract(subtract(d, rcyl(len2(v0, z - 0.1), u0, 0.12, 0.2, 0.5, 0)), rcyl(len2(v0, z + 0.2), u0, 0.07, 0.2, 0.5, 0));
      for (let k = 0; k < 3; k++) {                                                                                  // three swept fins
        const a = f + Math.PI / 3 + (k * 2 * Math.PI) / 3, u = x * Math.cos(a) + y * Math.sin(a), v = -x * Math.sin(a) + y * Math.cos(a);
        d = smin(d, Math.max(Math.abs(v) - 0.03, 0.15 - u, -0.7 - z, z + 0.1, (u - (0.62 - 0.55 * (z + 0.7))) * 0.8), 0.04);
      }
      return d;
    } },
    { id: "flame", order: 1, dynamic: true, key: (p) => (p ? p.L.toFixed(2) + ":" + p.tm.toFixed(2) : ""),
      box: { x: [-0.26, 0.26], y: [-0.26, 0.26] }, planes: planes(-2.6, -0.86), sdf: (x, y, z, { L, tm }) => {
        const s = (-0.85 - z) / L;                                          // 0 at the nozzle, 1 at the tip of the flame
        if (s < 0 || s > 1) return 1;
        const rho = len2(x, y);
        const rad = 0.11 * (0.8 + 0.4 * L) * Math.pow(1 - s, 0.9) * (1 + s * (0.18 * Math.sin(s * 16 - tm * 28) + 0.25 * Math.sin(Math.atan2(y, x) * 3 + tm * 11)));
        return rho - rad;
      } },
  ],
  /**
   * k, the intensity: how far it rises, and how big the flame swells.
   * 0: a low hop on a modest flame · 0.5: as first drawn · 1: a high hover on a flame twice the length
   */
  step(t, abs, k = 0.5) {
    const rise = byIntensity(k, [0.1, 0.3, 0.55]), fl = byIntensity(k, [0.7, 1.24, 1.6]) / 1.24;      // fl scales every flame length
    let z = 0, L = 0, amp = 0;
    if (t < 1.2) { /* waiting on the pad */ }
    else if (t < 2.6) { const u = (t - 1.2) / 1.4; L = 0.62 * u * fl; amp = 0.005 * u; }                                                          // ignition: the flame catches and grows
    else if (t < 5.2) { const u = (t - 2.6) / 2.6, e = u * u * (3 - 2 * u); z = rise * e; L = (0.62 + 0.62 * e) * fl; amp = 0.006 * (1 - e) + 0.0015; }   // a short, heavy lift while the flame swells
    else if (t < 6.4) { z = rise; L = (1.24 + 0.05 * Math.sin((t - 5.2) * 9)) * fl; amp = 0.0015; }                                                        // hovering on a full, throbbing flame
    else if (t < 8.2) { const u = (t - 6.4) / 1.8, e = u * u * (3 - 2 * u); z = rise * (1 - e); L = 1.24 * fl * (1 - e); amp = 0.0015 * (1 - e); }         // it settles and the flame withdraws
    const off = [amp * Math.sin(abs * 70), amp * 0.7 * Math.cos(abs * 53), z];
    return { body: { off }, flame: { off, prm: L > 0.03 ? { L: Math.round(L * 50) / 50, tm: Math.floor(abs * 24) / 24 } : null } };
  },
};

/* ===== figures/seedling.js ===== */
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

const seedling = {
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

/* ===== figures/spiral-stair.js ===== */
/*
 * A spiral stair round a central column: twelve wedge-shaped treads, each a little higher than the last. Move up it and
 * the treads unwind: folded, they sit nearly stacked in a tight stack; opened, each is turned a step further than the
 * one below and the stair spirals up more than a full turn. At rest it is folded. The column and base are cut once;
 * the treads are cut again as they turn.
 */
const STAIRS = 12, RISE = 0.075;                                         // the number of treads and the height of each

const spiralStair = {
  T: 4, zr: [-0.06, 1.0], S: 280, zm: 0.45,
  active: [0, 2.4],                                              // the treads unwind; the pose at 0 is the rest pose
  drive: (x, y) => clamp((480 - y) / 300, 0, 1),                 // up the stair
  hint: "move up the stair to unwind it",
  parts: [
    { id: "column", order: 0, cell: 0.012, box: { x: [-0.7, 0.7], y: [-0.7, 0.7] }, planes: planes(-0.06, 1.0, 0.02), sdf: (x, y, z) => {
      const r = len2(x, y);
      return Math.min(rcyl(r, z, 0.6, -0.06, 0.0, 0.015), rcyl(r, z, 0.08, 0, 0.98, 0.02), Math.hypot(x, y, z - 0.98) - 0.1);   // a round base, the column, a knob on top
    } },
    { id: "treads", order: 1, dynamic: true, cell: 0.018, key: (p) => p.turn.toFixed(2), box: { x: [-0.56, 0.56], y: [-0.56, 0.56] }, planes: planes(0.0, 1.0, 0.015), sdf: (x, y, z, { turn }) => {
      const i = clamp(Math.round((z - 0.04) / RISE), 0, STAIRS - 1), r = len2(x, y);
      const a = ((Math.atan2(y, x) - i * turn + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;                       // angle from tread i's middle
      return Math.max(r - 0.5, 0.07 - r, Math.abs(a) - 0.3, Math.abs(z - 0.04 - i * RISE) - 0.022);            // a wedge of a tread
    } },
  ],
  /**
   * k, the intensity: how far each tread turns from the last when it is opened.
   * 0: a gentle spiral (0.4 rad) · 0.5: 0.55 rad · 1: 0.7 rad, well over a full turn
   */
  step(t, abs, k = 0.5) {
    const open = byIntensity(k, [0.4, 0.55, 0.7]), e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t));
    return { column: {}, treads: { prm: { turn: Math.round((0.1 + (open - 0.1) * e) * 50) / 50 } } };
  },
};

/* ===== figures/telescope.js ===== */
/*
 * A brass telescope on a tripod, lying level along x with its eyepiece at the left: a main tube, two draw tubes nested
 * in it, a focusing knob, and a hooded lens at the far end. Move across it and the draw tubes slide out in two stages
 * while the focusing knob turns. At rest it is collapsed. The tripod and tubes are cut once and the tubes only move;
 * the knob is cut again as its teeth turn.
 */
const FOCUS_X = -0.4;                                                    // where the focusing knob sits along the tube

/** a leg: the distance to a rod from (ax, ay, az) to (bx, by, bz), thinner than a tube */
const scopeRod = (x, y, z, [ax, ay, az], [bx, by, bz], r) => {
  const dx = bx - ax, dy = by - ay, dz = bz - az, t = clamp(((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / (dx * dx + dy * dy + dz * dz), 0, 1);
  return Math.hypot(x - ax - t * dx, y - ay - t * dy, z - az - t * dz) - r;
};
const scopeTube = (r, x0, x1) => (x, y, z) => rcyl(len2(y, z), x, r, x0, x1, 0.015);

const telescope = {
  T: 4, zr: [-0.65, 0.14], S: 360, zm: -0.25,
  active: [0, 2],                                                // the draw tubes slide out and the knob turns; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 120) / 360, 0, 1),                    // across the telescope
  hint: "move across the telescope to draw it out and focus",
  parts: [
    { id: "stand", order: 0, cell: 0.009, box: { x: [-0.65, 0.35], y: [-0.55, 0.55] }, planes: planes(-0.65, -0.12, 0.01), sdf: (x, y, z) => {
      let d = Math.min(roundBox(x + 0.15, y, z + 0.15, 0.08, 0.08, 0.015, 0.015), rcyl(len2(x + 0.15, y), z, 0.045, -0.3, -0.12, 0.01));   // a saddle on a column
      for (let k = 0; k < 3; k++) {                                                                                                         // three splayed legs
        const a = Math.PI / 2 + (k * 2 * Math.PI) / 3;
        d = Math.min(d, scopeRod(x, y, z, [-0.15, 0, -0.27], [-0.15 + 0.4 * Math.cos(a), 0.4 * Math.sin(a), -0.62], 0.028));
      }
      return d;
    } },
    { id: "main", order: 1, box: { x: [-0.9, 0.1], y: [-0.2, 0.2] }, planes: planes(-0.14, 0.14, 0.02), sdf: (x, y, z) =>
      Math.min(scopeTube(0.13, -0.6, 0)(x, y, z), scopeTube(0.05, -0.76, -0.58)(x, y, z), scopeTube(0.07, -0.76, -0.72)(x, y, z)) },              // the main tube, its eyepiece and its eye cup
    { id: "draw1", order: 2, box: { x: [-0.4, 0.4], y: [-0.17, 0.17] }, planes: planes(-0.11, 0.11, 0.02), sdf: scopeTube(0.1, -0.3, 0.2) },
    { id: "draw2", order: 3, box: { x: [-0.2, 0.4], y: [-0.14, 0.14] }, planes: planes(-0.1, 0.1, 0.02), sdf: (x, y, z) =>
      subtract(Math.min(scopeTube(0.075, -0.1, 0.3)(x, y, z), scopeTube(0.095, 0.24, 0.3)(x, y, z)), scopeTube(0.06, 0.26, 0.4)(x, y, z)) },        // the last stage and its hood, open at the end
    { id: "knob", order: 4, dynamic: true, cell: 0.007, key: (p) => p.ph.toFixed(2), box: { x: [FOCUS_X - 0.09, FOCUS_X + 0.09], y: [0.1, 0.3] }, planes: planes(-0.07, 0.07, 0.015), sdf: (x, y, z, { ph }) => {
      const a = Math.atan2(z, x - FOCUS_X) + ph, teeth = 0.05 + 0.008 * Math.cos(10 * a);
      return Math.min(rcyl(len2(x - FOCUS_X, z), y, teeth, 0.17, 0.25, 0.01), rcyl(len2(x - FOCUS_X, z), y, 0.02, 0.1, 0.18, 0));   // a toothed knob on its spindle
    } },
  ],
  /**
   * k, the intensity: how far each draw tube slides out.
   * 0: a short draw · 0.5: as drawn · 1: nearly half again as far
   */
  step(t, abs, k = 0.5) {
    const reach = byIntensity(k, [0.1, 0.2, 0.26]), e = sm(0, 1.6, t) * (1 - sm(2.8, 3.8, t));
    return {
      stand: {}, main: {}, draw1: { off: [reach * e, 0, 0] }, draw2: { off: [2 * reach * e, 0, 0] },
      knob: { prm: { ph: Math.round((e * 5 * Math.PI) / 0.04) * 0.04 } },
    };
  },
};

/* ===== figures/terrain.js ===== */
/*
 * A square block of ground cut away to show its top: a rugged landscape of ridges and hollows, drawn as contour rings,
 * and the cut sides showing its profile. Move the cursor over it and the land reshapes: a peak rises under the cursor
 * and follows it round, the ground folding up into rings round the point. At rest it is the quiet landscape. The block
 * under the land is cut once; the land is cut again as the peak moves. It uses the cursor's position (the fourth
 * argument of step), not just how far through the action it is.
 */
const terrSide = 0.55;                                                   // half the side of the block

/** the land with no peak: ridges and hollows, and a broad rise toward the back */
const terrBase = (x, y) => 0.24 + 0.09 * Math.sin(5 * x + 2) * Math.cos(4 * y) + 0.07 * Math.sin(9 * x - 3 * y + 1) + 0.05 * Math.sin(13 * y + 2 * x) + 0.22 * Math.exp(-((x + 0.2) ** 2 + (y + 0.25) ** 2) / 0.15);

const terrain = {
  T: 4, zr: [-0.45, 1.0], S: 270, zm: 0.25,
  active: [0, 2.4],                                              // with no cursor (the demo), a peak wanders over the land; the pose at 0 is the rest pose
  drive: (x, y) => clamp(1.5 - Math.hypot(x - 300, y - 330) / 200, 0, 1),   // 1 over the land, 0 away from it: the cursor's place is what shapes it
  hint: "move over the land to raise a peak under the cursor",
  parts: [
    { id: "block", order: 0, box: { x: [-0.7, 0.7], y: [-0.7, 0.7] }, planes: planes(-0.45, 0.0, 0.015), sdf: (x, y) => Math.max(Math.abs(x), Math.abs(y)) - terrSide },
    { id: "land", order: 1, dynamic: true, cell: 0.022, key: (p) => (p.a ? p.px.toFixed(2) + ":" + p.py.toFixed(2) + ":" + p.a.toFixed(2) : "0"), box: { x: [-0.7, 0.7], y: [-0.7, 0.7] }, planes: planes(0.0, 1.06, 0.02), sdf: (x, y, z, { px, py, a }) => {
      const d2 = (x - px) ** 2 + (y - py) ** 2, peak = a ? a * Math.exp(-d2 / 0.03) * (1 + 0.12 * Math.sin(23 * x + 17 * y)) : 0;   // a ridged peak
      return Math.max(z - terrBase(x, y) - peak, Math.abs(x) - terrSide, Math.abs(y) - terrSide);
    } },
  ],
  /**
   * k, the intensity: how high the peak rises.
   * 0: a low rise · 0.5: a clear peak · 1: a tall one
   */
  step(t, abs, k = 0.5, pointer = null) {
    const rise = byIntensity(k, [0.3, 0.5, 0.7]), q = (v) => Math.round(v / 0.03) * 0.03;
    let px = 0, py = 0, s = 0;
    if (pointer && pointer.s > 0.002) { [px, py] = pointer.ground(0.35); s = pointer.s; }                      // the peak is under the cursor
    else { s = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t)); px = 0.3 * Math.cos(1 + t * 1.3); py = 0.3 * Math.sin(1 + t * 1.3); }   // with no cursor, it wanders
    const a = Math.round(rise * s * 40) / 40;
    return { block: {}, land: { prm: { px: a ? q(clamp(px, -0.5, 0.5)) : 0, py: a ? q(clamp(py, -0.5, 0.5)) : 0, a } } };
  },
};

/* ===== figures/tile-pyramid.js ===== */
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

const tilePyramid = {
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

/* ===== figures/tile-stack.js ===== */
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

const tileStack = {
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

/* ===== figures/toaster.js ===== */
/*
 * A two-slot toaster with its toast pushed down so only the crowns show, and the lever held down. The cursor
 * releases the lever and the toast springs up out of the slots. The body is cut once; the toast and the lever
 * are rigid, so each is cut once too and only moves.
 */
const bread = (x, z) => {                                                       // the slice seen from the side: a crown over a narrower stem
  const rb = (px, pz, bx, bz, r) => { const qx = Math.abs(px) - bx, qz = Math.abs(pz) - bz; return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r; };
  return smin(rb(x, z - 0.12, 0.23, 0.08, 0.06), rb(x, z + 0.08, 0.19, 0.15, 0.03), 0.05);
};
const slice = (x, y, z, yc) => {                                                // a thin rounded slice of it, at depth yc
  const a = bread(x, z) + 0.012, b = Math.abs(y - yc) - 0.035 + 0.012;
  return Math.hypot(Math.max(a, 0), Math.max(b, 0)) + Math.min(Math.max(a, b), 0) - 0.012;
};

const toaster = {
  T: 4, zr: [-0.42, 0.74], S: 260, zm: 0.16,
  active: [0, 2],                                                 // the lever lets go and the toast pops; the pose at 0 is the rest pose (toast and lever are drawn at rest, offsets start at 0)
  drive: (x, y) => clamp((470 - y) / 300, 0, 1),                   // up the toaster
  hint: "move up the toaster to pop the toast",
  parts: [
    { id: "body", order: 0, box: { x: [-0.75, 0.75], y: [-0.55, 0.55] }, planes: planes(-0.44, 0.3), sdf: (x, y, z) => {
      let d = roundBox(x, y, z + 0.02, 0.52, 0.26, 0.22, 0.1);                                                       // rounded shell
      for (const yc of [-0.14, 0.14]) d = subtract(d, roundBox(x, y - yc, z - 0.38, 0.32, 0.03, 0.6, 0.03));       // two slots
      d = subtract(d, roundBox(x - 0.38, y - 0.37, z, 0.01, 0.03, 0.17, 0.01));                                     // the lever's groove
      d = smin(d, rcyl(len2(x + 0.3, z - 0.02), y, 0.07, 0.3, 0.43, 0.02), 0.03);                                   // browning dial
      for (const fx of [-0.44, 0.44]) for (const fy of [-0.2, 0.2]) d = Math.min(d, rcyl(len2(x - fx, y - fy), z, 0.05, -0.44, -0.3, 0.02));   // feet
      return d;
    } },
    { id: "toast", order: 1, box: { x: [-0.4, 0.4], y: [-0.35, 0.35] }, planes: planes(-0.17, 0.37), sdf: (x, y, z) => Math.min(slice(x, y, z - 0.1, -0.14), slice(x, y, z - 0.1, 0.14)) },
    { id: "lever", order: 2, box: { x: [0.25, 0.5], y: [0.28, 0.58] }, planes: planes(-0.156, -0.044), sdf: (x, y, z) => roundBox(x - 0.38, y - 0.41, z + 0.1, 0.04, 0.03, 0.04, 0.015) },
  ],
  /**
   * k, the intensity: how high the toast pops.
   * 0: a hop that lifts the crowns clear · 0.5: half the toast out · 1: the whole slice, with a bounce
   */
  step(t, abs, k = 0.5) {
    const rise = byIntensity(k, [0.14, 0.3, 0.46]);
    const u = clamp((t - 0.35) / 0.9, 0, 1), back = 1.70158, v = u - 1;
    const pop = 1 + (back + 1) * v * v * v + back * v * v;                  // springs past its height and settles
    const down = sm(2.8, 3.8, t);                                           // after the action the loop sinks back
    const lever = sm(0.1, 0.7, t) * (1 - down);
    return { body: {}, toast: { off: [0, 0, rise * pop * (1 - down)] }, lever: { off: [0, 0, 0.18 * lever] } };
  },
};

/* ===== figures/typewriter.js ===== */
/*
 * A typewriter: a low body with three rows of round keys on posts, a half-round basket of typebars lying in a well
 * behind them, and a carriage at the back with a platen roller, two knobs, a return lever and a sheet of paper
 * standing up behind it. Move across it and it types: one typebar after another swings up out of the basket to strike
 * the platen, and the carriage steps to the left with every letter. At rest the bars lie in the basket and the
 * carriage is at the right. The body is cut once; the carriage is rigid and only slides; the typebars are cut again
 * as they strike.
 */
const TYPE_C = [0, -0.08], TYPE_BARS = 9, TYPE_FIRST = 0.25, TYPE_STEP = (Math.PI - 0.5) / (TYPE_BARS - 1);   // the middle of the basket, and where the bars lie round it
const TYPE_ORDER = [3, 7, 1, 5, 8, 0, 4, 2, 6];                         // the order the bars strike in

/** the distance to a rod between two points in space */
const typeRod = (x, y, z, [ax, ay, az], [bx, by, bz], r) => {
  const dx = bx - ax, dy = by - ay, dz = bz - az, t = clamp(((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / (dx * dx + dy * dy + dz * dz), 0, 1);
  return Math.hypot(x - ax - t * dx, y - ay - t * dy, z - az - t * dz) - r;
};

/** typebar m, swung up by angle a: from its pivot on the rim of the basket, in toward the middle and up toward the platen */
const typeBar = (x, y, z, m, a) => {
  const ang = TYPE_FIRST + m * TYPE_STEP, px = TYPE_C[0] + 0.19 * Math.cos(ang), py = TYPE_C[1] + 0.19 * Math.sin(ang);
  const ix = -Math.cos(ang), iy = -Math.sin(ang), L = 0.25;
  return typeRod(x, y, z, [px, py, 0.105], [px + L * Math.cos(a) * ix, py + L * Math.cos(a) * iy, 0.105 + L * Math.sin(a)], 0.016);
};

const typewriter = {
  T: 4, zr: [-0.02, 0.68], S: 360, zm: 0.22,
  active: [0, 2.4],                                              // it types a line; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 130) / 340, 0, 1),                    // across the typewriter
  hint: "move across the typewriter to type",
  parts: [
    { id: "body", order: 0, cell: 0.008, box: { x: [-0.65, 0.65], y: [-0.5, 0.48] }, planes: planes(-0.02, 0.3, 0.01), sdf: (x, y, z) => {
      let d = Math.min(roundBox(x, y, z - 0.05, 0.5, 0.36, 0.04, 0.03), roundBox(x, y + 0.3, z - 0.16, 0.48, 0.08, 0.1, 0.03));   // a low base, and a raised back that carries the carriage
      d = subtract(d, Math.max(len2(x - TYPE_C[0], y - TYPE_C[1]) - 0.22, 0.09 - z, -0.2 - y));                                  // the well the typebars lie in
      for (let r = 0; r < 3; r++) for (let k = 0; k < 9; k++) {                                                                  // three rows of keys, each row higher and set back
        const kx = -0.34 + 0.085 * k + 0.02 * r, ky = 0.32 - 0.08 * r, top = 0.17 + 0.035 * r, rr = len2(x - kx, y - ky);
        d = Math.min(d, rcyl(rr, z, 0.032, top - 0.025, top, 0.012), rcyl(rr, z, 0.013, 0.1, top - 0.02, 0));
      }
      return d;
    } },
    { id: "bars", order: 1, dynamic: true, cell: 0.008, key: (p) => p.j + ":" + p.a.toFixed(2), box: { x: [-0.25, 0.25], y: [-0.3, 0.14] }, planes: planes(0.085, 0.35, 0.012), sdf: (x, y, z, { j, a }) => {
      const m = clamp(Math.round((Math.atan2(y - TYPE_C[1], x - TYPE_C[0]) - TYPE_FIRST) / TYPE_STEP), 0, TYPE_BARS - 1);       // only the nearest resting bar can matter
      const flat = m === j && a > 0.02 ? 1 : typeBar(x, y, z, m, 0);
      return Math.min(flat, a > 0.02 ? typeBar(x, y, z, j, a) : 1);                                                               // and the bar that is striking
    } },
    { id: "carriage", order: 2, cell: 0.007, box: { x: [-0.55, 0.9], y: [-0.62, 0.0] }, planes: planes(0.27, 0.68, 0.01), sdf: (x, y, z) => {
      const cx = x - 0.18, r = len2(y + 0.24, z - 0.36);
      let d = Math.min(rcyl(r, cx, 0.07, -0.42, 0.42, 0.02), rcyl(r, Math.abs(cx), 0.09, 0.42, 0.5, 0.02));                      // the platen, and a knob at each end
      const w = (y + 0.26) * 0.707 + (z - 0.42) * 0.707, s = -(y + 0.26) * 0.707 + (z - 0.42) * 0.707;                            // the paper, leaning back from the platen
      d = Math.min(d, Math.max(Math.abs(w) - 0.008, Math.abs(cx) - 0.27, -s, s - 0.3));
      return Math.min(d, typeRod(cx, y, z, [-0.47, -0.24, 0.4], [-0.43, -0.06, 0.5], 0.016));                                    // and the return lever
    } },
  ],
  /**
   * k, the intensity: how many letters it types, and so how far the carriage travels.
   * 0: four · 0.5: eight · 1: twelve
   */
  step(t, abs, k = 0.5) {
    const letters = Math.round(byIntensity(k, [4, 8, 12])), q = letters * sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t)), n = Math.floor(q);
    const a = n < letters ? 1.3 * Math.sin(Math.PI * (q - n)) : 0;                                                              // the bar swings up and back for each letter
    return { body: {}, carriage: { off: [-0.035 * q, 0, 0] }, bars: { prm: { j: TYPE_ORDER[n % TYPE_BARS], a: Math.round(a * 20) / 20 } } };
  },
};

/* ===== figures/umbrella.js ===== */
/*
 * An umbrella standing on its tip, handle down: a thin shaft with a crooked handle, and a canopy that rides up the
 * shaft's length. Move up it and the canopy opens from a furled spike into a scalloped dome, its rim spreading and
 * rising as it goes. At rest it is furled. The shaft and handle are cut once; the canopy is cut again as it opens.
 */
const BRELLA_TOP = 0.6, SKIN = 0.03;                                    // where the canopy's apex stays, and how thick its skin is

/** the canopy at openness o: a paraboloid skin that widens and shortens as it opens, with an eight-lobed rim */
const canopy = (x, y, z, { o }) => {
  const r = len2(x, y), R = (0.1 + 0.46 * o) * (1 + 0.05 * o * Math.cos(8 * Math.atan2(y, x))), h = 0.7 - 0.45 * o;
  const rOut = R * Math.sqrt(Math.max(0, (BRELLA_TOP - z) / h)), rIn = R * Math.sqrt(Math.max(0, (BRELLA_TOP - SKIN - z) / h));
  return Math.max(r - rOut, -(r - rIn), BRELLA_TOP - h - z, z - BRELLA_TOP);                                   // between the outer and the inner paraboloid
};

const umbrella = {
  T: 4, zr: [-0.82, 0.7], S: 270, zm: -0.06,
  active: [0, 2.2],                                              // the canopy opens; the pose at 0 is the rest pose, furled
  drive: (x, y) => clamp((480 - y) / 300, 0, 1),                 // up the umbrella
  hint: "move up the umbrella to open it",
  parts: [
    { id: "shaft", order: 0, cell: 0.007, box: { x: [-0.2, 0.2], y: [-0.12, 0.12] }, planes: planes(-0.84, 0.7, 0.01), sdf: (x, y, z) => {
      const hook = Math.max(Math.hypot(len2(x - 0.075, z + 0.72) - 0.075, y) - 0.025, z + 0.72);              // a half ring below the shaft: the crook
      return Math.min(rcyl(len2(x, y), z, 0.024, -0.72, 0.62, 0.01), hook, Math.hypot(x, y, z - 0.66) - 0.028);   // the shaft, the crook, a ferrule at the tip
    } },
    { id: "canopy", order: 1, dynamic: true, cell: 0.01, key: (p) => p.o.toFixed(2), box: { x: [-0.62, 0.62], y: [-0.62, 0.62] }, planes: planes(-0.12, BRELLA_TOP, 0.03), sdf: canopy },
  ],
  /**
   * k, the intensity: how wide it opens.
   * 0: part open · 0.5: well open · 1: wide open
   */
  step(t, abs, k = 0.5) {
    const wide = byIntensity(k, [0.6, 0.85, 1]), e = sm(0, 1.6, t) * (1 - sm(2.8, 3.8, t));
    return { shaft: {}, canopy: { prm: { o: Math.round((0.06 + (wide - 0.06) * e) * 40) / 40 } } };
  },
};

/* ===== figures/vault-door.js ===== */
/*
 * A vault door seen from above, lying flat in its square frame: a round door with a raised ring, a hub, a six-spoke
 * wheel, and four locking bars laid radially on its face. Move across it and the wheel turns while the bars draw in
 * toward the hub. At rest the wheel is still and the bars are shot home. Lying flat, the slices are the rings of the
 * door itself. The frame and door are cut once; the wheel is cut again as it turns; the bars are rigid and only move.
 */
const DOOR_TOP = 0.2, BAR_Z = 0.27;                                     // the door's face, and the height of the bars' axes

/** a bar along x or y, `sign` picking its side: a rod with a thicker head at the outer end */
const bar = (axis, sign) => (x, y, z) => {
  const u = sign * (axis === "x" ? x : y), ra = len2(axis === "x" ? y : x, z - BAR_Z);
  return Math.min(rcyl(ra, u, 0.04, 0.22, 0.4, 0.015), rcyl(ra, u, 0.065, 0.36, 0.42, 0.02));
};
const alongX = { x: [0.1, 0.52], y: [-0.1, 0.1] }, alongY = { x: [-0.1, 0.1], y: [0.1, 0.52] };   // the boxes of a bar along x, and of one along y

/** the wheel on the door, spun by `ph`: six spokes, a rim, a hub */
const wheel = (x, y, z, { ph }) => {
  const r = len2(x, y), aa = ((((Math.atan2(y, x) + ph + Math.PI / 6) % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3)) - Math.PI / 6;   // angle to the nearest spoke
  const flat = Math.min(Math.max(r * Math.abs(Math.sin(aa)) - 0.018, r - 0.22), Math.abs(r - 0.2) - 0.016, r - 0.07);
  return Math.max(flat, Math.abs(z - 0.41) - 0.025);
};

const vaultDoor = {
  T: 4, zr: [-0.14, 0.48], S: 250, zm: 0.17,
  active: [0, 2.2],                                              // the wheel turns and the bars draw in; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 150) / 300, 0, 1),                    // across the door
  hint: "move across the door to turn the wheel and draw the bolts",
  parts: [
    { id: "frame", order: 0, box: { x: [-0.85, 0.85], y: [-0.85, 0.85] }, planes: planes(-0.14, 0.2, 0.015), sdf: (x, y, z) => {
      let d = subtract(roundBox(x, y, z, 0.62, 0.62, 0.08, 0.05), rcyl(len2(x, y), z, 0.47, -1, 1, 0));           // a square frame around a round opening
      for (const sx of [-0.56, 0.56]) for (const sy of [-0.56, 0.56]) d = Math.min(d, rcyl(len2(x - sx, y - sy), z, 0.04, 0.13, 0.19, 0.015));   // four rivets
      return d;
    } },
    { id: "door", order: 1, box: { x: [-0.55, 0.55], y: [-0.55, 0.55] }, planes: planes(-0.12, 0.38), sdf: (x, y, z) => {
      const r = len2(x, y), face = rcyl(r, z, 0.44, -0.12, DOOR_TOP, 0.03);
      const ring = Math.max(Math.abs(r - 0.34) - 0.025, Math.abs(z - DOOR_TOP) - 0.03);                          // a raised ring
      return Math.min(face, ring, rcyl(r, z, 0.07, DOOR_TOP, 0.36, 0.02));                                        // and the hub
    } },
    { id: "boltR", order: 2, box: alongX, planes: planes(0.2, 0.34, 0.02), sdf: bar("x", 1) },
    { id: "boltL", order: 2, box: { x: [-0.52, -0.1], y: alongX.y }, planes: planes(0.2, 0.34, 0.02), sdf: bar("x", -1) },
    { id: "boltN", order: 2, box: alongY, planes: planes(0.2, 0.34, 0.02), sdf: bar("y", 1) },
    { id: "boltS", order: 2, box: { x: alongY.x, y: [-0.52, -0.1] }, planes: planes(0.2, 0.34, 0.02), sdf: bar("y", -1) },
    { id: "wheel", order: 3, dynamic: true, cell: 0.009, key: (p) => p.ph.toFixed(2), box: { x: [-0.3, 0.3], y: [-0.3, 0.3] }, planes: planes(0.38, 0.44, 0.015), sdf: wheel },
  ],
  /**
   * k, the intensity: how far the wheel turns, and how far the bars draw in.
   * 0: a third of a turn, bars drawn in a little · 0.5: one turn · 1: two turns, bars drawn right in
   */
  step(t, abs, k = 0.5) {
    const turn = byIntensity(k, [0.35, 1, 2]) * 2 * Math.PI, draw = byIntensity(k, [0.05, 0.1, 0.14]);
    const back = sm(2.8, 3.8, t), ph = Math.round((-turn * sm(0, 1.5, t) * (1 - back)) / 0.03) * 0.03, d = draw * sm(0.8, 1.8, t) * (1 - back);
    return { frame: {}, door: {}, wheel: { prm: { ph } }, boltR: { off: [-d, 0, 0] }, boltL: { off: [d, 0, 0] }, boltN: { off: [0, -d, 0] }, boltS: { off: [0, d, 0] } };
  },
};

/* ===== figures/volcano.js ===== */
/*
 * A volcano: a steep cone with ridged flanks and an open crater. Move up it and the crater fills with lava, which
 * rises to the rim and spills over in three streams that run down the flank. At rest it is cold and dry. The cone is cut
 * once; the lava is cut again as it rises and flows.
 */
const volcTop = 0.5, volcStreams = [0.7, 2.8, 4.9];                      // the cone's height, and the angles of the three lava flows

/** the cone's radius at height z, with seven ridges that fade toward the crater */
const volcRadius = (z, th) => (0.15 + 0.35 * Math.pow(clamp(1 - z / volcTop, 0, 1), 1.4)) * (1 + 0.05 * Math.cos(7 * th) * (1 - z / volcTop));

const volcano = {
  T: 4, zr: [0, 0.56], S: 330, zm: 0.24,
  active: [0, 2.4],                                              // the crater fills and the lava spills; the pose at 0 is the rest pose
  drive: (x, y) => clamp((480 - y) / 300, 0, 1),                 // up the volcano
  hint: "move up the volcano to make it erupt",
  parts: [
    { id: "cone", order: 0, box: { x: [-0.65, 0.65], y: [-0.65, 0.65] }, planes: planes(0, volcTop, 0.012), sdf: (x, y, z) => {
      const r = len2(x, y), cone = Math.max(r - volcRadius(z, Math.atan2(y, x)), -z, z - volcTop);
      return subtract(cone, Math.max(r - 0.1, 0.38 - z));                                                         // an open crater in the top
    } },
    { id: "lava", order: 1, dynamic: true, cell: 0.016, key: (p) => (p ? p.f.toFixed(2) : ""), box: { x: [-0.56, 0.56], y: [-0.56, 0.56] }, planes: planes(0.05, 0.52, 0.02), sdf: (x, y, z, { f }) => {
      const r = len2(x, y), th = Math.atan2(y, x), pool = Math.max(r - 0.097, z - (0.385 + 0.105 * clamp(f / 0.4, 0, 1)), 0.37 - z);   // lava rising in the crater
      let d = pool;
      const reach = volcTop - 0.01 - 0.42 * clamp((f - 0.35) / 0.65, 0, 1);                                      // how far down the flank the flows have run
      if (f > 0.36) for (const a of volcStreams) {
        const ang = ((((th - a - 0.12 * Math.sin(z * 14 + a)) + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
        d = Math.min(d, Math.max(Math.abs(r - volcRadius(z, th)) - 0.022, Math.abs(ang) * r - (0.05 + 0.08 * (volcTop - z)), reach - z, z - volcTop));   // a strip lying on the flank
      }
      return d;
    } },
  ],
  /**
   * k, the intensity: how much lava it gives.
   * 0: it fills the crater · 0.5: it spills down a third of the flank · 1: the flows run nearly to the foot
   */
  step(t, abs, k = 0.5) {
    const amount = byIntensity(k, [0.4, 0.75, 1]), e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t));
    return { cone: {}, lava: { prm: e * amount > 0.02 ? { f: Math.round(e * amount * 40) / 40 } : null } };
  },
};

/* ===== figures/whirlpool.js ===== */
/*
 * A round dish of still water. Move up and a whirlpool opens in the middle: the surface sinks into a funnel and spiral
 * arms wind in toward it, turning as they go, each one a contour of the water's height. At rest the water is flat. The
 * dish is cut once; the water is cut again as it swirls.
 */
const whirlLevel = 0.03;

const whirlpool = {
  T: 4, zr: [-0.2, 0.1], S: 300, zm: -0.05,
  active: [0, 2.4],                                              // the vortex opens and turns; the pose at 0 is the rest pose, flat
  drive: (x, y) => clamp((480 - y) / 300, 0, 1),                 // up the dish
  hint: "move up the dish to stir a whirlpool",
  parts: [
    { id: "dish", order: 0, box: { x: [-0.8, 0.8], y: [-0.8, 0.8] }, planes: planes(-0.2, 0.09, 0.012), sdf: (x, y, z) => {
      const r = len2(x, y);
      return subtract(Math.max(r - 0.62, -0.2 - z, z - 0.08), Math.max(r - 0.54, -0.17 - z));                        // a round dish, hollow, with a thick rim
    } },
    { id: "water", order: 1, dynamic: true, cell: 0.018, key: (p) => p.d.toFixed(2) + ":" + p.ph.toFixed(1), box: { x: [-0.6, 0.6], y: [-0.6, 0.6] }, planes: planes(-0.17, 0.08, 0.012), sdf: (x, y, z, { d, ph }) => {
      const r = len2(x, y), dip = d * Math.exp(-Math.pow(r / 0.22, 1.5)), arms = d > 0.01 ? 0.016 * (d / (d + 0.05)) * (1 - Math.exp(-r / 0.08)) * Math.exp(-r / 0.5) * Math.cos(2 * Math.atan2(y, x) - 11 * r + ph) : 0;
      return Math.max(z - (whirlLevel - dip + arms), r - 0.53, -0.17 - z);                                          // water to a level that sinks and spirals
    } },
  ],
  /**
   * k, the intensity: how deep the vortex goes.
   * 0: a shallow dimple · 0.5: a clear funnel · 1: nearly to the floor
   */
  step(t, abs, k = 0.5) {
    const depth = byIntensity(k, [0.08, 0.15, 0.19]), e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t));
    return { dish: {}, water: { prm: { d: Math.round(depth * e * 100) / 100, ph: Math.round(e * 14 * 5) / 5 } } };
  },
};

/* ===== figures/windmill.js ===== */
/*
 * A tower windmill: an eight-sided tower that narrows as it rises, with a gallery round its waist, a door, a domed cap,
 * and four latticed sails on a shaft that points at you. Move across it and the sails turn, faster and then slowing,
 * and settle where they began. At rest they hang still in an X. The tower and cap are cut once; the sails are cut again
 * as they turn.
 */
const HUB_Z = 0.88, SAIL_Y = 0.3;                                       // the height of the shaft, and how far forward the sails sit

/** how far a point is outside the tower's eight sides at height z */
const mill = (x, y, z) => {
  let d = -1e9;
  for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4 + Math.PI / 8; d = Math.max(d, x * Math.cos(a) + y * Math.sin(a)); }
  return d;
};

/** the sails in the plane of the shaft, turned by ph: fold the angle onto one arm, then measure that arm's stock and lattice */
const sails = (x, y, z, { ph }) => {
  const dz = z - HUB_Z, r = len2(x, dz), q = Math.PI / 2, a = ((((Math.atan2(dz, x) - ph + q / 2) % q) + q) % q) - q / 2, u = r * Math.cos(a), v = r * Math.sin(a);
  const stock = Math.max(Math.abs(v) - 0.018, u - 0.8, 0.03 - u);
  const slat = ((((u - 0.2) % 0.15) + 0.15) % 0.15), hole = Math.max(Math.abs(slat - 0.075) - 0.035, Math.abs(v - 0.11) - 0.055);
  const blade = Math.max(Math.abs(v - 0.11) - 0.08, Math.abs(u - 0.49) - 0.29, -hole);                         // a frame with slats, on one side of the stock
  return Math.max(Math.min(stock, blade, r - 0.05), Math.abs(y - SAIL_Y) - 0.02);
};

const windmill = {
  T: 4, zr: [-0.32, 1.7], S: 270, zm: 0.68,
  active: [0, 2.4],                                              // the sails turn up and slow again; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 150) / 300, 0, 1),                    // across the windmill
  hint: "move across the windmill to turn its sails",
  parts: [
    { id: "tower", order: 0, box: { x: [-0.55, 0.55], y: [-0.55, 0.55] }, planes: planes(-0.32, 1.08, 0.025), sdf: (x, y, z) => {
      const apothem = 0.3 - (0.12 * (z + 0.3)) / 1.1;
      let d = Math.max(mill(x, y, z) - apothem, -0.3 - z, z - 0.8);                                                // an eight-sided tower that tapers
      d = Math.max(d, -Math.max(Math.abs(x) - 0.05, Math.abs(y - 0.3) - 0.12, Math.abs(z + 0.12) - 0.13) * (y > 0.1 ? 1 : -1));   // a door in the front face
      const gallery = Math.max(Math.abs(len2(x, y) - 0.34) - 0.045, Math.abs(z - 0.04) - 0.012);                  // a gallery ring round the waist
      return Math.min(d, gallery);
    } },
    { id: "cap", order: 1, box: { x: [-0.3, 0.3], y: [-0.3, 0.4] }, planes: planes(0.78, 1.08, 0.02), sdf: (x, y, z) =>
      Math.min(Math.max(Math.hypot(x, y, z - 0.8) - 0.21, 0.8 - z), rcyl(len2(x, z - HUB_Z), y, 0.045, 0.1, 0.34, 0.015)) },   // a dome, and the shaft pointing at you
    { id: "sails", order: 2, dynamic: true, cell: 0.012, key: (p) => p.ph.toFixed(2), box: { x: [-0.86, 0.86], y: [0.22, 0.38] }, planes: planes(0.1, 1.66, 0.022), sdf: sails },
  ],
  /**
   * k, the intensity: how far the sails turn.
   * 0: half a turn · 0.5: a turn and a half · 1: three turns
   */
  step(t, abs, k = 0.5) {
    const turns = byIntensity(k, [0.5, 1.5, 3]), back = sm(3, 4, t);
    return { tower: {}, cap: {}, sails: { prm: { ph: Math.round((Math.PI / 4 + turns * 2 * Math.PI * sm(0, 2.4, t) * (1 - back)) / 0.04) * 0.04 } } };
  },
};

/* ===== figures/index.js ===== */
/** every figure the page offers, in the order of its buttons */
const SCENES = { rocket, camera, binoculars, lightbulb, "record player": recordPlayer, lighthouse, toaster, "vault door": vaultDoor, carousel, "pocket watch": pocketWatch, telescope, "jack in the box": jackInTheBox, windmill, gyroscope, umbrella, "periscope submarine": periscopeSubmarine, seedling, "drawer chest": drawerChest, "bellows camera": bellowsCamera, percolator, terrain, volcano, "ripple tank": rippleTank, "tile pyramid": tilePyramid, "spiral stair": spiralStair, "ring tower": ringTower, funnel, hourglass, whirlpool, "crystal cluster": crystalCluster, honeycomb, "card fan": cardFan, "tile stack": tileStack, typewriter, printer, "gear train": gearTrain, "cassette deck": cassetteDeck };

window.Contour = { createPlayer, SCENES, RULE, VIEW, SPLIT, MOTION, LEVELS, GAP_RANGE };
})();
