#!/usr/bin/env node
/*
 * A still of a figure without a browser session: `node tools/still.mjs <name>` writes dist/still-<name>.png, one image of five
 * poses (rest, halfway, full, intensity 0 and 1), so a look takes one image. Chrome takes the picture of the HTML it writes.
 * `--html` writes the page and stops (no Chrome needed). Set CHROME to a Chrome binary if it is not the usual one.
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SCENES } from "../figures/index.js";
import { frame, prepare } from "../src/figure.js";
import { RULE } from "../src/painter.js";
import { VIEW } from "../src/view.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2), htmlOnly = args.includes("--html"), name = args.find((a) => !a.startsWith("--"));
const key = name && Object.keys(SCENES).find((k) => k === name);
if (!key) { console.error("usage: node tools/still.mjs <" + Object.keys(SCENES).join("|") + "> [--html]"); process.exit(1); }

const sc = SCENES[key], [a0, a1] = sc.active, mid = (a0 + a1) / 2;
prepare(sc);
const poses = [["rest", a0, 0.5], ["halfway", mid, 0.5], ["full", a1, 0.5], ["intensity 0", a1, 0], ["intensity 1", a1, 1]];
const panels = poses.map(([label, t, k]) => `<figure><svg viewBox="0 0 600 600">${frame(sc, t, t, VIEW, RULE, null, k)}</svg><figcaption>${label}</figcaption></figure>`).join("\n");
const html = `<!doctype html><meta charset=utf8><style>
body{margin:0;background:#0b0b0c;display:grid;grid-template-columns:repeat(5,300px)}figure{margin:0;position:relative}svg{width:300px;height:300px;display:block}
figcaption{position:absolute;left:8px;top:6px;font:10px ui-monospace,Menlo,monospace;color:#5d5d64}</style>${panels}`;
mkdirSync(join(root, "dist"), { recursive: true });
const base = join(root, "dist", "still-" + key), page = base + ".html";
writeFileSync(page, html);
if (htmlOnly) { console.log(page); process.exit(0); }
const chrome = process.env.CHROME || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
if (!chrome) { console.error("no Chrome found: set CHROME, or open " + page); process.exit(1); }
execFileSync(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1500,320", "--screenshot=" + base + ".png", "file://" + page], { stdio: "ignore" });
console.log(base + ".png");
