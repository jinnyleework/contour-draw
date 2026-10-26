import { len2, subtract, roundBox, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A cassette deck lying flat: a body with a well holding a cassette, the cassette's two windows showing its reels, and
 * a row of five piano keys along the front. Move across it and it plays: the play key goes down, both reels turn, and
 * the tape winds from the left reel onto the right, one pack shrinking as the other grows. At rest the keys are up
 * and the tape is all on the left. The deck and cassette are cut once; the play key only moves; the reels are cut
 * again as they turn and wind.
 */
const DECK_REELS = [-0.18, 0.18], DECK_REEL_Y = 0.02;                   // where the two reels sit

/** a reel: a pack of tape of radius `pack` round a hub with six teeth, turned by `ph` */
const deckReel = (x, y, z, cx, pack, ph) => {
  const dx = x - cx, dy = y - DECK_REEL_Y, r = len2(dx, dy), th = Math.atan2(dy, dx) + ph;
  const tape = Math.max(r - pack, 0.045 - r, Math.abs(z + 0.045) - 0.012);                                         // the pack of tape, round the hub
  const ring = Math.max(r - 0.045, -(r - (0.026 + 0.007 * Math.cos(6 * th))), Math.abs(z + 0.04) - 0.016);         // a hub with six teeth inside
  return Math.min(tape, ring);
};

export const cassetteDeck = {
  T: 4, zr: [-0.14, 0.04], S: 400, zm: -0.05,
  active: [0, 2.4],                                              // the play key goes down and the tape winds; the pose at 0 is the rest pose
  drive: (x) => clamp((x - 130) / 340, 0, 1),                    // across the deck
  hint: "move across the deck to play the tape",
  parts: [
    { id: "deck", order: 0, cell: 0.008, box: { x: [-0.72, 0.72], y: [-0.55, 0.55] }, planes: planes(-0.14, 0.02, 0.01), sdf: (x, y, z) => {
      let d = roundBox(x, y, z + 0.07, 0.56, 0.4, 0.05, 0.02);                                                     // the body, top at z = 0
      d = subtract(d, Math.max(Math.abs(x) - 0.44, Math.abs(y + 0.02) - 0.27, -0.08 - z));                         // the well the cassette sits in
      for (let k = 0; k < 5; k++) if (k !== 1) d = Math.min(d, roundBox(x + 0.3 - 0.15 * k, y - 0.34, z - 0.01, 0.055, 0.035, 0.012, 0.008));   // the piano keys, but the play key
      return d;
    } },
    { id: "cassette", order: 1, cell: 0.007, box: { x: [-0.5, 0.5], y: [-0.36, 0.32] }, planes: planes(-0.08, -0.005, 0.01), sdf: (x, y, z) => {
      let d = roundBox(x, y + 0.02, z + 0.04, 0.4, 0.24, 0.025, 0.012);                                           // the shell
      for (const cx of DECK_REELS) d = subtract(d, Math.max(len2(x - cx, y - DECK_REEL_Y) - 0.1, -0.04 - z));       // two round windows onto the reels
      d = subtract(d, roundBox(x, y + 0.2, z, 0.25, 0.03, 0.03, 0.01));                                            // the opening along the bottom edge
      return d;
    } },
    { id: "play", order: 2, box: { x: [-0.25, -0.05], y: [0.22, 0.46] }, planes: planes(-0.01, 0.03, 0.01), sdf: (x, y, z) => roundBox(x + 0.15, y - 0.34, z - 0.01, 0.055, 0.035, 0.012, 0.008) },
    { id: "reels", order: 3, dynamic: true, cell: 0.005, key: (p) => p.f.toFixed(2) + ":" + p.ph.toFixed(2), box: { x: [-0.32, 0.32], y: [-0.13, 0.17] }, planes: planes(-0.065, -0.025, 0.01), sdf: (x, y, z, { f, ph }) => {
      const left = 0.095 - 0.045 * f, right = 0.05 + 0.045 * f;                                                     // the tape moves from the left pack to the right
      return Math.min(deckReel(x, y, z, DECK_REELS[0], left, ph * (0.07 / left)), deckReel(x, y, z, DECK_REELS[1], right, ph * (0.07 / right)));
    } },
  ],
  /**
   * k, the intensity: how much tape winds across.
   * 0: a third · 0.5: two thirds · 1: all of it
   */
  step(t, abs, k = 0.5) {
    const wind = byIntensity(k, [0.33, 0.66, 1]), e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t)), press = sm(0, 0.3, t) * (1 - sm(2.9, 3.4, t));
    return { deck: {}, cassette: {}, play: { off: [0, 0, -0.018 * press] }, reels: { prm: { f: Math.round(wind * e * 40) / 40, ph: Math.round(-wind * e * 30 * 25) / 25 } } };
  },
};
