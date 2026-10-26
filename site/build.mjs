#!/usr/bin/env node
/**
 * Builds the site's one script: the contour engine and every figure in engine/figures/, joined by the engine's own
 * build, as a classic script with the pieces a page needs on window.Contour, so the pages work over file:// and on
 * GitHub Pages alike.
 *
 *   node site/build.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "../engine/tools/build.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "assets/contour-figures.js");
const expose = "window.Contour = { createPlayer, SCENES, RULE, VIEW, SPLIT, MOTION, LEVELS, GAP_RANGE };";
writeFileSync(out, `/* built by site/build.mjs from engine/: do not edit */\n(() => {\n${bundle()}\n${expose}\n})();\n`);
console.log(out);
