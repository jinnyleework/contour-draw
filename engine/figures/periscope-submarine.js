import { len2, rcyl, roundBox, smin, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

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

export const periscopeSubmarine = {
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
