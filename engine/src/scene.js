import { sheetsOf } from "./slice.js";
import { groundPoint } from "./camera.js";
import { clamp } from "./math.js";
import { paint, RULE, VIEW } from "./painter.js";

/*
 * A scene is an object and what it does. No DOM.
 *
 *   {
 *     T:     seconds in one loop,
 *     zr:    [zmin, zmax] the object's height range (rule A's height fade uses it),
 *     S, zm: camera scale and the height that lands mid-page,
 *     parts: [part, ...]        see slice.js,
 *     active: [t0, t1]          the stretch of the loop the cursor scrubs; the pose at t0 is the rest pose,
 *     drive(x, y) -> 0..1       the cursor's page position to how far through `active` it has taken the figure,
 *     hint:  a few words on where to move the pointer,
 *     step(t, abs, k, pointer) -> { [partId]: { prm?, off?, hide? }, pulse? }     (pointer is for figures that follow the cursor, else ignore it)
 *   }
 *
 * `step` says, for time t within the loop (and abs, the clock without the loop), what every part does, at
 * intensity k (0 to 1, 0.5 is the figure as first drawn; see byIntensity in math.js):
 * `off` moves it ([dx, dy, dz]), `prm` is handed to a dynamic part's sdf (null switches it off), and
 * `pulse` scales every stroke weight for a beat.
 */

/** how strongly the figures perform, 0 to 1: the page edits it in place, the player reads it on every frame */
export const MOTION = { intensity: 0.5 };

/** the markup for a scene at time t; `shift` is the hover split (see painter.js), `k` the intensity of the motion */
export function frame(scene, t, abs = t, view = VIEW, rule = RULE, shift = null, k = MOTION.intensity, cursor = null) {
  // a figure may follow the cursor: step gets a fourth argument, { s, x, y, ground(z) }, or null when nothing is pointing at it
  const pointer = cursor ? { s: clamp(cursor.s, 0, 1), x: cursor.x, y: cursor.y, ground: (z) => groundPoint(view, scene, cursor.x, cursor.y, z) } : null;
  const st = scene.step(t, abs, k, pointer), items = [];
  for (const part of scene.parts) {
    const a = st[part.id] || {};
    if (a.hide || (part.dynamic && !a.prm)) continue;
    for (const sh of sheetsOf(part, a.prm)) items.push({ sh, off: a.off || [0, 0, 0], order: part.order, over: part.overlay ? 1 : 0 });
  }
  items.sort((a, b) => a.over - b.over || (a.sh.z + a.off[2]) - (b.sh.z + b.off[2]) || a.order - b.order);   // overlays last, then bottom up
  return paint(items, scene, view, rule, st.pulse || 1, shift);
}

/**
 * The moment in the loop the cursor has taken the figure to. With the pointer away (strength 0) it is the rest pose;
 * as the pointer arrives it scrubs `active` by where it is. The strength is capped at 1 so the spring's overshoot
 * cannot carry the figure past its limit.
 */
export function hoverTime(scene, cursor) {
  const [a0, a1] = scene.active;
  if (cursor.s < 0.002) return a0;
  return a0 + clamp(scene.drive(cursor.x, cursor.y), 0, 1) * Math.min(1, cursor.s) * (a1 - a0);
}

/** cut every static part now, so the first frame does not stall */
export function prepare(scene) { for (const p of scene.parts) if (!p.dynamic) sheetsOf(p); }
