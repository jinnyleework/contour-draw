import { len2, rcyl, roundBox, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A gear train: four spur gears of different sizes meshed together on a plate, each on its own axle, the larger ones
 * with round holes through their webs. Move across it and the largest gear turns, and the others turn with it, each
 * at its own speed and in the right direction, tooth in gap. At rest they are still. The plate and axles are cut once;
 * the gears are cut again as they turn.
 */
const GEAR_M = 0.015;                                                    // the module: a gear's pitch radius is its tooth count times this
/** each gear: its tooth count, and which gear it meshes with and at what angle from that gear's middle */
const GEARS = (() => {
  const list = [{ n: 16, x: 0, y: 0 }], add = (n, from, beta) => {
    const f = list[from], dist = (f.n + n) * GEAR_M;
    list.push({ n, x: f.x + dist * Math.cos(beta), y: f.y + dist * Math.sin(beta), from, beta });
  };
  add(10, 0, -0.35); add(12, 1, 0.95); add(8, 0, 2.6);
  const cx = list.reduce((s, g) => s + g.x, 0) / list.length, cy = list.reduce((s, g) => s + g.y, 0) / list.length;
  return list.map((g) => ({ ...g, x: g.x - cx, y: g.y - cy }));        // centred on the page
})();

/** every gear's turn, from the first gear's turn: each meshing gear turns the other way, tooth in gap at the contact */
const gearTurns = (phi0) => {
  const out = [phi0];
  for (let k = 1; k < GEARS.length; k++) {
    const g = GEARS[k], f = GEARS[g.from];
    out.push(g.beta + Math.PI - Math.PI / g.n + (f.n / g.n) * (g.beta - out[g.from]));
  }
  return out;
};

export const gearTrain = {
  T: 4, zr: [-0.08, 0.12], S: 380, zm: 0.02,
  active: [0, 2.4],                                              // the gears turn; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 130) / 340, 0, 1),                    // across the gears
  hint: "move across the gears to turn them",
  parts: [
    { id: "plate", order: 0, box: { x: [-0.75, 0.75], y: [-0.65, 0.65] }, planes: planes(-0.08, 0.12, 0.012), sdf: (x, y, z) => {
      let d = roundBox(x, y, z + 0.055, 0.6, 0.48, 0.012, 0.02);                                                   // a flat plate
      for (const g of GEARS) d = Math.min(d, rcyl(len2(x - g.x, y - g.y), z, 0.028, -0.04, 0.1, 0.01));            // an axle for each gear
      return d;
    } },
    { id: "gears", order: 1, dynamic: true, cell: 0.011, key: (p) => p.phi.toFixed(3), box: { x: [-0.7, 0.7], y: [-0.6, 0.6] }, planes: planes(-0.005, 0.075, 0.012), sdf: (x, y, z, { phi }) => {
      const turns = gearTurns(phi);
      let d = 1;
      GEARS.forEach((g, k) => {
        const dx = x - g.x, dy = y - g.y, r = len2(dx, dy), R = g.n * GEAR_M;
        if (r > R + 0.04) return;                                                                                 // too far from this gear to matter
        const th = Math.atan2(dy, dx) - turns[k], tooth = R + 0.022 * clamp(2.2 * Math.cos(g.n * th), -1, 1);       // square-ish teeth round the pitch circle
        let gd = Math.max(r - tooth, 0.035 - r, Math.abs(z - 0.035) - 0.03);                                     // a toothed disc with a bore for the axle
        if (g.n >= 12) for (let h = 0; h < 4; h++) {                                                              // round holes through the larger webs, turning with them
          const ha = turns[k] + (h * Math.PI) / 2 + Math.PI / 4, hr = R * 0.55;
          gd = Math.max(gd, -(len2(dx - hr * Math.cos(ha), dy - hr * Math.sin(ha)) - R * 0.2));
        }
        d = Math.min(d, gd);
      });
      return d;
    } },
  ],
  /**
   * k, the intensity: how far the largest gear turns.
   * 0: half a turn · 0.5: one turn · 1: two turns
   */
  step(t, abs, k = 0.5) {
    const turns = byIntensity(k, [0.5, 1, 2]), e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t));
    return { plate: {}, gears: { prm: { phi: Math.round(turns * 2 * Math.PI * e * 200) / 200 } } };
  },
};
