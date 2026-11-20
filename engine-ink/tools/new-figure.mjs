#!/usr/bin/env node
/*
 * Starts a figure from a working template and registers it: `node tools/new-figure.mjs <name>`, or `--remove <name>` to undo.
 * The template is a flat ink drawing with a solid, a line and a hatch; its helpers are prefixed with the figure's name, as the
 * build needs. (For a drawing given as an image, use tools/trace.mjs instead: it writes the figure from the picture.)
 */
import { writeFileSync, unlinkSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** rewrites figures/index.js from the files in figures/ */
export function writeIndex() {
  const files = readdirSync(join(root, "figures")).filter((f) => f.endsWith(".js") && f !== "index.js" && !f.startsWith("_")).sort();   // _name.js: shared helpers, not figures
  const ids = files.map((f) => f.replace(/\.js$/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase()));
  const imports = files.map((f, i) => `import { ${ids[i]} } from "./${f}";`).join("\n");
  writeFileSync(join(root, "figures", "index.js"), `${imports}\n\n/** every figure the page offers, in the order of its buttons */\nexport const SCENES = { ${ids.join(", ")} };\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const remove = args.includes("--remove");
  const raw = args.find((a) => !a.startsWith("--"));
  if (!raw) { console.error("usage: node tools/new-figure.mjs <name> [--remove]"); process.exit(1); }
  const file = raw.toLowerCase().replace(/\s+/g, "-");
  const id = file.replace(/-([a-z])/g, (_, c) => c.toUpperCase());      // "tile stack" -> tileStack
  const path = join(root, "figures", `${file}.js`);
  if (remove) {
    if (existsSync(path)) unlinkSync(path);
    writeIndex();
    console.log(`removed ${file}`);
    process.exit(0);
  }
  if (existsSync(path)) { console.error(`${file}.js exists; open it, or remove it first`); process.exit(1); }
  writeFileSync(path, `import { sdCircle, sdEllipse } from "../src/math.js";
import { driveUp } from "../src/figure.js";

/* ${file}: a flat ink drawing. Shapes are laid in order: a solid ("fill"), a pen line along an outline ("line"), strokes inside a
 * shape ("hatch"), and "paper" to carve a highlight out of ink. The motion is a placeholder, written fresh for this engine:
 * the top shape lifts as the cursor rises. Replace it with the motion picked in step 6. */
export const ${id} = {
  T: 4, active: [0, 2], S: 230, hint: "move up to ...",
  drive: driveUp,
  shapes: [
    { id: "shade", ink: "black", mark: "hatch", tone: 0.5, box: [-0.6, 0.6, -0.6, 0.6], sdf: (x, y) => sdCircle(x, y, 0.08, -0.08, 0.45) },
    { id: "body", ink: "black", mark: "line", box: [-0.6, 0.6, -0.6, 0.6], sdf: (x, y) => sdCircle(x, y, 0, 0, 0.5) },
    { id: "top", ink: "red", box: [-0.3, 0.3, 0.5, 0.9], sdf: (x, y) => sdEllipse(x, y, 0, 0.7, 0.2, 0.12) },
  ],
  step(t, k) {
    const p = Math.min(1, t / 2);                                          // placeholder: 0 at rest, 1 at the end of active
    return { top: { off: [0, p * 0.12 * (0.4 + k)] } };
  },
};
`);
  writeIndex();
  console.log(path);
}
