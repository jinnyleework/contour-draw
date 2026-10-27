import { len2, roundBox, rcyl, smin, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A sewing machine: a flat bed, a pillar on the right, an arm across the top to a head on the left, a spool of thread
 * on the arm and a handwheel on the right end. Under the head a needle hangs over a strip of cloth with a seam already
 * stitched along it. Move across it and it sews: the needle pumps down through the cloth and up again, the cloth feeds
 * to the left a stitch at a time, and the handwheel turns. At rest the needle is up. The machine is cut once; the
 * needle and the cloth are rigid and only move; the handwheel is cut again as it turns.
 */
const SEW_NEEDLE_X = -0.42, SEW_BED = 0.08;                              // where the needle comes down, and the top of the bed

export const sewingMachine = {
  T: 4, zr: [0, 0.74], S: 360, zm: 0.3,
  active: [0, 2.4],                                              // it sews a run of stitches; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 130) / 340, 0, 1),                    // across the machine
  hint: "move across the machine to sew",
  parts: [
    { id: "machine", order: 0, cell: 0.009, box: { x: [-0.75, 0.75], y: [-0.4, 0.4] }, planes: planes(0, 0.74, 0.015), sdf: (x, y, z) => {
      let d = roundBox(x, y, z - SEW_BED / 2, 0.58, 0.24, SEW_BED / 2 - 0.015, 0.015);                                 // the bed
      d = smin(d, roundBox(x - 0.42, y, z - 0.3, 0.08, 0.1, 0.24, 0.04), 0.04);                                       // the pillar
      d = smin(d, roundBox(x, y, z - 0.52, 0.42, 0.07, 0.06, 0.05), 0.05);                                            // the arm
      d = smin(d, roundBox(x - SEW_NEEDLE_X, y, z - 0.44, 0.06, 0.08, 0.15, 0.04), 0.04);                              // the head
      d = Math.min(d, rcyl(len2(x - 0.05, y), z, 0.012, 0.6, 0.74, 0.004), rcyl(len2(x - 0.05, y), z, 0.05, 0.62, 0.7, 0.012));   // a spool on its pin
      return Math.min(d, roundBox(x - SEW_NEEDLE_X - 0.03, y, z - 0.105, 0.04, 0.04, 0.008, 0.006));                   // the presser foot
    } },
    { id: "needle", order: 1, cell: 0.005, box: { x: [SEW_NEEDLE_X - 0.05, SEW_NEEDLE_X + 0.05], y: [-0.05, 0.05] }, planes: planes(0.1, 0.32, 0.008), sdf: (x, y, z) =>
      rcyl(len2(x - SEW_NEEDLE_X, y), z, 0.012 - 0.006 * clamp((0.2 - z) / 0.09, 0, 1), 0.11, 0.31, 0.004) },        // a needle, fine at its point
    { id: "cloth", order: 2, cell: 0.008, box: { x: [-0.75, 0.75], y: [-0.25, 0.25] }, planes: planes(SEW_BED, SEW_BED + 0.024, 0.008), sdf: (x, y, z) => {
      const sheet = Math.max(Math.abs(x + 0.05) - 0.5, Math.abs(y) - 0.16, Math.abs(z - SEW_BED - 0.006) - 0.005);   // a strip of cloth on the bed
      const stitch = ((((x + 0.05) % 0.06) + 0.06) % 0.06) - 0.03;                                                      // a stitch every 0.06, already sewn to the right of the needle
      return Math.min(sheet, Math.max(Math.abs(stitch) - 0.018, Math.abs(y) - 0.008, Math.abs(z - SEW_BED - 0.016) - 0.005, SEW_NEEDLE_X + 0.04 - x, x - 0.45));
    } },
    { id: "wheel", order: 3, dynamic: true, cell: 0.008, key: (p) => p.ph.toFixed(2), box: { x: [0.45, 0.68], y: [-0.22, 0.22] }, planes: planes(0.32, 0.68, 0.012), sdf: (x, y, z, { ph }) => {
      const r = len2(y, z - 0.5), th = Math.atan2(z - 0.5, y) + ph;
      return rcyl(r, x, 0.14 + 0.01 * Math.cos(12 * th), 0.5, 0.6, 0.02);                                             // a knurled handwheel on the end
    } },
  ],
  /**
   * k, the intensity: how many stitches it sews.
   * 0: three · 0.5: six · 1: ten
   */
  step(t, abs, k = 0.5) {
    const stitches = Math.round(byIntensity(k, [3, 6, 10])), e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t)), q = stitches * e;
    return {
      machine: {}, needle: { off: [0, 0, -0.075 * (0.5 - 0.5 * Math.cos(2 * Math.PI * q))] }, cloth: { off: [-0.06 * q, 0, 0] },
      wheel: { prm: { ph: Math.round(2 * Math.PI * q * 25) / 25 } },
    };
  },
};
