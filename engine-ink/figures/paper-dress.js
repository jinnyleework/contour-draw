import { sdBox, sdEllipse, sdPath, hash2, clamp } from "../src/math.js";
import { bitmapSdf } from "../src/ink.js";
import { driveUp } from "../src/figure.js";
import { _paperDressSign } from "./_paper-dress-sign.js";
import { _paperDressShop } from "./_paper-dress-shop.js";

/*
 * Paper Dress Vintage: the shopfront from the photo (reference/paper-dress.webp) as a woodcut, for a card's 474 x 500 picture
 * box. The shop is wide and the card tall, so the front keeps its full width (the sign whole) and the storey above, which the
 * photo crops off, is drawn in: a row of windows under a dentilled cornice, the building ending on its own marks. Traced from the
 * photo: the sign (paper letters cut in the black fascia, figures/_paper-dress-sign.js) and the shop below it, the chalkboards,
 * the rail of clothes, the mannequins in the window, the A-board (figures/_paper-dress-shop.js). Drawn: the fascia, the canopy,
 * the three gooseneck lamps, the green mosaic piers as a field of small tiles, the terrazzo floor as scattered chips. A still.
 */
const PD_K = 0.002057;                                                     // world units per photo px: the shop's 875 px across 1.8
const pdX = (px) => (px - 467.5) * PD_K, pdY = (py) => -0.86 + (620 - py) * PD_K;
const PD_FASCIA = [pdY(215), pdY(70)], PD_L = -0.9, PD_R = 0.9, PD_FLOOR = -0.86;
const PD_UPPER = [PD_FASCIA[1] + 0.03, 0.82];                              // the storey above: its foot and its cornice top

/* ---------- traced from the photo ---------- */
const PD_SIGN = { area: [pdX(95), pdX(815), pdY(188), pdY(96)], mask: _paperDressSign.shapes[0].bitmap.mask };
const PD_SHOP = { area: [pdX(55), pdX(840), pdY(580), pdY(285)], mask: _paperDressShop.shapes[0].bitmap.mask };
const pdShop = (x, y) => bitmapSdf(PD_SHOP)(x, y);

/** the fascia: a black board across the front, a paper rule inset round it, the name in paper letters */
function pdFascia(x, y) {
  const cy = (PD_FASCIA[0] + PD_FASCIA[1]) / 2, hh = (PD_FASCIA[1] - PD_FASCIA[0]) / 2;
  const board = sdBox(x, y, 0, cy, PD_R, hh), rule = Math.abs(sdBox(x, y, 0, cy, PD_R - 0.028, hh - 0.028)) - 0.005;
  return Math.max(board, -rule, -bitmapSdf(PD_SIGN)(x, y));
}
/** the canopy under the fascia: hatched, not solid, so it does not stack a second black band under the board; a firm line at its foot */
const PD_CANOPY = [pdY(270), PD_FASCIA[0] - 0.014];
const pdCanopy = (x, y) => sdBox(x, y, 0, (PD_CANOPY[0] + PD_CANOPY[1]) / 2, PD_R, (PD_CANOPY[1] - PD_CANOPY[0]) / 2);
const pdCanopyFoot = (x, y) => Math.max(Math.abs(y - PD_CANOPY[0]) - 0.008, Math.abs(x) - PD_R);

/** three gooseneck lamps rising from the fascia's top, arching forward, their domed shades over the board */
function pdLamps(x, y) {
  let d = Infinity;
  for (const px of [170, 455, 735]) {
    const sx = pdX(px), top = PD_FASCIA[1];
    const arm = sdPath(x, y, [[sx - 0.07, top + 0.005], [sx - 0.07, top + 0.06], [sx - 0.04, top + 0.09], [sx, top + 0.085], [sx, top + 0.05]], 0.012);
    const shade = Math.max(sdEllipse(x, y, sx, top + 0.022, 0.05, 0.034), top + 0.006 - y);
    const rim = Math.max(Math.abs(y - (top + 0.012)) - 0.004, Math.abs(x - sx) - 0.04);
    d = Math.min(d, arm, Math.max(shade, -rim));
  }
  return d;
}

/** the green mosaic piers either side: small square tiles, about half of them dark, so the piers are a field, not a block */
function pdMosaic(x, y) {
  const inPier = Math.min(Math.max(PD_L - x, x - pdX(55)), Math.max(pdX(842) - x, x - PD_R + 0.04));
  if (inPier > 0.02 || y < PD_FLOOR + 0.04 || y > pdY(288)) return 1;
  const t = 0.028, i = Math.floor(x / t), j = Math.floor(y / t);
  if (hash2(i, j, 51) > 0.55) return 0.012;
  return Math.max(sdBox(x, y, (i + 0.5) * t, (j + 0.5) * t, t * 0.38, t * 0.38), inPier);
}

/** the terrazzo floor in front: scattered chips, a different turn each, thinning out at the front edge */
function pdTerrazzo(x, y) {
  const c = 0.028, i = Math.floor(x / c), j = Math.floor(y / c);
  let d = 1;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const ci = i + a, cj = j + b, cx = (ci + hash2(ci, cj, 61)) * c, cy = (cj + hash2(ci, cj, 62)) * c;
    if (cy > pdY(578) || cy < PD_FLOOR - 0.07 + hash2(ci, 0, 63) * 0.05 || Math.abs(cx) > 0.84 + hash2(cj, 1, 64) * 0.06) continue;
    if (hash2(ci, cj, 65) > 0.72) continue;
    const ang = hash2(ci, cj, 66) * Math.PI, ca = Math.cos(ang), sa = Math.sin(ang), u = (x - cx) * ca + (y - cy) * sa, v = -(x - cx) * sa + (y - cy) * ca;
    d = Math.min(d, sdBox(u, v, 0, 0, 0.007 + hash2(ci, cj, 67) * 0.009, 0.004 + hash2(ci, cj, 68) * 0.005));
  }
  return d;
}

/* ---------- the storey above, drawn in: a rendered wall, a row of windows, a dentilled cornice ---------- */
const PD_WINDOWS = [-0.66, -0.22, 0.22, 0.66];
function pdUpper(x, y) {
  const [foot, top] = PD_UPPER;
  // the cornice: a black band, dentils under it
  const cornice = sdBox(x, y, 0, top - 0.02, PD_R + 0.02, 0.02);
  const dentil = Math.max(sdBox(x, y, 0, top - 0.055, PD_R, 0.012), Math.abs(((x % 0.04) + 0.04) % 0.04 - 0.02) - 0.0105);
  // the windows: dark glass, paper frames, a transom and mullion; a sill under each
  let win = Infinity;
  for (const cx of PD_WINDOWS) {
    const g = sdBox(x, y, cx, 0.545, 0.105, 0.155), bars = Math.min(Math.abs(x - cx) - 0.008, Math.abs(y - 0.63) - 0.008);
    win = Math.min(win, Math.max(g, -bars), sdBox(x, y, cx, 0.372, 0.13, 0.009));
  }
  // the render: broken joints in long courses, light; the wall's edges as two firm lines
  const row = Math.floor((y - foot) / 0.065), joint = Math.abs((((y - foot) % 0.065) + 0.065) % 0.065 - 0.0325);
  const seg = Math.floor((x + row * 0.11) / 0.22);
  const render = Math.max(0.0325 - joint - 0.0035, Math.abs(x) - PD_R + 0.02, foot + 0.02 - y, y - (top - 0.08), hash2(seg, row, 71) < 0.45 ? 1 : -1, -(Math.min(...PD_WINDOWS.map((cx) => sdBox(x, y, cx, 0.53, 0.15, 0.2)))));
  const edges = Math.max(Math.abs(Math.abs(x) - PD_R + 0.008) - 0.006, foot - y, y - top);
  return Math.min(cornice, dentil, win, render, edges);
}

const PD_BOX = [-1, 1, -1.0, 0.95];
export const paperDress = {
  T: 4, active: [0, 1], S: 250, frame: [474, 500], hint: "paper dress vintage",
  drive: driveUp,
  shapes: [
    { id: "upper", box: PD_BOX, sdf: (x, y) => Math.max(pdUpper(x, y), -(pdLamps(x, y) - 0.015)) },
    { id: "fascia", box: PD_BOX, sdf: (x, y) => Math.max(pdFascia(x, y), -(pdLamps(x, y) - 0.015)) },
    { id: "lamps", box: PD_BOX, sdf: pdLamps },
    { id: "canopy", mark: "hatch", tone: 0.7, angle: 90, box: PD_BOX, sdf: pdCanopy },
    { id: "canopy-foot", box: PD_BOX, sdf: pdCanopyFoot },
    { id: "shop", box: [-0.9, 0.82, -0.82, -0.12], sdf: pdShop },
    { id: "mosaic", box: PD_BOX, sdf: pdMosaic },
    { id: "terrazzo", box: PD_BOX, sdf: pdTerrazzo },
  ],
  step() {
    return {};                                                            // a still: nothing moves
  },
};
