import { suitHeart } from "./_suit.js";
import { driveUp } from "../src/figure.js";

/* The heart suit: one solid heart (figures/_suit.js). A still. */
export const heart = {
  T: 4, active: [0, 1], S: 180, hint: "heart",
  drive: driveUp,
  shapes: [{ id: "heart", box: [-0.9, 0.9, -0.85, 0.85], sdf: suitHeart }],
  step() {
    return {};                                                            // a still: nothing moves
  },
};
