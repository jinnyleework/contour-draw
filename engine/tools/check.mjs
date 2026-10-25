#!/usr/bin/env node
/*
 * Checks a figure: `node tools/check.mjs [name | path/to/figure.js ...]`, or no argument to check them all.
 *
 * Prints one line per check (`ok`, `warn` or `FAIL`) and exits 1 if anything FAILed. The checks catch what is mechanical:
 * a figure that is missing a field, a shape that runs off the edge of its box (its outlines would never close), a step()
 * that names a part that does not exist, a cursor mapping that never reaches 0 or 1, an intensity that does nothing, a
 * frame with NaN in it or one that is too heavy to animate. Judging how it looks is not mechanical: do that in a browser.
 *
 *   FAIL  it will not work              warn  it will work, but look at it
 */
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve, basename } from "node:path";
import { frame, hoverTime } from "../src/scene.js";
import { sheetsOf, slicePart, CELL } from "../src/slice.js";
import { bundle } from "./build.mjs";

const SIZE_WARN = 450_000, SIZE_FAIL = 900_000, MS_WARN = 25, MS_FAIL = 60;
const camelOf = (k) => k.replace(/ ([a-z0-9])/g, (_, c) => c.toUpperCase());
const num = (v) => typeof v === "number" && Number.isFinite(v);
const nums = (a, n) => Array.isArray(a) && (n === undefined || a.length === n) && a.every(num);

/** the numbers of every path with a class, as [x, y] pairs: where the drawing lands on the page */
function pagePoints(markup) {
  const pts = [];
  for (const m of markup.matchAll(/class="fill" d="([^"]*)"/g)) {
    const v = m[1].match(/-?\d+(?:\.\d+)?/g) || [];
    for (let i = 0; i + 1 < v.length; i += 2) pts.push([+v[i], +v[i + 1]]);
  }
  return pts;
}

/** run every check on one scene; returns [{ level: "ok" | "warn" | "FAIL", check, detail }] */
export function checkFigure(name, sc) {
  const out = [];
  const add = (level, check, detail = "") => out.push({ level, check, detail });
  const need = (cond, check, detail) => { add(cond ? "ok" : "FAIL", check, cond ? "" : detail); return cond; };

  /* 1. the shape of the declaration */
  let sound = true;
  sound &= need(num(sc.T) && sc.T > 0, "T", "T is the seconds in one loop: a number above 0");
  sound &= need(nums(sc.zr, 2) && sc.zr[0] < sc.zr[1], "zr", "zr is [zmin, zmax], the height range of the object");
  sound &= need(num(sc.S) && sc.S > 0 && num(sc.zm), "S, zm", "S (scale) and zm (the height that sits mid-page) are numbers");
  sound &= need(nums(sc.active, 2) && sc.active[0] >= 0 && sc.active[0] < sc.active[1] && sc.active[1] <= sc.T, "active", "active is [t0, t1] inside the loop, t0 < t1: the stretch the cursor scrubs; t0 is the rest pose");
  sound &= need(typeof sc.drive === "function", "drive", "drive(x, y) -> 0..1 maps the cursor to how far through `active` the figure is");
  sound &= need(typeof sc.hint === "string" && sc.hint.length >= 5, "hint", "hint: a few words on where to move the pointer");
  sound &= need(typeof sc.step === "function", "step", "step(t, abs, k) says what every part does");
  sound &= need(Array.isArray(sc.parts) && sc.parts.length > 0, "parts", "parts is a list of at least one part");
  if (!sound) return out;

  const ids = sc.parts.map((p) => p.id);
  need(ids.every((i) => typeof i === "string" && i) && new Set(ids).size === ids.length, "part ids", "every part needs a unique string id");
  for (const p of sc.parts) {
    const label = `part "${p.id}"`;
    const ok = typeof p.sdf === "function" && num(p.order) && nums(p.box && p.box.x, 2) && nums(p.box && p.box.y, 2) && p.box.x[0] < p.box.x[1] && p.box.y[0] < p.box.y[1]
      && Array.isArray(p.planes) && p.planes.length > 0 && nums(p.planes) && (!p.dynamic || typeof p.key === "function") && (p.cell === undefined || (num(p.cell) && p.cell > 0));
    need(ok, label, "a part needs sdf(x, y, z, prm), order, box { x: [min, max], y: [min, max] }, planes, and for a dynamic part a key(prm) function; cell, if given, above 0");
    if (ok && !p.dynamic && p.planes.some((z) => z < sc.zr[0] - 0.06 || z > sc.zr[1] + 0.06)) add("warn", label, "has planes outside zr: the height fade is computed from zr, so widen it");   // a moving part (a flame) may leave it on purpose
  }
  if (out.some((o) => o.level === "FAIL")) return out;

  /* 2. step(): only real parts, sane values, at any time and intensity */
  const times = Array.from({ length: 60 }, (_, i) => (i / 60) * sc.T).concat([sc.active[0], sc.active[1]]);
  let bad = null;
  for (const k of [0, 0.5, 1]) for (const t of times) {
    const st = sc.step(t, t, k);
    if (!st || typeof st !== "object") { bad = `step(${t}, ${t}, ${k}) did not return an object`; break; }
    for (const [key, v] of Object.entries(st)) {
      if (key === "pulse") { if (!num(v) || v < 0) bad = `pulse is ${v} at t=${t}`; continue; }
      if (!ids.includes(key)) { bad = `step() names "${key}", which is not a part (parts: ${ids.join(", ")})`; break; }
      if (v && v.off && !nums(v.off, 3)) bad = `"${key}".off must be [dx, dy, dz] of finite numbers (t=${t})`;
      if (v && v.prm && !Object.values(v.prm).every((x) => typeof x !== "number" || Number.isFinite(x))) bad = `"${key}".prm has a NaN or Infinity at t=${t}`;
    }
    if (bad) break;
  }
  need(!bad, "step()", bad);
  for (const p of sc.parts) if (p.dynamic) {
    const anyOn = times.some((t) => { const a = sc.step(t, t, 0.5)[p.id]; return a && a.prm; });
    need(anyOn, `dynamic part "${p.id}"`, "step() never gives it a prm, so it is never drawn: leave `dynamic` off, or fix step()");
  }

  /* 3. the rule every shape must keep: the sdf is positive on the edge of its box, or its outlines never close */
  for (const p of sc.parts) {
    const cell = p.cell || CELL, [x0, x1] = p.box.x, [y0, y1] = p.box.y;
    const prms = p.dynamic ? [...new Set(times.map((t) => sc.step(t, t, 1)[p.id]).filter((a) => a && a.prm).map((a) => a.prm))].filter((_, i, all) => i % Math.ceil(all.length / 6) === 0) : [undefined];
    let hit = null;
    for (const prm of prms) for (const z of p.planes) {
      const edge = [];
      for (let x = x0; x <= x1 + 1e-9; x += cell) edge.push([x, y0], [x, y1]);
      for (let y = y0; y <= y1 + 1e-9; y += cell) edge.push([x0, y], [x1, y]);
      const inside = edge.find(([x, y]) => !(p.sdf(x, y, z, prm) > 0));
      if (inside) { hit = `at z=${z.toFixed(3)} the shape is not outside the box at (${inside[0].toFixed(2)}, ${inside[1].toFixed(2)}): widen box.x / box.y`; break; }
    }
    need(!hit, `part "${p.id}" closes inside its box`, hit);
  }

  /* 4. slicing: a loop of only a few points is a feature thinner than the cell */
  for (const p of sc.parts) {
    const prm = p.dynamic ? times.map((t) => sc.step(t, t, 1)[p.id]).find((a) => a && a.prm)?.prm : undefined;
    if (p.dynamic && !prm) continue;
    const sheets = p.dynamic ? slicePart(p, prm) : sheetsOf(p);
    const all = sheets.reduce((n, s) => n + s.loops.length, 0), tiny = sheets.reduce((n, s) => n + s.loops.filter((l) => l.length < 6).length, 0);
    if (!sheets.length) add("FAIL", `part "${p.id}" slices`, "it produced no sheets at all: is the shape inside its box and planes?");
    else if (tiny > 5 && tiny > all * 0.25) add("warn", `part "${p.id}" slices`, `${tiny} of ${all} outlines have under 6 points: a feature thinner than the grid cell (${(p.cell || CELL)}); set \`cell\` on this part to about a third of the thinnest feature`);
    else add("ok", `part "${p.id}" slices`, `${sheets.length} sheets`);
    // a thin upright feature (a stem, a leg, a pole) is cut as a small ring at every height: with wide gaps the rings read as dots, not a line
    const gap = p.planes.length > 1 ? (p.planes[p.planes.length - 1] - p.planes[0]) / (p.planes.length - 1) : 0;
    const rings = sheets.reduce((n, sh) => n + sh.loops.filter((l) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of l) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return Math.max(x1 - x0, y1 - y0) < 0.09; }).length, 0);
    if (rings >= 6 && gap > 0.016) add("warn", `part "${p.id}" thin stems`, `${rings} small rings at a gap of ${gap.toFixed(3)}: a stem, leg or pole will read as a row of dots. Give the part \`planes(a, b, 0.01)\` and make the feature at least three cells thick`);
  }

  /* 5. the cursor: drive covers 0 to 1, and moving it changes the picture */
  let lo = Infinity, hi = -Infinity, wild = false;
  for (let x = -50; x <= 650; x += 25) for (let y = -50; y <= 650; y += 25) { const v = sc.drive(x, y); if (!num(v) || v < 0 || v > 1) wild = true; lo = Math.min(lo, v); hi = Math.max(hi, v); }
  need(!wild, "drive range", "drive(x, y) must stay between 0 and 1 for any point");
  need(lo <= 0.02 && hi >= 0.98, "drive reaches both ends", `drive only spans ${lo.toFixed(2)}..${hi.toFixed(2)}: the figure would never reach its rest pose or its full action`);
  const rest = frame(sc, sc.active[0], 0), end = frame(sc, sc.active[1], sc.active[1]);
  need(rest !== end, "the figure responds", "the picture at the start of `active` and at its end is the same: nothing happens as the cursor drives it");
  const weak = frame(sc, sc.active[1], sc.active[1], undefined, undefined, null, 0), strong = frame(sc, sc.active[1], sc.active[1], undefined, undefined, null, 1);
  need(weak !== strong, "intensity", "intensity 0 and intensity 1 draw the same picture: read k in step() and map it with byIntensity(k, [lo, mid, hi])");
  const offs = (st) => Object.values(st).flatMap((v) => (v && v.off) || []).map(Math.abs);
  need(Math.max(0, ...offs(sc.step(sc.T - 1e-6, 1e6))) < 0.01, "loop ends at rest", "at the end of the loop a part is still offset: draw each part at its rest position and let `off` start from 0 (npm test requires this)");
  need(hoverTime(sc, { x: 300, y: 300, s: 0 }) === sc.active[0], "rest pose", "with the pointer away the figure must sit at active[0]");

  /* 6. frames: no NaN, not too heavy, on the page, fast enough */
  const frames = [["rest", rest], ["end", end], ["end, intensity 0", weak], ["end, intensity 1", strong]];
  need(frames.every(([, m]) => !/NaN|undefined|Infinity/.test(m)), "frames are clean", "NaN or undefined in the markup: a shape returns NaN somewhere (a division by zero, or a Math.sqrt of a negative?)");
  const biggest = Math.max(...frames.map(([, m]) => m.length));
  add(biggest > SIZE_FAIL ? "FAIL" : biggest > SIZE_WARN ? "warn" : "ok", "markup size", `${Math.round(biggest / 1000)} kB at most${biggest > SIZE_WARN ? ": too many points per outline; use a coarser cell or fewer planes" : ""}`);
  const off = frames.map(([label, m]) => { const pts = pagePoints(m); const away = pts.filter(([x, y]) => x < -20 || x > 620 || y < -20 || y > 620).length; return away > pts.length * 0.02 ? label : null; }).filter(Boolean);
  if (off.length) add("warn", "on the page", `part of the drawing leaves the 600 x 600 page (${off.join("; ")}): lower S, or shorten the action`);
  else add("ok", "on the page");
  frame(sc, sc.active[0], 0);
  const t0 = performance.now(), n = 20;
  for (let i = 0; i < n; i++) frame(sc, sc.active[0] + ((i + 1) / n) * (sc.active[1] - sc.active[0]) * 0.97, 0.3 + i);
  const ms = (performance.now() - t0) / n;
  add(ms > MS_FAIL ? "FAIL" : ms > MS_WARN ? "warn" : "ok", "moving frame", `${ms.toFixed(1)} ms while the cursor drives it${ms > MS_WARN ? ": slow; coarsen the grid or shrink the box of the part that is re-cut each frame" : ""}`);
  return out;
}

/** the figure files' scenes by name, from figures/index.js, or a scene from a file path */
async function load(arg, root) {
  if (/\.m?js$/.test(arg)) {
    const mod = await import(pathToFileURL(resolve(arg)).href);
    const scene = Object.values(mod).find((v) => v && typeof v === "object" && Array.isArray(v.parts) && typeof v.step === "function");
    if (!scene) throw new Error(`${arg}: no exported scene (an object with parts and step)`);
    return [basename(arg, ".js"), scene];
  }
  const { SCENES } = await import(pathToFileURL(join(root, "figures/index.js")).href);
  // a figure is found by its button name ("vault door"), its file name ("vault-door") or its identifier ("vaultDoor")
  const key = Object.keys(SCENES).find((k) => k === arg || k === arg.replace(/-/g, " ") || k.replace(/ /g, "") === arg.replace(/-/g, "").toLowerCase() || camelOf(k) === arg);
  if (!key) throw new Error(`no figure called "${arg}" in figures/index.js (has: ${Object.keys(SCENES).join(", ")})`);
  return [key, SCENES[key]];
}

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const quiet = process.argv.includes("--quiet"), args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const { SCENES } = await import(pathToFileURL(join(root, "figures/index.js")).href);
  const targets = await Promise.all((args.length ? args : Object.keys(SCENES)).map((a) => load(a, root)));
  let failed = 0, warned = 0;
  try { bundle(); console.log("ok    build: the modules join into one script with no clashing names"); }
  catch (e) { failed++; console.log(`FAIL  build: ${e.message}`); }
  for (const [name, sc] of targets) {
    console.log(`\n${name}`);
    for (const r of checkFigure(name, sc)) {
      if (r.level === "FAIL") failed++; else if (r.level === "warn") warned++;
      if (!(quiet && r.level === "ok")) console.log(`  ${r.level.padEnd(4)}  ${r.check}${r.detail ? ": " + r.detail : ""}`);
    }
  }
  console.log(`\n${targets.length} figure${targets.length === 1 ? "" : "s"}: ${failed ? failed + " FAILED" : "all passed"}${warned ? `, ${warned} warning${warned === 1 ? "" : "s"}` : ""}`);
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((e) => { console.error(e.message); process.exit(2); });
