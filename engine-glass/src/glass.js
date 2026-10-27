/*
 * Glass: turn a figure into a see-through one. No DOM.
 *
 * What the lightbulb does, for any figure: its body is a thin hollow shell, not a solid. Every slice then has two outlines,
 * an outer skin and an inner skin a wall's thickness inside it, and the stacked, opaque sheets show rings inside rings:
 * the line drawn twice. And because glass is see-through, what is inside it shows: interior parts are painted on top.
 *
 * A thin part (a fin, a flame) is thinner than the wall, so hollowing it changes nothing: it stays solid on its own.
 */

/** a hollow skin: inside only where the shape is within `wall` of its surface. Works on any signed distance function. */
export const shell = (d, wall) => Math.max(d, -d - wall);

/**
 * A glass version of `scene`.
 *   wall    the thickness of the skin, in world units. About two grid cells shows as two clear lines; much thinner and
 *           the two lines run together.
 *   solid   ids of parts to leave solid (a flame, a hinge, a knurled wheel)
 *   inside  extra parts, seen through the glass: painted on top (`overlay`), whatever their height
 *   follow  { insideId: partId }: an inside part moves with that part (takes its `off`), so a tank rides up with the rocket
 *   drive   (t, abs, k, base) -> { insideId: { prm } }: parameters for inside parts that change shape, given what the
 *           original figure's step() returned (`base`)
 *   hint    what to say instead of the original's
 */
export function glassOf(scene, { wall = 0.035, solid = [], inside = [], follow = {}, drive = null, hint } = {}) {
  const hollow = (p) => {
    const q = { ...p }, sdf = p.sdf;
    for (const cache of ["sheets", "cache", "cacheKey", "buf"]) delete q[cache];                  // never inherit the solid part's slices
    q.sdf = (x, y, z, prm) => shell(sdf(x, y, z, prm), wall);
    return q;
  };
  const base = scene.parts.map((p) => (solid.includes(p.id) ? p : hollow(p)));
  const extra = inside.map((p, i) => ({ order: 20 + i, ...p, overlay: true }));
  return {
    ...scene,
    hint: hint || scene.hint,
    parts: [...base, ...extra],
    step(t, abs, k = 0.5) {
      const st = scene.step(t, abs, k), out = { ...st }, more = drive ? drive(t, abs, k, st) : {};
      for (const p of inside) {
        const a = { ...(more[p.id] || {}) }, host = follow[p.id];
        if (host && st[host] && st[host].off) a.off = st[host].off;
        out[p.id] = a;
      }
      return out;
    },
  };
}
