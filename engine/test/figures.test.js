import test from "node:test";
import assert from "node:assert/strict";
import { SCENES } from "../figures/index.js";
import { frame, hoverTime, MOTION } from "../src/scene.js";
import { planes } from "../src/slice.js";
import { bundle, strip } from "../tools/build.mjs";

const times = (T) => Array.from({ length: 180 }, (_, i) => (i / 180) * T);

test("every scene: unique part ids, and step() only talks about parts that exist", () => {
  for (const [name, sc] of Object.entries(SCENES)) {
    const ids = sc.parts.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, name);
    for (const t of times(sc.T)) for (const k of Object.keys(sc.step(t, t))) if (k !== "pulse") assert.ok(ids.includes(k), `${name}: ${k}`);
  }
});

test("every scene loops: the end of the cycle is where it began", () => {
  for (const [name, sc] of Object.entries(SCENES)) {
    const a = JSON.stringify(sc.step(0, 0)), b = JSON.stringify(sc.step(sc.T - 1e-6, sc.T - 1e-6));
    assert.ok(a.length > 0 && b.length > 0);
    const off = (st) => Object.values(st).flatMap((v) => (v && v.off) || []).map(Math.abs);
    assert.ok(Math.max(0, ...off(sc.step(sc.T - 1e-6, 1e6))) < 0.01, `${name} ends at rest`);
  }
});

test("rocket: it never rises more than a short way, and the flame is on or cleanly off", () => {
  const rocket = SCENES.rocket;
  for (const t of times(rocket.T)) {
    const st = rocket.step(t, t);
    assert.ok(st.body.off[2] >= 0 && st.body.off[2] <= 0.3 + 1e-9, `lift at ${t}`);
    const p = st.flame.prm;
    assert.ok(p === null || (p.L >= 0.03 && p.L <= 1.3), `flame at ${t}`);
  }
  assert.equal(rocket.step(0.5, 0.5).flame.prm, null);                          // no flame on the pad
  assert.ok(rocket.step(5.8, 5.8).flame.prm.L > 1.15);                          // a full flame at the hover
});

test("camera: the zoom stays within 0 to 1, and the flash is brief", () => {
  const cam = SCENES.camera;
  for (const t of times(cam.T)) {
    const st = cam.step(t, t);
    assert.ok(st.lens.prm.zoom >= 0 && st.lens.prm.zoom <= 1);
    assert.ok(st.button.off[2] <= 0 && st.button.off[2] >= -0.0401);
  }
  assert.ok(cam.step(2.75, 2.75).pulse > 2);
  assert.ok(cam.step(1.0, 1.0).pulse < 1.01);
});

test("binoculars: the barrels move apart by at most 7 hundredths", () => {
  const b = SCENES.binoculars;
  for (const t of times(b.T)) {
    const [l, r] = [b.step(t, t).tubeL.off[0], b.step(t, t).tubeR.off[0]];
    assert.ok(Math.abs(l + r) < 1e-12 && r >= 0 && r <= 0.0701);
  }
});

test("a real frame of each scene draws, with no NaN", () => {
  for (const [name, sc] of Object.entries(SCENES)) {
    const out = frame(sc, sc === SCENES.rocket ? 4 : 2, 2);
    assert.ok(out.includes('class="fill"') && out.includes('class="ln"'), name);
    assert.ok(!/NaN|undefined/.test(out), name);
  }
});

test("build: modules join into one script with no imports, exports, or clashing names", () => {
  assert.equal(strip('import { a } from "./a.js";\nexport const b = 1;\nexport function c() {}\n'), "const b = 1;\nfunction c() {}\n");
  assert.equal(strip('export { a, b };\nconst c = 1;\n'), "const c = 1;\n");                       // a bare export list goes too
  const js = bundle();
  assert.ok(!/^import /m.test(js) && !/^export /m.test(js));
  assert.ok(js.includes("function createPlayer") && js.includes("const SCENES"));
});

const peak = (sc, pick, k) => Math.max(...times(sc.T).map((t) => pick(sc.step(t, t, k))));

test("intensity: 0.5 is the figure as first drawn, and the default when none is given", () => {
  assert.equal(MOTION.intensity, 0.5);
  for (const sc of Object.values(SCENES)) for (const t of times(sc.T)) assert.deepEqual(sc.step(t, t), sc.step(t, t, 0.5));
  assert.equal(peak(SCENES.rocket, (s) => s.body.off[2], 0.5), 0.3);
  assert.equal(peak(SCENES.camera, (s) => s.lens.prm.zoom, 0.5), 1);
  assert.ok(Math.abs(peak(SCENES.binoculars, (s) => s.tubeR.off[0], 0.5) - 0.07) < 1e-6);
});

test("intensity: every figure does more as it rises", () => {
  const rise = (k) => peak(SCENES.rocket, (s) => s.body.off[2], k), flame = (k) => peak(SCENES.rocket, (s) => (s.flame.prm ? s.flame.prm.L : 0), k);
  const zoom = (k) => peak(SCENES.camera, (s) => s.lens.prm.zoom, k), flash = (k) => peak(SCENES.camera, (s) => s.pulse, k);
  const apart = (k) => peak(SCENES.binoculars, (s) => s.tubeR.off[0], k), turn = (k) => peak(SCENES.binoculars, (s) => s.wheel.prm.ph, k);
  for (const f of [rise, flame, zoom, flash, apart, turn]) assert.ok(f(0) < f(0.5) && f(0.5) < f(1), String(f));
});

test("intensity: even at its strongest the rocket and its flame stay on the page", () => {
  const rocket = SCENES.rocket;
  assert.ok(peak(rocket, (s) => s.body.off[2], 1) <= 0.55 + 1e-9);
  assert.ok(peak(rocket, (s) => (s.flame.prm ? s.flame.prm.L : 0), 1) <= 1.7);
  const tip = -0.85 - 1.7 + 0.55;                                            // the flame's lowest tip at a hover, in world height
  assert.ok(300 + rocket.S * Math.sqrt(0.75) * (rocket.zm - tip) < 600);       // still above the bottom of the 600 page
});

test("intensity: frames at 0 and 1 draw, with no NaN, for every figure", () => {
  for (const [name, sc] of Object.entries(SCENES)) for (const k of [0, 1]) {
    const out = frame(sc, sc === SCENES.rocket ? 5.8 : 2.78, 2.78, undefined, undefined, null, k);
    assert.ok(out.includes('class="ln"') && !/NaN|undefined/.test(out), `${name} at ${k}`);
  }
});

test("hover: every figure says when it acts, how the cursor drives it, and where to move", () => {
  for (const [name, sc] of Object.entries(SCENES)) {
    assert.ok(sc.active[0] >= 0 && sc.active[0] < sc.active[1] && sc.active[1] <= sc.T, name);
    assert.ok(typeof sc.hint === "string" && sc.hint.length > 5, name);
    for (let x = -50; x <= 650; x += 25) for (let y = -50; y <= 650; y += 25) {
      const p = sc.drive(x, y);
      assert.ok(p >= 0 && p <= 1, `${name} drive(${x}, ${y}) = ${p}`);
    }
  }
});

test("hover: the pose at the start of the active stretch is the rest pose, at any intensity", () => {
  for (const k of [0, 0.5, 1]) {
    const r = SCENES.rocket.step(SCENES.rocket.active[0], 0, k), c = SCENES.camera.step(SCENES.camera.active[0], 0, k), b = SCENES.binoculars.step(SCENES.binoculars.active[0], 0, k);
    assert.equal(r.body.off[2], 0); assert.equal(r.flame.prm, null);
    assert.equal(c.lens.prm.zoom, 0); assert.equal(c.button.off[2], -0); assert.equal(c.pulse, 1 + 0);
    assert.equal(b.tubeR.off[0], 0); assert.equal(b.wheel.prm.ph, 0);
  }
});

test("hover: moving the cursor along the drive axis only ever takes the figure further", () => {
  const along = (sc, pick, k = 0.5) => {
    const v = Array.from({ length: 41 }, (_, i) => { const t = sc.active[0] + (i / 40) * (sc.active[1] - sc.active[0]); return pick(sc.step(t, t, k)); });
    return v.every((x, i) => i === 0 || x >= v[i - 1] - 1e-9) && v[40] > v[0];
  };
  assert.ok(along(SCENES.rocket, (s) => s.body.off[2]));
  const flame = (u) => { const sc = SCENES.rocket, t = sc.active[0] + u * (sc.active[1] - sc.active[0]); const p = sc.step(t, t).flame.prm; return p ? p.L : 0; };
  assert.ok(flame(0) < flame(0.25) && flame(0.25) < flame(0.5) && flame(0.5) < flame(0.75));   // it throbs at the top, so the trend, not every step
  assert.ok(along(SCENES.camera, (s) => s.lens.prm.zoom));
  assert.ok(along(SCENES.binoculars, (s) => s.tubeR.off[0]));
});

test("hoverTime: the rest pose with the pointer away, the end of the action at the far side, capped at the spring's overshoot", () => {
  const r = SCENES.rocket, [a0, a1] = r.active;
  assert.equal(hoverTime(r, { x: 300, y: 100, s: 0 }), a0);                      // pointer away
  assert.equal(hoverTime(r, { x: 300, y: 470, s: 1 }), a0);                      // at the foot of the rocket
  assert.equal(hoverTime(r, { x: 300, y: 100, s: 1 }), a1);                      // at the nose: fully launched
  assert.ok(Math.abs(hoverTime(r, { x: 300, y: 100, s: 0.5 }) - (a0 + (a1 - a0) / 2)) < 1e-9);   // the pointer arriving, half in
  assert.equal(hoverTime(r, { x: 300, y: 100, s: 1.08 }), a1);                   // the spring overshoots; the figure does not
  const c = SCENES.camera;
  assert.ok(hoverTime(c, { x: 400, y: 300, s: 1 }) > hoverTime(c, { x: 250, y: 300, s: 1 }));   // further right, further through
});

test("overlay: a part that sits inside glass is painted after everything else, whatever its height", () => {
  const disc = (id, z0, overlay) => ({ id, order: 0, overlay, box: { x: [-1, 1], y: [-1, 1] }, planes: planes(z0, z0 + 0.05), sdf: (x, y) => Math.hypot(x, y) - 0.3 });
  const scene = { T: 1, zr: [0, 1], S: 100, zm: 0, active: [0, 1], drive: () => 0, hint: "x", parts: [disc("low", 0.0, true), disc("high", 0.9, false)], step: () => ({ low: {}, high: {} }) };
  const out = frame(scene, 0);
  const fills = [...out.matchAll(/class="fill" d="M([\d.-]+) ([\d.-]+)/g)].map((m) => +m[2]);
  const lowY = Math.max(...fills), highY = Math.min(...fills);                  // the low disc sits lower on the page
  assert.ok(out.lastIndexOf(String(lowY)) > out.lastIndexOf(String(highY)), "the low overlay disc comes last");
});

test("lightbulb: dark and quiet at rest, lit and flickering as the cursor rises", () => {
  const b = SCENES.lightbulb;
  for (const k of [0, 0.5, 1]) { const rest = b.step(b.active[0], 0, k); assert.equal(rest.halo.prm, null); assert.equal(rest.pulse, 1); }
  const shells = (k) => { const p = b.step(b.active[1], 0, k).halo.prm; return p ? p.n : 0; };
  assert.ok(shells(0) < shells(0.5) && shells(0.5) < shells(1) && shells(1) <= 7);
  assert.ok(b.parts.filter((p) => p.overlay).map((p) => p.id).sort().join() === "filament,halo");
  let prev = 0;
  for (let i = 0; i <= 40; i++) { const t = (i / 40) * 2, p = b.step(t, 0).halo.prm; const n = p ? p.n : 0; assert.ok(n >= prev - 1e-9); prev = n; }
});

test("record player: the arm is parked and the platter still at rest, then the arm swings in before the platter spins up", () => {
  const r = SCENES["record player"];
  for (const k of [0, 0.5, 1]) { const rest = r.step(r.active[0], 0, k); assert.equal(rest.platter.prm.ph, 0); assert.ok(Math.abs(rest.arm.prm.a - Math.PI / 2) < 0.006); }
  const at = (t, k = 0.5) => r.step(t, 0, k);
  assert.ok(at(1.5).arm.prm.a > at(0.5).arm.prm.a);                                    // the arm swings in
  assert.equal(at(0.9).platter.prm.ph, 0);                                             // and the platter has not started
  assert.ok(at(3.2).platter.prm.ph > at(2).platter.prm.ph && at(2).platter.prm.ph > 0);
  const turns = (k) => at(3.2, k).platter.prm.ph / (2 * Math.PI);
  assert.ok(turns(0) < turns(0.5) && turns(0.5) < turns(1));
  assert.ok(Math.abs(turns(0.5) - 3) < 0.05 && Math.abs(at(3.2).arm.prm.a - (Math.PI - 0.35)) < 0.006);   // as first designed at 0.5
});

test("lighthouse: dark at rest, beams grow and sweep as the cursor crosses, and sweep further at higher intensity", () => {
  const l = SCENES.lighthouse, beams = (t, k = 0.5) => l.step(t, 0, k).beams.prm;
  for (const k of [0, 0.5, 1]) assert.equal(beams(l.active[0], k), null);                         // the lamp is dark at rest
  assert.ok(l.parts.find((p) => p.id === "lamp").overlay);                                       // and the lamp shows through the glass
  let prevA = -Infinity, prevL = 0;
  for (let i = 4; i <= 40; i++) {
    const p = beams((i / 40) * 2.4);
    if (!p) continue;
    assert.ok(p.a >= prevA - 1e-9 && p.L >= prevL - 1e-9, `step ${i}`);                         // the beam only grows and turns forward
    prevA = p.a; prevL = p.L;
  }
  const swept = (k) => beams(l.active[1], k).a - beams(0.6, k).a;
  assert.ok(swept(0) < swept(0.5) && swept(0.5) < swept(1));
  assert.ok(beams(l.active[1], 0.5).L <= 1.12 && beams(l.active[1], 1).L <= 1.12);                // the beam never outgrows the page: at the scale it is drawn, 1.12 is 168 units each way of 300
  assert.equal(l.drive(120, 300), 0);
  assert.equal(l.drive(480, 300), 1);
});
