/*
 * Puts one contour figure on a page: Contour.mount(el, name, opts) draws the figure named `name` (a key of
 * Contour.SCENES) into `el` as an svg, and returns its player (engine/src/player.js) with a few page helpers.
 *
 * A figure is sliced the first time it comes on screen, not when it is mounted, so a page of thirty figures opens at
 * once. Its colours come from the stylesheet (.ct), so it follows the site's theme by itself.
 *
 *   opts.rule, opts.view    its own copies of the engine's RULE and VIEW (a panel retunes them without touching the rest)
 *   opts.motion, opts.split its own intensity settings, likewise
 *   opts.weight             scales the line weight (small tiles draw lighter lines than the full page they were tuned for)
 *   opts.label              the svg's accessible name
 */
(() => {
  const { createPlayer, SCENES, RULE, VIEW, SPLIT, MOTION } = window.Contour;
  const NS = "http://www.w3.org/2000/svg";

  Contour.mount = (el, name, opts = {}) => {
    const scene = SCENES[name];
    const rule = opts.rule ?? { ...RULE, base: RULE.base * (opts.weight ?? 1) };
    const view = opts.view ?? { ...VIEW }, motion = opts.motion ?? { ...MOTION }, split = opts.split ?? { ...SPLIT };
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 600 600");
    svg.setAttribute("class", "ct");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", opts.label ?? `${name}, drawn as stacked contour slices: ${scene.hint}`);
    el.replaceChildren(svg);
    const player = createPlayer(svg, { [name]: scene }, { rule, view, motion, split });

    // sliced and drawn when it first comes on screen
    let shown = false;
    const show = () => { if (!shown) { shown = true; player.show(name); } };
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); show(); } }, { rootMargin: "200px" });
    io.observe(svg);

    // looping: the figure's whole action played over and over, a beat of rest between (the engine plays it once)
    let loop = 0;
    const looping = (on) => {
      clearTimeout(loop);
      if (!on) return;
      const again = () => { show(); player.demo(); loop = setTimeout(again, scene.T * 1000 + 900); };
      again();
    };

    return Object.assign(player, {
      svg, scene, rule, view, motion, split, show, looping,
      destroy() { clearTimeout(loop); io.disconnect(); svg.remove(); },
    });
  };
})();
