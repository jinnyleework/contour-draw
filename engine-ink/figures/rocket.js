import { sdCircle, sdPolygon, intersect, union } from "../src/math.js";
import { driveUp } from "../src/figure.js";

/* The rocket, as a block print: the hull as a pen line with its shadow side hatched, the nose and a band cut solid, a porthole
 * as a black disc with a paper glint, three solid fins, and the flame solid with a paper core. The motion is a
 * placeholder, written fresh for this engine: the rocket lifts off its flame as the cursor rises. */

/** the hull's half-width at height y: full at the base, closing to a point at the nose */
const rocketHalf = (y) => 0.25 * Math.pow(Math.max(0, 1 - Math.pow((y + 0.55) / 1.37, 2.4)), 0.6);
const ROCKET_HULL = (() => {
  const right = [], left = [];
  for (let i = 0; i <= 36; i++) { const y = -0.55 + (1.37 * i) / 36; right.push([rocketHalf(y), y]); left.unshift([-rocketHalf(y), y]); }
  return [...right, ...left];
})();
const rocketHull = (x, y) => sdPolygon(x, y, ROCKET_HULL);
const ROCKET_FIN_L = [[-0.23, -0.12], [-0.46, -0.5], [-0.46, -0.64], [-0.23, -0.5]];
const ROCKET_FIN_R = ROCKET_FIN_L.map(([x, y]) => [-x, y]);
const ROCKET_FLAME = [[-0.15, -0.6], [0.15, -0.6], [0.11, -0.78], [0.03, -0.98], [-0.02, -0.86], [-0.06, -1.04], [-0.12, -0.8]];
const ROCKET_CORE = [[-0.045, -0.62], [0.045, -0.62], [0.02, -0.72], [0, -0.8], [-0.02, -0.72]];

export const rocket = {
  T: 4, active: [0, 2], S: 220, hint: "a rocket",
  drive: driveUp,
  shapes: [
    { id: "flame", box: [-0.25, 0.25, -1.12, -0.5], sdf: (x, y) => sdPolygon(x, y, ROCKET_FLAME) },
    { id: "core", ink: "paper", box: [-0.15, 0.15, -0.95, -0.52], sdf: (x, y) => sdPolygon(x, y, ROCKET_CORE) },
    { id: "shade", mark: "hatch", tone: 0.55, angle: 62, box: [-0.35, 0.35, -0.65, 0.9],
      sdf: (x, y) => intersect(rocketHull(x, y) + 0.015, 0.03 - x) },
    { id: "hull", mark: "line", weight: 1.1, box: [-0.35, 0.35, -0.65, 0.9], sdf: rocketHull },
    { id: "nose", box: [-0.35, 0.35, 0.3, 0.9], sdf: (x, y) => intersect(rocketHull(x, y), 0.5 - y) },
    { id: "band", box: [-0.35, 0.35, -0.42, -0.14], sdf: (x, y) => intersect(rocketHull(x, y), Math.abs(y + 0.28) - 0.05) },
    { id: "fins", box: [-0.56, 0.56, -0.72, -0.04], sdf: (x, y) => union(sdPolygon(x, y, ROCKET_FIN_L), sdPolygon(x, y, ROCKET_FIN_R)) },
    { id: "port", box: [-0.2, 0.2, 0.0, 0.42], sdf: (x, y) => sdCircle(x, y, 0, 0.2, 0.105) },
    { id: "glint", ink: "paper", box: [-0.12, 0.08, 0.12, 0.32], sdf: (x, y) => sdCircle(x, y, -0.03, 0.23, 0.035) },
  ],
  step() {
    return {};                                                            // a still: nothing moves
  },
};
