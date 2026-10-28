#!/usr/bin/env node
/**
 * Builds the play page's script from the draw-engine repo's other engines, so play.html works over file:// and on
 * Vercel alike. The engines live in another repo, so this runs by hand and its output is committed (vercel.json's
 * build, site/build.mjs, does not run it):
 *
 *   assets/play-figures.js  each engine in ENGINES and every figure in its figures/, as classic scripts, with the
 *                           pieces the page needs on window.Play: { [engine]: { mount, figures: { name: figure } } }
 *
 *   node site/build-play.mjs [path/to/draw-engine/engines]     (default: ../draw-engine/engines beside this repo)
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(process.argv[2] ?? resolve(here, "../../draw-engine/engines"));
// each engine's folder, and the global its build sets
const ENGINES = { oscillon: "Oscillon", stitch: "Stitch" };

const parts = [], expose = [];
for (const [dir, global] of Object.entries(ENGINES)) {
  const { classic, engineScript } = await import(pathToFileURL(resolve(root, dir, "engine/build.mjs")).href);
  parts.push(engineScript());
  const figs = readdirSync(resolve(root, dir, "figures")).filter((f) => f.endsWith(".js")).sort();
  const mods = figs.map((f) => `${global}_${f.replace(/\.js$/, "").replace(/\W/g, "_")}`);
  figs.forEach((f, i) => parts.push(classic(readFileSync(resolve(root, dir, "figures", f), "utf8"), mods[i])));
  expose.push(`${dir}: { mount: window.${global}.mount, figures: Object.fromEntries([${mods.map((m) => `window.${m}`).join(", ")}].flatMap((m) => Object.values(m)).filter((f) => f && f.draw).map((f) => [f.name, f])) }`);
}
const out = resolve(here, "assets/play-figures.js");
writeFileSync(out, `/* built by site/build-play.mjs from draw-engine/engines: do not edit */\n${parts.join("\n")}\nwindow.Play = {\n  ${expose.join(",\n  ")}\n};\n`);
console.log(out);
