import test from "node:test";
import assert from "node:assert/strict";
import { clamp, r2, sm, len2, smin, subtract, roundBox, rcyl, intensity, byIntensity } from "../src/math.js";

test("clamp, r2 and sm", () => {
  assert.equal(clamp(5, 0, 1), 1);
  assert.equal(clamp(-5, 0, 1), 0);
  assert.equal(r2(1.23456), 1.23);
  assert.equal(sm(0, 1, -1), 0);
  assert.equal(sm(0, 1, 2), 1);
  assert.equal(sm(0, 1, 0.5), 0.5);
});

test("smin: never above the plain minimum, equal to it when the shapes are far apart", () => {
  for (const [a, b] of [[0.3, 0.31], [-0.2, 0.1], [0.5, -0.5]]) assert.ok(smin(a, b, 0.1) <= Math.min(a, b) + 1e-12);
  assert.equal(smin(0.2, 1.5, 0.1), 0.2);
});

test("subtract cuts one shape out of another", () => {
  assert.ok(subtract(-1, -0.5) > 0);      // a point inside both is outside the result
  assert.ok(subtract(-1, 0.5) < 0);       // inside a, outside b stays inside
});

test("roundBox is negative inside, positive outside, and rounds its edges", () => {
  assert.ok(roundBox(0, 0, 0, 0.5, 0.5, 0.5, 0.1) < 0);
  assert.ok(roundBox(2, 0, 0, 0.5, 0.5, 0.5, 0.1) > 0);
  assert.ok(Math.abs(roundBox(0.6, 0, 0, 0.5, 0.5, 0.5, 0.1)) < 1e-9);          // face at half-size plus rounding
  assert.ok(roundBox(0.6, 0.6, 0.6, 0.5, 0.5, 0.5, 0.1) > 0);                    // the corner is cut away
});

test("rcyl: the caller picks the axis, and the ends and sides are where they should be", () => {
  const y = (x, yy, z) => rcyl(len2(x, z), yy, 0.3, -0.5, 0.5, 0.05);            // a cylinder along y
  assert.ok(y(0, 0, 0) < 0);
  assert.ok(y(0.5, 0, 0) > 0);
  assert.ok(y(0, 0.8, 0) > 0);
  assert.ok(Math.abs(y(0.3, 0, 0)) < 1e-9);                                      // the side is at the radius
  assert.ok(Math.abs(y(0, 0.5, 0)) < 1e-9);                                      // the end is at c1
});

test("intensity: 0 to 1, 0.5 when it is not a number, numeric strings are read", () => {
  assert.equal(intensity(0.3), 0.3);
  assert.equal(intensity(-4), 0);
  assert.equal(intensity(9), 1);
  assert.equal(intensity("0.8"), 0.8);
  for (const bad of [undefined, null, NaN, "", "x", {}, Infinity]) assert.equal(intensity(bad), 0.5);
});

test("byIntensity: two straight lines that meet at the middle value", () => {
  const r = [10, 40, 100];
  assert.equal(byIntensity(0, r), 10);
  assert.equal(byIntensity(0.5, r), 40);
  assert.equal(byIntensity(1, r), 100);
  assert.equal(byIntensity(0.25, r), 25);
  assert.equal(byIntensity(0.75, r), 70);
  assert.equal(byIntensity(3, r), 100);                                         // clamped
  assert.equal(byIntensity(undefined, r), 40);                                  // the default is the middle
  assert.ok(Math.abs(byIntensity(1, [0.6, 0.2, 0.05]) - 0.05) < 1e-12);         // it can fall as well as rise
  assert.ok(byIntensity(0.75, [0.6, 0.2, 0.05]) < byIntensity(0.25, [0.6, 0.2, 0.05]));
});
