#!/usr/bin/env node
/*
 * The style studio: `node tools/studio.mjs [name ...]` writes dist/studio.html, a page that shows a few figures side by side
 * (the rocket, the lightbulb and the tile stack unless you name others), each at a pose you pick, under one set of style
 * sliders. It is the page for tuning a new engine's look with someone watching.
 *
 * The sliders come from the painter: `RULE` is the style object and `RULE_CONTROLS`, if the painter exports it, is the list
 * of [key, label, [min, max, step]] to show. Without it, every number in RULE gets a slider from 0 to twice its value.
 *
 * "apply to" sets where a slider writes: "all figures" edits RULE (the engine's look), a figure's name edits that figure's
 * override only (a per-drawing tweak). A figure may also carry its own `rule: { ... }` in its file. The look of a figure is
 * { ...RULE, ...figure.rule, ...override }, and a panel with any override is marked. `studioState()` in the console, or
 * the "copy settings" box, gives { rule, overrides } as JSON, so the values can be written back into the engine.
 *
 * Copied into an engine by the create-draw-engine skill; it reads the engine's own page template for its styles.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { bundle } from "./build.mjs";
import { SCENES } from "../figures/index.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const asked = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const want = asked.length ? asked : ["rocket", "lightbulb", "tileStack"];
const names = want.map((n) => Object.keys(SCENES).find((k) => k === n || k.replace(/\s+/g, "-") === n));
if (names.some((n) => !n)) { console.error("studio: no figure called " + want[names.indexOf(undefined)] + "; have " + Object.keys(SCENES).join(", ")); process.exit(1); }

const template = readFileSync(join(root, "page/actions.template.html"), "utf8");
const engineStyle = (template.match(/<style>([\s\S]*?)<\/style>/) || ["", ""])[1];

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Style Studio</title>
<style>${engineStyle}
  body { display: block; overflow: auto; }
  #panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; padding: 10px 14px; }
  figure { margin: 0; position: relative; border: 1px solid #1d1d20; border-radius: 6px; }
  figure.own { border-color: #6a5a2a; }
  figure svg { width: 100%; height: auto; aspect-ratio: 1 / 1; display: block; }
  figcaption { position: absolute; left: 8px; top: 8px; color: #5d5d64; }
  figure.own figcaption::after { content: " · own style"; color: #b39a4a; }
  textarea { width: 100%; height: 7em; background: #111113; color: #e6e6e6; border: 1px solid #29292d; border-radius: 6px; font: inherit; }
</style>
</head>
<body>
<nav id="nav"></nav>
<div id="panels"></div>
<div class="controls" id="controls"></div>
<script>
${bundle()}

/* ---------- the studio ---------- */
const NAMES = ${JSON.stringify(names)};
const OVERRIDES = Object.fromEntries(NAMES.map((n) => [n, {}]));
const STUDIO = { pose: "rest", target: "all figures" };
const POSES = { rest: 0, halfway: 0.5, full: 1 };
const panels = document.getElementById("panels"), nav = document.getElementById("nav"), controls = document.getElementById("controls");
const figs = NAMES.map((n) => {
  const f = document.createElement("figure"), s = document.createElementNS("http://www.w3.org/2000/svg", "svg"), c = document.createElement("figcaption");
  s.setAttribute("viewBox", "0 0 600 600"); c.textContent = n; f.append(s, c); panels.appendChild(f); prepare(SCENES[n]); return { n, f, s };
});
const lookOf = (n) => ({ ...RULE, ...(SCENES[n].rule || {}), ...OVERRIDES[n] });
function redraw() {
  for (const { n, f, s } of figs) {
    const sc = SCENES[n], [a0, a1] = sc.active, t = a0 + POSES[STUDIO.pose] * (a1 - a0);
    s.innerHTML = frame(sc, t, t, VIEW, lookOf(n), null, MOTION.intensity);
    f.classList.toggle("own", Object.keys(OVERRIDES[n]).length > 0 || !!sc.rule);
  }
  out.value = JSON.stringify(studioState(), null, 1);
}
window.studioState = () => ({ rule: { ...RULE }, figureRules: Object.fromEntries(NAMES.filter((n) => SCENES[n].rule).map((n) => [n, SCENES[n].rule])), overrides: OVERRIDES, view: { ...VIEW }, intensity: MOTION.intensity, pose: STUDIO.pose });

const button = (parent, text, onclick) => { const b = document.createElement("button"); b.textContent = text; b.onclick = onclick; parent.appendChild(b); return b; };
const choice = (parent, options, key, after) => {
  const bs = options.map((o) => button(parent, o, () => { STUDIO[key] = o; sync(); after(); }));
  const sync = () => bs.forEach((b) => b.setAttribute("aria-pressed", String(b.textContent === STUDIO[key]))); sync(); return sync;
};
const group = (label) => { const g = document.createElement("div"), h = document.createElement("span"); g.className = "group"; h.className = "head"; h.textContent = label; g.append(h); controls.appendChild(g); return g; };

choice(nav, Object.keys(POSES), "pose", redraw);

/* sliders: a view slider edits VIEW; a style slider writes to RULE or to one figure's override, as "apply to" says */
const sliders = [];
function slider(parent, getTarget, key, label, [min, max, step], digits = 2) {
  const l = document.createElement("label"), i = document.createElement("input"), o = document.createElement("output");
  Object.assign(i, { type: "range", min, max, step });
  const show = () => { const v = getTarget(true)[key]; i.value = v; o.textContent = (+v).toFixed(digits); };
  i.oninput = () => { getTarget(false)[key] = +i.value; o.textContent = (+i.value).toFixed(digits); redraw(); };
  l.append(label, i, o); parent.appendChild(l); sliders.push(show); show();
}
const view = group("view");
/* a 2D engine's view is a plane (VIEW.flat, set in its view.js): nothing turns or tilts, so only intensity is offered */
if (!VIEW.flat) {
  slider(view, () => VIEW, "azimuth", "turn", [-180, 180, 1], 0);
  slider(view, () => VIEW, "tilt", "tilt", [0.15, 0.95, 0.01]);
}
slider(view, () => MOTION, "intensity", "intensity", [0, 1, 0.05]);

const apply = group("apply to");
choice(apply, ["all figures", ...NAMES], "target", () => sliders.forEach((s) => s()));
button(apply, "clear overrides", () => { for (const n of NAMES) OVERRIDES[n] = {}; sliders.forEach((s) => s()); redraw(); });

const CONTROLS = typeof RULE_CONTROLS !== "undefined" ? RULE_CONTROLS
  : Object.keys(RULE).filter((k) => typeof RULE[k] === "number").map((k) => [k, k, [0, Math.max(1, RULE[k] * 2), 0.01]]);
const style = group("style");
const styleTarget = (reading) => STUDIO.target === "all figures" ? RULE : reading ? lookOf(STUDIO.target) : OVERRIDES[STUDIO.target];
for (const [key, label, range] of CONTROLS) slider(style, styleTarget, key, label, range, range[2] < 0.01 ? 3 : 2);

const copy = group("copy settings"), out = document.createElement("textarea");
out.readOnly = true; copy.appendChild(out);
window.STUDIO = STUDIO; window.OVERRIDES = OVERRIDES; window.redraw = redraw;
redraw();
</script>
</body>
</html>
`;

mkdirSync(join(root, "dist"), { recursive: true });
const file = join(root, "dist/studio.html");
writeFileSync(file, html);
console.log(file);
