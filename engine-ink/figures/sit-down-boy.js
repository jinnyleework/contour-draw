import { sdCircle } from "../src/math.js";
import { driveUp } from "../src/figure.js";
import { sminAll, sdTaper, sdEllipseR, curve, stroke, unionOf, makeHead, strokeRows } from "./_dog.js";

/* Sit down boy: a retriever sitting square, head up, looking at us (well, at you). Three heavy strokes drop onto its rump and
 * dust ticks fly out where it lands: the "down" of sit down. A still. */
const GROUND = -0.6;
const H = makeHead({ cx: 0.31, cy: 0.48, deg: 14, s: 0.95 });
const headD = H.d, earD = H.ear;

const torso = (x, y) => sdTaper(x, y, 0.02, 0.06, 0.19, -0.3, -0.26, 0.26);
const chest = (x, y) => sdCircle(x, y, 0.2, -0.0, 0.2);
const neck = (x, y) => sdTaper(x, y, 0.1, 0.12, 0.17, 0.26, 0.36, 0.11);
const hindPaw = (x, y) => sdTaper(x, y, -0.05, -0.55, 0.065, 0.12, -0.565, 0.05);
const haunch = (x, y) => sdCircle(x, y, -0.33, -0.34, 0.26);
const legNear = (x, y) => sdTaper(x, y, 0.24, -0.1, 0.09, 0.285, -0.52, 0.058);
const pawNear = (x, y) => sdEllipseR(x, y, 0.36, -0.57, 0.105, 0.045, 0);
const legFar = (x, y) => sdTaper(x, y, 0.4, -0.1, 0.07, 0.44, -0.52, 0.052);
const pawFar = (x, y) => sdEllipseR(x, y, 0.53, -0.57, 0.09, 0.04, 0);
const tail = (x, y) => Math.min(sdTaper(x, y, -0.52, -0.47, 0.055, -0.66, -0.56, 0.045), sdTaper(x, y, -0.66, -0.56, 0.045, -0.74, -0.58, 0.02));

const bodyD = (x, y) => sminAll([torso(x, y), chest(x, y), neck(x, y), haunch(x, y), headD(x, y), legNear(x, y), pawNear(x, y), hindPaw(x, y), tail(x, y)], 0.07);
const dogD = (x, y) => Math.min(bodyD(x, y), earD(x, y), legFar(x, y), pawFar(x, y));

/* the cuts: paper strokes laid by hand along the coat's flow */
const arc = (cx, cy, r, a0, a1, w, n = 10) => stroke(Array.from({ length: n + 1 }, (_, i) => { const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }), w);
const gouges = unionOf([
  stroke(curve([[-0.42, -0.12], [-0.26, 0.01], [-0.05, 0.18], [0.1, 0.29]]), 0.055),                       // the back, lit
  stroke(curve([[-0.42, -0.25], [-0.2, -0.06], [0.0, 0.08]]), 0.045),
  arc(-0.33, -0.34, 0.2, 105, 175, 0.05), arc(-0.33, -0.34, 0.125, 100, 170, 0.04),                     // the haunch
  stroke(curve([[0.0, -0.18], [-0.05, -0.34], [-0.02, -0.5]]), 0.016, (t) => Math.pow(Math.sin(Math.PI * t), 0.5)),   // the thigh's front edge
  arc(0.2, 0.0, 0.13, 30, 110, 0.045, 8), arc(0.2, 0.0, 0.07, 120, 200, 0.035, 8),                          // the chest's ruff
  stroke([[0.15, -0.24], [0.19, -0.4]], 0.014),                                                           // the elbow
  stroke(curve([[0.19, -0.04], [0.2, -0.25], [0.23, -0.47]]), 0.04),                                     // the near leg, lit
  stroke(curve([[0.1, 0.14], [0.2, 0.28]]), 0.04),                                                       // the neck
]);
const dogInk = (x, y) => {
  const body = Math.max(Math.min(bodyD(x, y), legFar(x, y), pawFar(x, y)), -Math.min(gouges(x, y), H.cut(x, y)));
  return Math.min(body, earD(x, y), H.ink(x, y));
};

/** the ground: rows of tapered strokes, ending of their own accord, with a paper halo round the dog */
const groundD = strokeRows([[-0.72, 0.68, -0.675, 0.34, 0.017], [-0.6, 0.55, -0.745, 0.27, 0.014], [-0.4, 0.38, -0.805, 0.2, 0.011]], { seed: 11, keepBelow: 0.15 });
const ground = (x, y) => Math.max(groundD(x, y), -(dogD(x, y) - 0.035));

/** speed lines dropping out of the air onto the rump: long, thin, tapering at both ends */
const fall = (x, top, bot, w) => stroke([[x, top], [x + 0.004, (top + bot) / 2], [x, bot]], w, (t) => Math.pow(Math.sin(Math.PI * t), 0.55));
const dropping = unionOf([fall(-0.6, 0.5, 0.0, 0.034), fall(-0.51, 0.62, 0.1, 0.04), fall(-0.42, 0.68, 0.2, 0.044), fall(-0.33, 0.72, 0.3, 0.04), fall(-0.24, 0.66, 0.38, 0.034)]);

const DOG_BOX = [-0.85, 0.85, -0.86, 0.86];
export const sitDownBoy = {
  T: 4, active: [0, 1], S: 300, frame: [474, 500], hint: "sit down boy",
  drive: driveUp,
  shapes: [
    { id: "ground", box: DOG_BOX, sdf: ground },
    { id: "dropping", box: DOG_BOX, sdf: dropping },
    { id: "dog", box: DOG_BOX, sdf: dogInk },
  ],
  step() {
    return {};                                                            // a still: nothing moves
  },
};
