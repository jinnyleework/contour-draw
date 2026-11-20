import { sdCircle, sdBox, sdPolygon, sdPath, sdSegment, union, intersect } from "../src/math.js";
import { driveUp } from "../src/figure.js";

/* The lightbulb, as a pen drawing: the glass a thin pen line with a light hatch on its shadow side, the filament a fine line
 * inside it, held on two wires, and the screw base cut solid with its threads carved out in paper. A still. */
const lightbulbGlass = (x, y) => union(sdCircle(x, y, 0, 0.26, 0.44), sdPolygon(x, y, [[-0.3, -0.05], [0.3, -0.05], [0.17, -0.34], [-0.17, -0.34]]));
const LIGHTBULB_FILAMENT = [[-0.14, 0.18], [-0.1, 0.27], [-0.05, 0.18], [0, 0.27], [0.05, 0.18], [0.1, 0.27], [0.14, 0.18]];
const LIGHTBULB_THREADS = [-0.4, -0.48, -0.56];

export const lightbulb = {
  T: 4, active: [0, 2], S: 230, hint: "a lightbulb",
  drive: driveUp,
  shapes: [
    { id: "shade", mark: "hatch", tone: 0.3, angle: -35, box: [-0.55, 0.55, -0.45, 0.8],
      sdf: (x, y) => intersect(lightbulbGlass(x, y) + 0.02, -sdCircle(x, y, -0.12, 0.36, 0.42)) },
    { id: "glass", mark: "line", weight: 0.8, box: [-0.55, 0.55, -0.45, 0.8], sdf: lightbulbGlass },
    { id: "glint", mark: "line", weight: 0.7, box: [-0.4, 0, 0.1, 0.6],
      sdf: (x, y) => intersect(Math.abs(sdCircle(x, y, 0, 0.26, 0.33)), Math.max(x + 0.12, 0.3 - y)) },
    { id: "filament", box: [-0.25, 0.25, -0.3, 0.38],
      sdf: (x, y) => union(sdPath(x, y, LIGHTBULB_FILAMENT, 0.016), Math.min(sdSegment(x, y, -0.14, 0.18, -0.06, -0.2), sdSegment(x, y, 0.14, 0.18, 0.06, -0.2)) - 0.009) },
    { id: "base", box: [-0.3, 0.3, -0.75, -0.25], sdf: (x, y) => sdBox(x, y, 0, -0.47, 0.18, 0.15, 0.03) },
    { id: "threads", ink: "paper", box: [-0.3, 0.3, -0.7, -0.3],
      sdf: (x, y) => LIGHTBULB_THREADS.reduce((d, ty) => Math.min(d, sdSegment(x, y, -0.13, ty - 0.025, 0.13, ty + 0.025) - 0.012), 1) },
    { id: "tip", box: [-0.15, 0.15, -0.8, -0.58], sdf: (x, y) => sdBox(x, y, 0, -0.66, 0.07, 0.04, 0.03) },
  ],
  step() {
    return {};                                                            // a still: nothing moves
  },
};
