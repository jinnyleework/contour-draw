/*
 * The page starts empty (each page's <head> sets .reveal before first paint) and draws itself in: the header fades
 * in; the column's construction lines run down the page from the top, and on down as you scroll, their tip a little
 * way up the window so you see them go; each section's guides and hatched band, and each row of tiles' guides, draw
 * across as they come in; and the text and tiles fade up in turn. Once drawn, a line or a block stays. Load it last on
 * every page with a sheet (library and the doc pages), after the page has built its sections. With reduced motion
 * everything is simply there.
 */
(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const sheet = document.querySelector(".lib-main, .doc-main");
  if (!sheet) return;
  const root = document.documentElement;
  root.classList.add("reveal");
  window.revealed = true;

  // the column lines: drawn down to 80% of the way down the window, never back up; at the foot of the page, all of them
  const TOP = parseFloat(getComputedStyle(sheet, "::before").top) || 0;
  let drawn = 0, queued = false;
  const draw = () => {
    queued = false;
    const r = sheet.getBoundingClientRect(), full = r.height + 200;   // past the lines' foot, whatever its overhang
    const end = innerHeight + scrollY >= root.scrollHeight - 2 ? full : innerHeight * 0.8 - (r.top + TOP);
    drawn = Math.max(drawn, Math.min(full, end));
    sheet.style.setProperty("--drawn", `${drawn}px`);
  };
  addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(draw); } }, { passive: true });
  addEventListener("resize", draw);
  // start from nothing, so the first screen's lines draw down from the top too
  sheet.style.setProperty("--drawn", "0px");
  requestAnimationFrame(() => requestAnimationFrame(draw));

  // each row of tiles gets its own guides, along the top and the foot of its frames
  document.querySelectorAll(".tiles").forEach((tiles) => {
    const cells = [...tiles.children], h = cells[0].offsetHeight;
    [...new Set(cells.map((t) => t.offsetTop))].forEach((y) => [y, y + h - 1].forEach((at) => {
      const g = document.createElement("i");
      g.className = "guide-row"; g.style.top = `${at}px`;
      tiles.prepend(g);
    }));
  });

  // guides draw across when they are a fifth of the way up the window
  const across = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("is-drawn"); across.unobserve(e.target); }
  }), { rootMargin: "0px 0px -20% 0px" });
  document.querySelectorAll(".shelf + .shelf, .sec + .sec, .guide-row").forEach((s) => across.observe(s));

  // the text and tiles fade up, each batch that comes in together a step apart
  const items = document.querySelectorAll(".lib-intro > *, .autoplay, .lib-toc, .shelf > h2, .tile, .sec > *, .tblock");
  const up = new IntersectionObserver((es) => {
    es.filter((e) => e.isIntersecting).forEach((e, i) => {
      e.target.style.transitionDelay = `${Math.min(i, 6) * 70}ms`;
      e.target.classList.add("is-in");
      e.target.addEventListener("transitionend", () => (e.target.style.transitionDelay = ""), { once: true });
      up.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  // hidden at once (no fade out: .rv only transitions once the page is loaded), then, from the next frame, the header
  // fades in and the blocks are let in as they come into the window, so even the first screen's fade up from nothing
  items.forEach((el) => el.classList.add("rv"));
  void document.body.offsetHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.classList.add("is-loaded");
    items.forEach((el) => up.observe(el));
  }));
})();
