import { len2, subtract, roundBox, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A mixing desk: a flat console with eight channels, each a long slot with a fader cap in it and three knobs above,
 * and a row of level meters along the back. Move across it and the faders slide up in a wave from left to right,
 * each to its own level, the knobs turn, and the meters climb. At rest the faders are down and the meters dark. The
 * console is cut once; the fader caps are rigid and only slide; the knobs and meters are cut again as they change.
 */
const DESK_CH = 8, deskX = (c) => -0.49 + 0.14 * c, DESK_TOP = 0.1;     // how many channels, where each one is, and the console's top
const deskLevel = (c) => 0.55 + 0.45 * Math.sin(c * 0.9 + 0.6);           // how far up channel c's fader goes, as a share of its travel

export const mixingDesk = {
  T: 4, zr: [0, 0.2], S: 400, zm: 0.06,
  active: [0, 2.4],                                              // the faders come up in a wave; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 130) / 340, 0, 1),                    // across the desk
  hint: "move across the desk to bring the faders up",
  parts: [
    { id: "console", order: 0, cell: 0.007, box: { x: [-0.72, 0.72], y: [-0.5, 0.5] }, planes: planes(0, DESK_TOP, 0.012), sdf: (x, y, z) => {
      let d = roundBox(x, y, z - DESK_TOP / 2, 0.6, 0.38, DESK_TOP / 2 - 0.02, 0.02);
      for (let c = 0; c < DESK_CH; c++) d = subtract(d, Math.max(Math.abs(x - deskX(c)) - 0.012, Math.abs(y - 0.13) - 0.17, 0.06 - z));   // a fader slot for each channel
      return subtract(d, Math.max(Math.abs(x) - 0.56, Math.abs(y + 0.33) - 0.03, 0.07 - z));                          // and a recess for the meters
    } },
    ...Array.from({ length: DESK_CH }, (_, c) => ({ id: "fader" + c, order: 1 + c, cell: 0.006, box: { x: [deskX(c) - 0.06, deskX(c) + 0.06], y: [0.2, 0.32] }, planes: planes(0.07, 0.15, 0.01),
      sdf: (x, y, z) => Math.min(roundBox(x - deskX(c), y - 0.26, z - 0.125, 0.032, 0.012, 0.015, 0.01), rcyl(len2(x - deskX(c), y - 0.26), z, 0.008, 0.07, 0.12, 0)) })),   // a cap on a stem in its slot
    { id: "knobs", order: 10, dynamic: true, cell: 0.005, key: (p) => p.e.toFixed(2), box: { x: [-0.58, 0.58], y: [-0.36, -0.03] }, planes: planes(0.07, 0.15, 0.01), sdf: (x, y, z, { e }) => {
      const c = clamp(Math.round((x + 0.49) / 0.14), 0, DESK_CH - 1), cx = deskX(c);
      if (y < -0.28) {                                                                                                  // a meter: a column of cells, lit up to its level
        const lit = Math.round(6 * deskLevel(c) * e), cell = clamp(Math.round((x - cx + 0.05) / 0.02), 0, 5);
        return cell < lit ? Math.max(roundBox(x - cx - (cell * 0.02 - 0.05), y + 0.33, z - 0.085, 0.006, 0.02, 0.012, 0.003), 0) : 1;
      }
      const row = clamp(Math.round((-0.08 - y) / 0.07), 0, 2), ky = -0.08 - 0.07 * row, a = -2.2 + 2.6 * e * (0.4 + 0.3 * row + 0.1 * (c % 3));
      const rr = len2(x - cx, y - ky), ux = Math.cos(a), uy = Math.sin(a), along = (x - cx) * ux + (y - ky) * uy, across = -(x - cx) * uy + (y - ky) * ux;
      const knob = rcyl(rr, z, 0.026, DESK_TOP - 0.01, DESK_TOP + 0.04, 0.01);
      return Math.min(knob, Math.max(Math.abs(across) - 0.006, Math.abs(along - 0.012) - 0.014, Math.abs(z - DESK_TOP - 0.045) - 0.006));   // and a pointer on top, turned to its setting
    } },
  ],
  /**
   * k, the intensity: how far the faders travel.
   * 0: a third of the way · 0.5: well up · 1: right to the top of their slots
   */
  step(t, abs, k = 0.5) {
    const travel = byIntensity(k, [0.1, 0.2, 0.28]), back = 1 - sm(2.9, 3.8, t), out = {};
    for (let c = 0; c < DESK_CH; c++) out["fader" + c] = { off: [0, -travel * deskLevel(c) * sm(0.15 * c, 0.15 * c + 1.2, t) * back, 0] };
    out.console = {}; out.knobs = { prm: { e: Math.round(sm(0, 2.4, t) * back * 40) / 40 } };
    return out;
  },
};
