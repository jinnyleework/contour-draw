import { byIntensity } from "./math.js";

/*
 * The hover split. No DOM.
 *
 * The cursor opens a gap in the stack of layers at its height: layers above it lift, layers below drop. Each layer
 * moves as a unit, across its whole width, by an amount that depends only on how near the cursor's height it is.
 * The gap has a cap so that neighbouring layers can never cross.
 */

/** the settings: `radius` is how far the split reaches (page units, vertically 1.6 times that), `intensity` how wide it opens, 0 to 1 */
export const SPLIT = { radius: 60, intensity: 0.5 };
/** how wide the gap opens, as a fraction of its cap, at intensity 0, 0.5 and 1 */
export const GAP_RANGE = [0.35, 0.7, 1];
/** the three buttons of an intensity toggle */
export const LEVELS = { low: 0, medium: 0.5, high: 1 };

/**
 * The shift for a layer whose middle is at page height `cy`, with the cursor at `cursorY` acting at `strength` (0 to 1):
 * negative lifts it, positive drops it, zero leaves it where it is.
 */
export function splitShift(cy, cursorY, strength, cfg = SPLIT) {
  const H = cfg.radius * 1.6, dy = cy - cursorY, u = Math.abs(dy) / H;
  if (u >= 1 || strength < 0.002) return 0;
  const G = byIntensity(cfg.intensity, GAP_RANGE) * Math.min(60, 0.45 * H);
  return Math.tanh(dy / 5) * strength * G * (1 - u) * (1 - u);
}
