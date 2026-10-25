import { len2, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A toy gyroscope: a heavy rotor, with a ring of round cut-outs, on a long axle whose pointed foot rests in a cup on a
 * plinth. Move across it and the rotor spins up while the axle leans over and sweeps round the cup, precessing as a
 * real one does. At rest it stands upright and still. The plinth is cut once; the rotor, leaning and spinning, is cut
 * again as it moves.
 */
const gyroHole = (x, y) => {                                              // six round cut-outs ringing the rotor, turning with it
  const k = (Math.round((Math.atan2(y, x) * 6) / (2 * Math.PI)) * (2 * Math.PI)) / 6;
  return Math.hypot(x - 0.24 * Math.cos(k), y - 0.24 * Math.sin(k)) - 0.065;
};

/** the rotor and axle in the frame of the leaning toy: `th` is the lean, `psi` the way it leans, `ph` the spin */
const gyroRotor = (x, y, z, { th, psi, ph }) => {
  const al = x * Math.cos(psi) + y * Math.sin(psi), pe = -x * Math.sin(psi) + y * Math.cos(psi);
  const a = al * Math.cos(th) - z * Math.sin(th), lz = al * Math.sin(th) + z * Math.cos(th);               // the point seen from the toy's own upright frame
  const lx = a * Math.cos(psi) - pe * Math.sin(psi), ly = a * Math.sin(psi) + pe * Math.cos(psi);
  const c = Math.cos(ph), s = Math.sin(ph), ux = lx * c + ly * s, uy = -lx * s + ly * c, r = len2(ux, uy);   // and turned by the spin
  const disc = Math.max(rcyl(r, lz, 0.4, 0.31, 0.39, 0.025), -gyroHole(ux, uy));
  const axle = Math.max(r - 0.04, lz - 0.52, -lz);
  return Math.min(disc, axle, rcyl(r, lz, 0.06, 0.28, 0.42, 0.01));                                       // a disc with cut-outs, an axle through it, a hub
};

export const gyroscope = {
  T: 4, zr: [-0.3, 0.9], S: 260, zm: 0.3,
  active: [0, 2.4],                                              // the rotor spins up and the axle leans and sweeps; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 150) / 300, 0, 1),                    // across the gyroscope
  hint: "move across the gyroscope to spin it up",
  parts: [
    { id: "plinth", order: 0, box: { x: [-0.6, 0.6], y: [-0.6, 0.6] }, planes: planes(-0.3, 0.02, 0.02), sdf: (x, y, z) => {
      const r = len2(x, y);
      return Math.min(rcyl(r, z, 0.5, -0.3, -0.2, 0.03), rcyl(r, z, 0.05, -0.2, -0.06, 0.01), rcyl(r, z, 0.1, -0.08, 0.0, 0.015),   // a round plinth, a stem, a cup
        Math.max(Math.abs(r - 0.4) - 0.02, Math.abs(z + 0.17) - 0.03));                                                               // and a raised ring on the plinth
    } },
    { id: "rotor", order: 1, dynamic: true, cell: 0.022, key: (p) => p.th.toFixed(2) + ":" + p.psi.toFixed(2) + ":" + p.ph.toFixed(2), box: { x: [-0.65, 0.65], y: [-0.65, 0.65] }, planes: planes(0, 0.9, 0.022), sdf: gyroRotor },
  ],
  /**
   * k, the intensity: how far the axle leans as it spins.
   * 0: a slight lean · 0.5: a clear one · 1: well over
   */
  step(t, abs, k = 0.5) {
    const lean = byIntensity(k, [0.18, 0.35, 0.55]), e = sm(0, 1.4, t) * (1 - sm(2.9, 3.8, t)), q = (v) => Math.round(v / 0.05) * 0.05;
    return { plinth: {}, rotor: { prm: { th: q(lean * e), psi: q(2 * Math.PI * 1.5 * sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t))), ph: q(10 * Math.PI * sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t))) } } };
  },
};
