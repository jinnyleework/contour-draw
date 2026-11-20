import { sdSegment, sdCircle, noise2, hash2, clamp, smooth } from "../src/math.js";

/*
 * Shared pieces for the dog pictures (down boy, good boy, bad boy, sit down boy): a retriever built from soft capsules and
 * ellipses blended into one silhouette, then cut like a woodcut: paper strokes run round the form (the iso-lines of the
 * silhouette's own distance), wide on the lit side and hairlines in the shade, so no mass is ever one solid block.
 * Everything is in world units, y up, a head's own frame facing right.
 */

/** a soft union: the joint between two shapes fills in over k */
export const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
export const sminAll = (list, k) => list.reduce((a, b) => smin(a, b, k));

/** a tapered capsule from circle (ax, ay, ra) to circle (bx, by, rb) */
export function sdTaper(x, y, ax, ay, ra, bx, by, rb) {
  const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1e-6, ux = dx / l, uy = dy / l;
  const along = (x - ax) * ux + (y - ay) * uy, perp = Math.abs(-(x - ax) * uy + (y - ay) * ux);
  const b = (ra - rb) / l, a = Math.sqrt(Math.max(1 - b * b, 0.0001)), k = -perp * b + along * a;   // iq's uneven capsule, p = (perp, along)
  if (k < 0) return Math.hypot(perp, along) - ra;
  if (k > a * l) return Math.hypot(perp, along - l) - rb;
  return perp * a + along * b - ra;
}

/** a rotated ellipse (degrees), close to a true distance near its edge */
export function sdEllipseR(x, y, cx, cy, rx, ry, deg = 0) {
  const c = Math.cos((deg * Math.PI) / 180), s = Math.sin((deg * Math.PI) / 180), px = x - cx, py = y - cy;
  const u = px * c + py * s, v = -px * s + py * c;
  return (Math.hypot(u / rx, v / ry) - 1) * Math.min(rx, ry);
}

/** a point list smoothed through its points (Catmull-Rom), n samples per span */
export function curve(pts, n = 10) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** a quadratic bezier as points */
export const bez = (a, c, b, n = 14) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; });

/** a pen stroke along a polyline: widest `w` (full width) where `profile(t)` is 1, tapering to points at its ends */
export function stroke(pts, w, profile = (t) => Math.pow(Math.sin(Math.PI * t), 0.6)) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1] || 1e-6;
  return (x, y) => {
    let best = Infinity, bt = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
      const h = len ? clamp(((x - ax) * dx + (y - ay) * dy) / len, 0, 1) : 0, d = Math.hypot(x - ax - dx * h, y - ay - dy * h);
      if (d < best) { best = d; bt = (cum[i - 1] + (cum[i] - cum[i - 1]) * h) / total; }
    }
    return best - (w / 2) * profile(bt) - 0.0008;
  };
}
/** the union of several sdfs */
export const unionOf = (list) => (x, y) => { let d = Infinity; for (const f of list) d = Math.min(d, f(x, y)); return d; };

/** a head-local frame: centre (cx, cy), tilt `deg` (nose up positive), scale s. returns a function that maps a head-local sdf into the page */
export function inFrame(cx, cy, deg, s, local) {
  const c = Math.cos((-deg * Math.PI) / 180), sn = Math.sin((-deg * Math.PI) / 180);
  return (x, y) => { const px = x - cx, py = y - cy; return local((px * c - py * sn) / s, (px * sn + py * c) / s) * s; };
}
/** a head-local point to the page */
export function toPage(cx, cy, deg, s, [u, v]) {
  const c = Math.cos((deg * Math.PI) / 180), sn = Math.sin((deg * Math.PI) / 180);
  return [cx + (u * c - v * sn) * s, cy + (u * sn + v * c) * s];
}

/**
 * The woodcut cut: `bodyD` is the silhouette's sdf. Inside it, paper strokes follow the form at depths first, first + pitch,
 * ... (n of them): up to `wide` across on the side facing the light and a hairline on the shadow side, broken and tapered by
 * noise. `calm(x, y)` in 0..1 turns the cut down where a part must stay solid (the nose, an ear). Returns the ink sdf.
 */
export function woodcut(bodyD, { seed = 1, first = 0.034, pitch = 0.056, n = 4, wide = 0.036, hair = 0.011, light = [-0.5, 0.86], calm = () => 1, scale = 8 } = {}) {
  const ll = Math.hypot(light[0], light[1]), lx = light[0] / ll, ly = light[1] / ll, e = 0.004;
  return (x, y) => {
    const d = bodyD(x, y);
    if (d > -first + 0.012) return d;
    const gx = bodyD(x + e, y) - bodyD(x - e, y), gy = bodyD(x, y + e) - bodyD(x, y - e), gl = Math.hypot(gx, gy) || 1;
    const lit = (gx * lx + gy * ly) / gl, k = calm(x, y);
    if (k <= 0) return d;
    let paper = Infinity;
    for (let i = 0; i < n; i++) {
      const di = first + i * pitch;
      if (d > -di + 0.03) break;
      const nb = noise2(x * scale + i * 3.7, y * scale - i * 1.3, seed + i);
      const breaks = smooth(0.34, 0.62, nb);
      const w = (hair + wide * smooth(-0.15, 0.75, lit)) * breaks * k * (1 - i * 0.08);
      if (w > 0.004) paper = Math.min(paper, Math.abs(d + di) - w / 2);
    }
    return Math.max(d, -paper);
  };
}

/** short tapered tick marks in rows, as the dive's water: [x0, x1, y] rows with hashed lengths, ends tapering */
export function strokeRows(rows, { seed = 7, keepBelow = 0.18 } = {}) {
  return (x, y) => {
    let d = Infinity;
    rows.forEach(([x0, x1, yy, len, half, wavy = 0.006], r) => {
      if (x < x0 - 0.001 || x > x1 + 0.001) return;
      const off = hash2(r, 2, seed) * len, s = Math.floor((x + off) / len), t = (x + off - s * len) / len;
      if (hash2(s, r, seed + 5) < keepBelow) return;
      const mid = yy + Math.sin(x * 8 + r * 2.1) * wavy;
      const w = half * Math.pow(Math.sin(clamp((t - 0.04) / 0.92, 0, 1) * Math.PI), 0.55);
      d = Math.min(d, Math.abs(y - mid) - w);
    });
    return Math.min(d, 1);
  };
}

/**
 * A retriever's head, in its own frame (facing right, skull at the origin, nose at about u = 0.42), placed at (cx, cy) tilted
 * `deg` and scaled `s`. Returns the solid (`d`), the ear (`ear`), the paper cuts that make it read (`cut`: eye, nose, mouth,
 * the ear's edge, a stroke down the forehead) and the ink inside them (`ink`: the pupil). `eye` is "open" or "side" (a glance
 * to the nose side), `mouth` "closed", "open" (jaw dropped, tongue out) or "sad" (the corner turned down). `ear` is two
 * circles, [u0, v0, r0, u1, v1, r1], the flap's root and tip.
 */
export function makeHead({ cx, cy, deg, s, ear = [0.0, 0.07, 0.055, -0.1, -0.14, 0.05], mouth = "closed", eye = "open", drop = 0 }) {
  const head = (local) => inFrame(cx, cy, deg, s, local);
  const hp = (u, v) => toPage(cx, cy, deg, s, [u, v]);
  const hcurve = (pts, w, prof) => stroke(curve(pts.map(([u, v]) => hp(u, v))), w, prof);
  const skull = head((u, v) => sdCircle(u, v, 0, 0, 0.16));
  const muzzle = head((u, v) => sdTaper(u, v, 0.1, -0.05, 0.11, 0.31, -0.06, 0.078));
  // the lower jaw hinges at the corner of the mouth and swings down by `drop` degrees
  const rad = (drop * Math.PI) / 180, c = Math.cos(-rad), sn = Math.sin(-rad), hx = 0.06, hy = -0.1;
  const swing = ([u, v]) => [hx + (u - hx) * c - (v - hy) * sn, hy + (u - hx) * sn + (v - hy) * c];
  const j0 = swing([0.05, -0.12]), j1 = swing([0.29, -0.115]);
  const jaw = head((u, v) => sdTaper(u, v, j0[0], j0[1], 0.085, j1[0], j1[1], 0.052));
  const nose = head((u, v) => sdCircle(u, v, 0.375, -0.045, 0.05));
  const solid = (x, y) => sminAll([skull(x, y), muzzle(x, y), jaw(x, y)], 0.03);
  const d = (x, y) => Math.min(smin(solid(x, y), nose(x, y), 0.03));
  const earD = head((u, v) => sdTaper(u, v, ear[0], ear[1], ear[2], ear[3], ear[4], ear[5]));
  const earHalo = (x, y) => Math.max(earD(x, y) - 0.022, -earD(x, y));
  // the eye: a paper almond with a black pupil pushed toward the nose (side glance: pushed to the front edge)
  const ex = eye === "side" ? 0.2 : 0.18, eyePaper = head((u, v) => sdEllipseR(u, v, 0.17, 0.045, 0.07, 0.05, 12));
  const pupil = head((u, v) => sdCircle(u, v, ex, 0.043, 0.027));
  const glint = head((u, v) => sdCircle(u, v, ex + 0.012, 0.054, 0.01));
  const noseShine = head((u, v) => sdCircle(u, v, 0.39, -0.015, 0.02));
  const noseBack = hcurve([[0.325, 0.0], [0.335, -0.05], [0.325, -0.1]], 0.014);
  const mouthPts = mouth === "sad" ? [[0.32, -0.11], [0.2, -0.105], [0.1, -0.12], [0.06, -0.15]] : [[0.32, -0.1], [0.2, -0.125], [0.11, -0.105], [0.06, -0.065]];
  const mouthLine = mouth === "open" ? () => 1 : hcurve(mouthPts, 0.016);
  const forehead = hcurve([[-0.1, 0.1], [0.0, 0.14], [0.1, 0.125]], 0.04);
  const muzzleTop = hcurve([[0.15, 0.02], [0.26, 0.0], [0.34, 0.0]], 0.028);
  const cut = (x, y) => Math.min(eyePaper(x, y), noseShine(x, y), noseBack(x, y), mouthLine(x, y), earHalo(x, y), forehead(x, y), muzzleTop(x, y));
  const ink = (x, y) => Math.max(pupil(x, y), -glint(x, y));
  return { d, ear: earD, cut, ink, hp, head };
}
