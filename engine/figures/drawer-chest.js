import { len2, subtract, roundBox, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

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

export const drawerChest = {
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
