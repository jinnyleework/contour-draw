import { len2, subtract, roundBox, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A classic iPod lying on its back: a rounded slab with a recessed screen at the top end and a click wheel below it,
 * a centre button inside the wheel and four small marks round its rim. The screen holds five rows of a list with a
 * selection bar around one. Move across it and a fingertip runs round the wheel while the bar steps down the list,
 * one row for each quarter turn. At rest the fingertip waits at the top of the wheel and the first row is chosen.
 *
 * The body, rows and wheel are cut once; the selection bar and the fingertip are rigid and only move.
 */
const IPOD_TOP = 0.06, IPOD_SCREEN = [0, -0.22], IPOD_WHEEL = [0, 0.24], IPOD_ROW = 0.065, IPOD_THUMB = 0.15;
const ipodRowY = (j) => IPOD_SCREEN[1] - 2 * IPOD_ROW + j * IPOD_ROW;

export const ipod = {
  T: 4, zr: [-0.06, 0.14], S: 370, zm: 0.04,
  active: [0, 2.4],                                                  // the fingertip turns and the list scrolls; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 170) / 260, 0, 1),                        // across the iPod
  hint: "move across the iPod to scroll the wheel",
  parts: [
    { id: "body", order: 0, cell: 0.008, box: { x: [-0.4, 0.4], y: [-0.62, 0.62] }, planes: planes(-0.06, 0.06, 0.012), sdf: (x, y, z) =>
      subtract(roundBox(x, y, z, 0.24, 0.44, 0.02, 0.04), roundBox(x - IPOD_SCREEN[0], y - IPOD_SCREEN[1], z - IPOD_TOP, 0.2, 0.15, 0.025, 0.012)) },   // the slab, with the screen sunk into it
    { id: "rows", order: 1, cell: 0.005, box: { x: [-0.24, 0.24], y: [-0.4, -0.04] }, planes: planes(0.018, 0.042, 0.012), sdf: (x, y, z) => {
      let d = 1;
      for (let j = 0; j < 5; j++) d = Math.min(d, roundBox(x + 0.03 * (j % 2), y - ipodRowY(j), z - 0.025, 0.14 - 0.03 * (j % 2), 0.006, 0.012, 0.004));   // five lines of the list, of two lengths
      return d;
    } },
    { id: "select", order: 2, cell: 0.005, box: { x: [-0.24, 0.24], y: [-0.4, -0.24] }, planes: planes(0.018, 0.054, 0.012), sdf: (x, y, z) =>
      roundBox(x, y - ipodRowY(0), z - 0.042, 0.18, 0.022, 0.002, 0.006) },                     // a bar lit over the chosen row
    { id: "wheel", order: 3, cell: 0.007, box: { x: [-0.28, 0.28], y: [-0.04, 0.52] }, planes: planes(0.06, 0.09, 0.012), sdf: (x, y, z) => {
      const dx = x - IPOD_WHEEL[0], dy = y - IPOD_WHEEL[1], r = len2(dx, dy);
      const ring = subtract(rcyl(r, z, 0.2, 0.04, 0.072, 0.008), rcyl(r, z, 0.085, 0, 0.2, 0));
      let marks = 1;
      for (const [mx, my] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) marks = Math.min(marks, rcyl(len2(dx - 0.165 * mx, dy - 0.165 * my), z, 0.014, 0.06, 0.08, 0.004));   // menu, play, back, forward
      return Math.min(ring, marks, rcyl(r, z, 0.07, 0.04, 0.084, 0.012));                       // and the centre button
    } },
    { id: "thumb", order: 4, cell: 0.008, box: { x: [-0.12, 0.12], y: [-0.03, 0.21] }, planes: planes(0.072, 0.13, 0.012), sdf: (x, y, z) =>
      Math.hypot(x - IPOD_WHEEL[0], (y - IPOD_WHEEL[1] + IPOD_THUMB) / 1.25, (z - 0.072) / 0.9) - 0.06 },                                 // a fingertip pad resting on the wheel
  ],
  /**
   * k, the intensity: how far down the list it scrolls (a quarter turn of the wheel for each row).
   * 0: one row · 0.5: three · 1: four, to the end
   */
  step(t, abs, k = 0.5) {
    const rows = byIntensity(k, [1, 3, 4]), u = sm(0, 2.2, t) * (1 - sm(2.8, 3.8, t)), a = rows * (Math.PI / 2) * u;
    const row = Math.min(4, Math.floor(rows * u + 0.15));
    return { body: {}, rows: {}, wheel: {}, select: { off: [0, row * IPOD_ROW, 0] },
      thumb: { off: [IPOD_THUMB * Math.sin(a), IPOD_THUMB * (1 - Math.cos(a)), 0] } };   // round the wheel from the top
  },
};
