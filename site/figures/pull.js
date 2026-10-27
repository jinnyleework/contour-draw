import { planes } from "../../engine/src/slice.js";

/*
 * The site's light pull, drawn on the contour engine: a ceiling rose, and a pendant turned from one profile (the end
 * knob, the cup, the ceramic grip tapering to its neck, and the cap), each cut into slices like every other figure.
 * site/build.mjs paints them once, at rest, into assets/pull.js; the chain between them and the motion are the page's
 * (assets/theme.js), since the pull is the site's own switch and not a figure in the library.
 *
 * Both are drawn small, so they are cut wider apart than a figure (a slice every few pixels, not every one).
 */

/** a turned solid: the radius at each height, from a profile of [radius, height] points running upward */
const pullLathe = (profile) => {
  const top = profile.at(-1)[1], bottom = profile[0][1];
  const r = (z) => {
    for (let i = 1; i < profile.length; i++) {
      const [r0, z0] = profile[i - 1], [r1, z1] = profile[i];
      if (z <= z1) return r0 + ((r1 - r0) * (z - z0)) / (z1 - z0 || 1);
    }
    return 0;
  };
  return (x, y, z) => (z < bottom || z > top ? 1 : Math.hypot(x, y) - r(z));
};

// the original pull's profile (draw-engine's lightpull.js), in its units, scaled down to the engine's: 20 to 1
const PULL_UNIT = 1 / 20;
const pullProfile = [[0.6, 0], [1.3, 0.35], [2, 1.3], [2, 2.2], [1.5, 3], [1.2, 3.3], [3.2, 4.4], [4.2, 6.4], [4.2, 7.4], [6.6, 8.2], [7.6, 10.2], [7.4, 11.6], [1.5, 28], [2.5, 28.4], [2.5, 30.3], [1.9, 31.1], [0.9, 31.6]]
  .map(([r, z]) => [r * PULL_UNIT, z * PULL_UNIT]);
export const PULL_HEIGHT = 31.6 * PULL_UNIT;

const pullScene = (part, zr, S, zm) => ({ T: 1, active: [0, 0], drive: () => 0, hint: "", zr, S, zm, parts: [part], step: () => ({}) });

/** the pendant, knob at the bottom (z 0) to cap at the top */
export const pullPendant = pullScene(
  { id: "pendant", order: 0, box: { x: [-0.5, 0.5], y: [-0.5, 0.5] }, cell: 0.008, planes: planes(0.004, PULL_HEIGHT - 0.004, 0.075), sdf: pullLathe(pullProfile) },
  [0, PULL_HEIGHT], 300, PULL_HEIGHT / 2,
);

/** the ceiling rose the chain hangs from: a shallow dome against the ceiling, wide at the top */
export const pullRose = pullScene(
  { id: "rose", order: 0, box: { x: [-0.5, 0.5], y: [-0.5, 0.5] }, cell: 0.008, planes: planes(0.004, 0.16, 0.05), sdf: pullLathe([[0.08, 0], [0.26, 0.05], [0.36, 0.11], [0.36, 0.16]]) },
  [0, 0.16], 300, 0.08,
);
