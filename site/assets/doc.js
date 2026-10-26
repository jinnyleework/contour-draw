/*
 * The doc pages' sheet: the section ruler on the left (built from each .sec, the current one on the long tick, its
 * stretch of the rule inking in as you read), and a copy cell on every code block.
 */
(() => {
  const toc = document.getElementById("toc"), secs = [...document.querySelectorAll(".sec")];
  secs.forEach((s) => toc.insertAdjacentHTML("beforeend", `<li><a href="#${s.id}">${s.dataset.title}</a></li>`));
  const links = [...toc.querySelectorAll("a")], items = [...toc.children];
  const mark = (id) => links.forEach((a) => a.setAttribute("aria-current", String(a.hash === "#" + id)));
  mark(secs[0].id);
  const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && mark(e.target.id)), { rootMargin: "-30% 0px -60% 0px" });
  secs.forEach((s) => io.observe(s));
  let queued = false;
  const progress = () => {
    queued = false;
    const at = innerHeight * 0.3, tops = secs.map((s) => s.getBoundingClientRect().top);
    const i = Math.max(0, tops.findLastIndex((t) => t <= at));
    const end = secs[i + 1] ? tops[i + 1] : secs[i].getBoundingClientRect().bottom;
    const p = Math.max(0, Math.min(1, (at - tops[i]) / (end - tops[i])));
    const tick = (li) => li.offsetTop + li.offsetHeight / 2;
    const from = tick(items[i]), to = items[i + 1] ? tick(items[i + 1]) : toc.offsetHeight;
    toc.style.setProperty("--from", `${from}px`);
    toc.style.setProperty("--to", `${from + (to - from) * p}px`);
  };
  addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(progress); } }, { passive: true });
  addEventListener("resize", progress);
  progress();

  document.querySelectorAll(".code").forEach((c) => {
    const btn = c.querySelector(".code-head button");
    btn?.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(c.querySelector("pre").textContent.trim()); } catch { return; }
      btn.textContent = "copied ✓"; setTimeout(() => (btn.textContent = "copy ⧉"), 1400);
    });
  });
})();
