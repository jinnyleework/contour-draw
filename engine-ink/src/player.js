import { clamp } from "./math.js";
import { frame, prepare, MOTION } from "./figure.js";
import { RULE } from "./painter.js";
import { VIEW } from "./view.js";

/*
 * The player: runs a figure in an svg. The only file that touches the page.
 *
 * Nothing moves until the pointer arrives. The pointer scrubs the figure's action: where it is over the drawing sets how far
 * through `active` the figure is (`fig.drive`), and leaving lets it spring back to rest. `rule`, `view` and `motion` are read
 * on every frame, so the page changes them in place and calls redraw(). The loop runs only while the pointer settles or a
 * demo plays; otherwise nothing is drawn.
 */
export function createPlayer(svg, figures, { rule = RULE, view = VIEW, motion = MOTION } = {}) {
  const cursor = { s: 0, target: 0, x: 300, y: 300, moved: 0 };
  let name = Object.keys(figures)[0], raf = 0, demoFrom = null, held = null;

  const timeOf = (now) => {
    const fig = figures[name];
    if (held !== null) return held;
    if (demoFrom !== null) {
      if (cursor.target > 0) demoFrom = null;                              // the pointer took over
      else { const t = (now - demoFrom) / 1000; if (t < fig.T) return t; demoFrom = null; }
    }
    if (cursor.s <= 0.002) return fig.active[0];
    return fig.active[0] + clamp(fig.drive(cursor.x, cursor.y), 0, 1) * Math.min(1, cursor.s) * (fig.active[1] - fig.active[0]);
  };
  const draw = (now) => {
    const fig = figures[name];
    svg.innerHTML = frame(fig, timeOf(now) % fig.T, now / 1000, view, rule, null, motion.intensity);
  };
  const tick = (now) => {
    cursor.s += (cursor.target - cursor.s) * 0.18;
    if (Math.abs(cursor.target - cursor.s) < 0.002) cursor.s = cursor.target;
    draw(now);
    const moving = cursor.s !== cursor.target || demoFrom !== null || now - cursor.moved < 400;
    raf = moving && !document.hidden ? requestAnimationFrame(tick) : 0;
  };
  const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
  const toPage = (e) => { const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse()); return [p.x, p.y]; };
  const point = (e) => { [cursor.x, cursor.y] = toPage(e); cursor.target = 1; cursor.moved = performance.now(); wake(); };

  svg.style.touchAction = "none";
  svg.addEventListener("pointermove", point);
  svg.addEventListener("pointerdown", point);
  svg.addEventListener("pointerleave", () => { cursor.target = 0; wake(); });

  return {
    names: () => Object.keys(figures),
    get current() { return name; },
    get hint() { return figures[name].hint || ""; },
    show(n) { name = n; demoFrom = null; held = null; prepare(figures[n], rule); draw(performance.now()); wake(); },
    demo() { held = null; demoFrom = performance.now(); wake(); },
    seek(t) { held = t; draw(performance.now()); },
    play() { held = null; wake(); },
    redraw() { draw(performance.now()); wake(); },
    cursor,
  };
}
