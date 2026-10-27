import { len2, roundBox, rcyl } from "../src/math.js";
import { planes } from "../src/slice.js";
import { glassOf } from "../src/glass.js";
import { rocket } from "./rocket.js";
import { camera } from "./camera.js";
import { binoculars } from "./binoculars.js";

/*
 * The rocket, the camera and the binoculars again, as glass: the same figures, with their bodies hollowed to a thin skin
 * (so every slice is drawn twice, outside and in), and with what is inside them showing through. Same cursor mappings, same
 * intensity. This file only says what is solid and what is inside; the hollowing is src/glass.js.
 *
 * It is listed after the figures it is built from (the build puts glass.js after the others).
 */

/** a rocket you can see into: two fuel tanks, a payload in the nose and the motor in the skirt. Fins and flame stay solid. */
export const glassRocket = glassOf(rocket, {
  solid: ["flame"],
  hint: "move up the rocket to launch it",
  inside: [
    { id: "tankLow", box: { x: [-0.3, 0.3], y: [-0.3, 0.3] }, planes: planes(-0.55, -0.12, 0.03), sdf: (x, y, z) => rcyl(len2(x, y), z, 0.17, -0.55, -0.12, 0.04) },
    { id: "tankHigh", box: { x: [-0.3, 0.3], y: [-0.3, 0.3] }, planes: planes(-0.08, 0.3, 0.03), sdf: (x, y, z) => rcyl(len2(x, y), z, 0.17, -0.08, 0.3, 0.04) },
    { id: "payload", box: { x: [-0.2, 0.2], y: [-0.2, 0.2] }, planes: planes(0.46, 0.7, 0.025), sdf: (x, y, z) => Math.hypot(x, y, z - 0.58) - 0.1 },
    { id: "motor", box: { x: [-0.2, 0.2], y: [-0.2, 0.2] }, planes: planes(-0.82, -0.6, 0.025), sdf: (x, y, z) => rcyl(len2(x, y), z, 0.09, -0.82, -0.6, 0.02) },
  ],
  follow: { tankLow: "body", tankHigh: "body", payload: "body", motor: "body" },        // they ride up and shake with the rocket
});

/** a camera you can see into: film spools, the sensor plate, the prism in the hump, and glass elements in the lens that spread out as it zooms */
export const glassCamera = glassOf(camera, {
  hint: "move across the camera to zoom and shoot",
  inside: [
    { id: "spools", box: { x: [-0.72, 0.72], y: [-0.14, 0.14] }, planes: planes(-0.22, 0.22, 0.03),
      sdf: (x, y, z) => Math.min(rcyl(len2(x - 0.5, y), z, 0.075, -0.22, 0.22, 0.02), rcyl(len2(x + 0.52, y), z, 0.075, -0.22, 0.22, 0.02)) },
    { id: "sensor", cell: 0.006, box: { x: [-0.2, 0.4], y: [-0.16, -0.01] }, planes: planes(-0.18, 0.18, 0.02), sdf: (x, y, z) => roundBox(x - 0.1, y + 0.09, z, 0.26, 0.012, 0.15, 0.005) },
    { id: "prism", box: { x: [-0.2, 0.2], y: [-0.2, 0.15] }, planes: planes(0.33, 0.43, 0.02), sdf: (x, y, z) => roundBox(x, y + 0.02, z - 0.38, 0.09, 0.07, 0.04, 0.02) },
    { id: "elements", dynamic: true, cell: 0.01, key: (p) => p.zoom.toFixed(2), box: { x: [-0.2, 0.44], y: [0.04, 1.1] }, planes: planes(-0.2, 0.2, 0.03), sdf: (x, y, z, { zoom }) => {
      const lr = len2(x - 0.12, z), L2 = 0.42 + 0.3 * zoom, gap = Math.max(0.07, (L2 - 0.3) / 2);
      return Math.min(...[0, 1, 2].map((i) => rcyl(lr, y, 0.19, 0.16 + i * gap, 0.2 + i * gap, 0.015)));        // three glass discs, spreading out as the lens extends
    } },
  ],
  drive: (t, abs, k, base) => ({ elements: { prm: { zoom: base.lens.prm.zoom } } }),
});

const tubeInside = (s) => (x, y, z) => {
  const cx = s * 0.36;
  return Math.min(roundBox(x - cx, y + 0.05, z, 0.12, 0.12, 0.12, 0.03), rcyl(len2(x - cx, z), y, 0.26, 0.5, 0.55, 0.01), rcyl(len2(x - cx, z), y, 0.13, -0.62, -0.57, 0.01));
};
/** binoculars you can see into: in each barrel a prism block, the objective lens at the front and the eyepiece lens at the back. The hinge and wheel stay solid. */
export const glassBinoculars = glassOf(binoculars, {
  solid: ["hinge", "wheel"],
  hint: "move across the binoculars to focus and adjust",
  inside: [
    { id: "innerL", cell: 0.007, box: { x: [-0.78, 0.04], y: [-0.8, 0.8] }, planes: planes(-0.3, 0.3, 0.03), sdf: tubeInside(-1) },
    { id: "innerR", cell: 0.007, box: { x: [-0.04, 0.78], y: [-0.8, 0.8] }, planes: planes(-0.3, 0.3, 0.03), sdf: tubeInside(1) },
  ],
  follow: { innerL: "tubeL", innerR: "tubeR" },                                      // each set of glass slides with its barrel
});

/** the figures of the glass page, in the order of its buttons */
export const GLASS = { rocket: glassRocket, camera: glassCamera, binoculars: glassBinoculars };
