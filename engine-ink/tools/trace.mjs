#!/usr/bin/env node
/*
 * A drawing given as an image becomes a figure: `node tools/trace.mjs <image> <name> [options]` writes figures/<name>.js and
 * registers it. Any picture works (a scan, a photo of a sketch, a silhouette, a screenshot); the engine then inks it.
 *
 *   dark areas      -> solid ink ("fill"); a coloured mark (red, blue...) is ink too, however light it reads in grey
 *   middle tones    -> hatching under the ink ("hatch"), so greys become pen strokes: light greys hatched one way, dark
 *                      greys crossed by a second hatch
 *   light areas     -> paper
 *
 * Options:
 *   --dark 0.45       how dark (0 black .. 1 white) a pixel must be to be solid ink
 *   --mid 0.72        how dark it must be to be hatched (set it equal to --dark for no hatching)
 *   --ink red         the one ink it prints in (default black)
 *   --invert          light lines on a dark ground: swap ink and paper first
 *   --size 420        the longest side of the drawing, in mask px (more is finer)
 *   --clean 1         passes of a small blur before the threshold: scan noise and jpeg grain go, the forms stay (0 for none)
 *   --drop 5e8f90     for a photo: every colour near this one's hue becomes paper, dark or light (a sea, a sky, a wall), so
 *                     the subject stands alone. Several: --drop 5e8f90,87b3d9. Greys are never dropped
 *   --drop-hue 25     how near, in degrees of hue
 *   --ground hatch    keep the dropped colour as a setting instead of paper: only hatched, never solid (cross-hatched where
 *                     darker than 0.5, hatched to 0.75, paper above: a sea keeps its glints), so the subject still stands out
 *   --frame           keep the whole picture as the drawing's area instead of cropping to what is drawn: pictures made
 *                     the same size (letters set at one size) then come out at one scale
 *   --local 40        judge each pixel against its own neighbourhood (a box this many px across) instead of the whole picture:
 *                     for uneven light, like letters on glass with the sky reflected in it. Darkness becomes "how much darker
 *                     than round here", re-centred on 0.5, so pair it with a --dark just under 0.5 (0.4 to 0.45)
 *   --colour 70       how strong a colour must be (its brightest channel minus its dullest, 0..255) to count as ink however
 *                     light it is: lower it to catch pale coloured marks, raise it when dull colours (brick) creep in
 *   --card 474x500    a card's picture box: the picture is cropped (centred) to that shape, nothing is trimmed off it, and
 *                     the figure gets that frame, so its exports come out exactly that size
 *   --frame-size 700  with --frame: the length that maps to the page's 1.7 units (default: the picture's longest side), so a
 *                     wide picture (a word) comes out at the same scale as square ones set at the same type size
 *   --halo 3          with --ground hatch: a paper gap this many px wide between the subject's ink and the ground
 *   --separate 2      where two clearly different colours meet inside the ink (shorts against skin), cut a paper line this
 *                     many px wide between them, as a woodcut separates forms. Off by default
 *
 * Needs `sips` (macOS) to read the image. No other dependencies.
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { writeIndex } from "./new-figure.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** an uncompressed 24 or 32 bit BMP to { w, h, px: [r, g, b, a] rows from the top } */
export function readBmp(buf) {
  const off = buf.readUInt32LE(10), w = buf.readInt32LE(18), hRaw = buf.readInt32LE(22), bpp = buf.readUInt16LE(28);
  const h = Math.abs(hRaw), topDown = hRaw < 0, step = bpp / 8, row = Math.ceil((w * step) / 4) * 4;
  if (bpp !== 24 && bpp !== 32) throw new Error(`trace: a ${bpp}-bit BMP is not read here`);
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const src = off + (topDown ? y : h - 1 - y) * row;
    for (let x = 0; x < w; x++) {
      const p = src + x * step, q = (y * w + x) * 4;
      px[q] = buf[p + 2]; px[q + 1] = buf[p + 1]; px[q + 2] = buf[p]; px[q + 3] = bpp === 32 ? buf[p + 3] : 255;
    }
  }
  return { w, h, px };
}

/** a 0/1 mask as run lengths: "w.h.r0.r1...", base 36, paper first, rows from the top (src/ink.js decodeMask reads it) */
export function encodeMask(m, w, h) {
  const runs = [];
  let cur = 0, n = 0;
  for (let k = 0; k < w * h; k++) { if (m[k] === cur) n++; else { runs.push(n); cur = m[k]; n = 1; } }
  runs.push(n);
  return [w, h, ...runs].map((v) => v.toString(36)).join(".");
}

/** a colour's hue in degrees and its saturation (0 grey .. 1 pure) */
export function hueOf(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return [0, 0];
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, d / max];
}

/** each pixel sorted: 0 paper, 1 hatched, 3 cross-hatched (the darker half of the greys), 2 solid. One ink: colour is only darkness */
export function classify({ w, h, px }, { dark = 0.45, mid = 0.72, invert = false, clean = 1, drop = [], dropHue = 25, separate = 0, ground = "paper", halo = 3, colour = 70, local = 0 } = {}) {
  const tone = new Uint8Array(w * h), hues = drop.map((hex) => hueOf(...[0, 2, 4].map((i) => parseInt(hex.replace("#", "").slice(i, i + 2), 16)))[0]);
  let L = new Float32Array(w * h), C = new Float32Array(w * h), D = new Float32Array(w * h);
  const H = new Float32Array(w * h), Sat = new Float32Array(w * h);
  for (let k = 0; k < w * h; k++) {
    const a = px[k * 4 + 3] / 255, [r, g, b] = [0, 1, 2].map((c) => px[k * 4 + c] * a + 255 * (1 - a));
    L[k] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (invert) L[k] = 1 - L[k];
    C[k] = Math.max(r, g, b) - Math.min(r, g, b) > colour ? 1 : 0;          // a strong colour: a mark, not a grey
    [H[k], Sat[k]] = hueOf(r, g, b);
    if (hues.length) {
      const hu = H[k], sat = Sat[k];
      D[k] = sat > 0.12 && hues.some((d) => Math.min(Math.abs(hu - d), 360 - Math.abs(hu - d)) < dropHue) ? 1 : 0;
    }
  }
  for (let p = 0; p < clean; p++) { L = blur3(L, w, h); C = blur3(C, w, h); if (hues.length) D = blur3(D, w, h); }
  if (local > 0) {
    // the neighbourhood's mean (box blur, a summed-area table), and each pixel's darkness against it
    const S = new Float64Array((w + 1) * (h + 1)), r = Math.round(local / 2);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) S[(y + 1) * (w + 1) + x + 1] = L[y * w + x] + S[y * (w + 1) + x + 1] + S[(y + 1) * (w + 1) + x] - S[y * (w + 1) + x];
    const M = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
      M[y * w + x] = (S[y1 * (w + 1) + x1] - S[y0 * (w + 1) + x1] - S[y1 * (w + 1) + x0] + S[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
    }
    for (let k = 0; k < w * h; k++) L[k] = clamp01(0.5 + (L[k] - M[k]) * 2);
  }
  for (let k = 0; k < w * h; k++) {
    if (D[k] > 0.5) {                                          // a dropped colour is paper, or a ground only ever hatched
      if (ground === "hatch") tone[k] = L[k] < 0.5 ? 3 : L[k] < 0.75 ? 1 : 0;
      continue;
    }
    if (C[k] > 0.5) { tone[k] = 2; continue; }                // a coloured mark is ink however light it reads in grey
    tone[k] = L[k] < dark ? 2 : L[k] < (dark + mid) / 2 ? 3 : L[k] < mid ? 1 : 0;
  }
  if (separate > 0) {
    // a seam: two pixels a little apart, both coloured, whose hues differ by more than 50 degrees
    const seam = new Uint8Array(w * h), far = 2, hd = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
    for (let y = 0; y < h - far; y++) for (let x = 0; x < w - far; x++) {
      const k = y * w + x;
      for (const q of [k + far, k + far * w]) {
        if (Sat[k] > 0.2 && Sat[q] > 0.2 && tone[k] === 2 && tone[q] === 2 && hd(H[k], H[q]) > 50) seam[k] = seam[q] = 1;
      }
    }
    const cut = separate > 1 ? dilate(seam, w, h, Math.round((separate - 1) / 2)) : seam;
    for (let k = 0; k < w * h; k++) if (cut[k]) tone[k] = 0;
  }
  if (ground === "hatch" && halo > 0) {
    const solid = new Uint8Array(w * h);
    for (let k = 0; k < w * h; k++) solid[k] = tone[k] === 2 ? 1 : 0;
    const near = dilate(solid, w, h, Math.round(halo));
    for (let k = 0; k < w * h; k++) if (near[k] && D[k] > 0.5) tone[k] = 0;
  }
  return { tone };
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** a 3 by 3 box blur, edges clamped */
function blur3(src, w, h) {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += src[Math.min(h - 1, Math.max(0, y + dy)) * w + Math.min(w - 1, Math.max(0, x + dx))];
    out[y * w + x] = sum / 9;
  }
  return out;
}

/** the box [x0, x1, y0, y1] of the non-paper pixels in a window of the picture, with a pad */
function contentBox(tone, w, fx, fy, fw, fh, pad = 3) {
  let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1;
  for (let y = fy; y < fy + fh; y++) for (let x = fx; x < fx + fw; x++) if (tone[y * w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return null;
  return [Math.max(fx, x0 - pad), Math.min(fx + fw, x1 + pad + 1), Math.max(fy, y0 - pad), Math.min(fy + fh, y1 + pad + 1)];
}

/** a 0/1 mask shrunk (erode) or grown (dilate) by r px, square window */
function morph(m, w, h, r, grow) {
  const a = new Uint8Array(w * h), b = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = grow ? 0 : 1;
    for (let d = -r; d <= r; d++) { const xx = x + d, on = xx >= 0 && xx < w ? m[y * w + xx] : 0; v = grow ? v | on : v & on; }
    a[y * w + x] = v;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = grow ? 0 : 1;
    for (let d = -r; d <= r; d++) { const yy = y + d, on = yy >= 0 && yy < h ? a[yy * w + x] : 0; v = grow ? v | on : v & on; }
    b[y * w + x] = v;
  }
  return b;
}
const erode = (m, w, h, r) => morph(m, w, h, r, false);
const dilate = (m, w, h, r) => morph(m, w, h, r, true);

/** the masks of the crop: { solid, hatch, cross } as encoded strings (null where empty) */
function masks({ tone }, w, [x0, x1, y0, y1]) {
  const cw = x1 - x0, ch = y1 - y0, solid = new Uint8Array(cw * ch);
  let ns = 0;
  const midOnly = new Uint8Array(cw * ch), darkMid = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const k = (y0 + y) * w + x0 + x, q = y * cw + x;
    if (tone[k] === 2) { solid[q] = 1; ns++; }
    if (tone[k] === 1 || tone[k] === 3) midOnly[q] = 1;
    if (tone[k] === 3) darkMid[q] = 1;
  }
  // only broad grey areas are hatched: the thin grey halo a scan leaves round every dark edge is opened away
  const hatch = dilate(erode(midOnly, cw, ch, 2), cw, ch, 2), cross = dilate(erode(darkMid, cw, ch, 2), cw, ch, 2);
  const nh = hatch.reduce((a, v) => a + v, 0), nc = cross.reduce((a, v) => a + v, 0);
  const min = cw * ch * 0.002;
  return { cw, ch, solid: ns > min ? encodeMask(solid, cw, ch) : null, hatch: nh > min ? encodeMask(hatch, cw, ch) : null, cross: nc > min ? encodeMask(cross, cw, ch) : null };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2), flags = {}, pos = [];
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith("--")) { pos.push(args[i]); continue; }
    const key = args[i].slice(2);
    if (key === "invert" || key === "frame") flags[key] = true; else flags[key] = args[++i];
  }
  const [image, raw] = pos;
  if (!image || !raw || !existsSync(image)) { console.error("usage: node tools/trace.mjs <image> <name> [--dark 0.45] [--mid 0.72] [--ink red] [--invert] [--size 420] [--clean 1] [--drop hex,hex] [--drop-hue 25] [--separate 2] [--ground hatch] [--halo 3] [--frame] [--frame-size 700] [--colour 70] [--card 474x500]"); process.exit(1); }
  if (!/^_?[a-z][a-z0-9 -]*$/i.test(raw)) { console.error(`trace: "${raw}" is not a usable name: letters, digits, spaces and dashes (a leading _ makes a helper: traced, but not a figure of its own)`); process.exit(1); }
  const file = raw.toLowerCase().replace(/\s+/g, "-"), id = file.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), path = join(root, "figures", `${file}.js`);
  const size = +(flags.size || 420), clean = +(flags.clean ?? 1), dark = +(flags.dark ?? 0.45), mid = Math.max(dark, +(flags.mid ?? 0.72));

  const tmp = mkdtempSync(join(tmpdir(), "ink-trace-")), bmp = join(tmp, "in.bmp");
  execFileSync("sips", ["-s", "format", "bmp", "-Z", String(size), image, "--out", bmp], { stdio: "ignore" });
  const pic = readBmp(readFileSync(bmp));
  rmSync(tmp, { recursive: true, force: true });
  const drop = flags.drop ? flags.drop.split(",") : [], dropHue = +(flags["drop-hue"] ?? 25);
  const separate = +(flags.separate ?? 0), ground = flags.ground || "paper", halo = +(flags.halo ?? 3);
  const colour = +(flags.colour ?? 70);
  const local = +(flags.local ?? 0);
  const cls = classify(pic, { dark, mid, invert: !!flags.invert, clean, drop, dropHue, separate, ground, halo, colour , local });

  // cropped to what is drawn, and fitted to the page's -0.85 .. 0.85
  const card = flags.card ? flags.card.split("x").map(Number) : null;
  if (card) {                                                             // the largest centred window of the card's shape
    const want = card[0] / card[1], w = Math.min(pic.w, Math.round(pic.h * want)), h = Math.min(pic.h, Math.round(pic.w / want));
    flags.frame = true; flags.cardBox = [Math.floor((pic.w - w) / 2), Math.floor((pic.w - w) / 2) + w, Math.floor((pic.h - h) / 2), Math.floor((pic.h - h) / 2) + h];
  }
  const box = flags.cardBox || (flags.frame ? (contentBox(cls.tone, pic.w, 0, 0, pic.w, pic.h) && [0, pic.w, 0, pic.h]) : contentBox(cls.tone, pic.w, 0, 0, pic.w, pic.h));
  if (!box) { console.error("trace: nothing dark enough in the picture; raise --dark or --mid, or try --invert"); process.exit(1); }
  const cw = box[1] - box[0], ch = box[3] - box[2], unit = 1.7 / (flags.frame && flags["frame-size"] ? +flags["frame-size"] : Math.max(cw, ch)), ax = (cw * unit) / 2, ay = (ch * unit) / 2;
  const m = masks(cls, pic.w, box), tag = id.replace(/[A-Z]/g, (c) => "_" + c).toUpperCase(), ink = flags.ink || "black";
  const consts = [], shapes = [];
  if (m.hatch) { consts.push(`const ${tag}_HATCH = { area: ${id}Area, mask: "${m.hatch}" };`); shapes.push(`    { id: "tone", ink: "${ink}", mark: "hatch", tone: 0.5, bitmap: ${tag}_HATCH },`); }
  if (m.cross) { consts.push(`const ${tag}_CROSS = { area: ${id}Area, mask: "${m.cross}" };`); shapes.push(`    { id: "cross", ink: "${ink}", mark: "hatch", tone: 0.5, angle: -40, bitmap: ${tag}_CROSS },`); }
  if (m.solid) { consts.push(`const ${tag}_SOLID = { area: ${id}Area, mask: "${m.solid}" };`); shapes.push(`    { id: "ink", ink: "${ink}", bitmap: ${tag}_SOLID },`); }
  const opts = `--dark ${dark} --mid ${mid} --size ${size} --clean ${clean}${ink !== "black" ? " --ink " + ink : ""}${flags.invert ? " --invert" : ""}${drop.length ? ` --drop ${drop.join(",")} --drop-hue ${dropHue}` : ""}${separate ? ` --separate ${separate}` : ""}${ground !== "paper" ? ` --ground ${ground} --halo ${halo}` : ""}${flags.frame ? " --frame" : ""}${flags["frame-size"] ? " --frame-size " + flags["frame-size"] : ""}${colour !== 70 ? " --colour " + colour : ""}${card ? " --card " + flags.card : ""}${local ? " --local " + local : ""}`;

  writeFileSync(path, `import { driveUp } from "../src/figure.js";

/* ${file}: traced from ${image.split("/").pop()} by tools/trace.mjs (${opts}).
 * Dark areas are solid ink, middle tones are hatched, all in one ink. A still. Retrace rather than edit the masks. */
const ${id}Area = [${(-ax).toFixed(4)}, ${ax.toFixed(4)}, ${(-ay).toFixed(4)}, ${ay.toFixed(4)}];
${consts.join("\n")}

export const ${id} = {
  T: 4, active: [0, 1], S: ${card ? +(Math.max(...card) / 1.7).toFixed(4) : 300},${card ? ` frame: [${card[0]}, ${card[1]}],` : ""} hint: "${file.replace(/-/g, " ")}",
  drive: driveUp,
  shapes: [
${shapes.join("\n")}
  ],
  step() {
    return {};                                                            // a still: nothing moves
  },
};
`);
  writeIndex();
  console.log(`${path} (${shapes.length} shapes, mask ${cw}x${ch} px)`);
}
