/*
 * The cursor as the drawing sees it: a point on a spring, so it lags the real pointer a little and settles
 * with a slight bounce, plus a "strength" on a spring that rises when the pointer is over the drawing and
 * falls when it leaves. No DOM, so it can be tested; the player feeds it the pointer.
 *
 * Positions are in page units (the 600 x 600 box).
 */

const K = 150, C = 15;      // spring stiffness and damping: slightly underdamped, so it settles with a small overshoot

export const createCursor = () => ({ x: 300, y: 300, vx: 0, vy: 0, s: 0, vs: 0, tx: 300, ty: 300, ts: 0 });

/** the pointer is at (x, y): the cursor follows. On entering it appears there, it does not fly in from where it was. */
export function aim(c, x, y) {
  if (c.ts === 0) { c.x = x; c.y = y; c.vx = c.vy = 0; }
  c.tx = x; c.ty = y; c.ts = 1;
}

/** the pointer left: the strength falls away */
export function release(c) { c.ts = 0; }

/**
 * Advance by dt seconds. Returns whether it is still moving (the loop can sleep when it is not).
 * With `reduced` it lands on its target at once.
 */
export function stepCursor(c, dt, reduced = false) {
  if (reduced) { c.x = c.tx; c.y = c.ty; c.s = c.ts; c.vx = c.vy = c.vs = 0; return false; }
  const n = Math.max(1, Math.ceil(dt * 240)), h = dt / n;
  for (let i = 0; i < n; i++) {
    c.vx += (-K * (c.x - c.tx) - C * c.vx) * h; c.x += c.vx * h;
    c.vy += (-K * (c.y - c.ty) - C * c.vy) * h; c.y += c.vy * h;
    c.vs += (-K * (c.s - c.ts) - C * c.vs) * h; c.s += c.vs * h;
  }
  const moving = Math.abs(c.x - c.tx) + Math.abs(c.y - c.ty) > 0.1 || Math.abs(c.s - c.ts) > 0.002 || Math.abs(c.vx) + Math.abs(c.vy) + Math.abs(c.vs) > 0.05;
  if (!moving) { c.x = c.tx; c.y = c.ty; c.s = c.ts; c.vx = c.vy = c.vs = 0; }
  return moving;
}
