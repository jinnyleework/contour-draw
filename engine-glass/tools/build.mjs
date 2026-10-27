#!/usr/bin/env node
/*
 * Puts the engine and the figures on a page: `node tools/build.mjs` writes dist/actions.html (the figures) and dist/glass.html
 * (the same three, as glass), each one file with no dependencies that opens straight from disk. (Browsers refuse module imports from file://, so the modules are
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
const ENGINE = ["src/math.js", "src/contour.js", "src/slice.js", "src/camera.js", "src/painter.js", "src/scene.js", "src/pointer.js", "src/split.js", "src/glass.js", "src/player.js"];
const order = () => [...ENGINE, ...readdirSync(join(root, "figures")).filter((f) => f.endsWith(".js") && f !== "index.js" && f !== "glass.js").sort().map((f) => `figures/${f}`), "figures/glass.js", "figures/index.js"];

/** one module as plain script text: no imports, no exports */
export function strip(src) {
  return src
    .replace(/^import[^;]*;\n/gm, "")
    .replace(/^export \{[^}]*\};?\n/gm, "")                          // a bare `export { a, b };`
    .replace(/^export (const|let|function|class) /gm, "$1 ");
}

/** the names a module declares at its top level */
const declared = (src) => [...src.matchAll(/^(?:const|let|function|class) ([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);

export function bundle() {
  const seen = new Map(), parts = [];
  for (const file of order()) {
    const text = strip(readFileSync(join(root, file), "utf8"));
    for (const name of declared(text)) {
      if (seen.has(name)) throw new Error(`build: "${name}" is declared in both ${seen.get(name)} and ${file}; rename one`);
      seen.set(name, file);
    }
    parts.push(`/* ===== ${file} ===== */\n${text.trim()}\n`);
  }
  return parts.join("\n");
}

/** the pages: the one template, with a different set of figures and a different title */
export const PAGES = {
  actions: { figures: "SCENES", title: "Contour Actions", file: "actions.html" },
  glass: { figures: "GLASS", title: "Contour Glass", file: "glass.html" },
};

export function page(kind = "actions") {
  const { figures, title } = PAGES[kind];
  const template = readFileSync(join(root, "page/actions.template.html"), "utf8");
  return template.replace("/*ENGINE*/", () => bundle()).replace("/*FIGURES*/ SCENES", () => figures).replace("<title>Contour Actions</title>", () => `<title>${title}</title>`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(join(root, "dist"), { recursive: true });
  for (const [kind, { file }] of Object.entries(PAGES)) { const out = join(root, "dist", file); writeFileSync(out, page(kind)); console.log(out); }
}
