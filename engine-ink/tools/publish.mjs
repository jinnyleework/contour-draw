#!/usr/bin/env node
/*
 * Writes dist/actions.publish.html: the built page in the form the Artifact host wants. No document wrapper (the host
 * adds one), a title, the safe-area side gutters, and the dark look declared outright. The page itself is the same as
 * dist/actions.html, so the shared link always comes from the engine.
 */
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { page, modules, template } from "./build.mjs";

/** the form the Artifact host wants, for a page given as text */
function adapt(s) {
  const swap = (from, to) => { const found = from instanceof RegExp ? from.test(s) : s.includes(from); if (!found) throw new Error("publish: cannot find " + from); s = s.replace(from, to); };
  swap(/<!doctype html>\s*<html[^>]*>\s*<head>\s*<meta charset[^>]*>\s*<meta name="viewport"[^>]*>\s*/i, "");
  swap(/<title>.*?<\/title>/, '<title>Ink Engine</title>\n<meta name="claude:viewport-fit-sides" content="cover">');
  swap("</head>\n<body>", "");
  swap("</body>\n</html>", "");
  swap("body { margin: 0;", "body { margin: 0; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); box-sizing: border-box;");
  return s.trim() + "\n";
}

export const publishable = () => adapt(page());

/**
 * The same page as files: the shell (title, styles, the page's own script) with one script tag per module, and each
 * module as its own file. A figure changed later changes one small file, so a republish and a merge touch little.
 * Returns { html, files: { "engine.js": text, "figures/toaster.js": text, ... } }. Classic scripts share one global
 * scope, so the modules need no loader: they load in order and the page script runs last.
 */
export function publishParts() {
  const mods = modules(), engine = mods.filter((m) => m.file.startsWith("src/")), files = { "engine.js": engine.map((m) => m.text).join("\n") };
  for (const m of mods) if (!m.file.startsWith("src/")) files[m.file] = m.text;
  const tags = Object.keys(files).map((f) => `<script src="${f}"></script>`).join("\n");
  return { html: adapt(template().replace("<script>\n/*ENGINE*/", () => tags + "\n<script>")), files };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = join(dirname(fileURLToPath(import.meta.url)), "../dist/actions.publish.html");
  writeFileSync(out, publishable());
  console.log(out);
  // and as files, in dist/publish/: index.html plus one file per module (publish with `files`, see the skill)
  const dir = join(dirname(out), "publish"), { html, files } = publishParts();
  rmSync(dir, { recursive: true, force: true });
  for (const [f, text] of Object.entries({ "index.html": html, ...files })) { mkdirSync(dirname(join(dir, f)), { recursive: true }); writeFileSync(join(dir, f), text); }
  console.log(dir + "/ (" + (Object.keys(files).length + 1) + " files, page " + html.length + " bytes)");
}
