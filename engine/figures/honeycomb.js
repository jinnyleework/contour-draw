import { clamp, byIntensity, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A patch of nineteen hexagonal cells, thin walls round each, in the shape of a larger hexagon. Move across it and the
 * cells fill with honey in a wave from the left, each cell rising to a domed surface a little after its neighbour.
 * At rest every cell is empty. The walls are cut once; the honey is cut again as the wave crosses.
 */
const COMB = 0.14;                                                       // the apothem of a cell: half the distance from one cell's middle to the next

/** the middle of the cell nearest a point, and whether that cell is in the patch: a flat-top hexagon grid, found by rounding in cube coordinates */
const combCell = (x, y) => {
  const fq = x / (1.732 * COMB), fr = (y - fq * COMB) / (2 * COMB), fs = -fq - fr;
  let q = Math.round(fq), r = Math.round(fr), s = Math.round(fs);
  const dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  return { cx: q * 1.732 * COMB, cy: (q + 2 * r) * COMB, in: Math.max(Math.abs(q), Math.abs(r), Math.abs(-q - r)) <= 2 };
};
const combNorm = (x, y) => Math.max(Math.abs(y), 0.866 * Math.abs(x) + 0.5 * Math.abs(y));   // distance to a hexagon's edge (its apothem is the value where the edge is)

export const honeycomb = {
  T: 4, zr: [0, 0.27], S: 300, zm: 0.1,
  active: [0, 2.2],                                              // the honey wave crosses; the pose at 0 is the rest pose, empty
  drive: (x) => clamp((x - 130) / 340, 0, 1),                    // across the comb
  hint: "move across the comb to fill its cells",
  parts: [
    { id: "walls", order: 0, cell: 0.01, box: { x: [-0.85, 0.85], y: [-0.85, 0.85] }, planes: planes(0, 0.25, 0.02), sdf: (x, y) => {
      const c = combCell(x, y), n = combNorm(x - c.cx, y - c.cy);
      return c.in ? Math.max(n - COMB, COMB - 0.035 - n) : 1;                                                     // a thin hexagonal wall round every cell
    } },
    { id: "honey", order: 1, dynamic: true, cell: 0.014, key: (p) => p.e.toFixed(2) + ":" + p.h.toFixed(2), box: { x: [-0.85, 0.85], y: [-0.85, 0.85] }, planes: planes(0.02, 0.24, 0.015), sdf: (x, y, z, { e, h }) => {
      const c = combCell(x, y);
      if (!c.in) return 1;
      const n = combNorm(x - c.cx, y - c.cy), fill = clamp(e * 1.7 - (c.cx + 0.7) / 1.4, 0, 1);                    // how full this cell is: the wave reaches the left first
      return Math.max(n - (COMB - 0.04), z - (0.025 + h * fill * (1 - 0.5 * Math.pow(n / COMB, 2))), 0.015 - z);    // honey to a domed surface, a little below the walls
    } },
  ],
  /**
   * k, the intensity: how high the honey rises in each cell.
   * 0: a third of the wall · 0.5: nearly two thirds · 1: almost to the brim
   */
  step(t, abs, k = 0.5) {
    const high = byIntensity(k, [0.08, 0.15, 0.21]), e = sm(0, 2.2, t) * (1 - sm(2.9, 3.8, t));
    return { walls: {}, honey: { prm: e > 0.1 ? { e: Math.round(e * 40) / 40, h: high } : null } };
  },
};
