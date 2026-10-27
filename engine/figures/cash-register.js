import { len2, subtract, roundBox, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A cash register: a cabinet with a cash drawer, a deck of round keys above it, and a display box at the back with a
 * window in its top. Move up it and it rings up a sale: the keys go down one after another, three flags rise in the
 * window, and the drawer springs out, open, with its compartments. At rest the drawer is shut and the flags are down.
 * The cabinet is cut once; the drawer and flags are rigid and only move; the keys are cut again as they press.
 */
const TILL_ROWS = 4, TILL_COLS = 6, TILL_ORDER = [9, 2, 16, 7, 21, 12, 4];   // the key grid, and the order a sale presses them in
const tillKey = (i) => [-0.25 + 0.1 * (i % TILL_COLS), 0.17 - 0.08 * Math.floor(i / TILL_COLS)];

export const cashRegister = {
  T: 4, zr: [0, 0.78], S: 380, zm: 0.32,
  active: [0, 2.4],                                              // the keys press, the flags rise, the drawer opens; the pose at 0 is the rest pose
  drive: (x, y) => clamp((480 - y) / 300, 0, 1),                 // up the register
  hint: "move up the register to ring up a sale",
  parts: [
    { id: "cabinet", order: 0, cell: 0.009, box: { x: [-0.6, 0.6], y: [-0.5, 0.5] }, planes: planes(0, 0.72, 0.015), sdf: (x, y, z) => {
      let d = subtract(roundBox(x, y, z - 0.1, 0.42, 0.32, 0.07, 0.03), Math.max(Math.abs(x) - 0.36, Math.abs(z - 0.1) - 0.065, -0.28 - y));   // the base, with a slot for the drawer
      d = Math.min(d, roundBox(x, y - 0.02, z - 0.27, 0.38, 0.25, 0.06, 0.03));                                       // the key deck
      const box = roundBox(x, y + 0.24, z - 0.5, 0.24, 0.05, 0.13, 0.03);                                                 // the display, at the back
      return Math.min(d, subtract(box, Math.max(Math.abs(x) - 0.18, Math.abs(y + 0.24) - 0.035, 0.52 - z)));            // with a window down into its top
    } },
    { id: "keys", order: 1, dynamic: true, cell: 0.007, key: (p) => p.j + ":" + p.p.toFixed(2), box: { x: [-0.35, 0.35], y: [-0.15, 0.27] }, planes: planes(0.34, 0.42, 0.008), sdf: (x, y, z, { j, p }) => {
      const c = clamp(Math.round((x + 0.25) / 0.1), 0, TILL_COLS - 1), r = clamp(Math.round((0.17 - y) / 0.08), 0, TILL_ROWS - 1), i = r * TILL_COLS + c;   // only the nearest key can matter
      const [kx, ky] = tillKey(i), top = 0.41 - (i === j ? 0.03 * p : 0), rr = len2(x - kx, y - ky);
      return Math.min(rcyl(rr, z, 0.034, top - 0.025, top, 0.012), rcyl(rr, z, 0.013, 0.32, top - 0.02, 0));                 // a round key on a post
    } },
    { id: "flags", order: 2, box: { x: [-0.25, 0.25], y: [-0.33, -0.15] }, planes: planes(0.42, 0.62, 0.01), sdf: (x, y, z) => {
      let d = 1;
      for (const fx of [-0.11, 0, 0.11]) d = Math.min(d, roundBox(x - fx, y + 0.24, z - 0.53, 0.035, 0.012, 0.07, 0.008));   // three flags, below the window at rest
      return d;
    } },
    { id: "drawer", order: 3, cell: 0.008, box: { x: [-0.45, 0.45], y: [-0.4, 0.45] }, planes: planes(0.035, 0.17, 0.01), sdf: (x, y, z) => {
      const outer = roundBox(x, y - 0.02, z - 0.1, 0.34, 0.27, 0.05, 0.01), inner = Math.max(Math.abs(x) - 0.32, Math.abs(y - 0.0) - 0.26, 0.065 - z);
      let d = subtract(outer, inner);                                                                                      // an open tray
      for (const dx of [-0.16, 0, 0.16]) d = Math.min(d, Math.max(roundBox(x - dx, y - 0.0, z - 0.1, 0.008, 0.26, 0.05, 0), z - 0.15));   // dividers into four compartments
      return Math.min(d, roundBox(x, y - 0.3, z - 0.1, 0.36, 0.015, 0.06, 0.012), rcyl(len2(x, z - 0.1), y, 0.025, 0.31, 0.36, 0.01));   // a front and a knob
    } },
  ],
  /**
   * k, the intensity: how far the drawer springs out.
   * 0: ajar · 0.5: open · 1: right out
   */
  step(t, abs, k = 0.5) {
    const reach = byIntensity(k, [0.14, 0.24, 0.32]), back = 1 - sm(2.9, 3.8, t), q = TILL_ORDER.length * sm(0, 1.5, t) * back, n = Math.min(Math.floor(q), TILL_ORDER.length - 1);
    return {
      cabinet: {}, keys: { prm: { j: TILL_ORDER[n], p: q > 0.02 ? Math.round(Math.sin(Math.PI * (q - Math.floor(q))) * 20) / 20 : 0 } },
      flags: { off: [0, 0, 0.12 * sm(1.3, 1.9, t) * back] }, drawer: { off: [0, reach * sm(1.6, 2.2, t) * back, 0] },
    };
  },
};
