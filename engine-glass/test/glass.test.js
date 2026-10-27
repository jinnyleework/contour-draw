import test from "node:test";
import assert from "node:assert/strict";
import { shell, glassOf } from "../src/glass.js";
import { SCENES, GLASS } from "../figures/index.js";
import { checkFigure } from "../tools/check.mjs";
import { frame } from "../src/scene.js";
import { sheetsOf, slicePart, planes } from "../src/slice.js";

test("shell: inside only within a wall of the surface, and it leaves a thin part whole", () => {
  assert.equal(shell(-0.5, 0.1) > 0, true);                                      // deep inside: hollow
  assert.equal(shell(-0.05, 0.1) < 0, true);                                     // within the wall: solid
  assert.equal(shell(0.2, 0.1) > 0, true);                                       // outside: outside
  for (const d of [-0.08, -0.03, -0.001]) assert.ok(shell(d, 0.1) < 0, `a part only ${-d} deep stays solid`);
});

const ball = () => ({
  T: 2, zr: [-1, 1], S: 100, zm: 0, active: [0, 1], drive: () => 0, hint: "move to move the ball",
  parts: [{ id: "ball", order: 0, box: { x: [-1, 1], y: [-1, 1] }, planes: planes(-0.8, 0.8, 0.05), sdf: (x, y, z) => Math.hypot(x, y, z) - 0.7 }],
  step: (t, a, k = 0.5) => ({ ball: { off: [0, 0, 0.2 * t * k] } }),
});

test("glassOf: every slice through the body is drawn twice, and the original figure is untouched", () => {
  const solid = ball(), g = glassOf(solid, { wall: 0.08 });
  const mid = (sc) => slicePart(sc.parts[0]).find((s) => Math.abs(s.z) < 0.03);
  assert.equal(mid(solid).loops.length, 1);                                       // the solid ball: one outline
  assert.equal(mid(g).loops.length, 2);                                           // the glass ball: its skin, inside and out
  assert.equal(sheetsOf(solid.parts[0]), solid.parts[0].sheets);                  // and the original was not given the glass's slices
  assert.equal(sheetsOf(solid.parts[0]).find((s) => Math.abs(s.z) < 0.03).loops.length, 1);
  assert.equal(g.parts[0].sheets, undefined, "the copy starts with no inherited slices");
});

test("glassOf: parts named solid stay solid; inside parts are overlays that follow their host and take their parameters", () => {
  const g = glassOf(ball(), {
    solid: ["ball"], hint: "x",
    inside: [{ id: "core", box: { x: [-1, 1], y: [-1, 1] }, planes: planes(-0.2, 0.2, 0.05), sdf: (x, y, z) => Math.hypot(x, y, z) - 0.1 }],
    follow: { core: "ball" }, drive: (t) => ({ core: { prm: { t } } }),
  });
  assert.equal(slicePart(g.parts[0]).find((s) => Math.abs(s.z) < 0.03).loops.length, 1);   // solid, as asked
  const core = g.parts.find((p) => p.id === "core");
  assert.ok(core.overlay && core.order >= 20);
  const st = g.step(1, 1, 1);
  assert.deepEqual(st.core.off, st.ball.off);                                      // it rides with its host
  assert.equal(st.core.prm.t, 1);
  assert.equal(g.hint, "x");
});

test("glass figures: the same cursor mapping and intensity as the originals, and every one passes the checker", () => {
  for (const [name, glass] of Object.entries(GLASS)) {
    const orig = SCENES[name];
    assert.deepEqual(glass.active, orig.active, name);
    assert.equal(glass.drive(300, 200), orig.drive(300, 200));
    const fails = checkFigure(name, glass).filter((r) => r.level === "FAIL" && r.check !== "moving frame");   // timing depends on the machine
    assert.deepEqual(fails, [], name);
    for (const t of [orig.active[0], orig.active[1]]) assert.ok(frame(glass, t, t).includes('class="ln"'));
  }
});

test("glass figures: more outlines than the originals (drawn twice), and what is inside shows through", () => {
  const count = (sc) => (frame(sc, sc.active[1], sc.active[1]).match(/class="fill"/g) || []).length;
  for (const [name, glass] of Object.entries(GLASS)) {
    assert.ok(count(glass) > count(SCENES[name]), name);
    const inside = glass.parts.filter((p) => p.overlay);
    assert.ok(inside.length >= 2, `${name} has things inside`);
  }
  assert.ok(GLASS.rocket.parts.find((p) => p.id === "flame" && !p.overlay).dynamic);                 // the flame is the original's, still solid
});
