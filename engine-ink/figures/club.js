import { suitClub } from "./_suit.js";
import { driveUp } from "../src/figure.js";

/* The club suit: three balls on a flared foot, solid (figures/_suit.js). A still. */
export const club = {
  T: 4, active: [0, 1], S: 180, hint: "club",
  drive: driveUp,
  shapes: [{ id: "club", box: [-0.85, 0.85, -0.9, 0.9], sdf: suitClub }],
  step() {
    return {};                                                            // a still: nothing moves
  },
};
