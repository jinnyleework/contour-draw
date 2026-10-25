import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { SCENES } from "../figures/index.js";
import { checkFigure } from "../tools/check.mjs";
import { figureSource, register, unregister, camel } from "../tools/new-figure.mjs";
import { planes } from "../src/slice.js";
import { byIntensity, clamp, sm } from "../src/math.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// timing is a property of the machine, not of the figure: the checker reports it, but a test must not depend on it
const notTiming = (r) => r.check !== "moving frame";
const fails = (scene) => checkFigure("t", scene).filter((r) => r.level === "FAIL" && notTiming(r)).map((r) => r.check);

/** the smallest figure that should pass: a ball that rises with the cursor, on a base */
const good = () => ({
  T: 4, zr: [-0.6, 1.4], S: 130, zm: 0.4, active: [0, 2], drive: (x, y) => clamp((430 - y) / 260, 0, 1), hint: "move up the ball to raise it",
  parts: [
    { id: "base", order: 0, box: { x: [-0.6, 0.6], y: [-0.6, 0.6] }, planes: planes(-0.6, -0.4, 0.02), sdf: (x, y, z) => Math.max(Math.hypot(x, y) - 0.4, Math.abs(z + 0.5) - 0.08) },
    { id: "ball", order: 1, dynamic: true, key: (p) => p.h.toFixed(2), box: { x: [-0.5, 0.5], y: [-0.5, 0.5] }, planes: planes(-0.4, 1.4, 0.03), sdf: (x, y, z, { h }) => Math.hypot(x, y, z + 0.1 - h) - 0.3 },
  ],
  step: (t, abs, k = 0.5) => ({ base: {}, ball: { prm: { h: byIntensity(k, [0.3, 0.7, 1.1]) * sm(0, 2, t) } } }),
});

test("check: every figure in the engine passes", () => {
  for (const [name, sc] of Object.entries(SCENES)) assert.deepEqual(fails(sc), [], name);
});

test("check: a sound figure passes with nothing to fix", () => {
  const out = checkFigure("good", good());
  assert.deepEqual(out.filter((r) => r.level !== "ok" && notTiming(r)), []);
});

test("check: each mistake is caught, and named", () => {
  const case_ = (edit) => { const s = good(); edit(s); return fails(s); };
  assert.ok(case_((s) => { delete s.hint; }).includes("hint"));
  assert.ok(case_((s) => { s.active = [3, 1]; }).includes("active"));
  assert.ok(case_((s) => { s.drive = () => 0.5; }).includes("drive reaches both ends"));
  assert.ok(case_((s) => { s.drive = (x) => x / 100; }).includes("drive range"));
  assert.ok(case_((s) => { s.parts[1].id = "base"; }).includes("part ids"));
  assert.ok(case_((s) => { s.step = () => ({ ghost: {} }); }).includes("step()"));
  assert.ok(case_((s) => { s.step = () => ({ base: {}, ball: { prm: { h: NaN } } }); }).includes("step()"));
  assert.ok(case_((s) => { s.step = () => ({ base: {}, ball: { prm: { h: 0.5 } } }); }).includes("the figure responds"));            // nothing changes as the cursor drives it
  assert.ok(case_((s) => { const st = s.step; s.step = (t, a) => st(t, a, 0.5); }).includes("intensity"));                            // k is ignored
  assert.ok(case_((s) => { s.parts[0].box = { x: [-0.3, 0.3], y: [-0.3, 0.3] }; }).includes('part "base" closes inside its box'));  // the shape runs off the edge of its box
  assert.ok(case_((s) => { s.parts[1].sdf = () => NaN; }).length > 0);
  assert.ok(case_((s) => { s.parts[1].key = undefined; }).includes('part "ball"'));
  assert.ok(case_((s) => { s.parts = []; }).includes("parts"));
});

test("check: a part that is dynamic but never given a prm is reported", () => {
  const s = good(); s.step = () => ({ base: {} });
  assert.ok(fails(s).includes('dynamic part "ball"'));
});

test("check: a feature thinner than the grid is a warning that says to set `cell`", () => {
  const withWire = (cell) => {
    const s = good();
    s.parts.push({ id: "wire", order: 2, cell, box: { x: [-0.1, 0.1], y: [-0.1, 0.1] }, planes: planes(0, 0.5, 0.02), sdf: (x, y) => Math.hypot(x, y) - 0.012 });
    s.step = (t, a, k = 0.5) => ({ base: {}, wire: {}, ball: { prm: { h: byIntensity(k, [0.3, 0.7, 1.1]) * sm(0, 2, t) } } });
    return checkFigure("t", s).find((r) => r.check === 'part "wire" slices');
  };
  const coarse = withWire(undefined), fine = withWire(0.004);
  assert.ok(coarse.level === "warn" && /cell/.test(coarse.detail), JSON.stringify(coarse));
  assert.equal(fine.level, "ok", JSON.stringify(fine));
});

test("new-figure: names become identifiers and button labels", () => {
  assert.equal(camel("walnut-clock"), "walnutClock");
  assert.equal(camel("orb"), "orb");
});

test("new-figure: registering adds the import and the entry, once, and unregistering gives the file back", () => {
  const index = readFileSync(join(root, "figures/index.js"), "utf8");
  const added = register(index, "walnut-clock");
  assert.ok(added.includes('import { walnutClock } from "./walnut-clock.js";'));
  assert.ok(added.includes('"walnut clock": walnutClock'));
  assert.throws(() => register(added, "walnut-clock"), /already registered/);
  assert.equal(unregister(added, "walnut-clock").replace(/\s+/g, " "), index.replace(/\s+/g, " "));
  const plain = register(index, "orb");
  assert.ok(plain.includes("import { orb }") && /SCENES = \{[^}]*, orb \}/.test(plain));
  assert.equal(unregister(plain, "orb").replace(/\s+/g, " "), index.replace(/\s+/g, " "));
});

test("new-figure: the template it writes passes the checker as it stands", async () => {
  const dir = join(root, "test", ".tmp");
  mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(join(dir, "orb.js"), figureSource("orb", "../.."));
    const mod = await import(pathToFileURL(join(dir, "orb.js")).href);
    const out = checkFigure("orb", mod.orb);
    assert.deepEqual(out.filter((r) => r.level === "FAIL" && notTiming(r)), [], JSON.stringify(out.filter((r) => r.level !== "ok")));
    assert.ok(figureSource("walnut-clock").includes("export const walnutClock"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
