#!/usr/bin/env node
/*
 * The finished still of a figure: `node tools/export.mjs <name> [--size 1800]` writes dist/<name>.svg (the drawing itself, any
 * size) and dist/<name>.png (`--size` px square, default 1800). Chrome takes the PNG. Set CHROME if it is not the usual one.
 * Every figure: `node tools/export.mjs --all`.
 * `--figma` writes dist/<name>.figma.svg instead: plain filled paths with the grain baked in as holes, no background, no
 * filters, cropped to the drawing (design tools drop svg filters; paste or import it straight in). No PNG.
 * `--grain-size 4` with it: pin holes 4 times bigger, for art that will be shown about 4 times smaller than it is drawn.
 * `--grain 0.2` with it: how much grain (the look's `grain`, 0 none .. 1 most) for this export only.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SCENES } from "../figures/index.js";
import { frame, prepare, pose, frameBox } from "../src/figure.js";
import { RULE, paintFlat } from "../src/painter.js";
import { VIEW } from "../src/view.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2), at = args.indexOf("--size"), size = at >= 0 ? +args[at + 1] : 1800;
const gat = args.indexOf("--grain-size"), grainSize = gat >= 0 ? +args[gat + 1] : 1;
const gr = args.indexOf("--grain"), grainAmount = gr >= 0 ? +args[gr + 1] : null;
const names = args.includes("--all") ? Object.keys(SCENES) : args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--size" && args[i - 1] !== "--grain-size" && args[i - 1] !== "--grain");
if (!names.length || names.some((n) => !SCENES[n])) { console.error("usage: node tools/export.mjs <" + Object.keys(SCENES).join("|") + "> [--size 1800] | --all"); process.exit(1); }
const chrome = process.env.CHROME || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
mkdirSync(join(root, "dist"), { recursive: true });

for (const name of names) {
  const fig = SCENES[name];
  prepare(fig);
  if (args.includes("--figma")) {
    const look = { ...RULE, ...(fig.rule || {}), ...(grainAmount === null ? {} : { grain: grainAmount }) }, { body, box } = paintFlat(pose(fig, fig.active[0], 0.5, look), look, { grainSize });
    const fb = frameBox(fig), [x, y, w, h] = fb ? [fb[0], fb[1], fig.frame[0], fig.frame[1]] : box.map((v) => +v.toFixed(1)), file = join(root, "dist", name + ".figma.svg");
    writeFileSync(file, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}">${body}</svg>\n`);
    console.log(file);
    continue;
  }
  const fb = frameBox(fig), vb = fb ? `${fb[0]} ${fb[1]} ${fig.frame[0]} ${fig.frame[1]}` : "0 0 600 600";
  const pw = size, ph = fb ? Math.round((size * fig.frame[1]) / fig.frame[0]) : size;      // a framed figure keeps its frame's shape
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${pw}" height="${ph}">${frame(fig, fig.active[0], fig.active[0], VIEW, RULE, null)}</svg>`;
  const base = join(root, "dist", name);
  writeFileSync(base + ".svg", svg);
  if (!chrome) { console.log(base + ".svg (no Chrome found for the PNG: set CHROME)"); continue; }
  writeFileSync(base + ".export.html", `<!doctype html><style>body{margin:0}svg{display:block}</style>${svg}`);
  execFileSync(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", `--window-size=${pw},${ph}`, "--screenshot=" + base + ".png", "file://" + base + ".export.html"], { stdio: "ignore" });
  console.log(base + ".png");
}
