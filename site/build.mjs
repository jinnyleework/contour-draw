#!/usr/bin/env node
/**
 * Builds the site's scripts from engine/, so the pages work over file:// and on GitHub Pages alike:
 *
 *   assets/contour-figures.js  the contour engine and every figure in engine/figures/, joined by the engine's own
 *                              build, as a classic script with the pieces a page needs on window.Contour
 *   assets/pull.js             the light pull's pendant and ceiling rose (figures/pull.js), painted once at rest, for
 *                              assets/theme.js to hang in every page's header
 *
 *   node site/build.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "../engine/tools/build.mjs";
import { frame } from "../engine/src/scene.js";
import { RULE, VIEW } from "../engine/src/painter.js";
import { pullPendant, pullRose } from "./figures/pull.js";

const here = dirname(fileURLToPath(import.meta.url));

const figures = resolve(here, "assets/contour-figures.js");
const expose = "window.Contour = { createPlayer, SCENES, RULE, VIEW, SPLIT, MOTION, LEVELS, GAP_RANGE };";
writeFileSync(figures, `/* built by site/build.mjs from engine/: do not edit */\n(() => {\n${bundle()}\n${expose}\n})();\n`);
console.log(figures);

// the pull's two pieces as markup, each with the box its lines fill on the engine's 600 × 600 page; drawn about a
// tenth of their page size, so in lighter lines than a figure
const PULL_RULE = { ...RULE, base: 0.55 };
const painted = (scene) => {
  const markup = frame(scene, 0, 0, VIEW, PULL_RULE);
  const n = [...markup.matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)].map((m) => [+m[1], +m[2]]);
  const box = [Math.min(...n.map((p) => p[0])), Math.min(...n.map((p) => p[1])), Math.max(...n.map((p) => p[0])), Math.max(...n.map((p) => p[1]))];
  return { markup, box: box.map((v) => Math.round(v * 10) / 10) };
};
const pull = resolve(here, "assets/pull.js");
writeFileSync(pull, `/* built by site/build.mjs from figures/pull.js: do not edit */\nwindow.contourPull = ${JSON.stringify({ pendant: painted(pullPendant), rose: painted(pullRose) })};\n`);
console.log(pull);
