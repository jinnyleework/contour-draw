#!/usr/bin/env node
/*
 * Starts a figure: `node tools/new-figure.mjs <name>` writes figures/<name>.js from a working template and registers it in
 * figures/index.js, so the page gets a button for it. The template passes `tools/check.mjs` as it stands (a base, and an orb
 * that rises as the cursor goes up); replace its parts, its drive and its step with the real figure.
 *
 * `node tools/new-figure.mjs --remove <name>` takes a figure out again: deletes the file and its registration.
 *
 * <name> is lowercase letters, digits and hyphens. The button reads the name with hyphens as spaces.
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export const camel = (name) => name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const label = (name) => name.replace(/-/g, " ");
const entry = (name) => (/^[a-z]+$/.test(name) ? camel(name) : `"${label(name)}": ${camel(name)}`);

/** the source of a new figure. `rel` is the path from the file to the engine's src folder's parent (".." for figures/) */
export function figureSource(name, rel = "..") {
  const id = camel(name), words = label(name);
  return `import { byIntensity, clamp, roundBox, sm } from "${rel}/src/math.js";
import { planes } from "${rel}/src/slice.js";

/*
 * TODO: the ${words}. One paragraph: what it is, what the cursor does to it, and what it looks like at rest.
 * It is cut into parts along what moves: the base is cut once, the orb is cut again as it rises.
 */
export const ${id} = {
  T: 4, zr: [-0.6, 1.4], S: 130, zm: 0.4,
  active: [0, 2],                                              // TODO the stretch of the loop the cursor scrubs; the pose at active[0] is the rest pose
  drive: (x, y) => clamp((430 - y) / 260, 0, 1),               // TODO the cursor's page position -> 0..1 through \`active\`; this one is up the figure
  hint: "move up the ${words} to raise it",                    // TODO a few words on where to move the pointer
  parts: [
    { id: "base", order: 0, box: { x: [-0.6, 0.6], y: [-0.6, 0.6] }, planes: planes(-0.6, -0.4, 0.02),
      sdf: (x, y, z) => roundBox(x, y, z + 0.5, 0.42, 0.42, 0.08, 0.05) },
    { id: "orb", order: 1, dynamic: true, key: (p) => p.h.toFixed(2), box: { x: [-0.5, 0.5], y: [-0.5, 0.5] }, planes: planes(-0.4, 1.4, 0.03),
      sdf: (x, y, z, { h }) => Math.hypot(x, y, z - (-0.1 + h)) - 0.3 },
  ],
  /**
   * k, the intensity: TODO what it changes.
   * 0: a small rise · 0.5: a medium one · 1: a large one
   */
  step(t, abs, k = 0.5) {
    const reach = byIntensity(k, [0.3, 0.7, 1.1]);
    return { base: {}, orb: { prm: { h: reach * sm(0, 2, t) } } };
  },
};
`;
}

/** index.js with the figure imported and added to SCENES; throws if it is already there */
export function register(index, name) {
  const id = camel(name), file = name;
  if (new RegExp(`from "\\./${file}\\.js"`).test(index)) throw new Error(`${name} is already registered in figures/index.js`);
  const lines = index.split("\n"), last = lines.map((l) => l.startsWith("import ")).lastIndexOf(true);
  lines.splice(last + 1, 0, `import { ${id} } from "./${file}.js";`);
  const out = lines.join("\n").replace(/(export const SCENES = \{)([^}]*)\};/, (_, a, body) => `${a}${body.trimEnd().replace(/,$/, "")}, ${entry(name)} };`);
  if (!out.includes(entry(name))) throw new Error("figures/index.js has no `export const SCENES = { ... };` to add to");
  return out;
}

/** index.js without the figure */
export function unregister(index, name) {
  const id = camel(name), e = entry(name);
  return index
    .split("\n").filter((l) => !l.includes(`from "./${name}.js"`)).join("\n")
    .replace(new RegExp(`,?\\s*${e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s*[,}])`), "")
    .replace(/\{\s*,/, "{ ");
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const [a, b] = process.argv.slice(2), removing = a === "--remove", name = removing ? b : a;
  if (!name || !NAME.test(name)) { console.error("usage: node tools/new-figure.mjs <name>   |   --remove <name>\n  name: lowercase letters, digits and hyphens"); process.exit(2); }
  const file = join(root, "figures", `${name}.js`), indexFile = join(root, "figures/index.js");
  if (removing) {
    if (existsSync(file)) unlinkSync(file);
    writeFileSync(indexFile, unregister(readFileSync(indexFile, "utf8"), name));
    console.log(`removed figures/${name}.js and its registration`);
  } else {
    if (existsSync(file)) { console.error(`figures/${name}.js already exists`); process.exit(1); }
    writeFileSync(indexFile, register(readFileSync(indexFile, "utf8"), name));
    writeFileSync(file, figureSource(name));
    console.log(`wrote figures/${name}.js and registered it\nnext: edit it, then  node tools/check.mjs ${name}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
