import { sdBox, sdCircle, sdSegment, sdPolygon, sdPath, hash2, clamp } from "../src/math.js";
import { driveUp } from "../src/figure.js";

/*
 * The Spurstowe Arms: the pub alone, drawn by hand from the photo (reference/spurstowe.png) as a woodcut, for a card's 474 x 500
 * picture box. Three storeys of pale stock brick, drawn mostly as paper with a scatter of brick strokes, dressed in dark red
 * brick (solid ink with paper joints): quoins up both corners, which step in and out and give the building its own edges,
 * segmental arches and jamb blocks round the sash windows. A coping and a chimney on top. The ground floor is completed where a
 * car hid it: cream pilasters, dark windows and the door, two wall lanterns, the fascia with the name in paper letters,
 * lettered by hand after the photo's bold slab-serif capitals (traced, they were too small in the photo to read). A pavement of
 * tapered strokes underneath. A still.
 */
const SPUR_L = -0.57, SPUR_R = 0.57, SPUR_GROUND = -0.86, SPUR_TOP = 0.78;
const SPUR_FASCIA = [-0.405, -0.265];                                        // the fascia's bottom and top
const SPUR_WINDOWS = [                                                     // [cx, bottom, top, half-width, curtains]
  [-0.27, 0.25, 0.47, 0.068, false], [0.27, 0.25, 0.47, 0.068, false],
  [-0.27, -0.22, 0.1, 0.075, true], [0.27, -0.22, 0.1, 0.075, true],
];

/* ---------- the upper walls ---------- */
const spurFacade = (x, y) => sdBox(x, y, 0, (SPUR_FASCIA[1] + SPUR_TOP) / 2, SPUR_R, (SPUR_TOP - SPUR_FASCIA[1]) / 2);
const spurOpening = ([cx, b, t, hw]) => (x, y) => sdBox(x, y, cx, (b + t) / 2, hw, (t - b) / 2);
const spurOpenings = (x, y) => Math.min(...SPUR_WINDOWS.map((w) => spurOpening(w)(x, y)));

/** the pale stock brick: a scatter of short tapered strokes along the courses, about a third of the bricks, so the wall stays light */
function spurBrickStrokes(x, y) {
  const course = 0.034, row = Math.floor((y - SPUR_GROUND) / course), off = (row % 2) * 0.04;
  const col = Math.floor((x + off) / 0.08), t = (x + off - col * 0.08) / 0.08;
  if (hash2(col, row, 31) > 0.55) return 1;
  const yy = SPUR_GROUND + row * course + course * 0.3, half = 0.0075 * Math.pow(Math.sin(clamp((t - 0.08) / 0.84, 0, 1) * Math.PI), 0.5);
  return Math.abs(y - yy) - half;
}

/** dark red dressings: quoins up both corners (long and short blocks in turn), the arch over each window, its jamb blocks */
function spurDressings(x, y) {
  let d = Infinity;
  // quoins: blocks 0.05 tall, alternately 0.12 and 0.075 long, set in from each corner; joints left as paper
  for (const side of [-1, 1]) {
    const k = Math.floor((y - SPUR_FASCIA[1]) / 0.05), len = k % 2 ? 0.075 : 0.12, cy = SPUR_FASCIA[1] + k * 0.05 + 0.025;
    if (cy < SPUR_TOP - 0.06 && cy > SPUR_FASCIA[1] + 0.03) d = Math.min(d, sdBox(x, y, side * (SPUR_R - len / 2), cy, len / 2 - 0.004, 0.025 - 0.009));
  }
  for (const [cx, b, t, hw] of SPUR_WINDOWS) {
    // the segmental arch: a band of voussoirs over the head, the joints radial
    const R = hw * 1.6, ccy = t - R * 0.62, r = Math.hypot(x - cx, y - ccy);
    if (y > t - 0.03) {
      const a = Math.atan2(y - ccy, x - cx), step = 0.17, j = Math.abs(((a % step) + step) % step - step / 2) * r;
      d = Math.min(d, Math.max(r - R - 0.05, R - r, t - 0.002 - y, 0.007 - j));
    }
    // jamb blocks either side: short and long in turn
    for (const side of [-1, 1]) {
      const k = Math.floor((y - b) / 0.045), len = k % 2 ? 0.03 : 0.05, cy = b + k * 0.045 + 0.0225;
      if (cy > b && cy < t) d = Math.min(d, sdBox(x, y, cx + side * (hw + len / 2 + 0.006), cy, len / 2, 0.0225 - 0.008));
    }
  }
  return d;
}

/** the sash windows: dark glass with the white sashes left as paper, curtains in the lower sashes on the first floor */
function spurGlass(x, y) {
  let d = Infinity;
  for (const w of SPUR_WINDOWS) {
    const [cx, b, t, hw, curtains] = w, frame = 0.013, mid = (b + t) / 2;
    const pane = sdBox(x, y, cx, mid, hw - frame, (t - b) / 2 - frame);
    const bars = Math.min(Math.abs(x - cx) - 0.009, Math.abs(y - mid) - 0.011);
    let g = Math.max(pane, -bars);
    if (curtains && y < mid) g = Math.max(g, -(sdBox(x, y, cx, (b + mid) / 2, hw - frame, (mid - b) / 2 - frame) + 0.002)) ;
    if (curtains && y < mid) g = Math.min(g, Math.max(pane, Math.min(...[-0.04, 0, 0.04].map((f) => Math.abs(x - cx - f) - 0.0028)), y - mid + 0.012));
    d = Math.min(d, g);
  }
  return d;
}
const spurSills = (x, y) => Math.min(...SPUR_WINDOWS.map(([cx, b, , hw]) => sdBox(x, y, cx, b - 0.012, hw + 0.03, 0.008)));

/** the coping along the parapet, a string course over the fascia, and the chimney stack with its pots */
function spurRoof(x, y) {
  const coping = sdBox(x, y, 0, SPUR_TOP - 0.012, SPUR_R + 0.02, 0.016);
  const stackBody = sdBox(x, y, 0.42, SPUR_TOP + 0.06, 0.075, 0.06);
  const course = Math.floor((y - SPUR_TOP) / 0.03), joint = Math.abs((((y - SPUR_TOP) % 0.03) + 0.03) % 0.03 - 0.015);
  const stack = Math.max(stackBody, -(0.015 - joint - 0.0035 + (course < 0 ? 1 : 0)));
  const cap = sdBox(x, y, 0.42, SPUR_TOP + 0.128, 0.09, 0.012);
  const pots = Math.min(sdBox(x, y, 0.385, SPUR_TOP + 0.162, 0.016, 0.025, 0.006), sdBox(x, y, 0.455, SPUR_TOP + 0.158, 0.016, 0.021, 0.006));
  return Math.min(coping, stack, cap, pots);
}

/* ---------- the ground floor ---------- */
/**
 * The sign's lettering, drawn after the photo: bold slab-serif capitals (a Victorian pub's gilt letters). Each glyph is strokes
 * in cap-height units, [polyline, weight]: stems heavy, serifs as bars. Nothing is thinner than 0.17 of the cap height: paper
 * letters in a black board shrink as the ink spreads, and a thinner stroke closes. `w` is the advance.
 */
const SPUR_STEM = 0.21, SPUR_SERIF = 0.12;
const SPUR_GLYPHS = {
  T: { w: 0.8, s: [[[[0.05, 0.97], [0.75, 0.97]], 0.19], [[[0.4, 0.97], [0.4, 0]], SPUR_STEM], [[[0.24, 0.03], [0.56, 0.03]], SPUR_SERIF], [[[0.06, 0.97], [0.06, 0.8]], SPUR_SERIF], [[[0.74, 0.97], [0.74, 0.8]], SPUR_SERIF]] },
  H: { w: 0.86, s: [[[[0.13, 0], [0.13, 1]], SPUR_STEM], [[[0.73, 0], [0.73, 1]], SPUR_STEM], [[[0.13, 0.52], [0.73, 0.52]], 0.17], [[[0, 0.03], [0.27, 0.03]], SPUR_SERIF], [[[0, 0.97], [0.27, 0.97]], SPUR_SERIF], [[[0.59, 0.03], [0.86, 0.03]], SPUR_SERIF], [[[0.59, 0.97], [0.86, 0.97]], SPUR_SERIF]] },
  E: { w: 0.74, s: [[[[0.13, 0], [0.13, 1]], SPUR_STEM], [[[0.13, 0.97], [0.66, 0.97]], 0.17], [[[0.13, 0.52], [0.5, 0.52]], 0.17], [[[0.13, 0.03], [0.68, 0.03]], 0.17], [[[0, 0.03], [0.2, 0.03]], SPUR_SERIF], [[[0, 0.97], [0.2, 0.97]], SPUR_SERIF], [[[0.66, 0.97], [0.66, 0.78]], SPUR_SERIF], [[[0.68, 0.03], [0.68, 0.22]], SPUR_SERIF]] },
  S: { w: 0.74, s: [[[[0.62, 0.82], [0.52, 0.96], [0.3, 0.98], [0.13, 0.86], [0.13, 0.66], [0.3, 0.55], [0.5, 0.47], [0.64, 0.34], [0.64, 0.14], [0.47, 0.02], [0.24, 0.02], [0.1, 0.16]], 0.22], [[[0.62, 0.98], [0.62, 0.76]], SPUR_SERIF], [[[0.1, 0.02], [0.1, 0.24]], SPUR_SERIF]] },
  P: { w: 0.74, s: [[[[0.13, 0], [0.13, 1]], SPUR_STEM], [[[0.13, 0.97], [0.48, 0.97], [0.64, 0.85], [0.64, 0.66], [0.48, 0.54], [0.13, 0.54]], 0.19], [[[0, 0.03], [0.32, 0.03]], SPUR_SERIF], [[[0, 0.97], [0.13, 0.97]], SPUR_SERIF]] },
  U: { w: 0.84, s: [[[[0.13, 1], [0.13, 0.26], [0.26, 0.03], [0.52, 0.03], [0.68, 0.26], [0.68, 1]], SPUR_STEM], [[[0, 0.97], [0.28, 0.97]], SPUR_SERIF], [[[0.55, 0.97], [0.82, 0.97]], SPUR_SERIF]] },
  R: { w: 0.82, s: [[[[0.13, 0], [0.13, 1]], SPUR_STEM], [[[0.13, 0.97], [0.48, 0.97], [0.64, 0.85], [0.64, 0.66], [0.48, 0.54], [0.13, 0.54]], 0.19], [[[0.4, 0.54], [0.68, 0.03]], SPUR_STEM], [[[0, 0.03], [0.28, 0.03]], SPUR_SERIF], [[[0, 0.97], [0.13, 0.97]], SPUR_SERIF], [[[0.6, 0.03], [0.82, 0.03]], SPUR_SERIF]] },
  O: { w: 0.84, s: [[[[0.42, 0.98], [0.18, 0.86], [0.1, 0.5], [0.18, 0.14], [0.42, 0.02], [0.66, 0.14], [0.74, 0.5], [0.66, 0.86], [0.42, 0.98]], 0.22]] },
  W: { w: 1.08, s: [[[[0.06, 1], [0.27, 0.02], [0.54, 0.72], [0.81, 0.02], [1.02, 1]], 0.21], [[[-0.04, 0.97], [0.2, 0.97]], SPUR_SERIF], [[[0.9, 0.97], [1.12, 0.97]], SPUR_SERIF]] },
  A: { w: 0.88, s: [[[[0.06, 0.02], [0.44, 0.99]], 0.18], [[[0.44, 0.99], [0.8, 0.02]], SPUR_STEM], [[[0.24, 0.34], [0.64, 0.34]], 0.17], [[[-0.04, 0.03], [0.2, 0.03]], SPUR_SERIF], [[[0.66, 0.03], [0.94, 0.03]], SPUR_SERIF]] },
  M: { w: 1.0, s: [[[[0.12, 0.02], [0.12, 0.98]], 0.18], [[[0.12, 0.98], [0.49, 0.18]], SPUR_STEM], [[[0.49, 0.18], [0.86, 0.98]], 0.18], [[[0.86, 0.98], [0.86, 0.02]], SPUR_STEM], [[[0, 0.03], [0.24, 0.03]], SPUR_SERIF], [[[0.74, 0.03], [0.98, 0.03]], SPUR_SERIF]] },
  " ": { w: 0.36, s: [] },
};
/** a line of lettering as an sdf: centred on cx, baseline at base, cap height h, letters `track` apart */
function spurLettering(text, cx, base, h, track = 0.1) {
  const glyphs = [...text].map((c) => SPUR_GLYPHS[c]), total = glyphs.reduce((a, g) => a + g.w + track, -track) * h;
  let at = cx - total / 2;
  const placed = glyphs.map((g) => { const p = { g, x0: at }; at += (g.w + track) * h; return p; });
  return (x, y) => {
    let d = 1;
    for (const { g, x0 } of placed) {
      if (x < x0 - h * 0.2 || x > x0 + (g.w + 0.2) * h) continue;
      const u = (x - x0) / h, v = (y - base) / h;
      for (const [pts, w] of g.s) d = Math.min(d, sdPath(u, v, pts, w) * h);
    }
    return d;
  };
}
const spurSign = spurLettering("THE SPURSTOWE ARMS", 0, -0.368, 0.066);
/** the fascia: a black board across the front, the name in paper letters */
const spurFascia = (x, y) => Math.max(sdBox(x, y, 0, (SPUR_FASCIA[0] + SPUR_FASCIA[1]) / 2, SPUR_R + 0.015, (SPUR_FASCIA[1] - SPUR_FASCIA[0]) / 2), -spurSign(x, y));

/** the openings of the shopfront: a window, the big window, the door; the rest is cream pilaster */
const SPUR_BAYS = [[-0.53, -0.34, -0.7], [-0.27, -0.02, -0.7], [0.06, 0.24, SPUR_GROUND]];   // [x0, x1, bottom of the glass]
const SPUR_SHOP_TOP = -0.43;
const SPUR_PILASTERS = [[-0.57, -0.53], [-0.34, -0.27], [-0.02, 0.06], [0.24, 0.3]];   // between and beside the openings
function spurShop(x, y) {
  let d = Infinity;
  for (const [x0, x1, bot] of SPUR_BAYS) {
    const cx = (x0 + x1) / 2, hw = (x1 - x0) / 2;
    const open = sdBox(x, y, cx, (bot + SPUR_SHOP_TOP) / 2, hw, (SPUR_SHOP_TOP - bot) / 2);
    // glazing bars: a transom of small panes along the top, mullions below
    const transom = Math.abs(y - (SPUR_SHOP_TOP - 0.07)) - 0.006;
    const small = y > SPUR_SHOP_TOP - 0.07 ? Math.abs(((x - x0) % 0.045 + 0.045) % 0.045 - 0.0225) - 0.0045 : Infinity;
    const mull = bot > SPUR_GROUND ? Math.abs(x - cx) - 0.006 : Infinity;
    d = Math.min(d, Math.max(open, -Math.min(transom, small, mull)));
    // under a window, the stall riser: a dark panel with a paper inset
    if (bot > SPUR_GROUND) {
      const riser = sdBox(x, y, cx, (SPUR_GROUND + bot - 0.02) / 2, hw, (bot - 0.02 - SPUR_GROUND) / 2);
      d = Math.min(d, Math.max(riser, -(Math.abs(sdBox(x, y, cx, (SPUR_GROUND + bot - 0.02) / 2, hw - 0.03, (bot - 0.02 - SPUR_GROUND) / 2 - 0.03)) - 0.005)));
    }
  }
  // the cream pilasters between the openings, each fluted with two fine lines; the plinth along the foot
  const front = Math.max(Math.abs(x) - SPUR_R, Math.abs(y - (SPUR_GROUND + SPUR_SHOP_TOP) / 2) - (SPUR_SHOP_TOP - SPUR_GROUND) / 2);
  let flutes = Infinity;
  for (const [p0, p1] of SPUR_PILASTERS) {
    const inPier = Math.max(p0 - x, x - p1, SPUR_GROUND + 0.07 - y, y - SPUR_SHOP_TOP + 0.02);
    flutes = Math.min(flutes, Math.max(inPier, Math.min(Math.abs(x - p0 - 0.016) - 0.0035, Math.abs(x - p1 + 0.016) - 0.0035)));
  }
  // the wide pier on the right is rendered ashlar: broken horizontal joints
  const ashRow = Math.abs((((y - SPUR_GROUND) % 0.075) + 0.075) % 0.075 - 0.0375), ashCol = Math.floor((x - 0.3) / 0.09) + Math.floor((y - SPUR_GROUND) / 0.075) * 7;
  const ashlar = Math.max(0.0375 - ashRow - 0.0055, 0.31 - x, x - 0.53, SPUR_GROUND + 0.07 - y, y - SPUR_SHOP_TOP + 0.03, hash2(ashCol, 3, 5) < 0.18 ? 1 : -1);
  const plinth = Math.max(Math.abs(y - (SPUR_GROUND + 0.05)) - 0.006, front);
  return Math.max(Math.min(d, flutes, ashlar, plinth), -(spurLanterns(x, y) - 0.016));   // a paper halo keeps the lanterns clear
}

/** a wall lantern: bracket, cap, glass in a frame, a finial below */
function spurLantern(x, y, cx, cy) {
  const arm = sdSegment(x, y, cx + 0.05, cy + 0.07, cx, cy + 0.07) - 0.006;
  const cap = sdPolygon(x, y, [[cx - 0.035, cy + 0.04], [cx + 0.035, cy + 0.04], [cx + 0.012, cy + 0.075], [cx - 0.012, cy + 0.075]]);
  const body = sdPolygon(x, y, [[cx - 0.035, cy + 0.04], [cx + 0.035, cy + 0.04], [cx + 0.024, cy - 0.04], [cx - 0.024, cy - 0.04]]);
  const glass = sdPolygon(x, y, [[cx - 0.022, cy + 0.03], [cx + 0.022, cy + 0.03], [cx + 0.014, cy - 0.03], [cx - 0.014, cy - 0.03]]);
  const fin = sdCircle(x, y, cx, cy - 0.052, 0.01);
  return Math.min(arm, cap, Math.max(body, -glass), fin, Math.max(glass, Math.abs(x - cx) - 0.003));
}
const spurLanterns = (x, y) => Math.min(spurLantern(x, y, -0.305, -0.53), spurLantern(x, y, 0.4, -0.53));

/** the pavement: two rows of tapered strokes under the front, ending of their own accord */
function spurPavement(x, y) {
  let d = Infinity;
  for (const [row, yy, len, half] of [[0, SPUR_GROUND - 0.03, 0.22, 0.007], [1, SPUR_GROUND - 0.075, 0.3, 0.006]]) {
    const off = hash2(row, 2, 3) * len, s = Math.floor((x + off) / len), t = (x + off - s * len) / len;
    if (hash2(s, row, 13) < 0.25 || Math.abs(x) > 0.66 + hash2(s, row, 17) * 0.1) continue;
    const w = half * Math.pow(Math.sin(clamp((t - 0.06) / 0.88, 0, 1) * Math.PI), 0.5);
    d = Math.min(d, Math.abs(y - yy - Math.sin(x * 7 + row) * 0.004) - w);
  }
  return d;
}

/** the wall, cut away where the windows, dressings and sills sit, with a paper margin round them */
const spurWall = (x, y) => Math.max(spurFacade(x, y), spurBrickStrokes(x, y), -(spurOpenings(x, y) - 0.035), -(spurDressings(x, y) - 0.008), SPUR_FASCIA[1] + 0.03 - y, y - SPUR_TOP + 0.04);

const SPUR_BOX = [-0.75, 0.75, -1.0, 1.02];
export const spurstowe = {
  T: 4, active: [0, 1], S: 250, frame: [474, 500], hint: "the spurstowe arms",
  drive: driveUp,
  shapes: [
    { id: "wall", box: SPUR_BOX, sdf: spurWall },
    { id: "dressings", box: SPUR_BOX, sdf: (x, y) => Math.max(spurDressings(x, y), -(spurOpenings(x, y) - 0.008)) },
    { id: "glass", box: SPUR_BOX, sdf: spurGlass },
    { id: "sills", box: SPUR_BOX, sdf: spurSills },
    { id: "roof", box: SPUR_BOX, sdf: spurRoof },
    { id: "fascia", box: SPUR_BOX, sdf: spurFascia },
    { id: "shop", box: SPUR_BOX, sdf: spurShop },
    { id: "lanterns", box: SPUR_BOX, sdf: spurLanterns },
    { id: "pavement", box: SPUR_BOX, sdf: spurPavement },
  ],
  step() {
    return {};                                                            // a still: nothing moves
  },
};
