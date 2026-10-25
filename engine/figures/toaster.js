import { len2, smin, subtract, roundBox, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

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

export const toaster = {
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
