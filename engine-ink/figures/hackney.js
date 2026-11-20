import { sdCircle, sdBox, sdPolygon, sdPath, sdSegment, hash2, noise2 } from "../src/math.js";
import { driveUp } from "../src/figure.js";
import { bitmapSdf } from "../src/ink.js";
import { _hackneySign } from "./_hackney-sign.js";
import { _hackneyCrowd } from "./_hackney-crowd.js";

/*
 * Hackney Church Brew Co: the railway arch, drawn by hand from the photo (reference/hackney.webp) as a woodcut, for a card's
 * 474 x 500 picture box, ending inside it as the dive does (the wall on whole bricks, the crowd on a ragged edge), never cut
 * flat by the frame. The arch is completed (the photo crops its top): a ring of voussoirs in a black brick wall with paper
 * mortar cut in. Inside it the steel glazing (fine bars over plain paper glass, so the sign and doorway lead), the open double
 * doors and the dark bar beyond, its hanging lights as paper dots.
 * The sign's lettering is traced from the photo itself, its stencil capitals as they are painted. In front, the beer-hall tables
 * and the crowd, traced from the photo as one strip, cropped by the frame. A still.
 */
const HACKNEY_GROUND = -0.85, HACKNEY_SPRING = 0.0, HACKNEY_R = 0.78, HACKNEY_RING = 0.12;
const HACKNEY_DOOR = 0.2, HACKNEY_DOOR_TOP = 0.1;

/** the glazed opening: the round-topped arch down to the ground */
const hackneyOpening = (x, y) => {
  const side = Math.max(Math.abs(x) - HACKNEY_R, HACKNEY_GROUND - y, y - HACKNEY_SPRING);
  return Math.min(side, Math.max(Math.hypot(x, y - HACKNEY_SPRING) - HACKNEY_R, HACKNEY_SPRING - y));
};
const hackneyDoor = (x, y) => sdBox(x, y, 0, (HACKNEY_GROUND + HACKNEY_DOOR_TOP) / 2, HACKNEY_DOOR, (HACKNEY_DOOR_TOP - HACKNEY_GROUND) / 2);

/* ---------- the sign: traced from the photo's own lettering (figures/_hackney-sign.js), laid in above the door ---------- */
const HACKNEY_SIGN = { area: [-0.37, 0.37, 0.175, 0.627], mask: _hackneySign.shapes[0].bitmap.mask };
const hackneySign = (x, y) => bitmapSdf(HACKNEY_SIGN)(x, y);
/** the house number on the right-hand pier, cut in paper as the photo has it painted */
const hackneyNumber = (x, y) => Math.min(sdPath(x, y, [[0.83, 0.272], [0.846, 0.29], [0.846, 0.22]], 0.013),
  sdPath(x, y, [[0.866, 0.29], [0.9, 0.29], [0.876, 0.22]], 0.013));

/* ---------- the glazing ---------- */
const HACKNEY_MAJOR = [-0.52, -HACKNEY_DOOR, HACKNEY_DOOR, 0.52];
/** the steel bars: a fine vertical every 0.13, a fine rail every 0.17 up from the ground, heavier mullions and the door head */
function hackneyBars(x, y) {
  const vx = Math.abs(((x + 0.065) % 0.13 + 0.13) % 0.13 - 0.065) - 0.0042;
  const hy = Math.abs((((y - HACKNEY_GROUND) % 0.17) + 0.17) % 0.17 - 0.085) - 0.0042;
  const major = Math.min(...HACKNEY_MAJOR.map((m) => Math.abs(x - m) - 0.011), Math.abs(y - HACKNEY_DOOR_TOP) - 0.011);
  return Math.min(vx, hy, major);
}

/** the doors, swung open toward us: narrow leaves either side of the doorway, each a steel frame with its own bars */
const HACKNEY_LEAF = (s) => [[s * 0.2, HACKNEY_GROUND + 0.02], [s * 0.31, HACKNEY_GROUND + 0.06], [s * 0.31, HACKNEY_DOOR_TOP + 0.05], [s * 0.2, HACKNEY_DOOR_TOP]];
const hackneyLeafArea = (x, y) => Math.min(sdPolygon(x, y, HACKNEY_LEAF(-1)), sdPolygon(x, y, HACKNEY_LEAF(1)));
function hackneyLeaves(x, y) {
  const a = hackneyLeafArea(x, y), frame = Math.abs(a + 0.008) - 0.008;
  const s = Math.sign(x) || 1, mid = Math.abs(Math.abs(x) - 0.255) - 0.004;
  const t = (Math.abs(x) - 0.2) / 0.11, rail = Math.min(...[0.25, 0.5, 0.75].map((f) => {
    const yy = HACKNEY_GROUND + 0.02 + 0.04 * t + f * (HACKNEY_DOOR_TOP - HACKNEY_GROUND - 0.02 + 0.01 * t);
    return Math.abs(y - yy) - 0.004;
  }));
  return Math.max(a, Math.min(frame, mid, rail)) + 0 * s;
}

/* ---------- inside the doorway: the hanging lights and the clock ---------- */
function hackneyLights(x, y) {
  let d = Infinity;
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) {
    const t = i / 5, lx = s * (0.04 + 0.13 * t), ly = -0.06 - Math.sin(t * Math.PI) * 0.04 - t * 0.03;
    d = Math.min(d, sdCircle(x, y, lx, ly, 0.011 + hash2(i, s + 2, 9) * 0.004));
  }
  const clock = Math.abs(sdCircle(x, y, 0, 0.0, 0.03)) - 0.005;
  const hands = Math.min(sdSegment(x, y, 0, 0, 0, 0.02) - 0.0035, sdSegment(x, y, 0, 0, 0.014, -0.006) - 0.0035);
  return Math.min(d, clock, hands);
}
/* ---------- the wall: black brick, paper mortar, the voussoir ring ---------- */
function hackneyWall(x, y) {
  const wall = Math.max(-hackneyOpening(x, y) - 0.02, HACKNEY_GROUND - y);    // a paper margin keeps the glazing apart
  const r = Math.hypot(x, y - HACKNEY_SPRING), above = y > HACKNEY_SPRING - 0.002;
  let mortar, past = false;
  if (above && r < HACKNEY_R + HACKNEY_RING) {
    const a = Math.atan2(y - HACKNEY_SPRING, x), step = Math.PI / 26, k = Math.abs(((a % step) + step) % step - step / 2) * r;
    mortar = k - 0.0075;                                                   // voussoirs: radial joints
  } else {
    const course = 0.048, row = Math.floor((y - HACKNEY_GROUND) / course), cy = Math.abs((((y - HACKNEY_GROUND) % course) + course) % course - course / 2);
    const off = (row % 2) * 0.055, cx = Math.abs((((x + off) % 0.11) + 0.11) % 0.11 - 0.055);
    mortar = Math.min(course / 2 - cy - 0.0075, 0.055 - cx - 0.0065);     // bed joints and staggered head joints, open enough to read as strokes
    // the wall ends on whole bricks inside the frame: each course stops a little further in or out, the top course steps too
    const col = Math.floor((x + off) / 0.11), bx = col * 0.11 + 0.055 - off, by = HACKNEY_GROUND + row * course + course / 2;
    past = Math.abs(bx) > 0.83 + hash2(row, 1, 7) * 0.08 || by > 0.89 + hash2(col, 2, 7) * 0.06;
  }
  const ringEdge = above ? Math.abs(r - (HACKNEY_R + HACKNEY_RING)) - 0.011 : Infinity;
  return Math.max(wall, -mortar, -ringEdge, -(hackneyNumber(x, y) - 0.002), past ? 0.01 : -Infinity);
}

/* ---------- the tables and the crowd: traced from the photo (figures/_hackney-crowd.js) as one strip across the bottom ---------- */
/** the strip is laid a little wider than the frame, placed so its doorway sits under the drawn door; it ends raggedly inside the frame */
const HACKNEY_STRIP_TOP = -0.369;
const HACKNEY_CROWD = { area: [-1.078, 1.122, -1.0, HACKNEY_STRIP_TOP], mask: _hackneyCrowd.shapes[0].bitmap.mask };
const hackneyCrowd = (x, y) => bitmapSdf(HACKNEY_CROWD)(x, y);
/**
 * Only the people and tables are kept from the strip: above head height (-0.47) the photo's own glazing is cut away, except
 * in the doorway, where the drinkers standing in the bar are taller. The drawn building carries on behind them.
 */
const hackneyCrowdOnly = (x, y) => Math.max(hackneyCrowd(x, y), Math.abs(x) < HACKNEY_DOOR ? y - HACKNEY_STRIP_TOP : y + 0.47,
  Math.abs(x) - 0.88 - 0.05 * noise2(y * 9, 3, 5), -0.93 - 0.035 * noise2(x * 6, 1, 5) - y);   // ragged ends inside the frame
/** the drawn building, cut away round the crowd by a paper halo */
const hackneyBehind = (f) => (x, y) => Math.max(f(x, y), -(hackneyCrowdOnly(x, y) - 0.022));

/** what stands in front of the glazing, grown by a paper halo: the glass and its bars are cut away there */
const hackneyFront = (x, y) => Math.min(hackneySign(x, y) - 0.02, hackneyLeafArea(x, y) - 0.01, hackneyCrowdOnly(x, y) - 0.022);
const hackneyGlass = (x, y) => Math.max(hackneyOpening(x, y), -hackneyDoor(x, y), -hackneyFront(x, y));

const HACKNEY_BOX = [-1, 1, -1.02, 1.02];
/** a shape kept just past the frame (the frame clips it), so its ink closes inside its box */
const hackneyBound = (f) => (x, y) => Math.max(f(x, y), sdBox(x, y, 0, 0, 0.97, 1.005));
export const hackney = {
  T: 4, active: [0, 1], S: 250, frame: [474, 500], hint: "hackney church brew co",
  drive: driveUp,
  shapes: [
    { id: "bars", box: HACKNEY_BOX, sdf: hackneyBound((x, y) => Math.max(hackneyBars(x, y), hackneyGlass(x, y))) },
    { id: "bar", box: [-0.25, 0.25, -0.9, 0.15], sdf: hackneyBehind((x, y) => Math.max(hackneyDoor(x, y), -hackneyLights(x, y))) },
    { id: "leaves", box: [-0.4, 0.4, -0.9, 0.2], sdf: hackneyBehind(hackneyLeaves) },
    { id: "wall", box: HACKNEY_BOX, sdf: hackneyBound(hackneyBehind(hackneyWall)) },
    { id: "sign", box: [-0.5, 0.5, 0.12, 0.68], sdf: hackneySign },
    { id: "crowd", box: [-1.1, 1.15, -1.03, -0.34], sdf: hackneyBound(hackneyCrowdOnly) },
  ],
  step() {
    return {};                                                            // a still: nothing moves
  },
};
