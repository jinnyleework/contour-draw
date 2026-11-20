import { sdBox, sdCircle, sdPolygon, sdSegment, sdPath, hash2 } from "../src/math.js";
import { bitmapSdf } from "../src/ink.js";
import { driveUp } from "../src/figure.js";
import { _starLetters } from "./_star-letters.js";
import { _starMural } from "./_star-mural.js";

/*
 * The Star by Hackney Downs: the corner pub drawn by hand from the photo as a woodcut, for a card's 474 x 500 picture box, to
 * the card rules (the /draw-ink skill). The whole building is fitted inside the frame with a paper margin, in the photo's
 * upward perspective: the grey render lightly hatched, the white window surrounds left in paper round dark sash panes, the
 * eaves on their brackets, the corner tower with its rusticated quoins, arched window and hanging sign, the mural panel with
 * its star, the fascia band with the name cut in it and the scalloped awning, the arched ground-floor windows and doors, the shutter, and the striped
 * planter fence along the front, ending on its own uprights. The fascia's lettering and the mural are traced from close-ups
 * (reference/star-fascia.webp, star-mural.png). A still.
 *
 * Everything is placed in the photo's pixels (2000 x 1333, x right, y down); `starPx` fits the building (x 105..1460,
 * y 60..1290) into the frame at 0.326 frame px per photo px, with a 16 px margin each side. Strokes are at least 6 photo px
 * (2 frame px) and marks 17 photo px apart, or the ink eats or joins them at card size.
 */
const STAR_K = 0.326, STAR_X0 = 105, STAR_Y0 = 60, STAR_LEFT = 16, STAR_TOP = 46;
/** a shape drawn in photo pixels, in world units */
const starPx = (f) => (x, y) => {
  const X = (x * 250 + 300 - 63 - STAR_LEFT) / STAR_K + STAR_X0, Y = (300 - y * 250 - 50 - STAR_TOP) / STAR_K + STAR_Y0;
  return Math.min(f(X, Y), 120) * (STAR_K / 250);                        // finite: the ink's pooling blur cannot take Infinity
};
const starRect = (x, y, x0, y0, x1, y1, r = 0) => sdBox(x, y, (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, r);
const starFrame = (x, y, x0, y0, x1, y1, w) => Math.abs(starRect(x, y, x0, y0, x1, y1)) - w / 2;
/** a round-topped opening: a box whose top is a half circle */
const starArch = (x, y, x0, y0, x1, y1) => {
  const r = (x1 - x0) / 2, cx = (x0 + x1) / 2;
  return Math.min(starRect(x, y, x0, y0 + r, x1, y1), Math.max(Math.hypot(x - cx, y - (y0 + r)) - r, y - (y0 + r)));
};

/* ---------- the walls ---------- */
const STAR_EAVE = [[112, 412], [1222, 74]];                              // the eaves line, rising to the right
/** the windows: [x0, y0, x1, y1, kind] for the glass; kind 0 sash, 1 arched, 2 sash with a hood above */
const STAR_WINDOWS = [[228, 462, 278, 585, 0], [388, 425, 447, 552, 0], [555, 388, 605, 515, 1], [728, 338, 805, 482, 0], [970, 270, 1065, 432, 0],
  [150, 676, 197, 795, 2], [375, 640, 433, 808, 2], [722, 582, 800, 775, 2], [975, 535, 1072, 750, 2], [1292, 248, 1376, 438, 1]];
const STAR_MURAL = [446, 534, 690, 810];

/* ---------- perspective: the building is seen from below its corner ----------
 * The long front recedes to the left and the tower's face to the right, so each face's level lines (sills, window heads, the
 * render's courses) run between its top edge and its foot, converging. `starLevel` reads a point as if those lines ran level
 * through column cx: a shape drawn upright, centred at cx, then tilts with its wall. */
const STAR_FRONT_TOP = [[112, 412], [1222, 74]], STAR_FRONT_FOOT = [[190, 836], [1254, 784]];
const STAR_TOWER_TOP = [[1222, 74], [1458, 186]], STAR_TOWER_FOOT = [[1256, 784], [1468, 806]];
const starLineY = ([[ax, ay], [bx, by]], x) => ay + ((by - ay) * (x - ax)) / (bx - ax);
function starLevel(x, y, cx, tower = cx > 1210) {
  const [top, foot] = tower ? [STAR_TOWER_TOP, STAR_TOWER_FOOT] : [STAR_FRONT_TOP, STAR_FRONT_FOOT];
  const t = starLineY(top, x), f = starLineY(foot, x), v = (f - y) / (f - t), tc = starLineY(top, cx), fc = starLineY(foot, cx);
  return fc - v * (fc - tc);
}
const starCx = (w) => (w[0] + w[2]) / 2;
const starGlass = (x, y, [x0, y0, x1, y1, kind]) => kind === 1 ? starArch(x, y, x0, y0, x1, y1) : starRect(x, y, x0, y0, x1, y1);
const starSurroundFlat = (x, y, w) => { const m = 20; return w[4] === 1 ? starArch(x, y, w[0] - m, w[1] - m, w[2] + m, w[3] + m) : starRect(x, y, w[0] - m, w[1] - m, w[2] + m, w[3] + m); };
/** a window's surround, tilted with its wall */
const starSurround = (x, y, w) => starSurroundFlat(x, starLevel(x, y, starCx(w)), w);
const starMuralBox = (x, y) => starRect(x, starLevel(x, y, 568), ...STAR_MURAL);

/** the render: courses of fine lines across the front, converging with it, kept off the surrounds and the mural (the tower is white) */
function starRender(x, y) {
  if (x < 124 || x > 1188) return 40;
  const t = starLineY(STAR_FRONT_TOP, x) + 36, f = starLineY(STAR_FRONT_FOOT, x) - 6;
  if (y < t - 10 || y > f + 10) return 40;
  const n = 17, k = ((f - y) / (f - t)) * n, line = Math.abs(k - Math.round(k)) * ((f - t) / n) - 3.4;
  return Math.max(line, t - y, y - f, -Math.min(...STAR_WINDOWS.slice(0, 9).map((w) => starSurround(x, y, w) - 9)), -(starMuralBox(x, y) - 14));
}

/** the lines of the building: the eaves and their brackets, the corners, the tower's quoins and top, the window surrounds */
function starLines(x, y) {
  const [[ex0, ey0], [ex1, ey1]] = STAR_EAVE;
  let d = Math.min(sdSegment(x, y, ex0, ey0, ex1, ey1) - 7, sdSegment(x, y, ex0, ey0 + 22, ex1 - 30, ey1 + 22) - 3.5,
    sdSegment(x, y, 1222, 74, 1458, 186) - 7, sdSegment(x, y, 1236, 96, 1450, 202) - 3.5,                        // the tower's cornice
    sdSegment(x, y, 118, 412, 118, 1100) - 4, sdSegment(x, y, 1458, 186, 1452, 1110) - 4);                       // the outer corners
  for (let i = 1; i < 15; i++) {                                                                                   // brackets under the eaves
    const t = i / 15, bx = ex0 + (ex1 - ex0) * t, by = ey0 + (ey1 - ey0) * t + 26;
    d = Math.min(d, starRect(x, y, bx - 6, by, bx + 6, by + 18, 2));
  }
  for (let i = 0; i < 6; i++) { const t = (i + 0.5) / 6, bx = 1236 + 214 * t, by = 96 + 106 * t + 12; d = Math.min(d, starRect(x, y, bx - 6, by, bx + 6, by + 16, 2)); }
  for (const [qx0, qx1] of [[1196, 1236], [1404, 1452]]) {                                                         // the quoins: blocks, their joints on the tower's slope
    const qy0 = starLevel(x, y, (qx0 + qx1) / 2, true);
    d = Math.min(d, sdSegment(x, y, qx0, 110, qx0, 900) - 3, sdSegment(x, y, qx1, 110, qx1, 900) - 3);
    for (let qy = 140; qy < 890; qy += 30) d = Math.min(d, Math.max(Math.abs(qy0 - qy) - 2.6, Math.abs(x - (qx0 + qx1) / 2) - (qx1 - qx0) / 2));
  }
  for (const w of STAR_WINDOWS) {
    const ly = starLevel(x, y, starCx(w));
    d = Math.min(d, Math.abs(starSurroundFlat(x, ly, w)) - 3);                                                  // the surround's edge
    d = Math.min(d, starRect(x, ly, w[0] - 30, w[3] + 20, w[2] + 30, w[3] + 32, 2));                             // the sill
    if (w[4] === 2) d = Math.min(d, starRect(x, ly, w[0] - 38, w[1] - 62, w[2] + 38, w[1] - 44, 2),            // a hood on two consoles
      starRect(x, ly, w[0] - 34, w[1] - 44, w[0] - 22, w[1] - 14, 2), starRect(x, ly, w[2] + 22, w[1] - 44, w[2] + 34, w[1] - 14, 2));
  }
  return d;
}

/** the panes: dark, with paper glazing bars */
function starPanes(x, y) {
  let d = Infinity;
  for (const w of STAR_WINDOWS) {
    const [x0, y0, x1, y1] = w, cx = (x0 + x1) / 2, mid = (y0 + y1) / 2, ly = starLevel(x, y, cx);
    const bars = Math.min(Math.abs(x - cx) - 5.5, Math.abs(ly - mid) - 6, Math.abs(ly - (y0 + (mid - y0) * 0.5)) - 4.5, Math.abs(ly - (mid + (y1 - mid) * 0.5)) - 4.5);
    d = Math.min(d, Math.max(starGlass(x, ly, w), -bars));
  }
  return d;
}

/**
 * The mural: a framed panel, and in it the painting traced from the close-up (reference/star-mural.png, figures/_star-mural.js):
 * the woman's dark eyes and lips, her blonde hair and the star in paper, shadows hatched. The trace is fitted to the panel's
 * inside (squeezed a little: the close-up is seen head-on, the panel in perspective) and tilted with the wall.
 */
const STAR_MURAL_IN = [458, 546, 678, 798];
const starMuralPart = (id) => ({ area: [STAR_MURAL_IN[0], STAR_MURAL_IN[2], -STAR_MURAL_IN[3], -STAR_MURAL_IN[1]], mask: _starMural.shapes.find((sh) => sh.id === id).bitmap.mask });
const STAR_MURAL_INK = starMuralPart("ink"), STAR_MURAL_TONE = starMuralPart("tone"), STAR_MURAL_CROSS = starMuralPart("cross");
/** one layer of the painting (ink, tone or cross), in the panel, kept 5 px inside its border */
const starMuralLayer = (part) => (x, y0in) => {
  const y = starLevel(x, y0in, 568), [a, b, c, d] = STAR_MURAL_IN;
  return Math.max(bitmapSdf(part)(x, -y), starRect(x, y, a + 5, b + 5, c - 5, d - 5));
};
/** the panel's border: a solid frame round the painting */
function starMural(x, y0in) {
  const y = starLevel(x, y0in, 568), [x0, y0, x1, y1] = STAR_MURAL;
  return Math.max(starRect(x, y, x0, y0, x1, y1), -starRect(x, y, ...STAR_MURAL_IN));
}

/** the tower's hanging sign: a framed panel, cross-hatched for now (its painting is still to be traced), on two brackets */
const starSignFrame = (x, y) => Math.min(starFrame(x, y, 1298, 458, 1414, 726, 8), sdSegment(x, y, 1290, 640, 1316, 668) - 4, sdSegment(x, y, 1420, 640, 1398, 668) - 4,
  starFrame(x, y, 1108, 656, 1188, 700, 5), ...[667, 678, 689].map((ly) => starRect(x, y, 1120, ly - 2.5, 1176, ly + 2.5)));   // and the street name plate
const starSignField = (x, y) => starRect(x, y, 1312, 472, 1400, 712);

/* ---------- the shopfront ---------- */
/**
 * The name, cut in paper from the fascia: traced from the close-up (reference/star-fascia.webp; the T of THE, crossed by a
 * lamp post, is the T of STAR, and the S of STAR, behind a street sign, is the S of DOWNS: figures/_star-letters.js). Laid
 * along the band's slant, spread a little wider than in the photo so it reads at card size, and thickened by 2.6 px.
 */
const STAR_LETTERS = { area: [185.6, 1256, -(855.6 + 23.4), -(855.6 - 23.4)], mask: _starLetters.shapes[0].bitmap.mask };
const starLetters = (x, y) => bitmapSdf(STAR_LETTERS)(x, -(y + 0.0404 * (x - 720))) - 2.6;
/** the fascia band, slanting with the perspective, with the name cut in it, and the scalloped awning under it */
function starFascia(x, y) {
  const band = Math.max(sdPolygon(x, y, [[190, 836], [1254, 784], [1256, 872], [190, 906]]), -starLetters(x, y));
  const side = sdPolygon(x, y, [[1256, 784], [1468, 806], [1468, 860], [1256, 872]]);
  const awning = sdPolygon(x, y, [[180, 912], [1250, 878], [1250, 904], [180, 940]]);
  const t = (x - 180) / 1070, edge = 940 + (904 - 940) * t, scallop = sdCircle(x, y, Math.round((x - 180) / 34) * 34 + 180, edge + 4, 11);
  return Math.min(band, side, Math.max(awning, -scallop));
}
const STAR_ARCHES = [[238, 958, 350, 1090], [588, 942, 750, 1100], [978, 928, 1200, 1100]];
const STAR_DOORS = [[393, 986, 535, 1100], [810, 982, 915, 1100]];
/** the ground floor: arched windows as frames of bars round paper glass, dark doors with lit panes, the shutter with its star */
function starGround(x, y) {
  let d = Infinity;
  for (const [x0, y0, x1, y1] of STAR_ARCHES) {
    const cx = (x0 + x1) / 2, glass = starArch(x, y, x0, y0, x1, y1);
    d = Math.min(d, Math.abs(glass) - 5, Math.max(Math.abs(x - cx) - 3.5, glass), Math.max(Math.abs(y - (y0 + y1) * 0.5 - 10) - 3, glass));
  }
  for (const [x0, y0, x1, y1] of STAR_DOORS) {
    const cx = (x0 + x1) / 2, leaf = starRect(x, y, x0, y0, x1, y1);                                              // dark, with lit panes in paper
    d = Math.min(d, Math.max(leaf, -starRect(x, y, x0 + 14, y0 + 16, cx - 9, y0 + 70), -starRect(x, y, cx + 9, y0 + 16, x1 - 14, y0 + 70)));
  }
  const shutter = starRect(x, y, 1306, 958, 1440, 1100), slats = Math.abs(((y - 958) % 14 + 14) % 14 - 7) - 3.2, box = starRect(x, y, 1300, 916, 1446, 950, 2);
  const sp = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 20 : 48; sp.push([1373 + Math.cos(a) * r, 1040 + Math.sin(a) * r]); }
  const starCut = sdPolygon(x, y, sp);
  d = Math.min(d, Math.max(shutter, -slats, -starCut), Math.max(starCut, shutter), box);
  return d;
}

/* ---------- the planter fence along the front ---------- */
/** uprights 34 px wide with paper between, alternately solid and outlined (the photo's dark and light stripes), plants along the top */
const STAR_FENCE_X0 = 80, STAR_FENCE_X1 = 1450, STAR_FENCE_W = 34;
const starFenceTop = (x) => 1108 - (x - STAR_FENCE_X0) * 0.02;
function starFenceUpright(x, y, odd) {
  const k = Math.floor((x - STAR_FENCE_X0) / STAR_FENCE_W), cx = STAR_FENCE_X0 + (k + 0.5) * STAR_FENCE_W;
  if (k < 0 || cx > STAR_FENCE_X1 || (k % 2 === 1) !== odd) return 40;
  const top = starFenceTop(cx) + hash2(k, 1, 23) * 10, bottom = 1268 + hash2(k, 2, 23) * 16;
  const upright = starRect(x, y, cx - STAR_FENCE_W / 2 + 4, top, cx + STAR_FENCE_W / 2 - 4, bottom, 3);
  return odd ? Math.abs(upright + 3.5) - 3.5 : upright;                                                   // the light ones as an outline
}
function starPlants(x, y) {
  let d = 40;
  for (let i = 0; i < 60; i++) {
    const px = STAR_FENCE_X0 + 10 + i * 24 + (hash2(i, 1, 29) - 0.5) * 10, py = starFenceTop(px) - 6 + (hash2(i, 2, 29) - 0.5) * 12;
    if (hash2(i, 3, 29) < 0.3 || px > STAR_FENCE_X1 - 20) continue;
    d = Math.min(d, sdCircle(x, y, px, py, 9 + hash2(i, 4, 29) * 9));
  }
  return Math.max(d, y - starFenceTop(x) - 4);
}

const starBox = (x0, y0, x1, y1) => {
  const w = (X) => ((X - STAR_X0) * STAR_K + STAR_LEFT + 63 - 300) / 250, h = (Y) => (300 - ((Y - STAR_Y0) * STAR_K + STAR_TOP + 50)) / 250;
  return [w(x0) - 0.03, w(x1) + 0.03, h(y1) - 0.03, h(y0) + 0.03];
};
const starShape = (id, f, box, extra = {}) => ({ id, box: starBox(...box), sdf: starPx(f), ...extra });
export const star = {
  T: 4, active: [0, 1], S: 250, frame: [474, 500], hint: "the star by hackney downs",
  drive: driveUp,
  shapes: [
    starShape("render", starRender, [110, 60, 1200, 850]),
    starShape("chimneys", (x, y) => Math.min(starRect(x, y, 292, 300, 312, 336, 2), starRect(x, y, 318, 296, 338, 332, 2), starRect(x, y, 342, 302, 360, 334, 2), sdSegment(x, y, 296, 248, 296, 300) - 3), [280, 230, 370, 345]),
    starShape("lines", starLines, [95, 55, 1475, 960]),
    starShape("panes", starPanes, [140, 230, 1390, 815]),
    starShape("mural", starMural, [436, 524, 700, 820]),
    starShape("mural-tone", starMuralLayer(STAR_MURAL_TONE), [436, 524, 700, 820], { mark: "hatch", tone: 0.5, angle: 50 }),
    starShape("mural-cross", starMuralLayer(STAR_MURAL_CROSS), [436, 524, 700, 820], { mark: "hatch", tone: 0.5, angle: -40 }),
    starShape("mural-ink", starMuralLayer(STAR_MURAL_INK), [436, 524, 700, 820]),
    starShape("sign-field", starSignField, [1300, 460, 1410, 720], { mark: "hatch", tone: 0.75, angle: 30 }),
    starShape("sign-frame", starSignFrame, [1100, 448, 1430, 735]),
    starShape("fascia", starFascia, [170, 775, 1475, 960]),
    starShape("ground", starGround, [225, 905, 1455, 1110]),
    starShape("fence-solid", (x, y) => starFenceUpright(x, y, false), [60, 1060, 1510, 1295]),
    starShape("fence-outlined", (x, y) => starFenceUpright(x, y, true), [60, 1060, 1510, 1295]),
    starShape("plants", starPlants, [60, 1060, 1510, 1130]),
  ],
  step() {
    return {};                                                            // a still: nothing moves
  },
};
