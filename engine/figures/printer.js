import { len2, subtract, roundBox, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A desktop printer: a boxy body with a paper tray leaning up behind it, an output tray in front, a slot across the top
 * where the print head runs on a rail, and three buttons. Move across it and it prints: the head shuttles back and
 * forth along the slot while a sheet feeds out of the mouth onto the output tray. At rest the head is parked at the
 * left and the tray is empty. The body is cut once; the head and the sheet are rigid and only move.
 */
const PRINT_SHEET_Z = 0.06;                                              // the height the sheet travels at

export const printer = {
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
