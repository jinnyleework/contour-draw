import { suitDiamond } from "./_suit.js";
import { driveUp } from "../src/figure.js";

/* The diamond suit: four bowed sides, solid (figures/_suit.js). A still. */
export const diamond = {
  T: 4, active: [0, 1], S: 180, hint: "diamond",
  drive: driveUp,
  shapes: [{ id: "diamond", box: [-0.75, 0.75, -0.95, 0.95], sdf: suitDiamond }],
  step() {
    return {};                                                            // a still: nothing moves
  },
};
