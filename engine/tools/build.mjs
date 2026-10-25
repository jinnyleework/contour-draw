#!/usr/bin/env node
/*
 * Puts the engine and the figures on a page: `node tools/build.mjs` writes dist/actions.html, one file with no
 * dependencies that opens straight from disk. (Browsers refuse module imports from file://, so the modules are
 * joined into one script instead.)
 *
 * The join is deliberately simple: for each module in dependency order, drop its `import` lines and its `export`
 * keywords, and concatenate. It works because every top-level name in the engine is unique, which the build checks.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
/** the engine in dependency order, then every figure in figures/ (a new file is picked up on its own), then the index that lists them */
const ENGINE = ["src/math.js", "src/contour.js", "src/slice.js", "src/camera.js", "src/painter.js", "src/scene.js", "src/pointer.js", "src/split.js", "src/player.js"];
const order = () => [...ENGINE, ...readdirSync(join(root, "figures")).filter((f) => f.endsWith(".js") && f !== "index.js").sort().map((f) => `figures/${f}`), "figures/index.js"];

/** one module as plain script text: no imports, no exports */
export function strip(src) {
  return src
    .replace(/^import[^;]*;\n/gm, "")
    .replace(/^export \{[^}]*\};?\n/gm, "")                          // a bare `export { a, b };`
    .replace(/^export (const|let|function|class) /gm, "$1 ");
}

/** the names a module declares at its top level */
const declared = (src) => [...src.matchAll(/^(?:const|let|function|class) ([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);

/** every module as { file, text }, stripped, in order; checks that no top-level name is declared twice */
export function modules() {
  const seen = new Map();
  return order().map((file) => {
    const text = strip(readFileSync(join(root, file), "utf8"));
    for (const name of declared(text)) {
      if (seen.has(name)) throw new Error(`build: "${name}" is declared in both ${seen.get(name)} and ${file}; rename one`);
      seen.set(name, file);
    }
    return { file, text: `/* ===== ${file} ===== */\n${text.trim()}\n` };
  });
}

export function bundle() {
  return modules().map((m) => m.text).join("\n");
}

export const template = () => readFileSync(join(root, "page/actions.template.html"), "utf8");

export function page() {
  const template = readFileSync(join(root, "page/actions.template.html"), "utf8");
  return template.replace("/*ENGINE*/", () => bundle());
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(join(root, "dist"), { recursive: true });
  const out = join(root, "dist/actions.html");
  writeFileSync(out, page());
  console.log(out);
}
