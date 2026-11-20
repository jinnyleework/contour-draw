#!/usr/bin/env node
/*
 * A contact sheet: `node tools/sheet.mjs [name ...]` writes dist/sheet.png, each figure at rest (top row) and full (bottom row),
 * so a set of figures takes one look. Default: every figure. Needs Chrome, as still.mjs does.
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
const asked = process.argv.slice(2), names = asked.length ? asked : Object.keys(SCENES);
const cell = (n, t, label) => `<figure><svg viewBox="0 0 600 600">${frame(SCENES[n], t, t, VIEW, RULE, null)}</svg><figcaption>${n} · ${label}</figcaption></figure>`;
for (const n of names) prepare(SCENES[n]);
const rows = [names.map((n) => cell(n, SCENES[n].active[0], "rest")), names.map((n) => cell(n, SCENES[n].active[1], "full"))].flat().join("");
const W = 250 * names.length;
writeFileSync(join(root, "dist/sheet.html"), `<!doctype html><meta charset=utf8><style>body{margin:0;background:#0b0b0c;display:grid;grid-template-columns:repeat(${names.length},250px)}figure{margin:0;position:relative}svg{width:250px;height:250px;display:block}figcaption{position:absolute;left:8px;top:6px;font:10px ui-monospace,Menlo,monospace;color:#777}</style>${rows}`);
mkdirSync(join(root, "dist"), { recursive: true });
const chrome = process.env.CHROME || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find(existsSync);
execFileSync(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--window-size=${W},500`, "--screenshot=" + join(root, "dist/sheet.png"), "file://" + join(root, "dist/sheet.html")], { stdio: "ignore" });
console.log(join(root, "dist/sheet.png"));
