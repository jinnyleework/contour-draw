#!/usr/bin/env node
/*
 * Writes dist/actions.publish.html and dist/glass.publish.html: the built pages in the form the Artifact host wants. No document wrapper (the host
 * adds one), a title, the safe-area side gutters, and the dark look declared outright. The page itself is the same as
 * dist/actions.html, so the shared link always comes from the engine.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { page, PAGES } from "./build.mjs";

export function publishable(kind = "actions") {
  let s = page(kind);
  const swap = (from, to) => { const found = from instanceof RegExp ? from.test(s) : s.includes(from); if (!found) throw new Error("publish: cannot find " + from); s = s.replace(from, to); };
  swap(/<!doctype html>\s*<html[^>]*>\s*<head>\s*<meta charset[^>]*>\s*<meta name="viewport"[^>]*>\s*/i, "");
  swap(/<title>.*?<\/title>/, `<title>${PAGES[kind].title}</title>\n<meta name="claude:viewport-fit-sides" content="cover">`);
  swap("</head>\n<body>", "");
  swap("</body>\n</html>", "");
  swap("<style>", "<style>\n  :root { color-scheme: dark; }");
  swap("body { display: grid;", "body { padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); box-sizing: border-box; display: grid;");
  return s.trim() + "\n";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const [kind, { file }] of Object.entries(PAGES)) { const out = join(dirname(fileURLToPath(import.meta.url)), "../dist", file.replace(".html", ".publish.html")); writeFileSync(out, publishable(kind)); console.log(out); }
}
