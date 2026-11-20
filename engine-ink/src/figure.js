import { clamp } from "./math.js";
import { sampleShape, inkLoops } from "./ink.js";
import { paint, RULE } from "./painter.js";
import { VIEW } from "./view.js";

/*
 * A figure is a flat drawing as inked shapes, and what it does. No DOM.
 *
 *   {
 *     T:      seconds in one loop,
 *     S:      page px per world unit (a figure's box is about -1..1, y up),
 *     active: [t0, t1]       the stretch of the loop the cursor scrubs; the pose at t0 is the rest pose,
 *     drive(x, y) -> 0..1    the cursor's page position to how far through `active` it has taken the figure,
 *     hint:   a few words on where to move the pointer,
 *     rule?:  the figure's own look knobs over RULE (rare; each one goes on STYLE.md),
 *     frame?: [w, h]         a picture frame in page px, centred on the page: every mark is clipped to it, and the exports
 *                            come out exactly that size (a card's picture box) instead of cropped to the drawing,
 *     shapes: [{ id, ink, mark, order?, box: [x0, x1, y0, y1], sdf(x, y) } or { id, ink, mark, bitmap: { area, mask } }],
 *     step(t, k) -> { [shapeId]: { off, scale, spin, pivot, hide } }
 *   }
 *
 * `ink` is a PALETTE key ("paper" carves a highlight out of what is under it). `mark` is how the shape is inked: "fill" (the
 * default), "line" (its outline, as a pen line; `weight` scales it) or "hatch" (strokes inside it; `angle` in degrees, `tone`
 * 0 light to 1 dark). A bitmap is a drawing given as an image (tools/trace.mjs writes it). A shape is inked once per look;
 * motion moves the ink, never re-inks it. Shapes are laid in `order` (ties keep the order they are written in).
 */

/** how strongly the figures perform, 0 to 1: the page edits it, the player reads it on every frame */
export const MOTION = { intensity: 0.5 };
/** the three buttons of the intensity control */
export const LEVELS = { low: 0, medium: 0.5, high: 1 };

/** the cursor's page position to 0..1 for a figure that rises up the page: the bottom of the figure is 0, the top is 1 */
export const driveUp = (x, y) => clamp((520 - y) / 400, 0, 1);
/** the same, across the page from left to right */
export const driveAcross = (x, y) => clamp((x - 90) / 420, 0, 1);

/** the look knobs that change the ink (so a change to them re-inks the shape) */
const INK_KEYS = ["line", "pressure", "hatch", "scratch", "pool", "spread", "wobble", "rough", "tooth", "speckle", "dry", "keep", "dust"];

const samples = new WeakMap();
function sampleOf(shape, fig) {
  let s = samples.get(shape);
  if (!s || s.P !== fig.S) samples.set(shape, (s = { P: fig.S, sample: sampleShape(shape, fig.S), inked: new Map() }));
  return s;
}

/** a shape's ink under a look, for one phase of the boil, in world units (kept for the last few looks) */
export function inkOf(shape, fig, rule, phase = 0) {
  const s = sampleOf(shape, fig), key = INK_KEYS.map((k) => rule[k]).join(",") + "|" + phase;
  if (!s.inked.has(key)) {
    if (s.inked.size > 8) s.inked.delete(s.inked.keys().next().value);
    s.inked.set(key, inkLoops(s.sample, shape, rule, phase));
  }
  return s.inked.get(key);
}

/** ink every shape now, so the first frame does not stall */
export function prepare(fig, rule = RULE) {
  const look = fig.rule ? { ...rule, ...fig.rule } : rule;
  for (const shape of fig.shapes) inkOf(shape, fig, look);
}

/** the shapes posed at time t, in the order they are laid: [{ id, ink, loops }] with each loop in page px */
export function pose(fig, t, k = MOTION.intensity, rule = RULE, phase = 0) {
  const st = fig.step(t, k) || {}, S = fig.S, out = [];
  const layers = fig.shapes.map((shape, i) => ({ shape, i })).sort((a, b) => (a.shape.order ?? 0) - (b.shape.order ?? 0) || a.i - b.i);
  for (const { shape } of layers) {
    const m = st[shape.id] || {};
    if (m.hide) continue;
    const [ox, oy] = m.off || [0, 0], [px, py] = m.pivot || [0, 0], c = Math.cos(m.spin || 0), s = Math.sin(m.spin || 0), sc = m.scale ?? 1;
    const loops = inkOf(shape, fig, rule, phase).map((loop) =>
      loop.map(([x, y]) => {
        const X = (x - px) * sc, Y = (y - py) * sc;
        return [300 + S * (X * c - Y * s + px + ox), 300 - S * (X * s + Y * c + py + oy)];
      })
    );
    out.push({ id: shape.id, ink: shape.ink || "black", loops: fig.frame ? loops.map((l) => clipToFrame(l, frameBox(fig))).filter((l) => l.length >= 3) : loops });
  }
  return out;
}

/** a figure's frame as [x0, y0, x1, y1] in page px, or null */
export const frameBox = (fig) => fig.frame ? [300 - fig.frame[0] / 2, 300 - fig.frame[1] / 2, 300 + fig.frame[0] / 2, 300 + fig.frame[1] / 2] : null;

/** a closed loop clipped to a rectangle (Sutherland-Hodgman, one side at a time) */
export function clipToFrame(loop, [x0, y0, x1, y1]) {
  const sides = [[(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]]];
  let pts = loop;
  for (const [inside, cross] of sides) {
    if (!pts.length) break;
    const next = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length], b = pts[i];
      if (inside(b)) { if (!inside(a)) next.push(cross(a, b)); next.push(b); } else if (inside(a)) next.push(cross(a, b));
    }
    pts = next;
  }
  return pts;
}

/**
 * The markup for a figure at time t. The sixth argument is kept for the page tools (the contour engine's hover shift; this
 * engine has none). `view` is the plane (VIEW), so nothing is turned.
 */
export function frame(fig, t, abs = t, view = VIEW, rule = RULE, _unused = null, k = MOTION.intensity) {
  const look = fig.rule ? { ...rule, ...fig.rule } : rule;
  return paint(pose(fig, t, k, look), look);
}
