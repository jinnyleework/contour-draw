import { hash2, clamp } from "../src/math.js";
import { bitmapSdf } from "../src/ink.js";
import { driveUp } from "../src/figure.js";
import { diver } from "./diver.js";

/* The dive: the diver traced from the photo (figures/diver.js: his solid and the cross-hatch on his lit back), set in a sea
 * drawn by hand rather than traced, cut in the same heavy ink as he is. The sea is a woodcut gradient: under the horizon it
 * is fine black strokes on paper; nearer us the strokes swell until the water is solid ink with white wave lines cut into it.
 * The strokes break where the sun is on the water, and a paper halo keeps the diver clear of the dark water. A still. */
const THE_DIVE_HORIZON = 0.5;
const THE_DIVE_SOLID = diver.shapes.find((s) => s.id === "ink").bitmap;
const THE_DIVE_CROSS = diver.shapes.find((s) => s.id === "cross").bitmap;

/** the diver's solid, grown by a paper halo: the sea is cut away inside it */
const theDiveHalo = (x, y) => bitmapSdf(THE_DIVE_SOLID)(x, y) - 0.04;

/**
 * The sea: rows in perspective (close under the horizon, wide near us). Each row is a run of wavy strokes tapered at both
 * ends; `q`, how near the row is (0 at the horizon, 1 at the bottom), sets how much of the row's height the strokes fill and
 * how short the gaps between them are, so near water closes into solid ink with paper lines left between the rows.
 */
function theDiveSea(x, y) {
  const d = THE_DIVE_HORIZON - 0.03 - y;
  if (d < 0) return Math.max(-d, 0.01);
  const depth = 1.5, rows = 24, r = Math.sqrt(d / depth) * rows, n = Math.round(r), q = clamp(n / rows, 0, 1);
  const pitch = (2 * Math.sqrt(Math.max(d, 0.002) / depth) * depth) / rows;   // world height of one row here
  // strokes: long and nearly joined near us, short with open gaps far off; fewer kept where the sun glitters
  const len = 0.08 + q * 0.5, off = hash2(n, 3, 41) * len, s = Math.floor((x + off) / len), along = x + off - s * len;
  const t = clamp(along / len, 0, 1);
  const glitter = clamp(1 - Math.hypot((x - 0.35) / 0.55, (y + 0.2) / 0.4), 0, 1);
  const keep = hash2(s, n, 17) > 0.2 * (1 - q) + glitter * (0.6 - q * 0.3);
  // the row's centre line waves along x, and each stroke bows a little on its own
  const bow = (hash2(s, n, 5) - 0.5) * (0.5 - q * 0.25) * Math.sin(t * Math.PI);
  const wave = (Math.sin(x * (9 - q * 3) + n * 1.7) * (0.22 - q * 0.06) + bow) * pitch;
  const centre = Math.abs((r - n) * pitch - wave);                       // distance to the row's centre line, world units
  const fill = 0.16 + 0.68 * Math.pow(q, 1.15);                          // share of the row the stroke covers
  const half = 0.5 * pitch * fill * Math.pow(Math.sin(t * Math.PI), 0.35 + 0.4 * (1 - q)) + 0.0015;
  const stroke = centre - half;
  return keep ? Math.max(stroke, Math.abs(x) - 0.95, -0.95 - y) : Math.max(stroke, 0.004);
}

export const theDive = {
  T: 4, active: [0, 1], S: 300, hint: "the dive",
  drive: driveUp,
  shapes: [
    { id: "sea", box: [-1, 1, -1, THE_DIVE_HORIZON + 0.02], sdf: (x, y) => Math.max(theDiveSea(x, y), -theDiveHalo(x, y)) },
    { id: "horizon", box: [-1, 1, THE_DIVE_HORIZON - 0.06, THE_DIVE_HORIZON + 0.06],
      sdf: (x, y) => Math.max(Math.abs(y - THE_DIVE_HORIZON) - 0.006, Math.abs(x) - 0.95, -theDiveHalo(x, y)) },
    { id: "back", mark: "hatch", tone: 0.5, angle: -40, bitmap: THE_DIVE_CROSS },
    { id: "diver", bitmap: THE_DIVE_SOLID },
  ],
  step() {
    return {};                                                            // a still: nothing moves
  },
};
