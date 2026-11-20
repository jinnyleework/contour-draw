import { sdBox, subtract } from "../src/math.js";
import { driveUp } from "../src/figure.js";

/* The tile stack: five flat tiles in a column, each inked a different way, so one look is tried on many repeated flat cells
 * with sharp corners: a solid with a paper frame cut in, a pen outline over a hatch, a dense hatch, an outline alone, and a
 * solid with a paper square. A still. */
const TILE_STACK_Y = [-0.62, -0.31, 0, 0.31, 0.62];
const TILE_STACK_X = [0.02, -0.04, 0.03, -0.02, 0.04];
const tileStackBox = (i) => [TILE_STACK_X[i] - 0.48, TILE_STACK_X[i] + 0.48, TILE_STACK_Y[i] - 0.2, TILE_STACK_Y[i] + 0.2];
const tileStackTile = (i, inset = 0) => (x, y) => sdBox(x, y, TILE_STACK_X[i], TILE_STACK_Y[i], 0.38 - inset, 0.12 - inset, 0.015);

export const tileStack = {
  T: 4, active: [0, 2], S: 230, hint: "a stack of tiles",
  drive: driveUp,
  shapes: [
    { id: "t0", box: tileStackBox(0), sdf: tileStackTile(0) },
    { id: "t0-frame", ink: "paper", box: tileStackBox(0), sdf: (x, y) => subtract(tileStackTile(0, 0.04)(x, y), tileStackTile(0, 0.065)(x, y)) },
    { id: "t1-shade", mark: "hatch", tone: 0.6, angle: 50, box: tileStackBox(1), sdf: tileStackTile(1, 0.01) },
    { id: "t1", mark: "line", box: tileStackBox(1), sdf: tileStackTile(1) },
    { id: "t2-shade", mark: "hatch", tone: 0.85, angle: -40, box: tileStackBox(2), sdf: tileStackTile(2, 0.01) },
    { id: "t2", mark: "line", box: tileStackBox(2), sdf: tileStackTile(2) },
    { id: "t3", mark: "line", box: tileStackBox(3), sdf: tileStackTile(3) },
    { id: "t4", box: tileStackBox(4), sdf: tileStackTile(4) },
    { id: "t4-mark", ink: "paper", box: tileStackBox(4), sdf: (x, y) => sdBox(x, y, TILE_STACK_X[4], TILE_STACK_Y[4], 0.05, 0.05, 0.005) },
  ],
  step() {
    return {};                                                            // a still: nothing moves
  },
};
