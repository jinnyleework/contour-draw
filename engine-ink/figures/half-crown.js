import { sdBox, sdCircle, sdEllipse, sdPolygon, sdPath, sdSegment, hash2 } from "../src/math.js";
import { bitmapSdf } from "../src/ink.js";
import { driveUp } from "../src/figure.js";
import { _halfCrownLeft } from "./_half-crown-left.js";
import { _halfCrownRight } from "./_half-crown-right.js";

/*
 * The Half Crown, Hackney: the pub front drawn by hand from the photo (reference/half-crown.webp) as a woodcut, for a card's
 * 474 x 500 picture box, to the card rules (the /draw-ink skill): it ends on its own marks inside the frame, with paper
 * between every mass. The A-board and the neighbours are left out. Above, whole bricks with open joints, stepping in and out
 * at the wall's ragged end, under the roofline and round the white sash windows; the planter as a bumpy band of leaves;
 * three gooseneck lamps throwing paper rays down the fascia, whose name is cut in paper from the photo's own lettering
 * (traced: figures/_half-crown-sign.js; its F was lost in a lamp's glare and is rebuilt from the E of THE). Below, fluted
 * pilasters and a frame of black bars round plain paper glass, jugs and posters on the sill in silhouette, the lit transom
 * and panelled doors, the Guinness sign on its bracket, and the paving in courses that end on tapered strokes. A still.
 *
 * Everything is placed in the photo's own pixels (x right, y down, from the 684 x 752 screenshot); `halfCrownPx` turns a
 * shape drawn there into world units. The frame shows the photo's x 40..627, y 76..695; the drawing keeps inside x 58..618,
 * y 90..682, so a margin of paper runs round it.
 */
const HALF_CROWN_U = 0.8075 / 250;                                       // world units per photo pixel (474 / 587 page px, S 250)
const halfCrownPx = (f) => (x, y) => f(333.5 + x / HALF_CROWN_U, 385.5 - y / HALF_CROWN_U) * HALF_CROWN_U;
/** a box in photo pixels, corners x0,y0 .. x1,y1, corners rounded by r */
const halfCrownRect = (x, y, x0, y0, x1, y1, r = 0) => sdBox(x, y, (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, r);
/** a box's outline as a line of width w */
const halfCrownFrame = (x, y, x0, y0, x1, y1, w) => Math.abs(halfCrownRect(x, y, x0, y0, x1, y1)) - w / 2;

/* ---------- above the shop: whole bricks, sash windows, chimneys ---------- */
const HALF_CROWN_ROOF = [[30, 66], [345, 100], [345, 92], [373, 92], [374, 110], [548, 148], [575, 176], [575, 200], [30, 200]];
const HALF_CROWN_WINDOWS = [[98, 95, 181, 200], [260, 128, 330, 200], [370, 113, 398, 200]];
const HALF_CROWN_PANES = [[107, 103, 139, 140], [143, 103, 174, 140], [107, 145, 139, 200], [143, 145, 174, 200],
  [268, 135, 295, 160], [299, 135, 323, 160], [268, 164, 295, 200], [299, 164, 323, 200], [376, 120, 393, 150], [376, 154, 393, 200]];
const halfCrownWindowsOut = (x, y) => Math.min(...HALF_CROWN_WINDOWS.map(([a, b, c, d]) => halfCrownRect(x, y, a, b, c, d)));
/**
 * The upper wall as bricks: courses 10 px tall, bricks 24 long, staggered, with open joints. Only whole bricks are laid: a
 * brick is left out where it would cross the roofline, a window (with a little margin), or the wall's ragged left end,
 * which steps in and out course by course; so the wall ends on its own bricks, never on the frame.
 */
function halfCrownBricks(x, y) {
  const course = 10, len = 24, joint = 1.6, row = Math.floor((y - 92) / course);
  if (row < 0 || y > 192) return 4;
  const off = (row % 2) * (len / 2), k = Math.floor((x + off) / len), cx = (k + 0.5) * len - off, cy = 92 + (row + 0.5) * course;
  const left = 60 + hash2(row, 1, 13) * 30;                                                    // the ragged end
  if (cx - len / 2 < left || sdPolygon(cx, cy, HALF_CROWN_ROOF) > -6 || halfCrownWindowsOut(cx, cy) < 9) return Math.max(4, halfCrownRect(x, y, cx - len / 2, cy - course / 2, cx + len / 2, cy + course / 2));
  return halfCrownRect(x, y, cx - len / 2 + joint, cy - course / 2 + joint, cx + len / 2 - joint, cy + course / 2 - joint, 0.6);
}
const halfCrownUpper = (x, y) => Math.min(
  ...HALF_CROWN_PANES.map(([a, b, c, d]) => halfCrownRect(x, y, a, b, c, d)),
  halfCrownFrame(x, y, 98, 95, 181, 205, 1.6), halfCrownFrame(x, y, 260, 128, 330, 205, 1.6), halfCrownFrame(x, y, 370, 113, 398, 205, 1.6),   // the white frames, edged
  halfCrownRect(x, y, 345, 92, 373, 106), halfCrownRect(x, y, 486, 128, 500, 150), halfCrownRect(x, y, 470, 142, 508, 152),   // chimney stacks
  sdPath(x, y, [[505, 150], [522, 125], [540, 117]], 2), sdSegment(x, y, 515, 120, 530, 132) - 1, sdSegment(x, y, 525, 114, 538, 126) - 1);   // the aerial

/* ---------- the planter: a bumpy band of leaves, flecked ---------- */
function halfCrownPlanter(x, y) {
  let d = halfCrownRect(x, y, 86, 188, 572, 201);
  for (let i = 0; i < 46; i++) {
    const cx = 88 + i * 10.6 + (hash2(i, 1, 3) - 0.5) * 6, cy = 184 + (hash2(i, 2, 3) - 0.5) * 8;
    d = Math.min(d, sdCircle(x, y, cx, cy, 5.5 + hash2(i, 3, 3) * 5));
  }
  d = Math.min(d, sdCircle(x, y, 88, 210, 8), sdCircle(x, y, 84, 226, 6), sdCircle(x, y, 90, 240, 5));   // the trail over the left end
  const fx = Math.floor(x / 9), fy = Math.floor(y / 7), cx = (fx + 0.5) * 9 + (hash2(fx, fy, 7) - 0.5) * 4, cy = (fy + 0.5) * 7;
  const fleck = hash2(fx, fy, 8) < 0.45 ? sdEllipse(x, y, cx, cy, 2.2, 1.3) : Infinity;                   // leaves catching the light
  return Math.max(d, -fleck, y - 202);                                                                     // paper between it and the cornice
}

/* ---------- the lamps: paper shades on gooseneck arms, light falling in rays ---------- */
const HALF_CROWN_LAMPS = [155, 335, 515];
function halfCrownLamps(x, y) {
  let d = Infinity;
  for (const lx of HALF_CROWN_LAMPS) {
    const shade = sdPolygon(x, y, [[lx - 4, 214], [lx + 4, 214], [lx + 12, 232], [lx + 13, 238], [lx - 13, 238], [lx - 12, 232]]);
    const arm = sdPath(x, y, [[lx - 9, 206], [lx - 8, 196], [lx - 2, 193], [lx, 200], [lx, 214]], 2.6);
    d = Math.min(d, shade, arm, sdCircle(x, y, lx, 213, 3));
  }
  return d;
}
/** the light under each shade: thin paper rays fanning down the board, longer in the middle */
function halfCrownRays(x, y) {
  let d = Infinity;
  for (const lx of HALF_CROWN_LAMPS) {
    if (Math.abs(x - lx) > 50 || y < 238 || y > 312) continue;
    for (let k = -4; k <= 4; k++) {
      const a = k * 0.2, len = 62 - Math.abs(k) * 8;
      d = Math.min(d, sdSegment(x, y, lx + Math.sin(a) * 10, 241, lx + Math.sin(a) * len, 241 + Math.cos(a) * len) - 1.1 * (1 - Math.abs(k) * 0.12));
    }
  }
  return d;
}

/* ---------- cornice, friezes and the fascia board, one block of ink with its cuts ---------- */
/**
 * The traced letters, in photo pixels. THE HALF and CROWN are traced apart (figures/_half-crown-left.js, _half-crown-right.js):
 * THE HALF sits on a darker part of the board, so it is traced bolder. Their masks lie over the photo's y 275..315, x 145..352.5
 * and 352.5..515 (the fascia crop, enlarged four times, split at 830 px; the left half starts at its pixel 1).
 */
const halfCrownSignArea = (px0, px1) => [(px0 - 333.5) * HALF_CROWN_U, (px1 - 333.5) * HALF_CROWN_U, (385.5 - 315) * HALF_CROWN_U, (385.5 - 275) * HALF_CROWN_U];
const HALF_CROWN_SIGN_LEFT = { area: halfCrownSignArea(145.25, 352.5), mask: _halfCrownLeft.shapes[0].bitmap.mask };
const HALF_CROWN_SIGN_RIGHT = { area: halfCrownSignArea(352.5, 515), mask: _halfCrownRight.shapes[0].bitmap.mask };
const halfCrownLetters = (x, y) => {
  const wx = (x - 333.5) * HALF_CROWN_U, wy = (385.5 - y) * HALF_CROWN_U;
  return Math.min(bitmapSdf(HALF_CROWN_SIGN_LEFT)(wx, wy), bitmapSdf(HALF_CROWN_SIGN_RIGHT)(wx, wy)) / HALF_CROWN_U;
};
/** reeding: vertical paper grooves every 7 px between y0 and y1 */
const halfCrownReeds = (x, y, x0, x1, y0, y1) => Math.max(Math.abs(((x - x0) % 7 + 7) % 7 - 3.5) - 1.1, halfCrownRect(x, y, x0, y0, x1, y1));
function halfCrownFascia(x, y) {
  const block = Math.min(halfCrownRect(x, y, 100, 205, 562, 250), halfCrownRect(x, y, 112, 248, 550, 344), halfCrownRect(x, y, 108, 342, 554, 374),
    sdPolygon(x, y, [[548, 178], [578, 178], [578, 194], [566, 214], [563, 262], [556, 304], [548, 304]]));      // the console bracket on the right
  const seams = Math.min(...[217.5, 249, 343.5].map((sy) => Math.abs(y - sy) - 1.1));                               // paper between its mouldings
  const cuts = Math.min(
    halfCrownReeds(x, y, 112, 552, 221, 244), halfCrownReeds(x, y, 114, 550, 347, 369), seams,
    Math.abs(y - 211) - 1.1 + (x < 102 || x > 560 ? 99 : 0),                                                         // a groove in the cornice
    halfCrownFrame(x, y, 127, 261, 535, 331, 2.4),                                                                   // the board's inner panel
    halfCrownLetters(x, y) - 0.7, halfCrownLamps(x, y), halfCrownRays(x, y),
    Math.abs(sdCircle(x, y, 568, 198, 6)) - 1.3);                                                                   // the bracket's scroll
  return Math.max(block, -cuts);
}

/* ---------- the Guinness sign: an oval on its bracket, ringed and lettered in paper ---------- */
function halfCrownGuinness(x, y) {
  const cx = 596, cy = 306, oval = sdEllipse(x, y, cx, cy, 22, 31);
  const bracket = Math.min(halfCrownRect(x, y, 578, 254, 616, 259), sdSegment(x, y, cx, 259, cx, 275) - 1.2, sdPath(x, y, [[580, 259], [586, 266], [580, 270]], 1.4));
  const ring = Math.abs(sdEllipse(x, y, cx, cy, 17, 26)) - 1.3;
  const word = Math.max(halfCrownRect(x, y, cx - 15, cy - 7, cx + 15, cy + 3), Math.abs(((x - cx + 15) % 5 + 5) % 5 - 2.5) - 1.1);   // a lettered band, suggested
  const swash = sdPath(x, y, [[cx - 12, cy + 12], [cx - 4, cy + 9], [cx + 4, cy + 14], [cx + 12, cy + 10]], 1.8);
  return Math.min(Math.max(oval, -ring, -word, -swash), bracket);
}

/* ---------- the shopfront: pilasters, a frame of bars, plain glass ---------- */
const HALF_CROWN_GLASS = [[134, 378, 280, 572], [387, 378, 532, 572]];
function halfCrownShopfront(x, y) {
  const pilasters = Math.max(Math.min(halfCrownRect(x, y, 108, 374, 134, 632), halfCrownRect(x, y, 540, 304, 578, 632)),
    -Math.min(...[116, 125, 549, 559, 569].map((fx) => Math.max(Math.abs(x - fx) - 1.1, halfCrownRect(x, y, fx - 2, 388, fx + 2, 624)))));   // their fluting
  const bars = Math.min(...HALF_CROWN_GLASS.map(([a, b, c, d]) => halfCrownFrame(x, y, a, b, c, d, 5)),
    halfCrownRect(x, y, 134, 572, 540, 580),                                                                      // the sill rail
    halfCrownRect(x, y, 280, 374, 290, 632), halfCrownRect(x, y, 378, 374, 387, 632),                             // the door posts
    halfCrownRect(x, y, 290, 374, 378, 380), halfCrownRect(x, y, 290, 413, 378, 420));                            // the transom's rails
  const risers = Math.min(halfCrownFrame(x, y, 134, 580, 280, 632, 3), halfCrownFrame(x, y, 142, 588, 272, 624, 1.8),
    halfCrownFrame(x, y, 387, 580, 540, 632, 3), halfCrownFrame(x, y, 395, 588, 532, 624, 1.8));
  return Math.min(pilasters, bars, risers);
}
/* What is in the windows, kept simple, in black on the paper glass: the shelf rail, a few strokes of reflection, two posters,
 * stoneware jugs on the sill, and the lights: two strip lights on cords in the left window and a lantern in the right, each with
 * a fringe of short strokes for its glow. Marks are kept 7 px apart and no thinner than about 2.5 px, or the ink runs them
 * together or eats them at card size. */
const HALF_CROWN_JUGS = [[172, 540, 7], [196, 534, 8], [470, 536, 8], [494, 542, 6]];
/** a stoneware jug: a round-shouldered body and a short neck */
const halfCrownJugs = (x, y) => HALF_CROWN_JUGS.reduce((d, [cx, top, r]) => Math.min(d,
  halfCrownRect(x, y, cx - r, top + r * 0.8, cx + r, 571, r * 0.8), halfCrownRect(x, y, cx - r * 0.4, top, cx + r * 0.4, top + r, 1)), Infinity);
/** a light's glow: short strokes radiating from (cx, cy) between radii r0 and r1, over the angles a0..a1 (degrees, 0 = right, y down) */
function halfCrownGlow(x, y, cx, cy, r0, r1, a0, a1, n) {
  let d = Infinity;
  for (let i = 0; i < n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / (n - 1)) * Math.PI) / 180, l = i % 2 ? r1 : r1 - (r1 - r0) * 0.4;
    d = Math.min(d, sdSegment(x, y, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * l, cy + Math.sin(a) * l) - 1.4);
  }
  return d;
}
/** the left window's strip lights: two long bars on cords, a fringe of glow below each; the right window's lantern, glowing round */
function halfCrownLights(x, y) {
  let d = Infinity;
  for (const [by, ry] of [[404, 7], [422, 10]]) {
    d = Math.min(d, halfCrownRect(x, y, 212, by, 276, by + 4, 1.5));
    for (let i = 0; i < 6; i++) {                                                                // glow strokes, well apart and clear of the bar
      const gx = 217 + i * 10.6;
      d = Math.min(d, sdSegment(x, y, gx, by + 9, gx + (gx - 244) * 0.12, by + 9 + ry * (i % 2 ? 1 : 0.65)) - 1.4);
    }
  }
  d = Math.min(d, sdSegment(x, y, 220, 380, 220, 404) - 1.3, sdSegment(x, y, 268, 380, 268, 404) - 1.3);
  const lantern = Math.max(sdPolygon(x, y, [[442, 430], [452, 430], [456, 448], [438, 448]]), -halfCrownRect(x, y, 445, 435, 449, 444));
  d = Math.min(d, sdSegment(x, y, 447, 380, 447, 430) - 1.3, lantern, halfCrownRect(x, y, 444, 426, 450, 431), halfCrownGlow(x, y, 447, 440, 15, 24, 0, 180, 9));
  return d;
}

function halfCrownWindowLife(x, y) {
  let d = Infinity;
  for (const [x0, y0, x1, y1] of HALF_CROWN_GLASS) {
    d = Math.min(d, Math.max(Math.abs(y - 492) - 1.2, halfCrownRect(x, y, x0, y0, x1, y1)));                         // the shelf rail
    for (let k = 0; k < 3; k++) {                                                                                     // a little reflection, upper left
      const sx = x0 + 10 + k * 9;
      d = Math.min(d, sdSegment(x, y, sx, y0 + 8 + k * 3, sx + 20 - k * 3, y0 + 36 - k * 2) - 1.2);
    }
  }
  const posters = Math.min(halfCrownFrame(x, y, 226, 446, 244, 474, 2.4), halfCrownFrame(x, y, 249, 446, 268, 474, 2.4));
  return Math.min(d, halfCrownJugs(x, y), posters, halfCrownLights(x, y), 40);
}

/** the doors: the leaves' edges and meeting stile, glazed tops, lower panels, handles; the transom's frame; the step */
function halfCrownDoorLines(x, y) {
  const leaves = Math.min(halfCrownFrame(x, y, 296, 440, 372, 597, 2.4), Math.max(Math.abs(x - 334) - 1.4, halfCrownRect(x, y, 330, 440, 338, 597)));
  let glass = Infinity;
  for (const [a, b] of [[301, 329], [339, 367]]) {
    const pane = halfCrownRect(x, y, a, 447, b, 520), bars = Math.min(Math.abs(x - (a + b) / 2) - 1, Math.abs(y - 471) - 1, Math.abs(y - 495) - 1);
    glass = Math.min(glass, Math.max(pane, -bars), halfCrownFrame(x, y, a + 2, 530, b - 2, 590, 1.8));
  }
  const handles = Math.min(halfCrownRect(x, y, 327, 525, 330, 540), halfCrownRect(x, y, 338, 525, 341, 540));
  const transom = Math.min(halfCrownFrame(x, y, 294, 385, 374, 408, 1.6), halfCrownRect(x, y, 318, 426, 350, 433));   // and the small name board under it
  const recess = Math.min(halfCrownRect(x, y, 290, 420, 296, 600), halfCrownRect(x, y, 372, 420, 378, 600), halfCrownRect(x, y, 290, 420, 378, 438));
  return Math.min(leaves, glass, handles, transom, recess, halfCrownRect(x, y, 290, 598, 378, 603));
}

/* ---------- the plinth and the paving ---------- */
const halfCrownPlinth = (x, y) => halfCrownRect(x, y, 102, 632, 584, 640);
/** the paving: six courses opening out toward us, each a stroke that tapers out at its own ragged ends, a joint now and then */
function halfCrownPaving(x, y) {
  let d = Infinity;
  for (let n = 0; n < 6; n++) {
    const ry = 648 + 32 * Math.pow(n / 5, 1.5), left = 62 + hash2(n, 1, 17) * 46, right = 612 - hash2(n, 2, 17) * 46;
    if (x < left - 2 || x > right + 2 || Math.abs(y - ry) > 6) continue;
    const t = Math.min(1, (x - left) / 22, (right - x) / 22), w = (0.8 + n * 0.22) * Math.max(0, t);
    d = Math.min(d, Math.abs(y - ry) - w);
  }
  for (let n = 0; n < 5; n++) {                                                                                       // joints between a course and the next
    const y0 = 648 + 32 * Math.pow(n / 5, 1.5), y1 = 648 + 32 * Math.pow((n + 1) / 5, 1.5);
    if (y < y0 || y > y1) continue;
    const len = 30 + n * 6, off = hash2(n, 3, 17) * len, k = Math.floor((x + off) / len), jx = (k + 0.5) * len - off;
    if (hash2(k, n, 6) < 0.5 && jx > 90 && jx < 585) d = Math.min(d, Math.max(Math.abs(x - jx) - 0.8, Math.abs(y - (y0 + y1) / 2) - (y1 - y0) / 2 + 1.5));
  }
  return Math.min(d, 40);                                                 // finite: the ink's pooling blur cannot take Infinity
}

const halfCrownShape = (id, f, box, extra = {}) => ({ id, box, sdf: halfCrownPx(f), ...extra });
/** a box in world units from photo pixels, with a margin */
const halfCrownWorldBox = (x0, y0, x1, y1) => [(x0 - 333.5) * HALF_CROWN_U - 0.03, (x1 - 333.5) * HALF_CROWN_U + 0.03, (385.5 - y1) * HALF_CROWN_U - 0.03, (385.5 - y0) * HALF_CROWN_U + 0.03];
export const halfCrown = {
  T: 4, active: [0, 1], S: 250, frame: [474, 500], hint: "the half crown",
  drive: driveUp,
  shapes: [
    halfCrownShape("bricks", halfCrownBricks, halfCrownWorldBox(50, 86, 590, 200)),
    halfCrownShape("upper", halfCrownUpper, halfCrownWorldBox(90, 86, 550, 210)),
    halfCrownShape("planter", (x, y) => Math.max(halfCrownPlanter(x, y), -(halfCrownLamps(x, y) - 1.5)), halfCrownWorldBox(70, 165, 590, 255)),
    halfCrownShape("fascia", halfCrownFascia, halfCrownWorldBox(95, 170, 585, 380)),
    halfCrownShape("guinness", halfCrownGuinness, halfCrownWorldBox(570, 248, 625, 345)),
    halfCrownShape("shopfront", halfCrownShopfront, halfCrownWorldBox(100, 296, 585, 638)),
    halfCrownShape("window-life", halfCrownWindowLife, halfCrownWorldBox(130, 374, 540, 576)),
    halfCrownShape("doors", halfCrownDoorLines, halfCrownWorldBox(285, 378, 384, 608)),
    halfCrownShape("plinth", halfCrownPlinth, halfCrownWorldBox(98, 628, 590, 644)),
    halfCrownShape("paving", halfCrownPaving, halfCrownWorldBox(55, 640, 620, 684)),
  ],
  step() {
    return {};                                                            // a still: nothing moves
  },
};
