import { frame, prepare, hoverTime, MOTION } from "./scene.js";
import { RULE, VIEW } from "./painter.js";
import { createCursor, aim, release, stepCursor } from "./pointer.js";
import { SPLIT, splitShift } from "./split.js";

/*
 * The player: runs a figure in an svg. This is the only file that touches the page.
 *
 * Nothing moves until the pointer arrives. The pointer drives a sprung cursor (pointer.js), and what that does
 * depends on the hover mode:
 *   "animate"  the cursor scrubs the figure's action: where it is over the drawing sets how far through the action
 *              the figure is (`scene.drive`), and leaving lets it spring back to rest.
 *   "split"    the layers part at the cursor's height (split.js); the figure itself stays at rest.
 * Either way, `motion.intensity` (animate) and `split.intensity` say how strongly the figure answers.
 * `rule`, `split` and `motion` are read on every frame, so a page changes them by editing the objects and calling redraw().
 *
 * One animation loop, and it sleeps whenever nothing needs it: pointer away and settled, off screen, tab hidden, or
 * the reader asked for less motion (then the figure answers the pointer at once and nothing animates on its own).
 * A finger works as the pointer: it acts while it is down, and the pose is held for a moment after it lifts, so a
 * tap reads as a look and not a flash (`HOLD`). The drawing takes the finger for itself (touch-action: none), so the
 * page does not scroll under it.
 * `demo()` plays the figure's whole loop once, for a look at what it does; the pointer arriving ends it.
 * `seek(t)` holds the figure at one moment, which is how a still of the loop is made; `play()` lets go.
 */
/** how long a lifted finger's pose is held, in ms */
export const HOLD = 1400;

export function createPlayer(svg, scenes, { rule = RULE, view = VIEW, split = SPLIT, motion = MOTION } = {}) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let name = Object.keys(scenes)[0], mode = "animate", raf = 0, onScreen = true, last = performance.now(), held = null, demoFrom = null, speed = 1;
  const cursor = createCursor();

  const draw = (now) => {
    const sc = scenes[name];
    let t = hoverTime(sc, cursor);                                           // the rest pose until the pointer arrives
    if (mode === "split") t = sc.active[0];                                   // the figure itself never moves in split mode
    if (demoFrom !== null) {
      if (cursor.s > 0.05) demoFrom = null;                                   // the pointer took over
      else { t = ((now - demoFrom) / 1000) * speed; if (t >= sc.T) { demoFrom = null; t = sc.active[0]; } }
    }
    if (held !== null) t = held;
    const shift = mode === "split" && cursor.s > 0.002 ? (cy) => splitShift(cy, cursor.y, cursor.s, split) : null;
    const follow = mode === "animate" && cursor.s > 0.002 && demoFrom === null && held === null ? cursor : null;      // the cursor, for a figure that follows it
    svg.innerHTML = frame(sc, t % sc.T, now / 1000, view, rule, shift, motion.intensity, follow);
  };
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const moving = stepCursor(cursor, dt, reduce);
    draw(now);
    // the flame flickers and the camera shakes on the clock, so while the pointer is over the figure the loop keeps going
    const live = demoFrom !== null || moving || (mode === "animate" && cursor.s > 0.002 && held === null);
    raf = onScreen && !document.hidden && !reduce && live ? requestAnimationFrame(tick) : 0;
  };
  const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  const toPage = (e) => { const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse()); return [p.x, p.y]; };
  let hold = 0;
  const let_go = () => { release(cursor); wake(); };
  svg.style.touchAction = "none";
  svg.addEventListener("pointermove", (e) => { clearTimeout(hold); aim(cursor, ...toPage(e)); wake(); });
  svg.addEventListener("pointerdown", (e) => { clearTimeout(hold); aim(cursor, ...toPage(e)); wake(); });
  // a mouse leaving acts at once; a finger lifting holds its pose first
  svg.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") { clearTimeout(hold); let_go(); } });
  for (const ev of ["pointerup", "pointercancel"]) svg.addEventListener(ev, (e) => { if (e.pointerType !== "mouse") { clearTimeout(hold); hold = setTimeout(let_go, HOLD); } });
  new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; if (onScreen) wake(); }).observe(svg);
  document.addEventListener("visibilitychange", wake);

  return {
    names: () => Object.keys(scenes),
    get current() { return name; },
    get mode() { return mode; },
    get hint() { return scenes[name].hint || ""; },
    show(n) { name = n; demoFrom = null; held = null; prepare(scenes[n]); draw(performance.now()); wake(); },
    /** "animate" or "split": what the pointer does to the figure */
    setMode(m) { mode = m === "split" ? "split" : "animate"; demoFrom = null; draw(performance.now()); wake(); },
    /** play the whole loop once; nothing runs on its own otherwise */
    demo() { if (reduce) return; held = null; demoFrom = performance.now(); wake(); },
    setSpeed(v) { speed = v; },
    seek(t) { held = t; draw(performance.now()); },
    play() { held = null; wake(); },
    redraw() { draw(performance.now()); wake(); },
    cursor,
  };
}
