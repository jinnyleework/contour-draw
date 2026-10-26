/*
 * The site's light pull: the theme switch, hung top right in every page's header. A click, a tap, or Enter or Space
 * tugs it, and the lights go off, or back on. The choice is kept across pages and visits.
 *
 * The figures follow by themselves: their ground and ink are the stylesheet's (.ct). Each page's <head> sets
 * data-theme before first paint, so nothing flashes. A page that keeps its own copy of the theme (the library's
 * panel) listens for "themechange".
 */
(() => {
  const root = document.documentElement, KEY = "theme";
  const current = () => (root.dataset.theme === "dark" ? "dark" : "light");
  const header = document.querySelector("header.top");
  if (!header) return;

  // a beaded cord down from the page's top edge, and a pendant cut as three slices, as the engine would draw one
  const beads = Array.from({ length: 9 }, (_, i) => `<circle class="bead" cx="20" cy="${4 + i * 7}" r="1.5"/>`).join("");
  const pull = Object.assign(document.createElement("button"), { type: "button", className: "pull" });
  pull.setAttribute("aria-label", "Dark mode");
  pull.innerHTML = `<svg viewBox="0 0 40 104" aria-hidden="true">${beads}
    <ellipse class="slice" cx="20" cy="94" rx="12" ry="4.2"/><ellipse class="slice" cx="20" cy="86" rx="8.6" ry="3.2"/><ellipse class="slice" cx="20" cy="79" rx="5" ry="2.1"/></svg>`;
  header.appendChild(pull);

  const set = (theme) => {
    root.dataset.theme = theme;
    try { localStorage.setItem(KEY, theme); } catch {}
    pull.setAttribute("aria-pressed", String(theme === "dark"));
    dispatchEvent(new CustomEvent("themechange", { detail: theme }));
  };
  set(current());

  // a pull, not a page load, is what makes the dark-only "technicals" link flicker on (site.css, .tech-on)
  let flick;
  pull.addEventListener("click", () => {
    set(current() === "dark" ? "light" : "dark");
    pull.classList.remove("is-tugged"); void pull.offsetWidth; pull.classList.add("is-tugged");
    root.classList.toggle("tech-on", current() === "dark");
    clearTimeout(flick); flick = setTimeout(() => root.classList.remove("tech-on"), 1200);
  });
})();
