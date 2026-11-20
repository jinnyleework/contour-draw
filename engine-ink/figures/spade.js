import { suitSpade } from "./_suit.js";
import { driveUp } from "../src/figure.js";

/* The spade suit: an upturned heart on a Didot-like foot, solid (figures/_suit.js). A still. */
export const spade = {
  T: 4, active: [0, 1], S: 180, hint: "spade",
  drive: driveUp,
  shapes: [{ id: "spade", box: [-0.9, 0.9, -0.88, 0.9], sdf: suitSpade }],
  step() {
    return {};                                                            // a still: nothing moves
  },
};
