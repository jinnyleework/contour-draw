import { len2, subtract, roundBox, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A letterpress: a heavy table carrying a bed with a raised block of type (an ornament, not letters: a ring, a star
 * and a border), four columns, a crosshead, and between them a platen on a screw with a T-handle on top. Move across it
 * and the platen comes down on the type, the screw sinking through the crosshead, and the drawing goes heavier for a
 * beat as it bites. At rest the platen is up. The table, columns and type are cut once; the platen and its screw are
 * rigid and only move.
 */
const PRESS_DROP = 0.37;                                                 // how far the platen comes down to meet the type

export const letterpress = {
  T: 4, zr: [0, 1.47], S: 280, zm: 0.62,
  active: [0, 1.85],                                             // the platen comes down onto the type and bites; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 130) / 340, 0, 1),                    // across the press
  hint: "move across the press to print",
  parts: [
    { id: "frame", order: 0, cell: 0.009, box: { x: [-0.7, 0.7], y: [-0.55, 0.55] }, planes: planes(0, 0.98, 0.012), sdf: (x, y, z) => {
      let d = roundBox(x, y, z - 0.06, 0.52, 0.38, 0.04, 0.02);                                                       // the table
      d = Math.min(d, subtract(roundBox(x, y, z - 0.14, 0.34, 0.25, 0.02, 0.01), Math.max(Math.abs(x) - 0.3, Math.abs(y) - 0.21, 0.13 - z)));   // the bed, a frame round the type
      const r = len2(x, y), th = Math.atan2(y, x), star = 0.1 + 0.05 * Math.cos(5 * th);
      const type = Math.min(Math.abs(r - 0.15) - 0.015, r - star, Math.max(Math.abs(Math.max(Math.abs(x) - 0.24, Math.abs(y) - 0.15)) - 0.012, 0));   // a ring, a star and a border in relief
      d = Math.min(d, Math.max(type, Math.abs(z - 0.155) - 0.015));
      for (const cx of [-0.48, 0.48]) for (const cy of [-0.32, 0.32]) d = Math.min(d, rcyl(len2(x - cx, y - cy), z, 0.035, 0.1, 0.9, 0.01));   // four columns
      return Math.min(d, subtract(roundBox(x, y, z - 0.92, 0.52, 0.36, 0.03, 0.02), rcyl(len2(x, y), z, 0.05, 0.8, 1.0, 0)));   // the crosshead, with a hole for the screw
    } },
    { id: "platen", order: 1, cell: 0.009, box: { x: [-0.5, 0.5], y: [-0.4, 0.4] }, planes: planes(0.54, 1.47, 0.012), sdf: (x, y, z) => {
      const r = len2(x, y);
      return Math.min(roundBox(x, y, z - 0.585, 0.35, 0.25, 0.03, 0.015), rcyl(r, z, 0.035, 0.6, 1.42, 0.01),               // the platen and its screw
        rcyl(len2(y, z - 1.42), x, 0.022, -0.22, 0.22, 0.01), rcyl(len2(x, y), z, 0.05, 1.38, 1.46, 0.015));                 // a T-handle on top
    } },
  ],
  /**
   * k, the intensity: how hard the impression lands, in how heavy the drawing goes as the platen bites.
   * 0: barely · 0.5: a clear beat · 1: a heavy one
   */
  step(t, abs, k = 0.5) {
    const bite = byIntensity(k, [0.3, 1, 1.8]), e = sm(0, 1.8, t) * (1 - sm(2.9, 3.8, t));
    return { frame: {}, platen: { off: [0, 0, -PRESS_DROP * e] }, pulse: 1 + bite * Math.exp(-(((t - 1.8) / 0.12) ** 2)) };
  },
};
