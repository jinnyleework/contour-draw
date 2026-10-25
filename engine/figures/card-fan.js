import { roundBox, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * Seven playing cards in a stack, each a different card: an ace of spades, a two of diamonds, a three of clubs, and so
 * on up to the five of hearts on top. A card is a rounded rectangle with its suit marked in two corners and its pips
 * standing up from the face, and no letters or numerals. Move up and the cards fan out about the stack's lower end, the
 * top card swinging furthest, until they make an arc. At rest they are squared into one stack. All seven are one dynamic
 * part, cut again as they fan.
 */
const CARDS = 7, CARD_PITCH = 0.05, CARD_FACE = 0.012;                  // how many cards, how far apart they lie, and half the thickness of one
const CARD_DECK = [[1, "spade"], [2, "diamond"], [3, "club"], [4, "spade"], [6, "diamond"], [2, "heart"], [5, "heart"]];   // the count and suit of each card, bottom to top
const CARD_PIPS = [[], [[0, 0]], [[0, 0.09], [0, -0.09]], [[0, 0.1], [0, 0], [0, -0.1]], [[-0.05, 0.09], [0.05, 0.09], [-0.05, -0.09], [0.05, -0.09]],
  [[-0.05, 0.09], [0.05, 0.09], [0, 0], [-0.05, -0.09], [0.05, -0.09]], [[-0.05, 0.1], [0.05, 0.1], [-0.05, 0], [0.05, 0], [-0.05, -0.1], [0.05, -0.1]]];   // where the pips sit on a card of each count

/** a suit mark as an inside-outside value (negative inside), in a unit frame about 2 wide, upright */
const cardSuit = (x, y, suit) => {
  const heart = (hx, hy) => Math.pow(hx * hx + hy * hy - 1, 3) - hx * hx * Math.pow(hy, 3);
  const stem = (sx, sy, top, bot) => Math.max(Math.abs(sx) - (0.1 + 0.3 * clamp((top - sy) / 0.5, 0, 1)), sy - top, bot - sy);
  if (suit === "heart") return heart(x * 0.95, y * 0.95 - 0.1) * 0.5;
  if (suit === "diamond") return (Math.abs(x) * 1.35 + Math.abs(y) - 1.05) * 0.5;
  if (suit === "spade") return Math.min(heart(x * 0.95, -y * 0.95 - 0.25) * 0.5, stem(x, y, -0.45, -1.15));
  const ball = (cx, cy) => Math.hypot(x - cx, y - cy) - 0.46;                                                       // a club: three round lobes and a stem
  return Math.min(ball(0, 0.5), ball(-0.5, -0.2), ball(0.5, -0.2), stem(x, y, -0.2, -1.1));
};

export const cardFan = {
  T: 4, zr: [0, 0.4], S: 420, zm: 0.15,
  active: [0, 2.2],                                              // the cards fan out; the pose at 0 is the rest pose, squared
  drive: (x, y) => clamp((480 - y) / 300, 0, 1),                 // up the cards
  hint: "move up the cards to fan them out",
  parts: [
    { id: "cards", order: 0, dynamic: true, cell: 0.011, key: (p) => p.s.toFixed(2), box: { x: [-0.65, 0.65], y: [-0.4, 0.5] }, planes: planes(0.0, CARDS * CARD_PITCH, 0.01), sdf: (x, y, z, { s }) => {
      const i = clamp(Math.round((z - 0.025) / CARD_PITCH), 0, CARDS - 1), ang = (i - (CARDS - 1) / 2) * s, zc = 0.025 + i * CARD_PITCH;   // this card's height and its turn about the stack's lower end
      const dy = y + 0.2, c = Math.cos(ang), sn = Math.sin(ang), u = x * c + dy * sn, v = -x * sn + dy * c - 0.2;
      const slab = Math.max(roundBox(u, v, 0, 0.115, 0.185, 0, 0.03), Math.abs(z - zc) - CARD_FACE);                                           // the card itself, a rounded rectangle
      if (z < zc + CARD_FACE * 0.5 || slab > 0.04) return slab;                                                     // the pips only stand up from the face
      const [count, suit] = CARD_DECK[i];
      let pip = 1;
      for (const [px, py] of CARD_PIPS[count]) pip = Math.min(pip, cardSuit((u - px) / 0.034, (v - py) / 0.034, suit));
      pip = Math.min(pip, cardSuit((u + 0.078) / 0.016, (v - 0.14) / 0.016, suit), cardSuit((u - 0.078) / 0.016, (v + 0.14) / 0.016, suit));   // and a small mark in two corners
      return Math.min(slab, Math.max(pip * 0.03, z - zc - 0.022, zc + CARD_FACE - 0.004 - z));                      // a pip stands a little above the face
    } },
  ],
  /**
   * k, the intensity: how wide the fan opens.
   * 0: a narrow fan · 0.5: a wide one · 1: nearly a half circle
   */
  step(t, abs, k = 0.5) {
    const spread = byIntensity(k, [0.18, 0.28, 0.4]), e = sm(0, 2.2, t) * (1 - sm(2.9, 3.8, t));
    return { cards: { prm: { s: Math.round((0.02 + (spread - 0.02) * e) * 50) / 50 } } };
  },
};
