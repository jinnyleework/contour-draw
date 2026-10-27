/*
 * The site's light pull: the theme switch, hung top right in every page's header. A ball chain comes down from above
 * the page's top edge to a pendant cut as contour slices (figures/pull.js, painted by site/build.mjs into
 * assets/pull.js, which loads before this).
 *
 * Point at it and it gives a little: the chain goes taut and the pendant drops. Press and drag it down and it follows
 * the hand, giving less the further it goes, and swings on its chain as the hand moves sideways; let go and it springs
 * home with a small bounce on its chain. A long enough pull turns the lights off, or back on; a short one springs back
 * and changes nothing. A click, a tap, or Enter or Space with it focused is a full pull. The choice is kept across
 * pages and visits.
 *
 * The figures follow the theme by themselves: their ground and ink are the stylesheet's (.ct). Each page's <head>
 * sets data-theme before first paint, so nothing flashes. A page that keeps its own copy of the theme (the library's
 * panel) listens for "themechange".
 */
(() => {
  const root = document.documentElement, KEY = "theme";
  const current = () => (root.dataset.theme === "dark" ? "dark" : "light");
  const header = document.querySelector("header.top");
  if (!header || !window.contourPull) return;

  // the pull's measures, in px: where the chain hangs from (well above the page, so it only comes in at the top edge),
  // how long it is, and how the pendant is drawn
  const PIVOT = [32, -40], CHAIN = 128, BEADS = 26, SCALE = 0.115;
  const GIVE = 6;                       // how far pointing at it draws the pendant down
  const DRAG = 34, REACH = 0.4;         // how far a drag can draw it further, and the share of that which counts as a pull
  const SWAY = 9;                       // how far a sideways drag swings it, either way (degrees, about a pivot far above)
  const { pendant } = window.contourPull;
  // where the pendant meets the chain, on its 600 × 600 page: the top of its cap
  const CAP = [300, 95];
  const place = ([x, y], [ax, ay]) => `translate(${x - ax * SCALE} ${y - ay * SCALE}) scale(${SCALE})`;

  const pull = Object.assign(document.createElement("button"), { type: "button", className: "pull" });
  pull.setAttribute("aria-label", "Dark mode");
  pull.innerHTML = `<svg viewBox="0 0 64 150" aria-hidden="true">
    <g class="ct">
      <g class="grab">
        <g class="chain">${Array.from({ length: BEADS }, () => '<circle r="1.25"/>').join("")}</g>
        <g class="pendant"><g transform="${place([0, 0], CAP)}">${pendant.markup}</g></g>
        <rect class="hit" x="-16" y="-4" width="32" height="58"/>
      </g>
    </g></svg>`;
  header.appendChild(pull);
  const beads = [...pull.querySelectorAll(".chain circle")], hang = pull.querySelector(".pendant"), hit = pull.querySelector(".hit");

  /* ---- the motion: two springs, how far the pendant has dropped and how far it has swung ---- */

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const drop = { at: 0, v: 0, to: 0 }, swing = { at: 0, v: 0, to: 0 };
  let raf = 0, last = 0, held = null;   // held: the hand's press, while it drags

  const draw = () => {
    const a = (swing.at * Math.PI) / 180, len = CHAIN + drop.at, sx = Math.sin(a), cy = Math.cos(a);
    // the chain runs straight from above the page to the cap, its beads evenly spread along it, so a longer pull spreads them
    beads.forEach((b, i) => {
      const t = (i + 0.5) / BEADS;
      b.setAttribute("cx", (PIVOT[0] + sx * len * t).toFixed(2));
      b.setAttribute("cy", (PIVOT[1] + cy * len * t).toFixed(2));
    });
    const end = [PIVOT[0] + sx * len, PIVOT[1] + cy * len];
    hang.setAttribute("transform", `translate(${end[0].toFixed(2)} ${end[1].toFixed(2)}) rotate(${(-swing.at).toFixed(2)})`);
    hit.setAttribute("transform", `translate(${end[0].toFixed(2)} ${end[1].toFixed(2)}) rotate(${(-swing.at).toFixed(2)})`);
  };
  // a drop springs back stiffly with one small bounce; a swing is a pendulum, slow to settle
  const spring = (s, k, c, dt) => { s.v += (k * (s.to - s.at) - c * s.v) * dt; s.at += s.v * dt; };
  const tick = (now) => {
    const dt = Math.min(0.032, (now - last) / 1000); last = now;
    if (!held) { spring(drop, 340, 13, dt); spring(swing, 40, 2.2, dt); }
    draw();
    const settled = !held && Math.abs(drop.at - drop.to) < 0.05 && Math.abs(drop.v) < 0.05 && Math.abs(swing.at - swing.to) < 0.05 && Math.abs(swing.v) < 0.05;
    raf = settled ? 0 : requestAnimationFrame(tick);
  };
  const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  const still = () => { drop.at = drop.to; swing.at = swing.to; drop.v = swing.v = 0; draw(); };

  /* ---- the switch ---- */

  const set = (theme) => {
    root.dataset.theme = theme;
    try { localStorage.setItem(KEY, theme); } catch {}
    pull.setAttribute("aria-pressed", String(theme === "dark"));
    dispatchEvent(new CustomEvent("themechange", { detail: theme }));
  };
  set(current());
  // a pull, not a page load, is what makes the dark-only "technicals" link flicker on (site.css, .tech-on)
  let flick;
  const toggle = () => {
    set(current() === "dark" ? "light" : "dark");
    root.classList.toggle("tech-on", current() === "dark");
    clearTimeout(flick); flick = setTimeout(() => root.classList.remove("tech-on"), 1200);
  };

  /* ---- the hand ---- */

  const over = (on) => { if (held) return; drop.to = on ? GIVE : 0; if (on) swing.v += 18; wake(); };
  hit.addEventListener("pointerenter", () => over(true));
  hit.addEventListener("pointerleave", () => over(false));

  // the page's px per the pull's px (the site may be zoomed), so the pendant stays under the hand
  const unit = () => pull.getBoundingClientRect().width / 64 || 1;
  let dragged = false;
  hit.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    hit.setPointerCapture(e.pointerId);
    held = { x: e.clientX, y: e.clientY, k: unit() };
    dragged = false;
    root.classList.add("pulling");
    wake();
  });
  hit.addEventListener("pointermove", (e) => {
    if (!held) return;
    const dx = (e.clientX - held.x) / held.k, dy = (e.clientY - held.y) / held.k;
    if (Math.hypot(dx, dy) > 3) dragged = true;
    // it gives less the further it goes, and never past DRAG; a sideways pull swings it, never past SWAY
    drop.at = GIVE + DRAG * (1 - Math.exp(-Math.max(0, dy) / DRAG));
    swing.at = SWAY * Math.tanh(dx / 40);
    drop.v = swing.v = 0;
    draw();
  });
  const letGo = (e) => {
    if (!held) return;
    held = null;
    root.classList.remove("pulling");
    const far = (drop.at - GIVE) / DRAG;
    drop.to = e?.type === "pointerup" && hit.matches(":hover") ? GIVE : 0;
    if (dragged && far >= REACH) toggle();
    wake();
  };
  hit.addEventListener("pointerup", letGo);
  hit.addEventListener("pointercancel", letGo);

  // a click that did not drag, or Enter or Space, is a full pull: down to the end of the chain, then home
  const tug = () => {
    toggle();
    if (reduced.matches) return still();
    drop.at = GIVE + DRAG * 0.8; drop.v = 0; drop.to = hit.matches(":hover") ? GIVE : 0;
    swing.v += 30;
    wake();
  };
  pull.addEventListener("click", (e) => { if (dragged) { dragged = false; return; } e.preventDefault(); tug(); });

  draw();
})();
