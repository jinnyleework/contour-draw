/* built by site/build-play.mjs from draw-engine/engines: do not edit */
window.Oscillon = (() => {
/*
 * Oscillon draw engine.
 *
 * Scaffolded 2026-10-27 from Orchestro's engine: its camera, solids, scene, details, focus and
 * interaction, with the API below unchanged (figures are mounted with mount(), and mountAll() still looks for
 * [data-orchestro] elements). The look is not here: every tone and line weight is between the TOKENS markers, written
 * from engine/style.json by apply.mjs, and the camera between the VIEW markers. CHANGES.md logs every change.
 * Nothing touches the document until mount() is called.
 *
 * How Oscillon draws: not in Orchestro's lines and faces, but as an oscilloscope traces a figure, a cloud of points on
 * its surfaces, after Ben Laposky's Oscillons. A figure lists surfaces (surf.sphere, lathe, slab, extrude, ...) and
 * hands them to cloud(), which lays them down as faint dots on a canvas: see-through, rims and folds densest by
 * themselves, highlights where the light falls (in light), and its own motion (disperse, gather, shimmer). The points
 * section, "points" below, has the whole of it; the six figures in figures/ show how a figure is written. Orchestro's
 * solids, details and interaction are still here, under the same API, for anything that wants them.
 * RULES.md says what a figure must do to be in the look; engine/check.mjs checks it.
 *
 * What a figure may call. Read this index; the code below it should not need reading.
 *
 * A figure       { name, means, frame?: [w, h], control?, mark?, draw(ctx) }, draw building a scene and calling interact();
 *                control: true for a page's own switch (a theme pull, a toggle): it carries no focus, and no blue;
 *                mark: true for a brand mark, a logo made as an object: the mark is the subject, so it carries none either
 *   ctx          { svg, frame, host, read(text), join(tick), subject(...solids), add(teardown) }
 * Camera
 *   camera()                              the 2:1 isometric camera: { project, unproject(sx, sy, z), fit(points, frame, pad) }
 *   cam.fit(points, ctx.frame, pad)       scales and centres so the world points fill the frame; give it the most extreme pose
 * Scene
 *   scene(ctx.svg, cam)                   { update(), floorFace(), join(...solids), collisions() }; call update() once built
 *   grid(sc, [x0, y0, x1, y1], cell)      the floor grid (thins itself, G1); returns the floor face, for hatched tiles
 * Solids (all take structure: true for what holds things and never moves, S3)
 *   box(sc, { at, size: [w, d, h], radius, floor })       at is centre-bottom; floor: true paints it under everything
 *   cylinder(sc, { at, r, h })            upright
 *   tube(sc, { from, to, r0, r1 })        lying along a horizontal axis; aim(from, to) turns it
 *   wedge(sc, { at, size, high })         a ramp rising to the side named by high: "+x", "-x", "+y", "-y"
 *   frustum(sc, { at, size, top })        a tapered block
 *   prism(sc, { points, z, h })           any convex outline, stood up
 *   shell(sc, { at, length, profile, wall, axis, open })  a hollow body open at one end, any convex cross-section: a
 *                                         mailbox, a tunnel; its inside shows through the opening when it faces the viewer.
 *                                         axis "z", open "end": a box or tub open at the top, one piece, that things stand
 *                                         in: its inside paints behind them and its near walls in front (profile in x, y)
 *   cutout(sc, { outline, z, h })         a flat piece cut along any outline, convex or not: a jigsaw piece; pieces that
 *                                         meet edge to edge read as one surface, and collide by their real outline;
 *                                         sides: "hatch" draws its sides in grey hatching, gap apart on screen, not shaded
 *   tray(sc, { at, size, wall })          an open box: { solids, floor }
 *   pipe(sc, { points, r })               joined tubes with collars: [solids]
 *   rod(sc, { points, r })                one round bar bent along a path, one continuous piece: a shackle, a handle, a cable
 *   wire(sc, { paths, r, light })         one round bar along several paths, moulded as one piece: crossings and joins merge
 *                                         into one outline (lettering, a bent-wire frame); lit and shaded where the light
 *                                         (a world direction; the brand's by default) really falls. wire.paths: screen points
 *   arc(c, radius, from, to, { u, v })    points along a circular arc, for a rod's bends
 *   lathe(sc, { at, profile: [[r, z]], seat, smooth })  a round solid turned from a convex profile: a domed button, a
 *                                         knob, a bulb, a nose; seat hides what sinks below a hole's rim; smooth (a ball, a
 *                                         globe) shades it without the line where its tones meet
 *   button(sc, { at, r, dome })           a push button modelled whole: a domed cap in its collar, joined: { cap, collar }
 *   solid.face(name)                      a face to draw in: "top", and on a box "+x" "-x" "+y" "-y" "left" "right";
 *                                         on a prism, wedge or frustum any face by its index (a prism's caps: 0, 1)
 *   solid.pose(m)                         where the transform m takes it from home; interact's gestures do this for you
 *   xf.rotate(axis, deg, pivot), xf.translate(d), xf.compose(a, b), xf.apply(m, p)   transforms, rarely needed by hand
 * On a face (world units, from the face's top-left as the viewer reads it)
 *   dots(face, [[s, t]], r, cls)          screws ("o-mark"), LEDs ("o-idle", "o-faint")
 *   slots(face, [s, t], n, opts)          a vent
 *   panel(face, [s0, t0, s1, t1], r)      a rounded panel line
 *   hatch(face, [s0, t0, s1, t1], gap)    grey hatching: texture only
 *   trace(face, paths, cls)               printed lines along world points on the face: a seam, a map's coastlines
 *   label(face, text, [s, t], size)       an engraved label, only where the object would carry one
 * Focus (exactly one per figure, there at rest; the only blue; always blue hatching)
 *   focus.area(face).set(worldPoints)     a blue-hatched area on a face (H1); move(face, worldPoints) travels to another (I6);
 *                                         give a list of outlines for one focus in several pieces (the lines of a page)
 *   focus.beam(face).set({ from, angle, width, spread, reach })   an area that starts at its source (B1)
 *   focus.solid(solid | [solids])         the whole of a part hatched as one, every face the viewer sees: a hammer's head
 *   focus.patch(face, [s0, t0, s1, t1], { r })   a hatched panel on a face: the picked part's lid, label, chest panel;
 *                                         move(face, rect) travels (I6). Always hatching, never a dot or an outline (F2)
 * Interaction
 *   interact(ctx, sc, parts, opts)        the whole of a figure's pointer, keyboard, touch, play and step work:
 *                                         parts [{ solid | solids, name, ... }], opts { move: { lift } | { slide },
 *                                         focus: { mark, on(part) -> [face, at] }, rest, read, change, follow, leave, steps,
 *                                         drop(part, amount 0-1) when a dragged part is let go }
 *                                         a part may carry gesture: one, or a list that nests (each later one in the part's own frame)
 * Gestures (what a part does when picked, as the real object would; RULES.md M1-M4)
 *   pose, while picked: lift(n), slide([dx, dy, dz]), press(n), hinge({ solids, pivot, axis, angle }),
 *                       grow(by, { pivot }): taller by `by` times from its base, a bar rising
 *   pose, while held:   drag([dx, dy, dz]): follows a press-and-drag towards d, springs home; drop(part, amount) on release
 *                       tilt({ pivot, axis, angle }): swings with the hand's sideways drag, either way, springs home
 *   act, on let-go:     recoil([dx, dy, dz], { delay, ms }): one dip along d as a dragged part snaps home, by how far it went
 *   act, once on pick:  spin({ solids, pivot, axis, turns }), hop(h), riffle(h, { stagger }), rock({ solids, pivot, axis, angle })
 *   hold, while picked: spin({ held: true, period, sym }), bob(h, { stagger }), beat({ pivot, axis, angle }), sweep(r)
 *   all take { solids } (a subset of the part; group them, [[body, mast], ...], to move a group as one in a wave),
 *   { delay } (ms, for follow-through), and those that turn { pivot, axis }
 *   spring(x), tween(v)                   for a figure's own motion (an aim); never under-damped (I5)
 * On a page
 *   mount(el, figure, opts)               opts { grid, theme: "light" | "dark" | "auto", tokens, play, fit, check, onRead }
 *                                         returns { grid(on), theme(t), tokens(map), play(on), phase(k), check(), destroy() }
 *   mountAll(figures, root)               mounts every [data-orchestro="name"] element
 *   react.js: <OrchestroFigure figure grid theme tokens play phase onRead />
 *
 * Layers of this file, top to bottom: camera, svg, clock, input, scene, solids, faces, focus, hover,
 * interact, style, check, mount.
 */

const NS = "http://www.w3.org/2000/svg";
const rad = (d) => (d * Math.PI) / 180;
const r2 = (n) => Math.round(n * 100) / 100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------------------------------------------------------------- camera */

/**
 * An orthographic camera. angle turns the world about z (45 gives the classic
 * isometric diamond), tilt is how far it looks down (30 gives the 2:1 view).
 */
/** The brand's one view (V1): every figure is seen from here; turn the object, never the camera. */
const VIEW = /*VIEW*/{ angle: 45, tilt: 30 }/*END*/;
function camera({ angle = VIEW.angle, tilt = VIEW.tilt, scale = 1 } = {}) {
  const ca = Math.cos(rad(angle)), sa = Math.sin(rad(angle));
  const st = Math.sin(rad(tilt)), ct = Math.cos(rad(tilt));
  const cam = {
    scale, ox: 0, oy: 0, angle, tilt,
    /** The direction from the scene towards the viewer, in world space. */
    toViewer: [sa * ct, ca * ct, st],
    project([x, y, z]) {
      const X = x * ca - y * sa, Y = x * sa + y * ca;
      return [cam.ox + cam.scale * X, cam.oy + cam.scale * (Y * st - z * ct)];
    },
    /** The world point under a screen point, on the plane at height z. */
    unproject(sx, sy, z = 0) {
      const X = (sx - cam.ox) / cam.scale, Y = ((sy - cam.oy) / cam.scale + z * ct) / st;
      return [X * ca + Y * sa, -X * sa + Y * ca, z];
    },
    /** How near the viewer a world point is: larger is nearer. */
    depth([x, y, z]) { return (x * sa + y * ca) * ct + z * st; },
    /** Which way a horizontal direction points on screen: < 0 left, > 0 right. */
    screenX([nx, ny]) { return nx * ca - ny * sa; },
    /** Scales and centres the camera so the world points fill the frame, less pad. */
    fit(points, [w, h], pad = 24) {
      cam.scale = 1; cam.ox = 0; cam.oy = 0;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of points) {
        const [sx, sy] = cam.project(p);
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
      cam.scale = Math.min((w - 2 * pad) / (x1 - x0 || 1), (h - 2 * pad) / (y1 - y0 || 1));
      cam.ox = w / 2 - (cam.scale * (x0 + x1)) / 2;
      cam.oy = h / 2 - (cam.scale * (y0 + y1)) / 2;
      return cam;
    },
  };
  return cam;
}

/* ------------------------------------------------------------------- svg */

/** One svg node. `cls` is the class; every other key is an attribute. */
function el(tag, attrs = {}, parent = null) {
  const node = parent ? parent.ownerDocument.createElementNS(NS, tag) : document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] != null) node.setAttribute(k === "cls" ? "class" : k, String(attrs[k]));
  if (parent) parent.appendChild(node);
  return node;
}
const closed = (pts) => (pts.length < 2 ? "" : "M" + pts.map((p) => r2(p[0]) + " " + r2(p[1])).join("L") + "Z");
const line = (pts) => (pts.length < 2 ? "" : "M" + pts.map((p) => r2(p[0]) + " " + r2(p[1])).join("L"));

/** The convex hull of screen points (monotone chain). */
function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) {
    while (lower.length > 1 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length > 1 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** The indices of the one cyclic run of `items` that pass `keep`, in order. */
function cyclicRun(items, keep) {
  const n = items.length, ok = items.map(keep);
  if (ok.every(Boolean)) return items.map((_, i) => i);
  let start = ok.findIndex((v, i) => v && !ok[(i + n - 1) % n]);
  if (start < 0) return [];
  const out = [];
  for (let k = 0; k < n && ok[(start + k) % n]; k++) out.push((start + k) % n);
  return out;
}

/* ----------------------------------------------------------------- clock */

const motion = { reduced: false, watching: false };
const loop = { items: new Set(), raf: 0, last: 0, seen: null };

function watchMotion(win) {
  if (motion.watching || !win.matchMedia) return;
  motion.watching = true;
  const q = win.matchMedia("(prefers-reduced-motion: reduce)");
  motion.reduced = q.matches;
  q.addEventListener?.("change", () => { motion.reduced = q.matches; loop.items.forEach(wakeItem); });
}
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - loop.last) / 1000));
  loop.last = now;
  let more = false;
  for (const it of loop.items) {
    if (!it.awake || !it.visible) continue;
    it.awake = !!it.tick(dt, now);
    more = more || it.awake;
  }
  loop.raf = more ? requestAnimationFrame(frame) : 0;
}
function wakeItem(it) {
  it.awake = true;
  if (!loop.raf && typeof requestAnimationFrame === "function") {
    loop.last = performance.now();
    loop.raf = requestAnimationFrame(frame);
  }
}
/**
 * Joins the page's one frame loop. tick(dt seconds, now ms) returns true while
 * it still has something to move. The loop sleeps when nothing moves, and
 * while `host` is offscreen.
 */
function join(host, tick) {
  const win = host.ownerDocument.defaultView;
  watchMotion(win);
  const it = { tick, awake: true, visible: true, host };
  if (win.IntersectionObserver) {
    loop.seen ??= new win.IntersectionObserver((entries) => {
      for (const e of entries) for (const x of loop.items) if (x.host === e.target) {
        x.visible = e.isIntersecting;
        if (x.visible) wakeItem(x);
      }
    }, { rootMargin: "80px" });
    loop.seen.observe(host);
  }
  loop.items.add(it);
  wakeItem(it);
  return {
    wake: () => wakeItem(it),
    leave: () => { loop.items.delete(it); loop.seen?.unobserve(host); },
  };
}
const reducedMotion = () => motion.reduced;

/**
 * A damped spring at rest on x. Set .target to move it; step(dt) returns whether it is moving.
 * Never under-damped: damping below critical is raised to it, so nothing bounces (I5).
 */
function spring(x, { stiffness = 170, damping = 26 } = {}) {
  damping = Math.max(damping, 2 * Math.sqrt(stiffness));
  const s = {
    x, v: 0, target: x,
    step(dt) {
      if (motion.reduced) { s.x = s.target; s.v = 0; return false; }
      const n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
      for (let i = 0; i < n; i++) {
        s.v += (-stiffness * (s.x - s.target) - damping * s.v) * h;
        s.x += s.v * h;
      }
      if (Math.abs(s.x - s.target) < 1e-3 && Math.abs(s.v) < 1e-2) { s.x = s.target; s.v = 0; return false; }
      return true;
    },
  };
  return s;
}

/** A cubic-bezier easing, solved for x by Newton's method with a bisection fallback. */
function bezier(x1, y1, x2, y2) {
  const ax = 3 * x1 - 3 * x2 + 1, bx = 3 * x2 - 6 * x1, cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1, by = 3 * y2 - 6 * y1, cy = 3 * y1;
  const X = (u) => ((ax * u + bx) * u + cx) * u, Y = (u) => ((ay * u + by) * u + cy) * u;
  const dX = (u) => (3 * ax * u + 2 * bx) * u + cx;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let u = t;
    for (let i = 0; i < 6; i++) {
      const d = dX(u), e = X(u) - t;
      if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break;
      u -= e / d;
    }
    if (!(u >= 0 && u <= 1) || Math.abs(X(u) - t) > 1e-4) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 30; i++) { u = (lo + hi) / 2; if (X(u) < t) lo = u; else hi = u; }
    }
    return Y(u);
  };
}
/** Cosmos's --motion-ease-out. */
const easeOut = bezier(0.23, 1, 0.32, 1);

/** A tween at rest on v. to(target, now, delay) retargets from where it is. */
function tween(v, ms = 600, ease = easeOut) {
  const t = {
    from: v, to: v, t0: -Infinity, ms,
    value(now) {
      if (motion.reduced) return t.to;
      const p = clamp((now - t.t0) / t.ms, 0, 1);
      return lerp(t.from, t.to, ease(p));
    },
    done(now) { return motion.reduced || now - t.t0 >= t.ms; },
    set(target, now, delay = 0) {
      if (target === t.to) return;
      t.from = t.value(now); t.to = target; t.t0 = now + delay;
    },
  };
  return t;
}

/* ----------------------------------------------------------------- input */

/** The pointer over the figure, in frame units: move([x, y]), leave(). Returns its tear-down. */
function pointer(host, svg, { move, leave }) {
  const at = (e) => {
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    return [vb.x + ((e.clientX - r.left) / r.width) * vb.width, vb.y + ((e.clientY - r.top) / r.height) * vb.height];
  };
  const onMove = (e) => move(at(e), e), onLeave = (e) => leave(e);
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerdown", onMove);
  host.addEventListener("pointerleave", onLeave);
  return () => {
    host.removeEventListener("pointermove", onMove);
    host.removeEventListener("pointerdown", onMove);
    host.removeEventListener("pointerleave", onLeave);
  };
}

/* ----------------------------------------------------------------- scene */

/**
 * A scene: a floor layer, painted first, and a layer of solids that the scene
 * keeps in depth order, so a figure may add them in any order.
 */
function scene(svg, cam) {
  const floor = el("g", { cls: "o-floor" }, svg);
  const layer = el("g", { cls: "o-solids" }, svg);
  const over = el("g", { cls: "o-over" }, svg);
  const solids = [];
  let order = "";
  const sc = {
    svg, cam, floor, layer, over, solids, order: [], live: [],
    /** Adds a solid. One made with { floor: true } (a slab others stand on) is painted with the floor, under every other solid. */
    add(solid) {
      solids.push(solid);
      // remember each solid's pose, so the checker can tell parts that move together from parts that move apart (S6)
      if (solid.pose) { const pose = solid.pose; solid.pose = (m) => { solid.xform = m; return pose(m); }; }
      (solid.floor ? floor : layer).appendChild(solid.g);
      return solid;
    },
    /** Redraws what moved, and only then puts the solids back in depth order. */
    update() {
      let moved = false;
      for (const s of solids) if (s.dirty !== false) { s.draw(); s.dirty = false; moved = true; }
      if (!moved) return;
      const sorted = paintOrder(cam, solids.filter((s) => !s.floor));
      sc.order = sorted;
      const now = sorted.map((s) => s.id).join(",");
      if (now !== order) { order = now; for (const s of sorted) layer.appendChild(s.g); }
    },
    /** The floor's plane, z = 0, as a face to draw in: u along x, v along y. */
    floorFace() { return planeFace(cam, floor, [0, 0, 0], [1, 0, 0], [0, 1, 0], Infinity, Infinity); },
    /** Makes several solids one object (a torch's body, neck and head), which may touch and overlap each other. */
    join(...parts) {
      // joins merge: anything already joined to one of these comes along, so joining a drum to each of its
      // buttons in turn makes one object of all of them
      const k = ++ids, olds = new Set(parts.map((p) => p.object).filter(Boolean));
      for (const x of solids) if (olds.has(x.object)) x.object = k;
      for (const p of parts) p.object = k;
      return parts;
    },
    /** Pairs of separate objects whose solids pass through each other, as they stand now (S2). */
    collisions(eps = 0.25) {
      const out = [], list = solids;
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.object && a.object === b.object) continue;
        if (overlaps(a, b, eps)) out.push([a, b]);
      }
      return out;
    },
  };
  return sc;
}

/**
 * Back to front for solids with world bounds { min, max }. Only pairs that
 * overlap on screen are ordered: one wholly below the other, or wholly behind it
 * along x or y (behind meaning away from the viewer), goes first; pairs that
 * overlap on every axis fall back to their centres' depth. The ordered pairs are
 * then sorted topologically, the farthest first among those free to go.
 */
function paintOrder(cam, list) {
  const v = cam.toViewer, n = list.length;
  const b = list.map((s) => s.bounds());
  const behind = (i, j) => {           // whether i must be painted before j
    const A = b[i], B = b[j];
    if (A.max[2] <= B.min[2] + 1e-6) return true;
    if (B.max[2] <= A.min[2] + 1e-6) return false;
    for (const k of [0, 1]) {
      if (v[k] > 0 && A.max[k] <= B.min[k] + 1e-6) return true;
      if (v[k] > 0 && B.max[k] <= A.min[k] + 1e-6) return false;
      if (v[k] < 0 && A.min[k] >= B.max[k] - 1e-6) return true;
      if (v[k] < 0 && B.min[k] >= A.max[k] - 1e-6) return false;
    }
    return list[i].depth() < list[j].depth();
  };
  // only solids that overlap on screen need an order between them: constraining the rest can only make
  // cycles (two posts at opposite corners are apart along x one way and along y the other)
  const box = list.map((s) => {
    const o = s.outline?.() ?? [];
    if (!o.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of o) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return [x0, y0, x1, y1];
  });
  // a pair needs an order only if their silhouettes really overlap: boxes that merely share a bounding rectangle
  // add constraints that make cycles (a tall divider, the shelves beside it and a drawer above them), and a broken
  // cycle can paint a pulled drawer over the one above it
  const hulls = list.map((s) => s.outline?.() ?? []);
  const overlap = (i, j) => !box[i] || !box[j] || (box[i][0] < box[j][2] && box[j][0] < box[i][2] && box[i][1] < box[j][3] && box[j][1] < box[i][3] && convexOverlap(hulls[i], hulls[j]));
  const after = Array.from({ length: n }, () => []), need = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (!overlap(i, j)) continue;
    if (behind(i, j)) { after[i].push(j); need[j]++; } else { after[j].push(i); need[i]++; }
  }
  const out = [], free = [];
  for (let i = 0; i < n; i++) if (!need[i]) free.push(i);
  while (out.length < n) {
    if (!free.length) {                 // a cycle: take the farthest left
      let k = -1;
      for (let i = 0; i < n; i++) if (need[i] > 0 && (k < 0 || list[i].depth() < list[k].depth())) k = i;
      need[k] = 0; free.push(k);
    }
    free.sort((i, j) => list[i].depth() - list[j].depth());
    const i = free.shift();
    if (need[i] < 0) continue;
    need[i] = -1;
    out.push(list[i]);
    for (const j of after[i]) if (need[j] > 0 && --need[j] === 0) free.push(j);
  }
  return out;
}

/**
 * Whether two solids' volumes overlap by more than eps: their world bounds, and for an upright round solid (a
 * cylinder or a lathe, not tilted) its circle rather than its square, so a box beside a round table is not inside it.
 */
function overlaps(a, b, eps = 0.25) {
  if (a.kind === "shell-inside" || b.kind === "shell-inside") return false;
  // a shell is hollow: only its walls and its closed end count
  if (a.slabs) return a.slabs().some((bb) => overlaps({ kind: "slab", bounds: () => bb }, b, eps));
  if (b.slabs) return b.slabs().some((bb) => overlaps(a, { kind: "slab", bounds: () => bb }, eps));
  const A = a.bounds(), B = b.bounds();
  if (![0, 1, 2].every((k) => Math.min(A.max[k], B.max[k]) - Math.max(A.min[k], B.min[k]) > eps)) return false;
  if (a.kind === "cutout" || b.kind === "cutout") return outlinesOverlap(footprintOf(a), footprintOf(b), eps);
  const round = (x, X) => (x.kind === "cylinder" || x.kind === "lathe") && (!x.xform || xf.upright(x.xform))
    ? { c: [(X.min[0] + X.max[0]) / 2, (X.min[1] + X.max[1]) / 2], r: (X.max[0] - X.min[0]) / 2 } : null;
  const ra = round(a, A), rb = round(b, B);
  if (ra && rb) return Math.hypot(ra.c[0] - rb.c[0], ra.c[1] - rb.c[1]) < ra.r + rb.r - eps;
  const circle = ra ?? rb, box = ra ? B : A;
  if (!circle) return true;
  const dx = Math.max(box.min[0] - circle.c[0], 0, circle.c[0] - box.max[0]), dy = Math.max(box.min[1] - circle.c[1], 0, circle.c[1] - box.max[1]);
  return Math.hypot(dx, dy) < circle.r - eps;
}

/** Whether two convex screen polygons overlap by more than a hair (separating axes). */
function convexOverlap(P, Q, eps = 0.05) {
  if (P.length < 3 || Q.length < 3) return true;
  for (const poly of [P, Q]) for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], nx = a[1] - b[1], ny = b[0] - a[0];
    const l = Math.hypot(nx, ny);
    if (!l) continue;
    let p0 = Infinity, p1 = -Infinity, q0 = Infinity, q1 = -Infinity;
    for (const [x, y] of P) { const d = (x * nx + y * ny) / l; p0 = Math.min(p0, d); p1 = Math.max(p1, d); }
    for (const [x, y] of Q) { const d = (x * nx + y * ny) / l; q0 = Math.min(q0, d); q1 = Math.max(q1, d); }
    if (p1 <= q0 + eps || q1 <= p0 + eps) return false;
  }
  return true;
}

/* ------------------------------------------------------------ transforms */

/**
 * Rigid transforms: { R, t }, a 3 × 3 rotation (row-major) and a translation, mapping p to R p + t.
 * Every solid takes one through pose(m), from where it was built (its home); interact() builds them
 * from a part's gestures, so a figure rarely makes one itself.
 */
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const xf = {
  identity: () => ({ R: I3.slice(), t: [0, 0, 0] }),
  translate: (d) => ({ R: I3.slice(), t: [d[0], d[1], d[2]] }),
  /** A turn of `deg` degrees about `axis` ("x", "y", "z" or a vector) through `pivot`, right-handed. */
  rotate(axis, deg, pivot = [0, 0, 0]) {
    const a = typeof axis === "string" ? { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[axis] : axis;
    const l = Math.hypot(...a) || 1, [x, y, z] = a.map((v) => v / l), c = Math.cos(rad(deg)), s = Math.sin(rad(deg)), C = 1 - c;
    const R = [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C];
    const Rp = xf.dir({ R }, pivot);
    return { R, t: [pivot[0] - Rp[0], pivot[1] - Rp[1], pivot[2] - Rp[2]] };
  },
  /** a after b: p -> a(b(p)). */
  compose(a, b) {
    const A = a.R, B = b.R, R = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
    const t = xf.dir(a, b.t);
    return { R, t: [t[0] + a.t[0], t[1] + a.t[1], t[2] + a.t[2]] };
  },
  apply: (m, p) => { const R = m.R; return [R[0] * p[0] + R[1] * p[1] + R[2] * p[2] + m.t[0], R[3] * p[0] + R[4] * p[1] + R[5] * p[2] + m.t[1], R[6] * p[0] + R[7] * p[1] + R[8] * p[2] + m.t[2]]; },
  dir: (m, v) => { const R = m.R; return [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]]; },
  /** Whether m keeps up as up: only a turn about z and a move, so an upright solid stays upright. */
  /** A stretch along z by s, about the height z0: a bar growing from its base. Upright, so a box or cylinder stays one. */
  stretch: (s, z0 = 0) => ({ R: [1, 0, 0, 0, 1, 0, 0, 0, s], t: [0, 0, z0 - s * z0] }),
  upright: (m) => Math.abs(m.R[2]) + Math.abs(m.R[5]) + Math.abs(m.R[6]) + Math.abs(m.R[7]) < 1e-9,
  same: (a, b) => a.R.every((v, i) => Math.abs(v - b.R[i]) < 1e-9) && a.t.every((v, i) => Math.abs(v - b.t[i]) < 1e-9),
};

/**
 * Paints a convex solid given as world vertices and faces (index lists): each visible face in the tone of
 * the way it points, the edges between visible faces, the silhouette as the outline. edges "all" draws every
 * edge between two visible faces (a wedge); "tone" only those where the tone changes (a tilted box, whose
 * rounded corners are many faces), and, without `corner`, none between two sides (a tilted cylinder).
 */
function meshPainter(cam, facesLayer, edgeNode) {
  const v = cam.toViewer, fills = [];
  const normal = (f, pts, mid) => {          // Newell's method, unit length, turned outwards (the solid is convex)
    let nx = 0, ny = 0, nz = 0, cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < f.length; i++) {
      const a = pts[f[i]], b = pts[f[(i + 1) % f.length]];
      nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]);
      cx += a[0]; cy += a[1]; cz += a[2];
    }
    const l = Math.hypot(nx, ny, nz) || 1, out = (cx / f.length - mid[0]) * nx + (cy / f.length - mid[1]) * ny + (cz / f.length - mid[2]) * nz < 0 ? -1 : 1;
    return [(out * nx) / l, (out * ny) / l, (out * nz) / l];
  };
  const tone = (n) => (n[2] > 0.5 ? "o-face-top" : cam.screenX([n[0], n[1]]) > 0 ? "o-face-right" : "o-face-left");
  return {
    normal,
    draw(pts, faces, { edges = "all", corner = true } = {}) {
      const mid = [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length);
      const scr = pts.map((p) => cam.project(p)), ns = faces.map((f) => normal(f, pts, mid));
      const seen = ns.map((n) => n[0] * v[0] + n[1] * v[1] + n[2] * v[2] > 1e-6);
      while (fills.length < faces.length) fills.push(el("path", {}, facesLayer));
      faces.forEach((f, i) => {
        fills[i].setAttribute("d", seen[i] ? closed(f.map((k) => scr[k])) : "");
        if (seen[i]) fills[i].setAttribute("class", tone(ns[i]));
      });
      for (let i = faces.length; i < fills.length; i++) fills[i].setAttribute("d", "");
      const owners = new Map();
      faces.forEach((f, i) => f.forEach((a, j) => { const b = f[(j + 1) % f.length], key = a < b ? a + "," + b : b + "," + a; (owners.get(key) ?? owners.set(key, []).get(key)).push(i); }));
      let d = "";
      for (const [key, fs] of owners) {
        if (edges === "none") break;
        if (fs.length !== 2 || !seen[fs[0]] || !seen[fs[1]]) continue;
        if (edges === "tone") {
          const t0 = tone(ns[fs[0]]), t1 = tone(ns[fs[1]]);
          if (t0 === t1 || (!corner && t0 !== "o-face-top" && t1 !== "o-face-top")) continue;
        }
        const [a, b] = key.split(",").map(Number);
        d += `M${r2(scr[a][0])} ${r2(scr[a][1])}L${r2(scr[b][0])} ${r2(scr[b][1])}`;
      }
      edgeNode.setAttribute("d", d);
      return hull(scr);
    },
    clear() { for (const f of fills) f.setAttribute("d", ""); edgeNode.setAttribute("d", ""); },
  };
}

/* ---------------------------------------------------------------- solids */

let ids = 0;
/** Moving structure is a mistake in the figure, so it is refused out loud (S3). */
const still = (solid) => { if (solid.structure) throw new Error(`S3: a ${solid.kind} marked as structure does not move`); };

/** A rounded rectangle footprint as samples {p: [x, y], n: [nx, ny]}, anticlockwise from +x. */
function roundRect(x0, y0, x1, y1, r, steps = 3) {
  r = clamp(r, 0.01, Math.min(x1 - x0, y1 - y0) / 2);
  const out = [];
  for (const [cx, cy, a0] of [[x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180], [x1 - r, y0 + r, 270]]) {
    for (let k = 0; k <= steps; k++) {
      const a = rad(a0 + (90 * k) / steps), c = Math.cos(a), s = Math.sin(a);
      out.push({ p: [cx + r * c, cy + r * s], n: [c, s] });
    }
  }
  return out;
}
function circleRing(cx, cy, r, steps = 48) {
  const out = [];
  for (let k = 0; k < steps; k++) {
    const a = (k / steps) * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a);
    out.push({ p: [cx + r * c, cy + r * s], n: [c, s] });
  }
  return out;
}

/**
 * An upright solid: a footprint ring stood from z0 to z1. Its faces are
 * filled by the way they point (top, left, right), its silhouette drawn as
 * the outline, the top's near edge as an edge, a shine just inside it, and,
 * for a box, the vertical edge where the left and right faces meet.
 * pose(m) puts it where m takes its home: a turn about z keeps it upright and
 * drawn as above; any other turn (a hinge, a tilt) draws it as a convex mesh,
 * the same tones and lines.
 */
function upright(sc, ring, z0, z1, { corner = true, shine = true } = {}) {
  const { cam } = sc, P = (q, z) => cam.project([q.p[0], q.p[1], z]);
  const g = el("g", { cls: "o-solid" });
  // three layers, always in this order (L1): faces, then highlights, then every grey line
  const faces = el("g", { cls: "o-l-faces" }, g), lights = el("g", { cls: "o-l-lights" }, g), lines = el("g", { cls: "o-l-lines" }, g);
  // one flat tone per way a side turns, curved or not (L2)
  const base = el("path", { cls: "o-face-left" }, faces);
  const right = el("path", { cls: "o-face-right" }, faces);
  const topFill = el("path", { cls: "o-face-top" }, faces);
  const rim = el("path", { cls: "o-shine" }, lights);
  const topEdge = el("path", { cls: "o-edge" }, lines);
  const vert = el("path", { cls: "o-edge" }, lines);
  const meshEdge = el("path", { cls: "o-edge" }, lines);
  const decals = el("g", {}, lines);
  const outline = el("path", { cls: "o-outline" }, lines);
  const painter = meshPainter(cam, faces, meshEdge);
  const v = cam.toViewer, faces_ = (q) => q.n[0] * v[0] + q.n[1] * v[1] > 1e-6;
  const homeRing = ring.map((q) => ({ p: [...q.p], n: [...q.n] })), H0 = z0, H1 = z1, N = ring.length;
  const meshFaces = [[...Array(N).keys()].reverse(), [...Array(N).keys()].map((i) => i + N), ...[...Array(N).keys()].map((i) => [i, (i + 1) % N, ((i + 1) % N) + N, i + N])];
  let shape = [];
  const body = {
    g, decals, z0, z1, ring, verts: null,
    /** The silhouette as drawn last, in screen points. */
    outline: () => shape,
    emphasis(on) { outline.classList.toggle("o-strong", !!on); },
    pose(m) {
      if (xf.upright(m)) {
        const R = m.R;
        body.verts = null;
        ring.splice(0, N, ...homeRing.map((q) => ({ p: [R[0] * q.p[0] + R[1] * q.p[1] + m.t[0], R[3] * q.p[0] + R[4] * q.p[1] + m.t[1]], n: [R[0] * q.n[0] + R[1] * q.n[1], R[3] * q.n[0] + R[4] * q.n[1]] })));
        // an upright pose may stretch the body along z (grow), about the height t carries it from
        body.z0 = H0 * m.R[8] + m.t[2]; body.z1 = H1 * m.R[8] + m.t[2];
      } else {
        body.verts = [...homeRing.map((q) => xf.apply(m, [q.p[0], q.p[1], H0])), ...homeRing.map((q) => xf.apply(m, [q.p[0], q.p[1], H1]))];
      }
    },
    bounds() {
      if (body.verts) return { min: [0, 1, 2].map((k) => Math.min(...body.verts.map((p) => p[k]))), max: [0, 1, 2].map((k) => Math.max(...body.verts.map((p) => p[k]))) };
      return { min: [Math.min(...ring.map((q) => q.p[0])), Math.min(...ring.map((q) => q.p[1])), body.z0], max: [Math.max(...ring.map((q) => q.p[0])), Math.max(...ring.map((q) => q.p[1])), body.z1] };
    },
    draw() {
      if (body.verts) {
        for (const n of [base, right, topFill, rim, topEdge, vert]) n.setAttribute("d", "");
        shape = painter.draw(body.verts, meshFaces, { edges: "tone", corner });
        outline.setAttribute("d", closed(shape));
        return;
      }
      painter.clear();
      const tp = ring.map((q) => P(q, body.z1)), bt = ring.map((q) => P(q, body.z0));
      shape = hull(tp.concat(bt));
      outline.setAttribute("d", closed(shape));
      base.setAttribute("d", closed(shape));
      const rr = cyclicRun(ring, (q) => faces_(q) && cam.screenX(q.n) > 0);
      right.setAttribute("d", rr.length ? closed(rr.map((i) => tp[i]).concat(rr.map((i) => bt[i]).reverse())) : "");
      vert.setAttribute("d", "");
      if (corner && rr.length) {
        const ends = [rr[0], rr[rr.length - 1]], i = cam.depth([...ring[ends[0]].p, 0]) > cam.depth([...ring[ends[1]].p, 0]) ? ends[0] : ends[1];
        vert.setAttribute("d", line([tp[i], bt[i]]));
      }
      topFill.setAttribute("d", closed(tp));
      topEdge.setAttribute("d", closed(tp));
      if (shine) {
        const near = cyclicRun(ring, faces_), k = (0.9 / cam.scale) * 1.4;
        rim.setAttribute("d", line(near.map((i) => P({ p: [ring[i].p[0] - ring[i].n[0] * k, ring[i].p[1] - ring[i].n[1] * k] }, body.z1))));
      }
    },
  };
  return body;
}

/**
 * The common part of a box and a cylinder: an upright body posed from its home, and the faces drawn on it,
 * each placed by the pose and hidden while it is turned away from the viewer.
 */
function uprightSolid(sc, body, { kind, home, structure, frames, center, extra = {} }) {
  const made = {};
  let m = xf.identity();
  const solid = {
    id: ++ids, g: body.g, kind, structure, home: [...home], ...extra,
    get at() { return xf.apply(m, home); },
    get pose_() { return m; },
    /** Puts the solid where the transform m takes its home; the scene's next update redraws it. */
    pose(next) {
      if (xf.same(next, m)) return;
      still(solid);
      m = next; body.pose(m); solid.dirty = true;
    },
    /** Moves it so its home point `at` comes to p. */
    moveTo(p) { solid.pose(xf.translate(p.map((v, k) => v - home[k]))); },
    /** Puts it at its home plus d, a world offset. */
    offset(d) { solid.pose(xf.translate(d)); },
    depth() { return sc.cam.depth(xf.apply(m, center)); },
    bounds: () => body.bounds(),
    outline: () => body.outline(),
    emphasis: (on) => body.emphasis(on),
    draw() {
      body.draw();
      const v = sc.cam.toViewer;
      for (const k in made) {
        const [o, u, vv, , , n] = frames[k];
        const nn = xf.dir(m, n);
        made[k].place(xf.apply(m, o), xf.dir(m, u), xf.dir(m, vv));
        made[k].g.style.display = nn[0] * v[0] + nn[1] * v[1] + nn[2] * v[2] > 1e-6 ? "" : "none";
      }
    },
    face(name) {
      if (!frames[name]) throw new Error(`a ${kind} has no face "${name}"; it has ${Object.keys(frames).join(", ")}`);
      if (!made[name]) {
        const [o, u, vv, fw, fh] = frames[name];
        made[name] = planeFace(sc.cam, body.decals, xf.apply(m, o), xf.dir(m, u), xf.dir(m, vv), fw, fh);
      }
      return made[name];
    },
  };
  return solid;
}

/**
 * A box: centre-bottom at `at`, `size` [w, d, h], corners rounded by `radius`.
 * Its faces are named "top", "+x", "-x", "+y", "-y", and "left" / "right"
 * for the two upright faces the camera sees.
 */
function box(sc, { at = [0, 0, 0], size = [40, 40, 16], radius = 1.6, floor = false, structure = floor } = {}) {
  const [w, d, h] = size, [cx, cy, z] = at;
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2, z1 = z + h;
  const body = upright(sc, roundRect(x0, y0, x1, y1, radius), z, z1);
  // each face: origin, across, down, its size, and the way it points
  const frames = {
    top: [[x0, y0, z1], [1, 0, 0], [0, 1, 0], w, d, [0, 0, 1]],
    "+y": [[x0, y1, z1], [1, 0, 0], [0, 0, -1], w, h, [0, 1, 0]],
    "+x": [[x1, y1, z1], [0, -1, 0], [0, 0, -1], d, h, [1, 0, 0]],
    "-y": [[x1, y0, z1], [-1, 0, 0], [0, 0, -1], w, h, [0, -1, 0]],
    "-x": [[x0, y0, z1], [0, 1, 0], [0, 0, -1], d, h, [-1, 0, 0]],
  };
  const solid = uprightSolid(sc, body, { kind: "box", home: at, structure, frames, center: [cx, cy, z + h / 2], extra: { floor, radius } });
  const face = solid.face;
  solid.face = (name) => {
    if (name === "left" || name === "right") {
      const v = sc.cam.toViewer, side = { "+x": [1, 0], "-x": [-1, 0], "+y": [0, 1], "-y": [0, -1] };
      name = Object.keys(side).find((k) => side[k][0] * v[0] + side[k][1] * v[1] > 0 && (sc.cam.screenX(side[k]) > 0) === (name === "right"));
    }
    return face(name);
  };
  return sc.add(solid);
}

/** An upright cylinder: centre-bottom at `at`, radius r, height h. Its "top" face is centred on the axis. */
function cylinder(sc, { at = [0, 0, 0], r = 16, h = 20, structure = false } = {}) {
  const [cx, cy, z] = at;
  const body = upright(sc, circleRing(cx, cy, r), z, z + h, { corner: false });
  const frames = { top: [[cx, cy, z + h], [1, 0, 0], [0, 1, 0], 2 * r, 2 * r, [0, 0, 1]] };
  return sc.add(uprightSolid(sc, body, { kind: "cylinder", home: at, structure, frames, center: [cx, cy, z + h / 2] }));
}

/**
 * A tube lying along a horizontal axis, from `from` to `to` (both on the
 * axis), radius r0 at `from` and r1 at `to`: a torch body, a pipe, a roller.
 * aim(from, to) moves it.
 */
function tube(sc, { from = [0, 0, 8], to = [40, 0, 8], r0 = 8, r1 = 8, steps = 36, structure = false } = {}) {
  const { cam } = sc;
  const g = el("g", { cls: "o-solid" });
  const faces = el("g", { cls: "o-l-faces" }, g), lights = el("g", { cls: "o-l-lights" }, g), lines = el("g", { cls: "o-l-lines" }, g);
  // flat tones, as on every solid (L2): the side, and the half of the surface that faces up in the top tone.
  // A curved surface carries no highlight line (L3)
  const side = el("path", { cls: "o-face-left" }, faces);
  const upper = el("path", { cls: "o-face-top" }, faces);
  const capFill = el("path", { cls: "o-face-right" }, faces);
  const capEdge = el("path", { cls: "o-edge" }, lines);
  const decals = el("g", {}, lines);
  const outline = el("path", { cls: "o-outline" }, lines);
  let A = from, B = to, shape = [], top = null;
  // a ring round the axis ax (3D, unit): e1 across it and level, e2 across it and as near up as it goes
  const basis = (ax) => {
    let e1 = [-ax[1], ax[0], 0], l = Math.hypot(e1[0], e1[1]);
    e1 = l > 1e-6 ? [e1[0] / l, e1[1] / l, 0] : [1, 0, 0];
    return [e1, [ax[1] * e1[2] - ax[2] * e1[1], ax[2] * e1[0] - ax[0] * e1[2], ax[0] * e1[1] - ax[1] * e1[0]]];
  };
  const disc = (c, r, ax) => {
    const [e1, e2] = basis(ax), out = [];
    for (let k = 0; k < steps; k++) {
      const t = (k / steps) * 2 * Math.PI, a = r * Math.cos(t), b = r * Math.sin(t);
      out.push(cam.project([c[0] + a * e1[0] + b * e2[0], c[1] + a * e1[1] + b * e2[1], c[2] + a * e1[2] + b * e2[2]]));
    }
    return out;
  };
  const axis = () => { const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], l = Math.hypot(...d) || 1; return d.map((x) => x / l); };
  const topFrame = () => {
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, ax = [(B[0] - A[0]) / len, (B[1] - A[1]) / len, 0];
    return [[(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, A[2] + Math.max(r0, r1)], ax, [-ax[1], ax[0], 0]];
  };
  const solid = {
    id: ++ids, g, decals, kind: "tube", structure, home: [[...from], [...to]],
    aim(a, b) {
      still(solid);
      if (a.every((v, k) => v === A[k]) && b.every((v, k) => v === B[k])) return;
      A = a; B = b; solid.dirty = true;
    },
    offset(d) { const [a, b] = solid.home; solid.aim(a.map((v, k) => v + d[k]), b.map((v, k) => v + d[k])); },
    /** Puts the tube where the transform m takes its home ends. */
    pose(m) { const [a, b] = solid.home; solid.aim(xf.apply(m, a), xf.apply(m, b)); },
    get ends() { return [A, B]; },
    outline: () => shape,
    emphasis(on) { outline.classList.toggle("o-strong", !!on); },
    /** "top": the plane touching the tube along its top line, centred on its middle, u along the axis. */
    face(name) {
      if (name !== "top") throw new Error("a tube has one face to draw in: top");
      return (top ??= planeFace(cam, decals, ...topFrame(), Infinity, Infinity));
    },
    depth() { return cam.depth([(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2]); },   // its middle, tilted or not
    bounds() {
      const r = Math.max(r0, r1);
      return { min: [0, 1, 2].map((k) => Math.min(A[k], B[k]) - r), max: [0, 1, 2].map((k) => Math.max(A[k], B[k]) + r) };
    },
    draw() {
      const ax = axis(), da = disc(A, r0, ax), db = disc(B, r1, ax);
      const all = hull(da.concat(db));
      shape = all;
      top?.place(...topFrame());
      side.setAttribute("d", closed(all));
      outline.setAttribute("d", closed(all));
      const half = steps / 2;
      upper.setAttribute("d", closed(da.slice(0, half + 1).concat(db.slice(0, half + 1).reverse())));
      // the end that faces the viewer shows its cap
      const v = cam.toViewer, towardB = ax[0] * v[0] + ax[1] * v[1] + ax[2] * v[2] > 0;
      capFill.setAttribute("d", closed(towardB ? db : da));
      capFill.setAttribute("class", cam.screenX(towardB ? ax : [-ax[0], -ax[1]]) > 0 ? "o-face-right" : "o-face-left");
      capEdge.setAttribute("d", closed(towardB ? db : da));
    },
  };
  return sc.add(solid);
}

/**
 * A convex solid with flat faces: `vertices` in world space, `faces` as lists
 * of vertex indices, anticlockwise seen from outside. Each visible face takes
 * the tone of the way it points (up, left or right), edges between two visible
 * faces are edges, the silhouette is the outline. The base for wedges and
 * frustums; sharp-cornered, so keep it for shapes a box cannot make.
 */
function faceted(sc, { vertices, faces, structure = false, kind = "faceted" }) {
  const { cam } = sc, v = cam.toViewer;
  const g = el("g", { cls: "o-solid" });
  const fl = el("g", { cls: "o-l-faces" }, g);
  el("g", { cls: "o-l-lights" }, g);
  const ln = el("g", { cls: "o-l-lines" }, g);
  const fills = faces.map(() => el("path", {}, fl));
  const edges = el("path", { cls: "o-edge" }, ln);
  const decals = el("g", {}, ln);
  const outline = el("path", { cls: "o-outline" }, ln);
  const home = vertices.map((p) => [...p]);
  let at = vertices.map((p) => [...p]), shape = [], top = null;
  const own = new Map();                // faces drawn in by index: face(i) -> planeFace, placed on every draw
  const normal = (f, pts) => {          // Newell's method, unit length
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < f.length; i++) {
      const a = pts[f[i]], b = pts[f[(i + 1) % f.length]];
      nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  };
  const upmost = () => faces.reduce((best, f, i) => (normal(f, at)[2] > normal(faces[best], at)[2] ? i : best), 0);
  const topFrame = () => frameOf(upmost());
  // a face's plane: from its first vertex along its first edge, v across it (n x u)
  const frameOf = (i) => {
    const f = faces[i], o = at[f[0]], a = at[f[1]], n = normal(f, at);
    const l = Math.hypot(a[0] - o[0], a[1] - o[1], a[2] - o[2]) || 1, u = [(a[0] - o[0]) / l, (a[1] - o[1]) / l, (a[2] - o[2]) / l];
    return [o, u, [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]]];
  };
  const solid = {
    id: ++ids, g, decals, kind, structure, home,
    offset(d) { solid.moveTo(d); },
    /** Puts the solid at its home moved by d. */
    moveTo(d) { solid.pose(xf.translate(d)); },
    /** Puts the solid where the transform m takes its home vertices. */
    pose(m) { const next = home.map((p) => xf.apply(m, p)); if (next.every((p, i) => p.every((x, k) => Math.abs(x - at[i][k]) < 1e-9))) return; still(solid); at = next; solid.dirty = true; },
    depth() { const c = [0, 1, 2].map((k) => at.reduce((s, p) => s + p[k], 0) / at.length); return cam.depth(c); },
    bounds() { return { min: [0, 1, 2].map((k) => Math.min(...at.map((p) => p[k]))), max: [0, 1, 2].map((k) => Math.max(...at.map((p) => p[k]))) }; },
    outline: () => shape,
    emphasis(on) { outline.classList.toggle("o-strong", !!on); },
    /**
     * "top": the plane of its most upward face, from that face's first vertex along its first edge. A number i is
     * faces[i] itself, wherever it turns: a prism's caps are 0 (at z) and 1 (at z + h), so a standing shield can
     * be drawn on, and hatched across, its front (F4).
     */
    face(name) {
      if (Number.isInteger(name)) {
        if (!faces[name]) throw new Error(`a faceted solid has faces 0 to ${faces.length - 1}, not ${name}`);
        if (!own.has(name)) {
          const f = planeFace(cam, decals, ...frameOf(name), Infinity, Infinity), n = normal(faces[name], at);
          f.g.style.display = n[0] * v[0] + n[1] * v[1] + n[2] * v[2] > 1e-6 ? "" : "none";
          own.set(name, f);
        }
        return own.get(name);
      }
      if (name !== "top") throw new Error("a faceted solid has one face to draw in by name, top, or any face by its index");
      if (!top) {
        // the face's size, in its own (s, t): the spread of its corners along u and v, so a patch can size itself
        const [o, u, vv] = topFrame(), f = faces[upmost()];
        const st = f.map((k) => { const d = at[k].map((x, j) => x - o[j]); return [d[0] * u[0] + d[1] * u[1] + d[2] * u[2], d[0] * vv[0] + d[1] * vv[1] + d[2] * vv[2]]; });
        const span = (j) => Math.max(...st.map((q) => q[j])) - Math.min(...st.map((q) => q[j]));
        top = planeFace(cam, decals, o, u, vv, span(0), span(1));
      }
      return top;
    },
    draw() {
      const scr = at.map((p) => cam.project(p)), seen = faces.map((f) => { const n = normal(f, at); return n[0] * v[0] + n[1] * v[1] + n[2] * v[2] > 1e-6 ? n : null; });
      shape = hull(scr);
      outline.setAttribute("d", closed(shape));
      faces.forEach((f, i) => {
        const n = seen[i];
        fills[i].setAttribute("d", n ? closed(f.map((k) => scr[k])) : "");
        if (n) fills[i].setAttribute("class", n[2] > 0.5 ? "o-face-top" : cam.screenX([n[0], n[1]]) > 0 ? "o-face-right" : "o-face-left");
      });
      // an edge shared by two visible faces is an edge; one on the silhouette is the outline's
      const owners = new Map();
      faces.forEach((f, i) => f.forEach((a, j) => { const b = f[(j + 1) % f.length], key = a < b ? a + "," + b : b + "," + a; (owners.get(key) ?? owners.set(key, []).get(key)).push(i); }));
      let d = "";
      for (const [key, fs] of owners) if (fs.length === 2 && seen[fs[0]] && seen[fs[1]]) { const [a, b] = key.split(",").map(Number); d += `M${r2(scr[a][0])} ${r2(scr[a][1])}L${r2(scr[b][0])} ${r2(scr[b][1])}`; }
      edges.setAttribute("d", d);
      // what is drawn on a face shows only while that face is turned towards the viewer, as on a box
      if (top) { top.place(...topFrame()); top.g.style.display = seen[upmost()] ? "" : "none"; }
      for (const [i, f] of own) { f.place(...frameOf(i)); f.g.style.display = seen[i] ? "" : "none"; }
    },
  };
  return sc.add(solid);
}

/** A wedge, a ramp: footprint `size` [w, d] centred at `at`, rising from nothing at one end to `h` at the end named by `high` ("+x", "-x", "+y" or "-y"). */
function wedge(sc, { at = [0, 0, 0], size = [40, 30, 16], high = "+x", structure = false } = {}) {
  const [cx, cy, z] = at, [w, d, h] = size, x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2;
  // built rising to +x, then turned about its centre
  const turn = { "+x": [1, 0], "+y": [0, 1], "-x": [-1, 0], "-y": [0, -1] }[high];
  if (!turn) throw new Error(`wedge: high is "+x", "-x", "+y" or "-y", not ${high}`);
  const rot = ([x, y, zz]) => { const dx = x - cx, dy = y - cy; return [cx + dx * turn[0] - dy * turn[1], cy + dx * turn[1] + dy * turn[0], zz]; };
  const vertices = [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [x1, y0, z + h], [x1, y1, z + h]].map(rot);
  const faces = [[0, 3, 2, 1], [1, 2, 5, 4], [0, 4, 5, 3], [0, 1, 4], [3, 5, 2]];
  return faceted(sc, { vertices, faces, structure, kind: "wedge" });
}

/** A frustum, a tapered block: base `size` [w, d] centred at `at`, `h` tall, its top `top` [tw, td] (smaller), centred above. */
function frustum(sc, { at = [0, 0, 0], size = [40, 40, 24], top = [20, 20], structure = false } = {}) {
  const [cx, cy, z] = at, [w, d, h] = size, [tw, td] = top;
  const ring = (a, b, zz) => [[cx - a / 2, cy - b / 2, zz], [cx + a / 2, cy - b / 2, zz], [cx + a / 2, cy + b / 2, zz], [cx - a / 2, cy + b / 2, zz]];
  const vertices = [...ring(w, d, z), ...ring(tw, td, z + h)];
  const faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  return faceted(sc, { vertices, faces, structure, kind: "frustum" });
}

/** A prism: any convex outline `points` [[x, y], ...] (anticlockwise) stood from z to z + h, drawn like a box with sharp corners. */
function prism(sc, { points, z = 0, h = 16, structure = false }) {
  const n = points.length, cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  for (let i = 0; i < n; i++) if (cross(points[i], points[(i + 1) % n], points[(i + 2) % n]) <= 0) throw new Error("prism: the outline must be convex and anticlockwise; split a concave shape into convex pieces and join them");
  const vertices = [...points.map(([x, y]) => [x, y, z]), ...points.map(([x, y]) => [x, y, z + h])];
  const faces = [[...points.keys()].reverse(), [...points.keys()].map((i) => i + n), ...points.map((_, i) => [i, (i + 1) % n, ((i + 1) % n) + n, i + n])];
  return faceted(sc, { vertices, faces, structure, kind: "prism" });
}

/**
 * A cutout: a flat piece cut from a sheet along any outline, convex or not: a jigsaw piece, a gasket, a stencil.
 * outline is [[x, y]] in world units, either way round; the piece lies from z to z + h. Its sides take one flat tone
 * per way they turn (L2), with an edge only at a real corner; its "top" face is the sheet's top, in world x and y
 * (s = x, t = y, before any pose), so seams, details and the focus are given where they lie. Cutouts that meet edge
 * to edge at the same height are one surface there: the side between them is not drawn, only the seam along the top,
 * and collisions test the real outline rather than its bounding box, so a knob can sit in its blank. It moves
 * upright only: slid, lifted or turned about z, as a piece on a table is.
 */
function cutout(sc, { outline: pts, z = 0, h = 3, sides = "shade", gap = 3, structure = false }) {
  const { cam } = sc, v = cam.toViewer;
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; area += x0 * y1 - x1 * y0; }
  const home = (area < 0 ? pts.slice().reverse() : pts.slice()).map(([x, y]) => [x, y]), N = home.length;
  const g = el("g", { cls: "o-solid" });
  const faces = el("g", { cls: "o-l-faces" }, g), lights = el("g", { cls: "o-l-lights" }, g), lines = el("g", { cls: "o-l-lines" }, g);
  const wallsG = el("g", {}, faces), walls = [];
  const topFill = el("path", { cls: "o-face-top" }, faces);
  const rim = el("path", { cls: "o-shine" }, lights);
  const hatchNode = el("path", { cls: "o-hatch o-nofill" }, lines);
  const edgeNode = el("path", { cls: "o-edge" }, lines);
  const decals = el("g", {}, lines);
  const outline = el("path", { cls: "o-outline" }, lines);
  // the outline is open lines (a seam is not outline), so the piece's area for picking is a hidden closed shape
  const hit = el("path", { cls: "o-hit" }, lines);
  let m = xf.identity(), poly = home.map((p) => [...p]), z0 = z, shape = [], top = null;
  const normals = () => poly.map((a, i) => { const b = poly[(i + 1) % N], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dy / l, -dx / l]; });
  const others = () => sc.solids.filter((x) => x !== solid && x.kind === "cutout");
  const solid = {
    id: ++ids, g, decals, kind: "cutout", structure, home: [...home],
    /** The outline as it lies now, and the heights it spans: for collisions and shared edges. */
    get footprint() { return { poly, z0, z1: z0 + h }; },
    pose(next) {
      if (xf.same(next, m)) return;
      if (!xf.upright(next)) throw new Error("a cutout moves upright only: slide, lift or turn it about z");
      still(solid);
      m = next; poly = home.map(([x, y]) => xf.apply(m, [x, y, 0]).slice(0, 2)); z0 = z + m.t[2];
      // a neighbour's sides depend on where this piece is: redraw every cutout
      solid.dirty = true; for (const o of others()) o.dirty = true;
    },
    offset(d) { solid.pose(xf.translate(d)); },
    moveTo(d) { solid.pose(xf.translate(d)); },
    outline: () => shape,
    emphasis(on) { outline.classList.toggle("o-strong", !!on); },
    face(name) {
      if (name !== "top") throw new Error("a cutout has one face to draw in: top");
      return (top ??= planeFace(cam, decals, xf.apply(m, [0, 0, z + h]), xf.dir(m, [1, 0, 0]), xf.dir(m, [0, 1, 0]), Infinity, Infinity));
    },
    depth() { const c = poly.reduce((t, p) => [t[0] + p[0] / N, t[1] + p[1] / N], [0, 0]); return cam.depth([c[0], c[1], z0 + h / 2]); },
    bounds() { return { min: [Math.min(...poly.map((p) => p[0])), Math.min(...poly.map((p) => p[1])), z0], max: [Math.max(...poly.map((p) => p[0])), Math.max(...poly.map((p) => p[1])), z0 + h] }; },
    draw() {
      const z1 = z0 + h, ns = normals();
      const tp = poly.map(([x, y]) => cam.project([x, y, z1])), bt = poly.map(([x, y]) => cam.project([x, y, z0]));
      // a side another cutout shares, at the same height, is inside the surface: not drawn
      const near = others().map((o) => o.footprint).filter((f) => Math.abs(f.z0 - z0) < 0.05 && Math.abs(f.z1 - z1) < 0.05);
      const shared = poly.map((a, i) => {
        const b = poly[(i + 1) % N], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        return near.some((f) => onBoundary(mid, f.poly, 0.05));
      });
      const seen = ns.map((n, i) => !shared[i] && n[0] * v[0] + n[1] * v[1] > 1e-6);
      const order = [...Array(N).keys()].filter((i) => seen[i]).sort((i, j) => {
        const d = (k) => cam.depth([(poly[k][0] + poly[(k + 1) % N][0]) / 2, (poly[k][1] + poly[(k + 1) % N][1]) / 2, z0]);
        return d(i) - d(j);
      });
      while (walls.length < order.length) walls.push(el("path", {}, wallsG));
      order.forEach((i, k) => {
        const j = (i + 1) % N;
        walls[k].setAttribute("d", closed([tp[i], tp[j], bt[j], bt[i]]));
        walls[k].setAttribute("class", sides === "hatch" ? "o-face-top" : cam.screenX(ns[i]) > 0 ? "o-face-right" : "o-face-left");
      });
      for (let k = order.length; k < walls.length; k++) walls[k].setAttribute("d", "");
      topFill.setAttribute("d", closed(tp));
      // lines: the top's edge over a side that shows, and seams, are edges; a corner between two sides that show is an
      // edge; the rest of the top's edge, the foot of every side that shows, and where a side turns away, are outline
      // a side's lines (its foot, its corners, its hatching) show only where the top does not hide them: on a piece
      // that is not convex, a side can run on behind another part of the top
      let ed = "", out = "", sh = "", ht = "";
      const behind = (a, b) => segmentParts(a, b, tp, false).map((q) => line(q)).join("");
      const k = (0.9 / cam.scale) * 1.4;
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N, p = (i + N - 1) % N;
        if (seen[i] || shared[i]) ed += line([tp[i], tp[j]]); else out += line([tp[i], tp[j]]);
        if (seen[i]) {
          out += behind(bt[i], bt[j]);
          const [a, b] = [poly[i], poly[j]].map(([x, y]) => cam.project([x - ns[i][0] * k, y - ns[i][1] * k, z1]));
          sh += line([a, b]);
          if (sides === "hatch") ht += hatchQuad([tp[i], tp[j], bt[j], bt[i]], gap).map(([a, b]) => behind(a, b)).join("");
        }
        if (seen[i] !== seen[p] && !shared[i] && !shared[p]) out += behind(tp[i], bt[i]);
        else if (seen[i] && seen[p] && ns[i][0] * ns[p][0] + ns[i][1] * ns[p][1] < 0.82) ed += behind(tp[i], bt[i]);
      }
      hatchNode.setAttribute("d", ht);
      edgeNode.setAttribute("d", ed);
      outline.setAttribute("d", out);
      rim.setAttribute("d", sh);
      shape = hull(tp.concat(bt));
      hit.setAttribute("d", closed(shape));
      top?.place(xf.apply(m, [0, 0, z + h]), xf.dir(m, [1, 0, 0]), xf.dir(m, [0, 1, 0]));
    },
  };
  return sc.add(solid);
}

/** The pieces of segment a-b that lie inside polygon poly (keep true) or outside it (keep false), in screen space. */
function segmentParts(a, b, poly, keep) {
  const ts = [0, 1], dx = b[0] - a[0], dy = b[1] - a[1];
  for (let i = 0; i < poly.length; i++) {
    const c = poly[i], d = poly[(i + 1) % poly.length], ex = d[0] - c[0], ey = d[1] - c[1], den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((c[0] - a[0]) * ey - (c[1] - a[1]) * ex) / den, u = ((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) / den;
    if (t > 1e-6 && t < 1 - 1e-6 && u >= -1e-9 && u <= 1 + 1e-9) ts.push(t);
  }
  ts.sort((x, y) => x - y);
  const at = (t) => [a[0] + dx * t, a[1] + dy * t], parts = [];
  for (let i = 0; i + 1 < ts.length; i++) {
    if (ts[i + 1] - ts[i] < 1e-6 || inside(at((ts[i] + ts[i + 1]) / 2), poly) !== keep) continue;
    const last = parts[parts.length - 1];
    if (last && Math.abs(last.t1 - ts[i]) < 1e-9) last.t1 = ts[i + 1]; else parts.push({ t0: ts[i], t1: ts[i + 1] });
  }
  return parts.map(({ t0, t1 }) => [at(t0), at(t1)]);
}
/** The brand's hatching across a convex screen quad: lines at 45 degrees, top left to bottom right, gap apart on screen. */
function hatchQuad(quad, gap) {
  // lines x - y = c, gap apart measured square to them
  const cs = quad.map(([x, y]) => x - y), step = gap * Math.SQRT2, lo = Math.min(...cs), hi = Math.max(...cs), out = [];
  for (let c = Math.ceil(lo / step) * step; c <= hi; c += step) {
    const span = Math.max(...quad.map((p) => Math.abs(p[0]) + Math.abs(p[1]))) + 10;
    out.push(...segmentParts([c - span, -span], [c + span, span], quad, true));
  }
  return out;
}
/** Whether point p lies on the boundary of polygon poly, within eps. */
function onBoundary(p, poly, eps) {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
    const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1);
    if (Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy) < eps) return true;
  }
  return false;
}
/** Whether two outlines' insides overlap by more than eps: edges that cross, or a corner well inside the other. */
function outlinesOverlap(P, Q, eps) {
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  for (let i = 0; i < P.length; i++) for (let j = 0; j < Q.length; j++) {
    const a = P[i], b = P[(i + 1) % P.length], c = Q[j], d = Q[(j + 1) % Q.length];
    const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
    const la = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, lc = Math.hypot(d[0] - c[0], d[1] - c[1]) || 1;
    if (d1 / lc * (d2 / lc) < -eps * eps && d3 / la * (d4 / la) < -eps * eps) return true;
  }
  const deep = (p, poly) => inside(p, poly) && !onBoundary(p, poly, eps);
  return P.some((p) => deep(p, Q)) || Q.some((q) => deep(q, P));
}
/** A solid's outline on the floor plan, for collisions with a cutout: its own, a circle, or its bounding rectangle. */
function footprintOf(x) {
  if (x.kind === "cutout") return x.footprint.poly;
  const B = x.bounds();
  if ((x.kind === "cylinder" || x.kind === "lathe") && (!x.xform || xf.upright(x.xform))) {
    const c = [(B.min[0] + B.max[0]) / 2, (B.min[1] + B.max[1]) / 2], r = (B.max[0] - B.min[0]) / 2;
    return [...Array(24).keys()].map((k) => [c[0] + r * Math.cos((k * Math.PI) / 12), c[1] + r * Math.sin((k * Math.PI) / 12)]);
  }
  return [[B.min[0], B.min[1]], [B.max[0], B.min[1]], [B.max[0], B.max[1]], [B.min[0], B.max[1]]];
}

/**
 * A shell: a hollow body of one even wall, its cross-section any convex outline, run along x or y and open at one end:
 * a mailbox, a tunnel, a pipe's mouth, a drawer's case. profile is [[a, b]]: a across the run (along +y for a run along
 * x, along -x for a run along y), b up; at is where the run starts, length how far it goes, open "end" or "start".
 * Seen from outside it is a solid; when its open end faces the viewer, its rim shows as a ring, and inside it the
 * walls, floor and back that face the viewer, seen only through the opening, each a step darker than outside, out of
 * the light: a floor in the light side tone, a wall or back in the dark one, the walls hatched grey along the run.
 * Its flat outer sides take details: face("+x" | "-x" | "+y" | "-y" | "top"), whichever it has.
 */
function shell(sc, { at = [0, 0, 0], length = 60, profile, wall = 1.2, axis = "x", open = "end", structure = false }) {
  const { cam } = sc, v = cam.toViewer;
  // the run, and the profile's two directions across it: a along ac, b along up (for a run along z, b along y)
  const ax = axis === "x" ? [1, 0, 0] : axis === "y" ? [0, 1, 0] : [0, 0, 1];
  const ac = axis === "x" ? [0, 1, 0] : axis === "y" ? [-1, 0, 0] : [1, 0, 0], up = axis === "z" ? [0, 1, 0] : [0, 0, 1];
  // open at the top, a box or a tub holds things: its inside is drawn as its own solid, behind what stands in it, and
  // its near walls and rim in front
  const split = axis === "z";
  let area = 0;
  for (let i = 0; i < profile.length; i++) { const [a0, b0] = profile[i], [a1, b1] = profile[(i + 1) % profile.length]; area += a0 * b1 - a1 * b0; }
  const P = area < 0 ? profile.slice().reverse() : profile.slice(), N = P.length;
  // the inside: every side moved in by the wall, its corners where neighbouring sides meet again
  const lineOf = (i) => { const [a0, b0] = P[i], [a1, b1] = P[(i + 1) % N], l = Math.hypot(a1 - a0, b1 - b0) || 1, n = [-(b1 - b0) / l, (a1 - a0) / l]; return { p: [a0 + n[0] * wall, b0 + n[1] * wall], d: [(a1 - a0) / l, (b1 - b0) / l] }; };
  const Q = P.map((_, i) => {
    const A = lineOf((i + N - 1) % N), B = lineOf(i), den = A.d[0] * B.d[1] - A.d[1] * B.d[0];
    if (Math.abs(den) < 1e-9) return B.p;
    const t = ((B.p[0] - A.p[0]) * B.d[1] - (B.p[1] - A.p[1]) * B.d[0]) / den;
    return [A.p[0] + A.d[0] * t, A.p[1] + A.d[1] * t];
  });
  const W = (sAlong, [a, b]) => [0, 1, 2].map((k) => at[k] + ax[k] * sAlong + ac[k] * a + up[k] * b);
  const sOpen = open === "start" ? 0 : length, sShut = length - sOpen, sBack = sShut + (open === "start" ? -wall : wall);
  const out = open === "start" ? ax.map((x) => -x) : ax;
  const home = [...P.map((q) => W(0, q)), ...P.map((q) => W(length, q))];
  const shutRing = sShut === 0 ? [...Array(N).keys()] : [...Array(N).keys()].map((i) => i + N);
  const faces = [...P.map((_, i) => [i, (i + 1) % N, ((i + 1) % N) + N, i + N]), sShut === 0 ? shutRing.slice().reverse() : shutRing];
  const homeOpen = P.map((q) => W(sOpen, q)), homeIn = Q.map((q) => W(sOpen, q)), homeBack = Q.map((q) => W(sBack, q));

  const g = el("g", { cls: "o-solid" });
  const fl = el("g", { cls: "o-l-faces" }, g);
  const meshG = el("g", {}, fl);
  const ig = split ? el("g", { cls: "o-solid" }) : null;
  const ifl = split ? el("g", { cls: "o-l-faces" }, ig) : fl;
  if (split) el("g", { cls: "o-l-lights" }, ig);
  const iln = split ? el("g", { cls: "o-l-lines" }, ig) : null;
  const id = "o-clip" + ++ids, clipPath = el("path", {}, el("clipPath", { id }, split ? ig : g));
  const inG = el("g", { "clip-path": `url(#${id})` }, ifl), back = el("path", {}, inG), walls = [];
  const rimFill = el("path", { "fill-rule": "evenodd" }, fl);
  el("g", { cls: "o-l-lights" }, g);
  const ln = el("g", { cls: "o-l-lines" }, g);
  const edges = el("path", { cls: "o-edge" }, ln);
  const inHatch = el("path", { cls: "o-hatch o-nofill", "clip-path": `url(#${id})` }, iln ?? ln);
  const inEdges = el("path", { cls: "o-edge", "clip-path": `url(#${id})` }, iln ?? ln);
  const rimEdges = el("path", { cls: "o-edge" }, ln);
  const decals = el("g", {}, ln);
  const outline = el("path", { cls: "o-outline" }, ln);
  // split, what stands in it is pointed at through its mouth: its own area for picking leaves the mouth out
  const hitPath = split ? el("path", { cls: "o-hit", "fill-rule": "evenodd" }, ln) : null;
  let mouthScr = null;
  const painter = meshPainter(cam, meshG, edges);
  const tone = (n) => (n[2] > 0.5 ? "o-face-top" : cam.screenX([n[0], n[1]]) > 0 ? "o-face-right" : "o-face-left");
  // inside, out of the light, each side is a step darker: a floor takes the light side tone, a wall or back the dark one
  const shade = (n) => (n[2] > 0.5 ? "o-face-left" : "o-face-right");
  // each inner side's normal, facing into the hollow (the outer side's, turned round)
  const inward = P.map((_, i) => { const [a0, b0] = P[i], [a1, b1] = P[(i + 1) % N], l = Math.hypot(a1 - a0, b1 - b0) || 1, n = [-(b1 - b0) / l, (a1 - a0) / l]; return [0, 1, 2].map((k) => ac[k] * n[0] + up[k] * n[1]); });

  // the flat outer sides, by the way they point, for details
  const named = { "+x": [1, 0, 0], "-x": [-1, 0, 0], "+y": [0, 1, 0], "-y": [0, -1, 0], top: [0, 0, 1] }, made = {};
  const frameOf = (name) => {
    const want = named[name];
    if (!want) throw new Error(`a shell has no face "${name}"; ask for "+x", "-x", "+y", "-y" or "top"`);
    const sides = P.map((_, i) => ({ f: faces[i], n: inward[i].map((x) => -x) }));
    const shutN = open === "start" ? ax : ax.map((x) => -x);
    const hit = [...sides, { f: faces[N], n: shutN }].find((x) => x.n[0] * want[0] + x.n[1] * want[1] + x.n[2] * want[2] > 0.999);
    if (!hit) throw new Error(`this shell has no flat side facing "${name}"`);
    const pts = hit.f.map((k) => home[k]), n = hit.n;
    // u reads left to right on screen, v down it, both in the face's plane
    let u = Math.abs(n[2]) > 0.9 ? [1, 0, 0] : [-n[1], n[0], 0];
    if (Math.abs(n[2]) > 0.9 && axis === "y") u = [0, 1, 0];
    const lu = Math.hypot(...u); u = u.map((x) => x / lu);
    if (cam.screenX([u[0], u[1]]) < 0) u = u.map((x) => -x);
    let w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    const p0 = cam.project([0, 0, 0]), p1 = cam.project(w);
    if (p1[1] < p0[1]) w = w.map((x) => -x);
    const S = pts.map((p) => p[0] * u[0] + p[1] * u[1] + p[2] * u[2]), T = pts.map((p) => p[0] * w[0] + p[1] * w[1] + p[2] * w[2]);
    const s0 = Math.min(...S), t0 = Math.min(...T), q = pts[0], dq = s0 - S[0], dt = t0 - T[0];
    return { o: [q[0] + u[0] * dq + w[0] * dt, q[1] + u[1] * dq + w[1] * dt, q[2] + u[2] * dq + w[2] * dt], u, v: w, n, w: Math.max(...S) - s0, h: Math.max(...T) - t0 };
  };
  let m = xf.identity(), shape = [];
  const centre = () => { const at = home.map((p) => xf.apply(m, p)); return cam.depth([0, 1, 2].map((k) => at.reduce((t, p) => t + p[k], 0) / at.length)); };
  const solid = {
    id: ++ids, g, decals, kind: "shell", structure, home: home.map((p) => [...p]),
    /** Its walls and its closed end as boxes, for collisions: a shell is hollow, and what stands in it is not in it. */
    slabs() {
      const box = (pts) => { const at = pts.map((p) => xf.apply(m, p)); return { min: [0, 1, 2].map((k) => Math.min(...at.map((p) => p[k]))), max: [0, 1, 2].map((k) => Math.max(...at.map((p) => p[k]))) }; };
      const out = P.map((_, i) => { const j = (i + 1) % N; return box([P[i], P[j], Q[i], Q[j]].flatMap((q) => [W(0, q), W(length, q)])); });
      out.push(box([...P.map((q) => W(sShut, q)), ...P.map((q) => W(sBack, q))]));
      return out;
    },
    pose(next) { if (xf.same(next, m)) return; still(solid); m = next; solid.dirty = true; },
    offset(d) { solid.pose(xf.translate(d)); },
    moveTo(d) { solid.pose(xf.translate(d)); },
    outline: () => shape,
    hit: split ? (p) => inside(p, shape) && !(mouthScr && inside(p, mouthScr)) : undefined,
    emphasis(on) { outline.classList.toggle("o-strong", !!on); },
    face(name) {
      if (!made[name]) { const f = frameOf(name); made[name] = { f, face: planeFace(cam, decals, xf.apply(m, f.o), xf.dir(m, f.u), xf.dir(m, f.v), f.w, f.h) }; }
      return made[name].face;
    },
    // split, its near walls are painted after what stands in it
    depth() { return centre() + (split ? 1e4 : 0); },
    bounds() { const at = home.map((p) => xf.apply(m, p)); return { min: [0, 1, 2].map((k) => Math.min(...at.map((p) => p[k]))), max: [0, 1, 2].map((k) => Math.max(...at.map((p) => p[k]))) }; },
    draw() {
      const at = home.map((p) => xf.apply(m, p));
      shape = painter.draw(at, faces, { edges: "tone", corner: false });
      outline.setAttribute("d", closed(shape));
      for (const k in made) {
        const { f, face } = made[k], nn = xf.dir(m, f.n);
        face.place(xf.apply(m, f.o), xf.dir(m, f.u), xf.dir(m, f.v));
        face.g.style.display = nn[0] * v[0] + nn[1] * v[1] + nn[2] * v[2] > 1e-6 ? "" : "none";
      }
      const o = xf.dir(m, out), seen = o[0] * v[0] + o[1] * v[1] + o[2] * v[2] > 1e-6;
      const scr = (pts) => pts.map((p) => cam.project(xf.apply(m, p)));
      if (!seen) {
        mouthScr = null; hitPath?.setAttribute("d", closed(shape));
        for (const n of [clipPath, back, rimFill, inEdges, inHatch, rimEdges, ...walls]) n.setAttribute("d", "");
        return;
      }
      // the rim: a ring round the opening; inside it, through the opening, the back and the sides that face the viewer
      const mouth = scr(homeIn), lip = scr(homeOpen), deep = scr(homeBack);
      mouthScr = mouth;
      hitPath?.setAttribute("d", closed(shape) + closed(mouth));
      rimFill.setAttribute("d", closed(lip) + closed(mouth));
      rimFill.setAttribute("class", tone(o));
      rimEdges.setAttribute("d", closed(lip) + closed(mouth));
      clipPath.setAttribute("d", closed(mouth));
      back.setAttribute("d", closed(deep));
      back.setAttribute("class", shade(o));
      const list = [];
      for (let i = 0; i < N; i++) {
        const n = xf.dir(m, inward[i]);
        if (n[0] * v[0] + n[1] * v[1] + n[2] * v[2] <= 1e-6) continue;
        const j = (i + 1) % N, c = [homeBack[i], homeBack[j], homeIn[j], homeIn[i]].map((p) => xf.apply(m, p));
        list.push({ i, j, n, d: cam.depth(c.reduce((t, p) => [t[0] + p[0] / 4, t[1] + p[1] / 4, t[2] + p[2] / 4], [0, 0, 0])) });
      }
      list.sort((a, b) => a.d - b.d);
      while (walls.length < list.length) walls.push(el("path", {}, inG));
      let ed = closed(deep);
      list.forEach((x, k) => {
        walls[k].setAttribute("d", closed([deep[x.i], deep[x.j], mouth[x.j], mouth[x.i]]));
        walls[k].setAttribute("class", shade(x.n));
      });
      for (let k = list.length; k < walls.length; k++) walls[k].setAttribute("d", "");
      // a line along the run only where two inside sides that show change tone
      for (const x of list) {
        const y = list.find((z) => z.i === x.j);
        if (y && shade(x.n) !== shade(y.n)) ed += line([deep[x.j], mouth[x.j]]);
      }
      inEdges.setAttribute("d", ed);
      // the walls in the shade inside are hatched along the run, so the hollow reads as going back (floors are not)
      let hd = "";
      for (const x of list) {
        if (x.n[2] > 0.5) continue;
        const span = Math.hypot(Q[x.j][0] - Q[x.i][0], Q[x.j][1] - Q[x.i][1]), n = Math.floor(span / 1.8);
        for (let k = 1; k <= n; k++) {
          const t = k / (n + 1), a = [0, 1].map((c) => deep[x.i][c] + (deep[x.j][c] - deep[x.i][c]) * t), b = [0, 1].map((c) => mouth[x.i][c] + (mouth[x.j][c] - mouth[x.i][c]) * t);
          hd += line([a, b]);
        }
      }
      inHatch.setAttribute("d", hd);
    },
  };
  sc.add(solid);
  if (split) {
    // the inside, painted before what stands in the shell; the shell's own draw draws it, so it never needs its own
    solid.inside = sc.add({
      id: ++ids, g: ig, kind: "shell-inside", structure: true, home: [], dirty: false,
      outline: () => shape, emphasis() {}, draw() {}, pose() {},
      depth: () => centre() - 1e4, bounds: () => solid.bounds(),
    });
  }
  return solid;
}

/**
 * A tray, an open box: a base and four walls, joined as one object. Returns
 * { solids, floor }: the solids (for interact's part, or structure), and the
 * face of the tray's inside floor, to draw what it holds.
 */
function tray(sc, { at = [0, 0, 0], size = [50, 40, 12], wall = 2, structure = false } = {}) {
  const [cx, cy, z] = at, [w, d, h] = size, t = wall;
  const base = box(sc, { at: [cx, cy, z], size: [w, d, t], radius: 1.2, structure });
  const walls = [
    [cx, cy - d / 2 + t / 2, w, t], [cx, cy + d / 2 - t / 2, w, t],
    [cx - w / 2 + t / 2, cy, t, d - 2 * t], [cx + w / 2 - t / 2, cy, t, d - 2 * t],
  ].map(([x, y, ww, dd]) => box(sc, { at: [x, y, z + t], size: [ww, dd, h - t], radius: 0.5, structure }));
  // the walls along x run the full width; the others fit between them, so no two pass through each other
  sc.join(base, ...walls);
  return { solids: [base, ...walls], floor: base.face("top") };
}

/**
 * A rod: one round bar of radius r bent along a path of world points: a padlock's shackle, a handle, a cable, a
 * hook. It is one continuous piece, not a chain of parts. In an orthographic view a round bar is as wide as its
 * diameter whichever way it runs, so the rod is drawn as its path's outline at that width, round at the ends, in
 * flat tones (L2): its side, and a lit band towards the light. Use arc() for its bends. End it where it meets
 * another solid (a shackle stops at the lock body's top), never inside one. pose(m) moves it like any solid.
 */
function rod(sc, { points, r = 2, structure = false }) {
  const { cam } = sc;
  const g = el("g", { cls: "o-solid" });
  const faces = el("g", { cls: "o-l-faces" }, g);
  el("g", { cls: "o-l-lights" }, g);
  const lines = el("g", { cls: "o-l-lines" }, g);
  const side = el("path", { cls: "o-face-right" }, faces);
  const lit = el("path", { cls: "o-face-top" }, faces);
  const decals = el("g", {}, lines);
  const outline = el("path", { cls: "o-outline" }, lines);
  const home = points.map((p) => [...p]);
  let at = home.map((p) => [...p]), shape = [];
  // the path's outline at half-width h on screen, shifted by d, with round ends
  const band = (scr, h, d = [0, 0]) => {
    const n = scr.length, left = [], right = [], tan = [];
    for (let i = 0; i < n; i++) {
      const a = scr[Math.max(0, i - 1)], b = scr[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const t = [(b[0] - a[0]) / l, (b[1] - a[1]) / l], nn = [-t[1], t[0]];
      tan.push(t);
      left.push([scr[i][0] + nn[0] * h + d[0], scr[i][1] + nn[1] * h + d[1]]);
      right.push([scr[i][0] - nn[0] * h + d[0], scr[i][1] - nn[1] * h + d[1]]);
    }
    const cap = (p, t, from) => {
      const out = [], a0 = Math.atan2(t[1], t[0]) + from;
      for (let k = 1; k < 8; k++) { const a = a0 - (k * Math.PI) / 8; out.push([p[0] + h * Math.cos(a) + d[0], p[1] + h * Math.sin(a) + d[1]]); }
      return out;
    };
    return [...left, ...cap(scr[n - 1], tan[n - 1], Math.PI / 2), ...right.reverse(), ...cap(scr[0], tan[0], -Math.PI / 2)];
  };
  const solid = {
    id: ++ids, g, decals, kind: "rod", structure, home,
    pose(m) { const next = home.map((p) => xf.apply(m, p)); if (next.every((p, i) => p.every((x, k) => Math.abs(x - at[i][k]) < 1e-9))) return; still(solid); at = next; solid.dirty = true; },
    offset(d) { solid.pose(xf.translate(d)); },
    moveTo(d) { solid.pose(xf.translate(d)); },
    outline: () => shape,
    emphasis(on) { outline.classList.toggle("o-strong", !!on); },
    face() { throw new Error("a rod has no face to draw in; put details and the focus on the solids it joins"); },
    depth() { const c = [0, 1, 2].map((k) => at.reduce((s, p) => s + p[k], 0) / at.length); return cam.depth(c); },
    bounds() { return { min: [0, 1, 2].map((k) => Math.min(...at.map((p) => p[k])) - r), max: [0, 1, 2].map((k) => Math.max(...at.map((p) => p[k])) + r) }; },
    draw() {
      const scr = at.map((p) => cam.project(p)), h = r * cam.scale;
      shape = band(scr, h);
      side.setAttribute("d", closed(shape));
      outline.setAttribute("d", closed(shape));
      lit.setAttribute("d", closed(band(scr, h * 0.45, [-h * 0.22, -h * 0.3])));
    },
  };
  return sc.add(solid);
}

/**
 * A wire: one round bar of radius r along several paths of world points, moulded as one piece, so where its paths
 * cross, branch or meet, the bar merges into one outline with no seam: a letter in tube lettering (a t's cross, an
 * e's bar into its bowl), a bent-wire frame. Drawn as strokes along the paths' centre lines: the outline underneath,
 * as wide as the bar and its line, then the side tone over it, then the lit band, so every inner edge is covered.
 * Same flat tones as a rod (L2); keep its paths in one plane, as a moulded piece would be. pose(m) moves it.
 * It is shaded in three flat tones (L2) where the light really falls: at each point, the side of the bar's round
 * section turned to the light is lit, the side turned from it is in shade, and the middle takes the side tone. So the
 * bands move round the bar as it turns, and the plane a wire stands in reads. light: the direction the light comes
 * from, in world space; by default the brand's, up and to the viewer's left (the way a box's faces are toned).
 */
function wire(sc, { paths, r = 2, light = null, structure = false }) {
  const { cam } = sc;
  const g = el("g", { cls: "o-solid" });
  const faces = el("g", { cls: "o-l-faces" }, g);
  el("g", { cls: "o-l-lights" }, g);
  const lines = el("g", { cls: "o-l-lines" }, g);
  // strokes in the figure's own units (not the page's), round at every end and join
  // they are the bar's body, not lines over a face (L1): marked o-bar
  const stroke = (parent, role) => el("path", { cls: "o-bar", fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round",
    style: `stroke:var(--o-${role});vector-effect:none` }, parent);
  // the light: by default up, and to the viewer's left (the way the box faces are toned)
  const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  const V = cam.toViewer, left = [-Math.cos(rad(cam.angle)), Math.sin(rad(cam.angle)), 0];
  const LIGHT = unit(light ?? [0, 0, 1].map((u, k) => 0.85 * u + 0.55 * left[k] + 0.25 * V[k]));
  // a band's centre line: each point moved round its section, towards the light (k > 0) or away (k < 0), by the
  // path's own direction there; only the part of the section the eye can see, so a band never leaves the bar
  const band = (path, k) => path.map((p, i) => {
    const a = unit([0, 1, 2].map((j) => path[Math.min(path.length - 1, i + 1)][j] - path[Math.max(0, i - 1)][j]));
    const flat = (v) => { const d = v.reduce((s, x, j) => s + x * a[j], 0); return v.map((x, j) => x - d * a[j]); };
    const eye = unit(flat(V)), toward = flat(LIGHT);
    // the light's direction round the section, kept to the visible half (towards the eye)
    const facing = toward.reduce((s, x, j) => s + x * eye[j], 0);
    const n = unit(toward.map((x, j) => x - Math.min(0, facing) * eye[j]));
    const q = cam.project([0, 1, 2].map((j) => p[j] + n[j] * r * k));
    return [q[0], q[1]];
  });
  const outline = stroke(faces, "outline"), side = stroke(faces, "face-left"), shade = stroke(faces, "face-right"), lit = stroke(faces, "face-top");
  const decals = el("g", {}, lines);
  // its outline is a stroke, so its area for picking is a hidden closed shape
  const hit = el("path", { cls: "o-hit" }, lines);
  const home = paths.map((path) => path.map((p) => [...p]));
  let at = home.map((path) => path.map((p) => [...p])), shape = [], strong = false;
  const all = () => at.flat();
  const solid = {
    id: ++ids, g, decals, kind: "wire", structure, home, paths: [],
    pose(m) { at = home.map((path) => path.map((p) => xf.apply(m, p))); still(solid); solid.dirty = true; },
    offset(d) { solid.pose(xf.translate(d)); },
    moveTo(d) { solid.pose(xf.translate(d)); },
    outline: () => shape,
    emphasis(on) { strong = !!on; outline.style.stroke = on ? "var(--o-strong)" : "var(--o-outline)"; outline.classList.toggle("o-strong", strong); solid.dirty = true; },
    face() { throw new Error("a wire has no face to draw in; put details and the focus on the solids it joins"); },
    depth() { const c = [0, 1, 2].map((k) => all().reduce((s, p) => s + p[k], 0) / all().length); return cam.depth(c); },
    bounds() { return { min: [0, 1, 2].map((k) => Math.min(...all().map((p) => p[k])) - r), max: [0, 1, 2].map((k) => Math.max(...all().map((p) => p[k])) + r) }; },
    draw() {
      const scr = at.map((path) => path.map((p) => cam.project(p))), h = r * cam.scale, d = (pts, o = [0, 0]) => line(pts.map(([x, y]) => [x + o[0], y + o[1]]));
      solid.paths = scr;
      const all = scr.map((pts) => d(pts)).join("");
      outline.setAttribute("d", all); outline.setAttribute("stroke-width", r2(2 * h + (strong ? 3.2 : 2.5)));
      side.setAttribute("d", all); side.setAttribute("stroke-width", r2(2 * h));
      shade.setAttribute("d", at.map((path) => line(band(path, -0.55))).join("")); shade.setAttribute("stroke-width", r2(h * 0.85));
      lit.setAttribute("d", at.map((path) => line(band(path, 0.45))).join("")); lit.setAttribute("stroke-width", r2(h * 0.75));
      // its silhouette, for picking and the checks: the hull of its bar
      shape = hull(scr.flat().flatMap(([x, y]) => [[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h]]));
      hit.setAttribute("d", closed(shape));
    },
  };
  return sc.add(solid);
}

/**
 * A lathe: a round solid turned about an upright axis from a profile, [[r, z], ...] from the bottom up (z above
 * `at`): a domed button, a knob, a bulb's glass, a rocket's nose, a bottle. Keep the profile convex (r never dips
 * then swells); a shape with a waist is two lathes, joined. Drawn as one solid in flat tones (L2), each band in the
 * tone of the way it faces, with an edge only where the top meets the side. A flat top (last r > 0) has a "top" face.
 * seat: a world height below which it is out of sight, inside the hole or collar it sits in (a button's cap): it is
 * cut there as it moves, so it sinks in behind the rim and is always painted above what it sits in.
 */
function lathe(sc, { at = [0, 0, 0], profile, steps = 32, structure = false, seat = null, smooth = false }) {
  const { cam } = sc, [cx, cy, z0] = at, N = steps;
  const g = el("g", { cls: "o-solid" });
  const faces = el("g", { cls: "o-l-faces" }, g);
  el("g", { cls: "o-l-lights" }, g);
  const lines = el("g", { cls: "o-l-lines" }, g);
  const edgeNode = el("path", { cls: "o-edge" }, lines);
  const decals = el("g", {}, lines);
  const outline = el("path", { cls: "o-outline" }, lines);
  const painter = meshPainter(cam, faces, edgeNode);
  // the profile, cut where it goes below its seat (the top of the collar or hole it sits in), as local z
  const cut = (zMin) => {
    if (zMin == null || zMin <= profile[0][1]) return profile;
    const out = [];
    for (let j = 0; j + 1 < profile.length; j++) {
      const [ra, za] = profile[j], [rb, zb] = profile[j + 1];
      if (za < zMin && zb > zMin) out.push([ra + ((rb - ra) * (zMin - za)) / (zb - za), zMin]);
      if (zb >= zMin) out.push([rb, zb]);
    }
    return out.length >= 2 ? out : [[0, profile.at(-1)[1]], [0, profile.at(-1)[1]]];
  };
  // rings of N points; a ring of radius 0 is one point (an apex)
  const mesh = (prof) => {
    const verts = [], ringAt = [], M = prof.length;
    for (const [r, z] of prof) {
      ringAt.push(verts.length);
      if (r <= 1e-6) verts.push([cx, cy, z0 + z]);
      else for (let k = 0; k < N; k++) { const a = (k / N) * 2 * Math.PI; verts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z0 + z]); }
    }
    const idx = (j, k) => (prof[j][0] <= 1e-6 ? ringAt[j] : ringAt[j] + (k % N)), fs = [];
    if (prof[0][0] > 1e-6) fs.push([...Array(N).keys()].map((k) => idx(0, k)).reverse());
    for (let j = 0; j + 1 < M; j++) for (let k = 0; k < N; k++) {
      const f = [idx(j, k), idx(j, k + 1), idx(j + 1, k + 1), idx(j + 1, k)].filter((v, i, a) => a.indexOf(v) === i);
      if (f.length >= 3) fs.push(f);
    }
    if (prof[M - 1][0] > 1e-6) fs.push([...Array(N).keys()].map((k) => idx(M - 1, k)));
    return { verts, faces: fs };
  };
  let m = xf.identity(), shape = [], top = null, geo = null;
  const build = () => {
    // a seat hides what has gone into the hole: only for poses that keep it upright, where z is still z
    const zMin = seat != null && xf.upright(m) ? seat - z0 - m.t[2] : null, { verts, faces: fs } = mesh(cut(zMin));
    geo = { at: verts.map((p) => xf.apply(m, p)), faces: fs };
  };
  build();
  const [rt, zt] = profile[profile.length - 1];
  const solid = {
    id: ++ids, g, decals, kind: "lathe", structure, home: [...at],
    pose(next) { if (xf.same(next, m)) return; still(solid); m = next; build(); solid.dirty = true; },
    offset(d) { solid.pose(xf.translate(d)); },
    moveTo(p) { solid.pose(xf.translate(p.map((v, k) => v - at[k]))); },
    outline: () => shape,
    emphasis(on) { outline.classList.toggle("o-strong", !!on); },
    face(name) {
      if (name !== "top" || rt <= 1e-6) throw new Error("a lathe has one face to draw in, its flat top, and only if its profile ends with r > 0");
      return (top ??= planeFace(cam, decals, xf.apply(m, [cx, cy, z0 + zt]), xf.dir(m, [1, 0, 0]), xf.dir(m, [0, 1, 0]), 2 * rt, 2 * rt));
    },
    depth() { const c = [0, 1, 2].map((k) => geo.at.reduce((t, p) => t + p[k], 0) / geo.at.length); return cam.depth(c); },
    bounds() { return { min: [0, 1, 2].map((k) => Math.min(...geo.at.map((p) => p[k]))), max: [0, 1, 2].map((k) => Math.max(...geo.at.map((p) => p[k]))) }; },
    draw() {
      // a smooth round surface (a ball, a globe) takes its tones without the line where they meet
      shape = painter.draw(geo.at, geo.faces, { edges: smooth ? "none" : "tone", corner: false });
      outline.setAttribute("d", closed(shape));
      if (top) {
        top.place(xf.apply(m, [cx, cy, z0 + zt]), xf.dir(m, [1, 0, 0]), xf.dir(m, [0, 1, 0]));
        const n = xf.dir(m, [0, 0, 1]), v = cam.toViewer;
        top.g.style.display = n[0] * v[0] + n[1] * v[1] + n[2] * v[2] > 1e-6 ? "" : "none";
      }
    },
  };
  return sc.add(solid);
}

/**
 * A push button, modelled as one: a domed cap of radius r sitting in its collar, the collar as structure on the
 * surface at `at`, the two joined (the cap goes into its collar, so they are one assembly). Returns { cap, collar };
 * give the cap to interact with gesture press(), no deeper than its skirt. dome is the crown's height as a share of r;
 * a flat-topped cap (dome: 0) has a "top" face for an icon.
 */
function button(sc, { at = [0, 0, 0], r = 6, dome = 0.42, skirt = 1.8 } = {}) {
  const [x, y, z] = at, w = Math.max(1, r * 0.2);
  const collar = lathe(sc, { at: [x, y, z], profile: [[r + w, 0], [r + w, w * 0.6], [r + w * 0.6, w * 0.9], [r + 0.3, w * 0.9]], structure: true });
  const crown = dome > 0 ? [20, 35, 50, 62, 74, 84, 90].map((d) => [r * Math.cos(rad(d)), skirt + r * dome * Math.sin(rad(d))]) : [[r * 0.94, skirt + 0.5]];
  // the cap sits in the collar's hole: below the collar's top it is out of sight, so pressed it sinks in, behind the rim
  const cap = lathe(sc, { at: [x, y, z + w * 0.5], profile: [[r, 0], [r, skirt], ...crown], seat: z + w * 0.9 });
  sc.join(collar, cap);
  return { cap, collar };
}

/** Points along a circular arc for a rod's bend: centre c, radius, from and to in degrees, in the plane of u and v. */
function arc(c, radius, from, to, { u = [1, 0, 0], v = [0, 0, 1], steps = 16 } = {}) {
  const out = [];
  for (let k = 0; k <= steps; k++) {
    const a = rad(from + ((to - from) * k) / steps), x = radius * Math.cos(a), y = radius * Math.sin(a);
    out.push([c[0] + u[0] * x + v[0] * y, c[1] + u[1] * x + v[1] * y, c[2] + u[2] * x + v[2] * y]);
  }
  return out;
}

/** A pipe along a path of world points, radius r, as joined tubes with a collar at each bend. Horizontal runs only. */
function pipe(sc, { points, r = 4, structure = false }) {
  const parts = [];
  for (let i = 0; i + 1 < points.length; i++) parts.push(tube(sc, { from: points[i], to: points[i + 1], r0: r, r1: r, structure }));
  for (let i = 1; i + 1 < points.length; i++) parts.push(cylinder(sc, { at: [points[i][0], points[i][1], points[i][2] - r * 1.15], r: r * 1.15, h: r * 2.3, structure }));
  sc.join(...parts);
  return parts;
}

/* ----------------------------------------------------------------- faces */

/**
 * A plane to draw in: origin o, unit directions u (across) and v (down), in
 * world space. Everything drawn into face.g is in world units on that plane,
 * mapped to the screen by one affine transform; strokes keep their weight.
 */
function planeFace(cam, parent, o, u, v, w, h) {
  const g = el("g", { cls: "o-face" }, parent);
  const face = {
    g, w, h, scale: cam.scale,
    /** The face's linear map to the screen, [a, b, c, d]: (s, t) lands at s * (a, b) + t * (c, d) from its origin. */
    m: [1, 0, 0, 1],
    /** Called after each place(): what is drawn at a fixed screen angle (blue hatching, H1) redraws itself. */
    placed: new Set(),
    place(o2, u2 = u, v2 = v) {
      o = o2; u = u2; v = v2;
      const E = cam.project(o), U = cam.project([o[0] + u[0], o[1] + u[1], o[2] + u[2]]), V = cam.project([o[0] + v[0], o[1] + v[1], o[2] + v[2]]);
      face.m = [U[0] - E[0], U[1] - E[1], V[0] - E[0], V[1] - E[1]];
      face.E = E;
      g.setAttribute("transform", `matrix(${[...face.m, E[0], E[1]].map((n) => r2(n * 1000) / 1000).join(" ")})`);
      for (const f of face.placed) f();
    },
    /** The world point at (s, t) on this face. */
    at(s, t) { return [o[0] + u[0] * s + v[0] * t, o[1] + u[1] * s + v[1] * t, o[2] + u[2] * s + v[2] * t]; },
    /** The face's (s, t) for a world point on (or over) its plane. */
    local(p) {
      const d = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
      return [d[0] * u[0] + d[1] * u[1] + d[2] * u[2], d[0] * v[0] + d[1] * v[1] + d[2] * v[2]];
    },
  };
  face.place(o, u, v);
  return face;
}

/** Dots on a face: screws, LEDs. cls "o-mark" (dark), "o-idle" (grey) or "o-faint" (lighter grey). */
function dots(face, points, r = 1, cls = "o-mark") {
  return points.map(([s, t]) => el("circle", { cx: s, cy: t, r, cls }, face.g));
}
/** A ring on a face; dashed unless solid is true. */
function ring(face, [s, t], r, { cls = "o-detail", dashed = true } = {}) {
  return el("circle", { cx: s, cy: t, r, cls: cls + (dashed ? " o-dashed" : "") + " o-nofill" }, face.g);
}
/** An engraved label on a face, in mono caps. size is the cap height's em, in world units. Use only when the object would carry it. */
function label(face, text, [s, t], size = 4) {
  const node = el("text", { x: s, y: t, cls: "o-label", "font-size": size }, face.g);
  node.textContent = String(text).toUpperCase();
  return node;
}
/** A row of n short slanted slots, a vent: from (s, t), each len long, gap apart. */
function slots(face, [s, t], n = 6, { len = 3, gap = 1.6, slant = 0.6 } = {}) {
  let d = "";
  for (let i = 0; i < n; i++) d += `M${r2(s + i * gap)} ${r2(t)}l${r2(slant)} ${r2(-len)}`;
  return el("path", { d, cls: "o-detail o-nofill" }, face.g);
}
/** A rounded rectangle on a face. */
function panel(face, [s0, t0, s1, t1], r = 1, cls = "o-detail o-nofill") {
  return el("rect", { x: s0, y: t0, width: s1 - s0, height: t1 - t0, rx: r, cls }, face.g);
}
/** Grey hatching on a face, inside [s0, t0, s1, t1]: lines along t, gap apart. Texture only. */
function hatch(face, [s0, t0, s1, t1], gap = 1.6, cls = "o-hatch") {
  let d = "";
  for (let s = s0 + gap / 2; s < s1; s += gap) d += `M${r2(s)} ${r2(t0)}V${r2(t1)}`;
  return el("path", { d, cls: cls + " o-nofill" }, face.g);
}
/**
 * Lines printed on a face, along paths of world points on (or seen through) its plane: a seam, a map's coastlines.
 * cls "o-detail", or "o-hatch" for a fainter line. Returns { node, set(paths) }, set redrawing them. Drawn in screen
 * space from the face's own (s, t), redrawn as the face moves, so long lines measure where they are drawn.
 */
function trace(face, paths = [], cls = "o-detail") {
  const node = el("path", { cls: cls + " o-nofill" }, face.g.parentNode);
  let loc = [];
  const draw = () => {
    const [a, b, c, d] = face.m, [ex, ey] = face.E;
    node.setAttribute("d", loc.map((p) => line(p.map(([s, t]) => [ex + s * a + t * c, ey + s * b + t * d]))).join(""));
  };
  face.placed.add(draw);
  const set = (ps) => { loc = ps.map((p) => p.map((q) => face.local(q))); draw(); };
  set(paths);
  return { node, set };
}
const GRID_MIN = 28;
/**
 * The floor's tile grid over [x0, y0, x1, y1] in world units, cell apart, fading out towards its edge.
 * Returns the floor face it is drawn in: texture drawn there (hatched tiles) goes with the grid when
 * the grid is turned off (rule F1).
 */
function grid(sc, [x0, y0, x1, y1], cell = 20) {
  const f = sc.floorFace();
  // never denser than GRID_MIN viewBox units between lines on screen: a tile is coarsened by whole steps (G1)
  const o = sc.cam.project([0, 0, 0]), ex = sc.cam.project([1, 0, 0]), ey = sc.cam.project([0, 1, 0]);
  const X = [ex[0] - o[0], ex[1] - o[1]], Y = [ey[0] - o[0], ey[1] - o[1]], cross = Math.abs(X[0] * Y[1] - X[1] * Y[0]);
  const gapPerUnit = Math.min(cross / Math.hypot(...Y), cross / Math.hypot(...X));   // screen distance between lines one unit apart
  cell *= Math.max(1, Math.ceil(GRID_MIN / (cell * gapPerUnit)));
  let d = "";
  for (let x = x0; x <= x1 + 1e-6; x += cell) d += `M${r2(x)} ${r2(y0)}V${r2(y1)}`;
  for (let y = y0; y <= y1 + 1e-6; y += cell) d += `M${r2(x0)} ${r2(y)}H${r2(x1)}`;
  const id = "o-fade" + ++ids, defs = el("defs", {}, sc.svg);
  const gr = el("radialGradient", { id: id + "g", cx: 0.5, cy: 0.5, r: 0.5 }, defs);
  el("stop", { offset: 0.35, "stop-color": "#fff" }, gr);
  el("stop", { offset: 1, "stop-color": "#fff", "stop-opacity": 0 }, gr);
  const m = el("mask", { id, maskContentUnits: "objectBoundingBox" }, defs);
  el("rect", { width: 1, height: 1, fill: `url(#${id}g)` }, m);
  f.g.setAttribute("mask", `url(#${id})`);
  f.g.classList.add("o-gridlayer");
  el("path", { d, cls: "o-grid o-nofill" }, f.g);
  return f;
}

/* ----------------------------------------------------------------- focus */

const FADE = 140;
/** How far apart blue hatch lines are on screen, in viewBox units, on every face of every figure (H1). */
const HATCH_GAP = 3;
/** Their one angle on screen, whatever the face: 45° clockwise from the horizontal, top left to bottom right (H1). */
const HATCH_ANGLE = 45;
/**
 * Blue hatch lines over [s0, t0, s1, t1] on a face, as a path in its (s, t): at HATCH_ANGLE on screen and
 * HATCH_GAP apart there, whichever way the face turns. Lines are levels of one screen measure, so they stay
 * fixed to the face and a moving area uncovers them.
 */
function blueHatch(face, [s0, t0, s1, t1], polys = null) {
  const [a, b, c, d] = face.m, k = rad(HATCH_ANGLE), n = [-Math.sin(k), Math.cos(k)];   // the lines' screen normal
  const m = [a * n[0] + b * n[1], c * n[0] + d * n[1]], mm = Math.hypot(...m);           // that normal's measure in (s, t)
  if (mm < 1e-6) return "";                                                               // the face is edge-on
  const e = [-m[1] / mm, m[0] / mm], cs = (s0 + s1) / 2, ct = (t0 + t1) / 2;
  const lv = [[s0, t0], [s1, t0], [s0, t1], [s1, t1]].map(([s, t]) => m[0] * s + m[1] * t);
  let out = "";
  for (let L = Math.ceil(Math.min(...lv) / HATCH_GAP) * HATCH_GAP; L <= Math.max(...lv); L += HATCH_GAP) {
    const off = (L - (m[0] * cs + m[1] * ct)) / (mm * mm), ps = cs + m[0] * off, pt = ct + m[1] * off;
    // trimmed to the box, so the hatching reaches no further than what it fills
    let lo = -Infinity, hi = Infinity;
    for (const [p, q, a0, a1] of [[ps, e[0], s0, s1], [pt, e[1], t0, t1]]) {
      if (Math.abs(q) < 1e-9) continue;
      const u0 = (a0 - p) / q, u1 = (a1 - p) / q;
      lo = Math.max(lo, Math.min(u0, u1)); hi = Math.min(hi, Math.max(u0, u1));
    }
    if (hi - lo <= 1e-6) continue;
    if (!polys) { out += `M${r2(ps + e[0] * lo)} ${r2(pt + e[1] * lo)}L${r2(ps + e[0] * hi)} ${r2(pt + e[1] * hi)}`; continue; }
    // an area's lines are cut to its outline here, not only clipped, so each line is only as long as it is drawn
    // and the hatching measures where it shows (C1)
    const cuts = [];
    for (const poly of polys) for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], d = [b[0] - a[0], b[1] - a[1]], den = e[0] * d[1] - e[1] * d[0];
      if (Math.abs(den) < 1e-12) continue;
      const u = ((a[0] - ps) * d[1] - (a[1] - pt) * d[0]) / den, w = ((a[0] - ps) * e[1] - (a[1] - pt) * e[0]) / den;
      if (w >= 0 && w < 1) cuts.push(u);
    }
    cuts.sort((x, y) => x - y);
    for (let k = 0; k + 1 < cuts.length; k += 2) {
      const u0 = Math.max(lo, cuts[k]), u1 = Math.min(hi, cuts[k + 1]);
      if (u1 - u0 > 1e-6) out += `M${r2(ps + e[0] * u0)} ${r2(pt + e[1] * u0)}L${r2(ps + e[0] * u1)} ${r2(pt + e[1] * u1)}`;
    }
  }
  return out;
}
/** move(face, at) for a focus mark: it fades out where it is and in where it goes (rule I6). */
function traveller(node, face, at, put) {
  node.classList.add("o-travel");
  let here = face, where = at, timer = 0;
  return (face2, at2 = where) => {
    if (face2 === here && at2.length === where.length && at2.every((v, i) => v === where[i])) { clearTimeout(timer); node.classList.remove("o-out"); return; }
    here = face2; where = at2;
    clearTimeout(timer);
    if (motion.reduced) { put(face2, at2); return; }
    node.classList.add("o-out");
    timer = setTimeout(() => { put(here, where); node.classList.remove("o-out"); }, FADE);
  };
}

/**
 * The focus: the one blue thing in a figure. area(face) hatches a region of a
 * face in blue lines (one screen angle and spacing for every face, H1) with a thin blue edge, and no fill (a beam on the floor, a path, a zone),
 * given its outline as world points; patch() hatches a rounded rectangle on a
 * face; beam() is an area that starts at its source. The focus is always blue
 * hatching (F2): ping(), led() and edge() are refused.
 * Each returns a handle whose set() moves it; set(null) clears an area.
 */
const focus = {
  area(face) {
    const g = el("g", { cls: "o-focus-area" }, face.g);
    const id = "o-clip" + ++ids;
    const clip = el("path", {}, el("clipPath", { id }, g));
    const tint = el("path", { cls: "o-focus-tint" }, g);
    const lines = el("path", { cls: "o-focus o-nofill o-thin", "clip-path": `url(#${id})` }, g);
    const edge = el("path", { cls: "o-focus o-nofill o-thin" }, g);
    let here = face, last = null, box = null, polys = null;
    const draw = () => lines.setAttribute("d", box ? blueHatch(here, box, polys) : "");
    const seen = new Set(), hook = (f) => { if (!seen.has(f)) { seen.add(f); f.placed.add(() => here === f && draw()); } };
    hook(face);
    // the area's outline: one, or several apart that make one focus (the lines of a typed page)
    const many = (pts) => !!pts && pts.length > 0 && Array.isArray(pts[0]) && Array.isArray(pts[0][0]);
    const put = (locs, f) => {
      if (f !== here) { here = f; last = null; hook(f); }
      const shapes = locs.filter((l) => l.length > 2), d = shapes.map(closed).join("");
      if (d === last) return;
      last = d;
      for (const n of [clip, tint, edge]) n.setAttribute("d", d);
      box = null; polys = shapes.length ? shapes : null;
      if (d) {
        box = [Infinity, Infinity, -Infinity, -Infinity];
        for (const [s, t] of shapes.flat()) box = [Math.min(box[0], s), Math.min(box[1], t), Math.max(box[2], s), Math.max(box[3], t)];
      }
      draw();
    };
    const local = (points, f) => (!points ? [] : many(points) ? points.map((pl) => pl.map((p) => f.local(p))) : [points.map((p) => f.local(p))]);
    /** The area's outline, as world points on the face's plane (by default the one it is on), or a list of outlines
     *  that together make the one focus; null clears it. */
    const set = (points, f = here) => put(local(points, f), f);
    // move(face, points) takes the area to another part, fading across (I6), as a patch's move does; the points are
    // read on that face as it is now, so a part that starts to move during the fade still gets its own outline
    const travel = traveller(g, face, [], (f, loc) => { f.g.appendChild(g); put(loc, f); });
    return { g, set, move: (f, points) => travel(f, local(points, f)) };
  },
  /**
   * The whole of a part as the focus: every face of it the viewer sees, hatched as one, its silhouette edge to edge
   * (F4): a hammer's head, a key. solids: one solid, or several that make one part (a key's bow and blade). It rides
   * with the part wherever the part moves, and is drawn with each solid, so what stands in front still covers it.
   */
  solid(solids) {
    const list = [solids].flat(), groups = [];
    list.forEach((x, i) => {
      // one focus: the first group is the mark, the rest are its parts
      // first in the solid's lines, so its edges, its details (a key's cuts, a vent) and its outline all read over it
      const layer = x.g.querySelector(".o-l-lines");
      const g = el("g", { cls: i ? "o-focus-area o-focus-part" : "o-focus-area o-focus-body" });
      layer.insertBefore(g, layer.firstChild);
      const id = "o-clip" + ++ids, clip = el("path", {}, el("clipPath", { id }, g));
      const tint = el("path", { cls: "o-focus-tint" }, g);
      const lines = el("path", { cls: "o-focus o-nofill o-thin", "clip-path": `url(#${id})` }, g);
      const edge = el("path", { cls: "o-focus o-nofill o-thin" }, g);
      const screen = { m: [1, 0, 0, 1] };
      const redraw = () => {
        const shape = x.outline() ?? [];
        const d = shape.length > 2 ? closed(shape) : "";
        for (const n of [clip, tint, edge]) n.setAttribute("d", d);
        if (!d) { lines.setAttribute("d", ""); return; }
        const xs = shape.map((p) => p[0]), ys = shape.map((p) => p[1]);
        lines.setAttribute("d", blueHatch(screen, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], [shape]));
      };
      const draw0 = x.draw;
      x.draw = function () { draw0.apply(this, arguments); redraw(); };
      groups.push({ g, redraw });
      redraw();
    });
    return { g: groups[0].g, set() { groups.forEach((q) => q.redraw()); } };
  },
  /**
   * A patch: blue hatching in a rounded rectangle [s0, t0, s1, t1] on a face, with a thin blue edge: the live
   * unit's lid, a drawer's label holder, a chest panel. r rounds its corners (half its shorter side makes a disc);
   * a fifth number in the rectangle rounds that one alone, for parts of different shapes.
   * move(face, rect) takes it to another part, fading across (I6). Make it big enough to show its hatching: at
   * least three lines (C10).
   */
  patch(face, rect, { r = 1 } = {}) {
    const g = el("g", { cls: "o-focus-area o-focus-patch" }, face.g);
    const id = "o-clip" + ++ids;
    const clip = el("rect", {}, el("clipPath", { id }, g));
    const tint = el("rect", { cls: "o-focus-tint" }, g);
    const lines = el("path", { cls: "o-focus o-nofill o-thin", "clip-path": `url(#${id})` }, g);
    const edge = el("rect", { cls: "o-focus o-nofill o-thin" }, g);
    let here = face, box = rect;
    const draw = () => lines.setAttribute("d", blueHatch(here, box)), seen = new Set();
    const set = ([s0, t0, s1, t1, rc = r], f = here) => {
      here = f; box = [s0, t0, s1, t1];
      if (!seen.has(f)) { seen.add(f); f.placed.add(() => here === f && draw()); }
      const rr = Math.min(rc, (s1 - s0) / 2, (t1 - t0) / 2);
      for (const n of [clip, tint, edge]) { n.setAttribute("x", s0); n.setAttribute("y", t0); n.setAttribute("width", s1 - s0); n.setAttribute("height", t1 - t0); n.setAttribute("rx", rr); }
      draw();
    };
    set(rect);
    return { g, set, move: traveller(g, face, rect, (f, rc) => { f.g.appendChild(g); set(rc, f); }) };
  },
  /**
   * A beam: a blue area on a face that starts at its source, as wide as the source, and opens out (B1).
   * set({ from, angle, width, spread, reach }) in world units and degrees; from is the source's centre on the face's plane.
   */
  beam(face) {
    const area = focus.area(face);
    return {
      g: area.g,
      set({ from, angle, width, spread = 20, reach = 60 }) {
        const a = rad(angle), d = [Math.cos(a), Math.sin(a)], n = [-d[1], d[0]], w = width / 2, z = from[2], pts = [];
        pts.push([from[0] + n[0] * w, from[1] + n[1] * w, z]);
        for (let k = 0; k <= 16; k++) {
          const b = a + rad(spread) - (2 * rad(spread) * k) / 16;
          pts.push([from[0] + reach * Math.cos(b), from[1] + reach * Math.sin(b), z]);
        }
        pts.push([from[0] - n[0] * w, from[1] - n[1] * w, z]);
        area.set(pts);
      },
    };
  },
  // the focus is always blue hatching (F2): a dot or a lit outline is refused out loud
  ping() { throw new Error("F2: the focus is always blue hatching, never a dot: use focus.patch(face, [s0, t0, s1, t1]) on the part's face"); },
  led() { throw new Error("F2: the focus is always blue hatching, never a lit dot: use focus.patch(face, [s0, t0, s1, t1]) round the indicator, or on the panel it lights"); },
  edge() { throw new Error("F2: the focus is always blue hatching, never an outline: use focus.patch on a face of the object, or focus.area round it"); },
};

/* ----------------------------------------------------------------- hover */

function inside([x, y], poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * Hover over a scene's targets, with intent (RULES.md, S4, S5, I2, I3, I4).
 * targets: [{ solid, ... }], any shape the figure likes; call it once the
 * scene is drawn at rest, since rest silhouettes are the hit areas. change(t)
 * is called with the new target, or null for rest. move(point) also reports
 * every pointer move, for figures that follow the pointer between targets,
 * and leave() when the pointer leaves the figure.
 * Returns { current, pick(t), release() }.
 */
function hover(ctx, sc, targets, { change, move, leave, dwell = 90, linger = 180, slow = 0.25 } = {}) {
  const solidsOf = (t) => t.solids ?? [t.solid];
  const rest = new Map(targets.map((t) => [t, solidsOf(t).map((s) => s.outline().slice())]));
  targets.forEach((t, i) => solidsOf(t).forEach((s) => { s.g.dataset.oTarget = String(i); }));
  ctx.hovers?.push({ targets, sc });
  const state = { current: null };
  let pending = null, since = 0, timer = 0, last = null, speed = 0;
  // What is under the pointer is the front-most solid whose silhouette holds it, as drawn now, in paint
  // order (S4): a target, or structure that blocks the pointer. Only where nothing is hit does the picked
  // target keep its rest spot, so a part that moves away from the pointer is not dropped (S5).
  const under = (p) => {
    const order = sc.order.length ? sc.order : sc.solids;
    for (let i = order.length - 1; i >= 0; i--) {
      if (!(order[i].hit ? order[i].hit(p) : inside(p, order[i].outline?.() ?? []))) continue;
      return targets.find((x) => solidsOf(x).includes(order[i])) ?? null;
    }
    const cur = state.current;
    return cur && rest.get(cur).some((o) => inside(p, o)) ? cur : null;
  };
  const commit = (t) => {
    clearTimeout(timer);
    if (t === state.current) return;
    state.current = t;
    change?.(t);
  };
  // A new target is taken when the pointer is slow over it, or has paused on it for `dwell`;
  // every move resets the pause, so a fast sweep takes nothing until it slows or stops (I2).
  // Rest is taken only after `linger` off every target (I3).
  const consider = (now) => {
    clearTimeout(timer);
    if (pending === state.current) return;
    if (!pending) { timer = setTimeout(() => commit(null), linger); return; }
    if (speed < slow && now - since >= 30) return commit(pending);
    timer = setTimeout(() => commit(pending), dwell);
  };
  ctx.onPointer({
    move(p, e) {
      // a tap picks at once, and the pick stays until a tap elsewhere (touch has no hover to read intent from)
      if (e?.pointerType === "touch" && e.type === "pointerdown") { pending = under(p); commit(pending); move?.(p, state.current); return; }
      const now = e?.timeStamp ?? performance.now();
      if (last) {
        const d = Math.hypot(p[0] - last.p[0], p[1] - last.p[1]), dt = Math.max(1, now - last.t);
        speed = speed * 0.6 + (d / dt) * 0.4;
      }
      last = { p, t: now };
      const t = under(p);
      if (t !== pending) { pending = t; since = now; }
      consider(now);
      move?.(p, state.current);
    },
    leave(e) {
      if (e?.pointerType === "touch") return;
      pending = null; since = performance.now(); last = null; speed = 0; consider(since); leave?.();
    },
  });
  const doc = ctx.host.ownerDocument, outside = (e) => { if (!ctx.host.contains(e.target) && state.current) { pending = null; commit(null); leave?.(); } };
  doc.addEventListener("pointerdown", outside);
  ctx.add(() => { clearTimeout(timer); doc.removeEventListener("pointerdown", outside); });
  return Object.assign(state, { pick: (t) => { pending = t; commit(t); }, release: () => { pending = null; commit(null); } });
}

/* -------------------------------------------------------------- gestures */

/**
 * Gestures: what a part does when it is picked, the way the real object would. Three kinds:
 *   pose  it springs there while picked and back on release: lift, slide, press, hinge
 *   act   it plays once on pick and ends where it began: spin (n turns), hop, riffle, rock
 *   hold  it runs while picked, then settles: spin({ held: true }), bob, beat, sweep
 * Every gesture takes { solids } (the part's own by default: give a subset to move one piece, the antenna
 * of a head), { delay } in ms (follow-through: the head lifts, then the antenna starts) and, for those that
 * turn, { pivot, axis }. A part's gestures nest: each after the first acts in the part's own frame, as if
 * the ones before had not happened, so [lift(4), spin({ solids: [vane] })] spins the vane about its own
 * axis and lifts it with the head. Motion stays calm (RULES.md M1-M4): springs never bounce, acts end
 * where they began within a budget, holds settle when the pointer leaves, and under reduced motion only
 * the poses land, at once.
 */
const gesture = (kind, o, at, extra = {}) => ({
  kind, at, solids: o.solids ?? null, delay: o.delay ?? 0, ms: o.ms ?? 640, stagger: o.stagger ?? 0,
  period: o.period ?? 1000, pivot: o.pivot ?? null, axis: o.axis ?? "z", ...extra,
});
const progress = (st, g, i) => clamp((st.e - i * g.stagger) / g.ms, 0, 1);
/** Straight up, n units, while picked. */
const lift = (n, o = {}) => gesture("pose", o, (st) => xf.translate([0, 0, n * st.k]));
/** Along a rail, d = [dx, dy, dz], while picked: a drawer, a rack unit. */
const slide = (d, o = {}) => gesture("pose", o, (st) => xf.translate(d.map((v) => v * st.k)));
/** Along d, as far as the hand drags it: a pull cord, a lever, a handle. It follows the pointer from rest towards d,
 *  giving less the further it goes, and springs home when let go; interact's drop(part, amount) hears the release. */
const drag = (d, o = {}) => gesture("pose", o, (st) => xf.translate(d.map((v) => v * (st.drag ?? st.k))), { drag: d });
/** About { pivot, axis }, as far as the hand drags it sideways, up to { angle } either way: a pendant on its chain, a
 *  sign on its hook. Positive angle swings to the viewer's right as the hand goes right; springs home when let go. */
/** Once, along d, when a dragged part is let go, scaled by how far it was dragged: a pull cord's bounce on its chain as
 *  it snaps home. One dip and back, never an oscillation (I5); give it a delay so it lands as the part arrives. */
const recoil = (d, o = {}) => gesture("release", { ms: 460, ...o }, (st, i, sl) => xf.translate(d.map((v) => v * (st.amp ?? 1) * Math.sin(Math.PI * progress(st, sl.g, i)))));
const tilt = (o) => gesture("pose", o, (st, i, sl) => xf.rotate(sl.axis, (o.angle ?? 20) * (st.side ?? st.k), sl.pivot), { tilt: true });
/** Straight down, n units, while picked: a button, a key. */
const press = (n, o = {}) => gesture("pose", o, (st) => xf.translate([0, 0, -n * st.k]));
/** Taller by `by` times its height while picked, from its base (pivot's z, the floor by default): a bar on a chart rising. */
const grow = (by, o = {}) => gesture("pose", o, (st, i, sl) => xf.stretch(1 + (by - 1) * st.k, o.pivot ? o.pivot[2] : 0));
/** Turns `angle` degrees about `axis` through `pivot` while picked: an arm at the shoulder, a lid at its hinge. */
const hinge = (o) => gesture("pose", o, (st, i, sl) => xf.rotate(sl.axis, (o.angle ?? 90) * st.k, sl.pivot));
/**
 * Spins about `axis` (z by default) through `pivot` (the solids' centre by default). Once on pick, `turns`
 * turns in `ms`; or with { held: true }, round and round every `period` ms while picked, settling on release
 * at the next turn, or the next of `sym` equal positions (a two-bladed vane: sym 2).
 */
const spin = (o = {}) => o.held
  ? gesture("hold", { period: 900, ...o }, (st, i, sl) => xf.rotate(sl.axis, 360 * st.phase, sl.pivot), { settle: "whole", sym: o.sym ?? 1 })
  : gesture("act", { ms: 720, ...o }, (st, i, sl) => xf.rotate(sl.axis, 360 * (o.turns ?? 1) * easeOut(progress(st, sl.g, i)), sl.pivot));
/** Up `h` and back down once, on pick: a rocket's hop. With { stagger } each solid goes in turn. */
const hop = (h = 8, o = {}) => gesture("act", { ms: 620, ...o }, (st, i, sl) => xf.translate([0, 0, h * Math.sin(Math.PI * progress(st, sl.g, i))]));
/** Cards riffling: each solid hops a little, one after another. */
const riffle = (h = 3, o = {}) => hop(h, { ms: 360, stagger: 60, ...o });
/** Tips `angle` degrees about `axis` through `pivot` and back, once: a parcel nudged, a nod. */
const rock = (o) => gesture("act", { ms: 600, ...o }, (st, i, sl) => xf.rotate(sl.axis, (o.angle ?? 10) * Math.sin(Math.PI * progress(st, sl.g, i)), sl.pivot));
/** Rises and falls `h` every `period` ms while picked; with { stagger } (a share of a cycle) as a wave across the solids. */
const bob = (h = 2.5, o = {}) => gesture("hold", { period: 900, ...o }, (st, i, sl) => xf.translate([0, 0, st.level * h * (1 - Math.cos(2 * Math.PI * (st.phase - i * (o.stagger ?? 0)))) / 2]), { settle: "fade" });
/** Swings `angle` degrees either way about `axis` through `pivot` while picked: a baton beating time. */
const beat = (o) => gesture("hold", { period: 760, ...o }, (st, i, sl) => xf.rotate(sl.axis, st.level * (o.angle ?? 16) * Math.sin(2 * Math.PI * st.phase), sl.pivot), { settle: "fade" });
/** Circles `r` units about where it stands, on the level, while picked: a magnifier scanning. */
const sweep = (r = 3, o = {}) => gesture("hold", { period: 1400, ...o }, (st) => { const a = 2 * Math.PI * st.phase; return xf.translate([st.level * r * Math.cos(a), st.level * r * Math.sin(a), 0]); }, { settle: "fade" });

/** The longest an act may run, delay and stagger included, and the shortest a hold's cycle (M3). */
const ACT_MAX = 900, HOLD_MIN = 450;

/* -------------------------------------------------------------- interact */

/**
 * One part answers at a time, the way RULES.md says: the whole of a figure's
 * pointer work in one call, so no rule is left to the figure to remember.
 *
 * parts: [{ solid } or { solids: [...] }, plus anything the figure wants].
 * A part's solids are joined into one object. A part may carry its own
 * `gesture` (one, or a list that nests: see the gestures above). Options:
 *   move     { lift: n } or { slide: [dx, dy, dz] }: the gesture of every part that names none.
 *            Every motion runs on the engine's springs and tweens, never the figure's own (I5).
 *   focus    { mark, on(part) -> [face, at] }: the focus mark travels to the picked part, or to `rest` (I6);
 *            for focus.patch, on(part) -> [face, [s0, t0, s1, t1]].
 *   rest     the part the focus marks when nothing is picked.
 *   read     (part) -> the read-out's few words; "rest" when nothing is picked (I1).
 *   change   (part or null): anything else the figure does when the pick changes.
 *   follow   (point, part or null) on every pointer move, for figures that track the pointer (an aim).
 *   leave    () when the pointer leaves the figure.
 *   steps    [part or null, ...]: what phase(k) shows for a deck's step k; by default phase(0) is rest and
 *            phase(k) the k-th part.
 * The picked part's outline goes strong (I7). The figure also answers the keyboard (arrows, Home, End,
 * Escape) and a tap; mount's { play: true } walks through the parts on its own. Returns hover's handle.
 */
function interact(ctx, sc, parts, { move = null, focus: mark = null, rest = null, read = (p) => p.name ?? "part", change, follow, leave, steps = null, drop } = {}) {
  const base = move?.lift != null ? lift(move.lift) : move?.slide ? slide(move.slide) : null;
  const centre = (solids) => {
    const b = solids.map((x) => x.bounds()), lo = [0, 1, 2].map((k) => Math.min(...b.map((q) => q.min[k]))), hi = [0, 1, 2].map((k) => Math.max(...b.map((q) => q.max[k])));
    return lo.map((v, k) => (v + hi[k]) / 2);
  };
  const items = parts.map((p) => {
    const solids = p.solids ?? [p.solid];
    const slots = [p.gesture ?? base].flat().filter(Boolean).map((g) => {
      // solids may be grouped, [[body, mast], [body, mast]]: a group moves as one, so a wave keeps a mast on its body
      const groups = (g.solids ?? solids).map((x) => [x].flat()), on = groups.flat(), idx = groups.flatMap((grp, i) => grp.map(() => i));
      for (const x of on) if (x.structure) throw new Error("S3: a part that moves cannot be structure");
      if ((g.kind === "act" || g.kind === "release") && g.delay + g.ms + g.stagger * (groups.length - 1) > ACT_MAX) console.warn(`[oscillon] M3: an act on "${read(p)}" runs ${g.delay + g.ms + g.stagger * (groups.length - 1)} ms, over ${ACT_MAX}; make it quicker`);
      if (g.kind === "hold" && g.period < HOLD_MIN) console.warn(`[oscillon] M3: a hold on "${read(p)}" cycles every ${g.period} ms, under ${HOLD_MIN}; slow it down`);
      return { g, on, idx, n: groups.length, axis: g.axis, pivot: g.pivot ?? centre(on), phase: 0, level: spring(0), v: 0, a: 0, target: 0, stopping: false };
    });
    // a drag moves its solids by the sum of the drag gestures on the way to them: the reach is the furthest of them goes
    const drags = slots.filter((sl) => sl.g.drag), reach = drags.reduce((a, sl) => a.map((v, i) => v + sl.g.drag[i]), [0, 0, 0]);
    return { p, solids, slots, k: spring(0), hand: spring(0), side: spring(0), tr: -Infinity, amp: 0, drags: drags.length > 0, tilts: slots.some((sl) => sl.g.tilt), reach, t0: -Infinity, picked: false };
  });
  for (const it of items) {
    if (it.solids.length > 1) sc.join(...it.solids);
    for (const s of it.solids) s.name ??= read(it.p);
  }
  // each solid's transform: the part's gestures composed, the last innermost
  const frameOf = (it, stateOf) => {
    const M = new Map();
    for (let j = it.slots.length - 1; j >= 0; j--) {
      const sl = it.slots[j], st = stateOf(it, sl);
      sl.on.forEach((x, i) => M.set(x, xf.compose(sl.g.at(st, sl.idx[i], sl), M.get(x) ?? xf.identity())));
    }
    return M;
  };
  const live = (now) => (it, sl) => ({ k: clamp(it.k.x, 0, 1), e: reducedMotion() ? Infinity : now - (sl.g.kind === "release" ? it.tr : it.t0) - sl.g.delay, amp: it.amp, phase: sl.phase, level: clamp(sl.level.x, 0, 1), drag: sl.g.drag ? clamp(it.hand.x, 0, 1) : undefined, side: sl.g.tilt ? clamp(it.side.x, -1, 1) : undefined });
  const apply = (stateOf) => { for (const it of items) for (const [x, m] of frameOf(it, stateOf)) x.pose(m); };
  const clock = ctx.join((dt, now) => {
    let moving = false;
    for (const it of items) {
      if (it.k.step(dt)) moving = true;
      if (it.hand.step(dt)) moving = true;
      if (it.side.step(dt)) moving = true;
      for (const sl of it.slots) {
        const g = sl.g;
        if (g.kind === "act" && !reducedMotion() && now - it.t0 < g.delay + g.ms + g.stagger * (sl.n - 1) + 32) moving = true;
        if (g.kind === "release" && !reducedMotion() && now - it.tr < g.delay + g.ms + g.stagger * (sl.n - 1) + 32) moving = true;
        if (g.kind !== "hold") continue;
        const want = it.picked && !reducedMotion() && now - it.t0 >= g.delay, v0 = 1000 / g.period;
        sl.level.target = want ? 1 : 0;
        if (sl.level.step(dt)) moving = true;
        if (reducedMotion()) { sl.level.x = 0; sl.phase = g.settle === "whole" ? Math.round(sl.phase * g.sym) / g.sym : 0; sl.stopping = false; continue; }
        if (want) { sl.stopping = false; sl.phase += v0 * dt; moving = true; if (now - it.t0 < g.delay + 32) moving = true; continue; }
        if (g.settle === "whole") {
          // slow to a stop, evenly, on the next of its `sym` equal positions, no sooner than a quarter turn on
          const q = 1 / g.sym, off = sl.phase / q - Math.round(sl.phase / q);
          if (!sl.stopping && Math.abs(off) < 1e-6) continue;
          if (!sl.stopping) {
            let dist = Math.ceil(sl.phase / q - 1e-9) * q - sl.phase;
            if (dist < 0.25 * q) dist += q;
            Object.assign(sl, { stopping: true, target: sl.phase + dist, v: v0, a: (v0 * v0) / (2 * dist) });
          }
          sl.v = Math.max(0, sl.v - sl.a * dt);
          sl.phase = Math.min(sl.target, sl.phase + sl.v * dt);
          if (sl.v <= 1e-3 || sl.phase >= sl.target - 1e-6) { sl.phase = sl.target; sl.stopping = false; } else moving = true;
        } else if (sl.level.x > 1e-3) { sl.phase += v0 * dt; moving = true; } else sl.phase = 0;
      }
    }
    apply(live(now));
    sc.update();
    return moving;
  });
  const handle = hover(ctx, sc, parts, {
    change(p) {
      const now = performance.now();
      for (const it of items) {
        const was = it.picked;
        it.picked = it.p === p;
        if (it.picked && !was) it.t0 = now;
        it.k.target = it.picked ? 1 : 0;
        for (const x of it.solids) x.emphasis(it.picked);
      }
      const on = p ?? rest;
      if (mark && on) mark.mark.move(...mark.on(on));
      ctx.read(p ? read(p) : "rest");
      change?.(p);
      clock.wake();
    },
    move: follow,
    leave,
  });
  // for the checker (M1): every part through its whole motion, the others where they are; then back
  const entry = ctx.hovers?.[ctx.hovers.length - 1];
  if (entry) {
    entry.motions = items.flatMap((it) => it.slots.map((sl) => ({ part: read(it.p), kind: sl.g.kind, run: sl.g.delay + sl.g.ms + sl.g.stagger * (sl.n - 1), period: sl.g.period })));
    entry.sweep = (visit, n = 10) => {
      const now = performance.now();
      for (const it of items) {
        if (!it.slots.length) continue;
        for (let q = 0; q <= n; q++) {
          const f = q / n;
          apply((other, sl) => other === it
            ? { k: f, e: f * (sl.g.ms + sl.g.stagger * (sl.n - 1)), phase: sl.phase + f, level: 1 }
            : live(now)(other, sl));
          sc.update();
          visit(read(it.p), f);
        }
      }
      apply(live(performance.now()));
      sc.update();
    };
  }

  // the keyboard: the figure takes focus; arrows step through the parts, Escape returns to rest
  const host = ctx.host, n = parts.length;
  host.tabIndex = 0;
  host.setAttribute("role", "group");
  const key = (e) => {
    const i = parts.indexOf(handle.current), step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step) handle.pick(parts[i < 0 ? (step > 0 ? 0 : n - 1) : (i + step + n) % n]);
    else if (e.key === "Home") handle.pick(parts[0]);
    else if (e.key === "End") handle.pick(parts[n - 1]);
    else if (e.key === "Escape") { handle.release(); leave?.(); }
    else return;
    stopPlay();
    e.preventDefault();
  };
  const blur = () => { if (!ctx.host.matches(":hover")) { handle.release(); leave?.(); } };
  host.addEventListener("keydown", key);
  host.addEventListener("blur", blur);

  // play: an unseen hand picks each part in turn, then rests, until a real one arrives (for decks, thumbnails)
  let playing = false, ptimer = 0, k = -1, held = false;
  const tick = () => {
    if (!playing || held) return;
    k = (k + 1) % (n + 1);
    if (k === n) { handle.release(); leave?.(); } else handle.pick(parts[k]);
    ptimer = setTimeout(tick, k === n ? 1600 : 2200);
  };
  const startPlay = () => { if (playing || reducedMotion()) return; playing = true; ptimer = setTimeout(tick, 900); };
  const stopPlay = () => { playing = false; clearTimeout(ptimer); };
  const enter = () => { held = true; clearTimeout(ptimer); };
  const exit = () => { held = false; if (playing) { clearTimeout(ptimer); ptimer = setTimeout(tick, 1200); } };
  host.addEventListener("pointerenter", enter);
  host.addEventListener("pointerleave", exit);
  ctx.controls.play = (on) => (on ? startPlay() : (stopPlay(), handle.release()));
  if (ctx.play) startPlay();

  // steps: a deck's build. phase(0) is rest; phase(k) picks steps[k], or the k-th part
  ctx.controls.phase = (s) => {
    stopPlay();
    const p = steps ? steps[s] ?? null : s > 0 ? parts[(s - 1) % n] : null;
    if (p) handle.pick(p); else { handle.release(); leave?.(); }
  };

  // the hand: press on a part that drags and pull; it follows along its reach, giving less near the end, and stays
  // picked while held, wherever the pointer goes; let go and it springs home, and drop() hears how far it went
  let grip = null;
  const frameAt = (e) => {
    const r = ctx.svg.getBoundingClientRect(), vb = ctx.svg.viewBox.baseVal;
    return [vb.x + ((e.clientX - r.left) / r.width) * vb.width, vb.y + ((e.clientY - r.top) / r.height) * vb.height];
  };
  const grab = (e) => {
    if (e.button > 0) return;
    const it = items[Number(e.target.closest?.("[data-o-target]")?.dataset.oTarget)];
    if (!it?.drags && !it?.tilts) return;
    // the reach on screen; a part that only tilts measures its swing against a reach straight down
    const a = sc.cam.project([0, 0, 0]), b = sc.cam.project(it.drags ? it.reach : [0, 0, -20]), s = [b[0] - a[0], b[1] - a[1]];
    grip = { it, from: frameAt(e), s, len2: s[0] * s[0] + s[1] * s[1] || 1, id: e.pointerId };
    try { host.setPointerCapture(e.pointerId); } catch {}   // a synthetic press has no pointer to capture
    handle.pick(it.p);
    stopPlay();
  };
  const pull = (e) => {
    if (!grip || e.pointerId !== grip.id) return;
    const p = frameAt(e), d = [p[0] - grip.from[0], p[1] - grip.from[1]];
    const f = Math.max(0, (d[0] * grip.s[0] + d[1] * grip.s[1]) / grip.len2), h = grip.it.hand;
    if (grip.it.drags) { h.x = h.target = 1 - Math.exp(-1.4 * f); h.v = 0; }
    // sideways: across the reach, to the viewer's right positive; it gives less the further it goes
    const across = (d[0] * grip.s[1] - d[1] * grip.s[0]) / grip.len2, w = grip.it.side;
    if (grip.it.tilts) { w.x = w.target = Math.tanh(1.2 * across); w.v = 0; }
    handle.pick(grip.it.p);
    clock.wake();
  };
  const letGo = (e) => {
    if (!grip || e.pointerId !== grip.id) return;
    const { it } = grip, amount = it.hand.x;
    grip = null;
    it.hand.target = 0;
    it.side.target = 0;
    it.tr = performance.now(); it.amp = amount;
    clock.wake();
    drop?.(it.p, amount);
  };
  if (items.some((it) => it.drags || it.tilts)) {
    host.addEventListener("pointerdown", grab);
    host.addEventListener("pointermove", pull);
    host.addEventListener("pointerup", letGo);
    host.addEventListener("pointercancel", letGo);
  }

  ctx.add(() => {
    stopPlay();
    host.removeEventListener("pointerdown", grab);
    host.removeEventListener("pointermove", pull);
    host.removeEventListener("pointerup", letGo);
    host.removeEventListener("pointercancel", letGo);
    host.removeEventListener("keydown", key);
    host.removeEventListener("blur", blur);
    host.removeEventListener("pointerenter", enter);
    host.removeEventListener("pointerleave", exit);
  });
  ctx.read("rest");
  return handle;
}

/* ---------------------------------------------------------------- points */

/*
 * How Oscillon draws: as an oscilloscope traces a figure, a cloud of points on its surfaces. A figure lists surfaces,
 * each a sampler of points in the world (with the way the surface faces there); cloud() scatters points over them by
 * area, projects them with the camera, and lays each down as one faint dot. Nothing is opaque and nothing is outlined:
 * a surface seen edge-on packs its points into a narrow band, so rims and folds come out densest by themselves, and
 * where surfaces overlap the dots add up. Where a surface faces the light, points are left out, so a highlight shows
 * as the ground coming through. The look reads from the host's tokens: --o-ink (the dots), --o-w-dot (a dot's size,
 * in px), --o-d-dot (each dot's strength), --o-d-count (how many of the points are drawn), --o-d-highlight (how many
 * points the light takes out where it falls fullest: 0 none, 1 all).
 *
 *   cloud(ctx, cam, surfaces, { count, seed, pad })   draws them; fits the camera to them; redraws on theme or size
 *   surf.sphere(r, { at, weight })                    a ball
 *   surf.lathe(profile [[r, z]], { at, weight })      a turned surface: a bulb, a body, a nose
 *   surf.disc(r, { at, r0, weight })                  a flat round (or annulus, from r0) at the height of at
 *   surf.ring(R, tube, { at, weight })                a torus: a thread, a collar
 *   surf.slab([w, d, h], { at, radius, turn, weight, edge, soft })   a rounded slab, its top, bottom and walls: a tile;
 *                                         edge: the share of its points that trace its edges (0.12), so flat faces read;
 *                                         soft: how wide that trace spreads (0.3)
 *   surf.extrude(outline [[u, v]], length, { at, radius, axis, turn, weight, edge, soft })
 *                                         a convex outline with rounded corners, pushed out along axis ("x" or
 *                                         "y": u, v are then the other horizontal and z; "z": u, v are x, y): a prism
 *                                         on its side, a bar; its ends trace their outline, as a slab's do
 *   surf.edges([[a, b], ...], { thick, weight })     straight edges traced
 *   surf.curve(fn(t) -> [x, y, z], { thick, weight }) points along a path, spread thick: a filament, a trail
 *   surf.tri(a, b, c, { weight })                     a flat triangle: a fin
 *   surf.quad(a, b, c, d, { weight })                 a flat four-sided face, corners in order: a box's side
 *   surf.tilt(surface, { axis: "x" | "y" | "z", deg, pivot })   the same surface turned: a body leaning, a part swung
 *   weight: how dense a surface is against the others (the focus is the densest: weight 3 or so)
 *
 * A sampler returns [x, y, z, nx, ny, nz]: the point, and the surface's normal there ([0, 0, 0] for a trace, an edge
 * or a curve, which the light doesn't take points from).
 */
const POINTS = /*POINTS*/{ count: 120000, spot: 0.22 }/*END*/;

function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const TAU = Math.PI * 2;
const NONE = [0, 0, 0];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
/** A point and a normal turned about z by deg, the point then moved to at. */
const turnZ = (p, n, deg, at) => {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return [at[0] + p[0] * c - p[1] * s, at[1] + p[0] * s + p[1] * c, at[2] + p[2], n[0] * c - n[1] * s, n[0] * s + n[1] * c, n[2]];
};
/** Picks an index from a list of weights, by a 0-1 number. */
function pick(cum, u) { const x = u * cum[cum.length - 1]; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; } return lo; }
const cumulate = (xs) => { let s = 0; return xs.map((x) => (s += x)); };
/** A soft offset, -spread to spread, most often near 0: an edge traced as a glowing band, not a hard line. */
const bell = (rand, spread) => ((rand() + rand() + rand()) / 1.5 - 1) * spread;

/** A closed outline as a polyline, and how to sample along it: [u, v] and the outward normal there. */
function along(loop) {
  const lens = loop.slice(1).map((p, i) => Math.hypot(p[0] - loop[i][0], p[1] - loop[i][1])), cum = cumulate(lens);
  const ccw = loop.slice(1).reduce((m, p, i) => m + loop[i][0] * p[1] - p[0] * loop[i][1], 0) > 0 ? 1 : -1;
  return {
    per: cum.at(-1), ccw,
    at(rand) {
      const i = pick(cum, rand()), t = rand(), p = loop[i], q = loop[i + 1], d = norm([q[0] - p[0], q[1] - p[1], 0]);
      return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, d[1] * ccw, -d[0] * ccw];
    },
  };
}

const surf = {
  sphere(r, { at = [0, 0, 0], weight = 1 } = {}) {
    return { kind: "sphere", area: 4 * Math.PI * r * r, weight, sample(rand) {
      const z = 2 * rand() - 1, th = rand() * TAU, q = Math.sqrt(1 - z * z), n = [q * Math.cos(th), q * Math.sin(th), z];
      return [at[0] + r * n[0], at[1] + r * n[1], at[2] + r * n[2], ...n];
    } };
  },
  lathe(profile, { at = [0, 0, 0], weight = 1 } = {}) {
    const seg = profile.slice(1).map((p, i) => { const q = profile[i]; return { r0: q[0], z0: q[1], r1: p[0], z1: p[1], a: Math.hypot(p[0] - q[0], p[1] - q[1]) * Math.max(0.05, (p[0] + q[0]) / 2) * Math.PI }; });
    const cum = cumulate(seg.map((s) => s.a));
    return { kind: "lathe", area: cum.at(-1), weight, sample(rand) {
      const s = seg[pick(cum, rand())], t = rand(), r = s.r0 + (s.r1 - s.r0) * t, z = s.z0 + (s.z1 - s.z0) * t, th = rand() * TAU;
      const [nr, nz] = norm([s.z1 - s.z0, s.r0 - s.r1, 0]);   // across the profile, outwards
      return [at[0] + r * Math.cos(th), at[1] + r * Math.sin(th), at[2] + z, nr * Math.cos(th), nr * Math.sin(th), nz];
    } };
  },
  disc(r, { at = [0, 0, 0], r0 = 0, weight = 1 } = {}) {
    return { kind: "disc", area: Math.PI * (r * r - r0 * r0), weight, sample(rand) {
      const rr = Math.sqrt(r0 * r0 + rand() * (r * r - r0 * r0)), th = rand() * TAU;
      return [at[0] + rr * Math.cos(th), at[1] + rr * Math.sin(th), at[2], 0, 0, 1];
    } };
  },
  ring(R, tube, { at = [0, 0, 0], weight = 1 } = {}) {
    return { kind: "ring", area: 4 * Math.PI * Math.PI * R * tube, weight, sample(rand) {
      const th = rand() * TAU, ph = rand() * TAU, rr = R + tube * Math.cos(ph);
      return [at[0] + rr * Math.cos(th), at[1] + rr * Math.sin(th), at[2] + tube * Math.sin(ph), Math.cos(ph) * Math.cos(th), Math.cos(ph) * Math.sin(th), Math.sin(ph)];
    } };
  },
  slab([w, d, h], { at = [0, 0, 0], radius = 0, turn = 0, weight = 1, edge = 0.12, soft = 0.3 } = {}) {
    const rr = Math.min(radius, w / 2, d / 2), hw = w / 2 - rr, hd = d / 2 - rr, loop = [];
    // the outline, corner arcs joined by straights, as a closed polyline
    [[hw, hd, 0], [-hw, hd, 90], [-hw, -hd, 180], [hw, -hd, 270]].forEach(([cx, cy, a0]) => { for (let k = 0; k <= 8; k++) { const a = rad(a0 + (90 * k) / 8); loop.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); } });
    loop.push(loop[0]);
    const rim = along(loop), flat = w * d - (4 - Math.PI) * rr * rr, walls = rim.per * h;
    const inside = (x, y) => { const ax = Math.abs(x) - hw, ay = Math.abs(y) - hd; return ax <= 0 || ay <= 0 || ax * ax + ay * ay <= rr * rr; };
    const corners = rr < 0.5 ? [[w / 2, d / 2], [-w / 2, d / 2], [-w / 2, -d / 2], [w / 2, -d / 2]] : [];
    return { kind: "slab", radius: rr, area: 2 * flat + walls, weight, sample(rand) {
      if (rand() < edge) {
        // an edge: the outline round its top or bottom, or (square corners) one of the uprights
        const j = () => bell(rand, soft);
        if (corners.length && rand() < (4 * h) / (4 * h + 2 * rim.per)) { const c = corners[Math.floor(rand() * 4)]; return turnZ([c[0] + j(), c[1] + j(), rand() * h], NONE, turn, at); }
        const [u, v] = rim.at(rand);
        return turnZ([u + j(), v + j(), (rand() < 0.5 ? 0 : h) + j()], NONE, turn, at);
      }
      if (rand() < walls / (2 * flat + walls)) { const [u, v, nu, nv] = rim.at(rand); return turnZ([u, v, rand() * h], [nu, nv, 0], turn, at); }
      let x, y; do { x = (rand() - 0.5) * w; y = (rand() - 0.5) * d; } while (!inside(x, y));
      const top = rand() < 0.5;
      return turnZ([x, y, top ? h : 0], [0, 0, top ? 1 : -1], turn, at);
    } };
  },
  extrude(outline, length, { at = [0, 0, 0], radius = 0, axis = "x", turn = 0, weight = 1, edge = 0.12, soft = 0.3 } = {}) {
    // the outline inset by radius (each side moved in, consecutive sides met), then each corner an arc round it
    const n = outline.length, side = (i) => { const a = outline[i], b = outline[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return { a, d: [dx / l, dy / l] }; };
    const ccw = outline.reduce((m, p, i) => m + p[0] * outline[(i + 1) % n][1] - outline[(i + 1) % n][0] * p[1], 0) > 0 ? 1 : -1;
    const inward = (sd) => [-sd.d[1] * ccw, sd.d[0] * ccw];
    const sides = outline.map((_, i) => side(i)), inset = [];
    for (let i = 0; i < n; i++) {
      const s0 = sides[(i - 1 + n) % n], s1 = sides[i], n0 = inward(s0), n1 = inward(s1);
      const p0 = [s0.a[0] + n0[0] * radius, s0.a[1] + n0[1] * radius], p1 = [s1.a[0] + n1[0] * radius, s1.a[1] + n1[1] * radius];
      const den = s0.d[0] * s1.d[1] - s0.d[1] * s1.d[0], t = ((p1[0] - p0[0]) * s1.d[1] - (p1[1] - p0[1]) * s1.d[0]) / den;
      inset.push({ p: [p0[0] + s0.d[0] * t, p0[1] + s0.d[1] * t], from: Math.atan2(-n0[1], -n0[0]), to: Math.atan2(-n1[1], -n1[0]) });
    }
    const loop = [];
    for (const c of inset) {
      let sweep = c.to - c.from; while (sweep * ccw < 0) sweep += TAU * ccw;
      for (let k = 0; k <= 8; k++) { const a = c.from + (sweep * k) / 8; loop.push([c.p[0] + radius * Math.cos(a), c.p[1] + radius * Math.sin(a)]); }
    }
    loop.push(loop[0]);
    const rim = along(loop), walls = rim.per * length;
    const flat = Math.abs(loop.slice(1).reduce((m, p, i) => m + loop[i][0] * p[1] - p[0] * loop[i][1], 0)) / 2;
    const xs = loop.map((p) => p[0]), ys = loop.map((p) => p[1]), [u0, u1, v0, v1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const inside = (u, v) => loop.slice(1).every((p, i) => ((p[0] - loop[i][0]) * (v - loop[i][1]) - (p[1] - loop[i][1]) * (u - loop[i][0])) * ccw >= 0);
    const map = (u, v, x) => (axis === "x" ? [x, u, v] : axis === "y" ? [u, x, v] : [u, v, x]);
    const place = (u, v, x, nu, nv, nx) => turnZ(map(u, v, x), map(nu, nv, nx), turn, at);
    return { kind: "extrude", radius, area: 2 * flat + walls, weight, sample(rand) {
      if (rand() < edge) { const [u, v] = rim.at(rand), j = () => bell(rand, soft); return place(u + j(), v + j(), (rand() < 0.5 ? -length / 2 : length / 2) + j(), 0, 0, 0); }
      if (rand() < walls / (2 * flat + walls)) { const [u, v, nu, nv] = rim.at(rand); return place(u, v, (rand() - 0.5) * length, nu, nv, 0); }
      let u, v; do { u = u0 + rand() * (u1 - u0); v = v0 + rand() * (v1 - v0); } while (!inside(u, v));
      const end = rand() < 0.5 ? -1 : 1;
      return place(u, v, (end * length) / 2, 0, 0, end);
    } };
  },
  edges(segs, { thick = 0.3, weight = 1 } = {}) {
    const lens = segs.map(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])), cum = cumulate(lens);
    return { kind: "edges", area: cum.at(-1) * thick * 4, weight, sample(rand) {
      const [a, b] = segs[pick(cum, rand())], t = rand(), j = () => bell(rand, thick);
      return [a[0] + (b[0] - a[0]) * t + j(), a[1] + (b[1] - a[1]) * t + j(), a[2] + (b[2] - a[2]) * t + j(), ...NONE];
    } };
  },
  curve(fn, { thick = 0.4, weight = 1, steps = 200 } = {}) {
    let len = 0; for (let i = 1; i <= steps; i++) { const a = fn((i - 1) / steps), b = fn(i / steps); len += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); }
    return { kind: "curve", area: len * thick * 4, weight, sample(rand) {
      const p = fn(rand()), j = () => (rand() + rand() - 1) * thick;
      return [p[0] + j(), p[1] + j(), p[2] + j(), ...NONE];
    } };
  },
  tri(a, b, c, { weight = 1 } = {}) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], area = Math.hypot(...cr) / 2, n = norm(cr);
    return { kind: "tri", area, weight, sample(rand) {
      let s = rand(), t = rand(); if (s + t > 1) { s = 1 - s; t = 1 - t; }
      return [a[0] + u[0] * s + v[0] * t, a[1] + u[1] * s + v[1] * t, a[2] + u[2] * s + v[2] * t, ...n];
    } };
  },
  quad(a, b, c, d, { weight = 1 } = {}) {
    const one = surf.tri(a, b, c), two = surf.tri(a, c, d), all = one.area + two.area;
    return { kind: "quad", area: all, weight, sample: (rand) => (rand() * all < one.area ? one : two).sample(rand) };
  },
  tilt(sf, { axis = "x", deg = 0, pivot = [0, 0, 0] } = {}) {
    const c = Math.cos(rad(deg)), sn = Math.sin(rad(deg)), [i, j] = axis === "x" ? [1, 2] : axis === "y" ? [2, 0] : [0, 1];
    const turn = (q) => { const a = q[i], b = q[j]; q[i] = a * c - b * sn; q[j] = a * sn + b * c; return q; };
    return { kind: sf.kind, radius: sf.radius, area: sf.area, weight: sf.weight, sample(rand) {
      const p = sf.sample(rand), q = turn([p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2]]), m = turn([p[3] ?? 0, p[4] ?? 0, p[5] ?? 0]);
      return [q[0] + pivot[0], q[1] + pivot[1], q[2] + pivot[2], ...m];
    } };
  },
};

/** Where the light comes from, in the world: over the viewer's left shoulder, as the brand's light. */
function lightFor(cam) {
  const V = cam.toViewer, right = [Math.cos(rad(cam.angle)), -Math.sin(rad(cam.angle)), 0];
  const L = norm([0.6 * V[0] - 0.8 * right[0], 0.6 * V[1] - 0.8 * right[1], 0.6 * V[2] + 0.9]);
  return { V, H: norm([L[0] + V[0], L[1] + V[1], L[2] + V[2]]) };
}

/**
 * Draws the surfaces as one cloud of points, on a canvas over the figure's svg.
 *
 * Motion, Oscillon's own, on every figure, each off at 0 and read from the host's tokens like the look:
 *   --o-m-disperse  the pointer pushes the dots near it aside, and they drift back when it moves on (0 off, 1 full)
 *   --o-m-gather    on first draw, the dots fly in from a scatter and settle into the figure (0 off; more: further out)
 *   --o-m-shimmer   the grain flickers slowly, as a live phosphor screen does (0 off, 1 full)
 * All of it stops under prefers-reduced-motion, and the figure is drawn still.
 */
function cloud(ctx, cam, surfaces, { count = POINTS.count, seed = 7, pad = 18 } = {}) {
  const rand = mulberry(seed), cum = cumulate(surfaces.map((s) => s.area * (s.weight ?? 1)));
  const P = new Float32Array(count * 3), N = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const p = surfaces[pick(cum, rand())].sample(rand);
    P[3 * i] = p[0]; P[3 * i + 1] = p[1]; P[3 * i + 2] = p[2]; N[3 * i] = p[3] ?? 0; N[3 * i + 1] = p[4] ?? 0; N[3 * i + 2] = p[5] ?? 0;
  }
  const some = []; for (let i = 0; i < count; i += 41) some.push([P[3 * i], P[3 * i + 1], P[3 * i + 2]]);
  cam.fit(some, ctx.frame, pad);
  const [w, h] = ctx.frame, host = ctx.host, doc = host.ownerDocument, win = doc.defaultView;
  // each point's place on screen; how much the light falls on it; and a fixed chance, so the same points go each time
  // the light is turned up (and the same points flicker, and fly in from the same place)
  const S = new Float32Array(count * 2), lit = new Float32Array(count), luck = new Float32Array(count), { V, H } = lightFor(cam);
  for (let i = 0; i < count; i++) {
    const s = cam.project([P[3 * i], P[3 * i + 1], P[3 * i + 2]]); S[2 * i] = s[0]; S[2 * i + 1] = s[1];
    let nx = N[3 * i], ny = N[3 * i + 1], nz = N[3 * i + 2];
    // a back face is reflected through the view plane, not turned round: then it catches the light where the face in
    // front of it does, and the highlight goes through the whole see-through body, as one clear spot
    const nv = nx * V[0] + ny * V[1] + nz * V[2];
    if (nv < 0) { nx -= 2 * nv * V[0]; ny -= 2 * nv * V[1]; nz -= 2 * nv * V[2]; }
    // a spot with a soft rim: cleared where the surface faces the light within SPOT of full on, fading out past it
    const f = nx * H[0] + ny * H[1] + nz * H[2], e = Math.min(1, Math.max(0, (f - (1 - POINTS.spot)) / (POINTS.spot * 0.6)));
    lit[i] = e * e * (3 - 2 * e);
    luck[i] = rand();
  }
  // where each dot is pushed from its place (disperse), and where it flies in from (gather), in frame units
  const off = new Float32Array(count * 2), vel = new Float32Array(count * 2), from = new Float32Array(count * 2), cx = w / 2, cy = h / 2;
  for (let i = 0; i < count; i++) {
    const a = rand() * TAU, r = (0.4 + rand()) * Math.max(w, h) * 0.5;
    from[2 * i] = Math.cos(a) * r + (S[2 * i] - cx) * 0.6; from[2 * i + 1] = Math.sin(a) * r + (S[2 * i + 1] - cy) * 0.6;
  }
  const c = doc.createElement("canvas");
  // what this cloud is, for check(): its surfaces, its points, the camera, and where it landed in the frame
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (let i = 0; i < count; i += 7) { const x = S[2 * i], y = S[2 * i + 1]; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  const record = { count, angle: cam.angle, tilt: cam.tilt, box: [bx0, by0, bx1, by1], frame: [w, h], canvas: c,
    surfaces: surfaces.map((sf) => ({ kind: sf.kind ?? "custom", weight: sf.weight ?? 1, area: sf.area, radius: sf.radius })) };
  (host.oClouds ??= []).push(record);
  c.className = "o-cloud";
  c.setAttribute("aria-hidden", "true");
  host.insertBefore(c, ctx.svg.nextSibling);
  const num = (cs, k, d) => { const v = parseFloat(cs.getPropertyValue(k)); return Number.isFinite(v) ? v : d; };
  const still = () => win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const GATHER_MS = 1800, RADIUS = 0.16 * Math.min(w, h);

  let pointer = null, gatherAt = null, wasGather = 0, moving = false, frame = 0, settled = true, last = 0;
  // the hand, eased: where it is (following the pointer a little behind) and how present (fading in and out)
  let hx = 0, hy = 0, here = 0;
  function draw(now = performance.now()) {
    const cs = win.getComputedStyle(host), t = host.dataset.oTheme;
    const dark = t === "dark" || (t === "auto" && win.matchMedia("(prefers-color-scheme: dark)").matches);
    const k = (host.clientWidth || w) / w, dpr = win.devicePixelRatio || 1, W = Math.round(w * k * dpr), Hh = Math.round(h * k * dpr);
    if (c.width !== W || c.height !== Hh) { c.width = W; c.height = Hh; }
    const g = c.getContext("2d");
    g.setTransform(k * dpr, 0, 0, k * dpr, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, w, h);
    g.globalCompositeOperation = dark ? "lighter" : "source-over";
    // on a dark ground the dots add up as light, so each is laid down at half strength to keep rims from burning out
    g.globalAlpha = Math.min(1, Math.max(0.01, num(cs, "--o-d-dot", 0.35) * (dark ? 0.5 : 1)));
    g.fillStyle = cs.getPropertyValue("--o-ink").trim() || (dark ? "#fff" : "#000");
    const s = num(cs, "--o-w-dot", 1) / k, n = Math.round(count * Math.min(1, Math.max(0, num(cs, "--o-d-count", 1))));
    const hl = Math.min(1, Math.max(0, num(cs, "--o-d-highlight", 0)));
    const calm = still(), disperse = calm ? 0 : num(cs, "--o-m-disperse", 0), shimmer = calm ? 0 : num(cs, "--o-m-shimmer", 0), gather = calm ? 0 : num(cs, "--o-m-gather", 0);
    // gather plays when the figure is first drawn, and again whenever it's turned up from off
    if (gather > 0 && (wasGather <= 0 || gatherAt == null)) gatherAt = now;
    wasGather = gather;
    const gt = gather > 0 && gatherAt != null ? Math.min(1, (now - gatherAt) / (GATHER_MS * (0.6 + 0.4 * gather))) : 1;
    // disperse: each dot near the hand is pushed straight away from it, by a push that fades smoothly with distance;
    // each dot rides a damped spring to where it's pushed and back home, so it eases out and settles, never jumps.
    // Steps are scaled to the time since the last frame, so it moves the same at any frame rate
    let busy = false;
    const dt = Math.min(2.5, last ? (now - last) / 16.7 : 1); last = now;
    if (pointer) { if (here === 0) { hx = pointer[0]; hy = pointer[1]; } hx += (pointer[0] - hx) * Math.min(1, 0.3 * dt); hy += (pointer[1] - hy) * Math.min(1, 0.3 * dt); }
    here += ((pointer && disperse ? 1 : 0) - here) * Math.min(1, 0.12 * dt);
    if (here < 0.002) here = 0;
    const push = disperse * here * RADIUS * 0.8, sig2 = 2 * (RADIUS * 0.5) ** 2, reach2 = 9 * (RADIUS * 0.5) ** 2;
    const K = 0.05 * dt, D = Math.pow(0.8, dt);   // spring stiffness, and the damping each step
    const shim = shimmer * 0.5, phase = now / 1400;
    for (let i = 0; i < n; i++) {
      if (hl && luck[i] < lit[i] * hl) continue;   // the light takes this one: the ground shows through
      if (shim && ((luck[i] * 7.3 + phase) % 1) < shim * 0.35) continue;   // this one is between flickers
      let x = S[2 * i], y = S[2 * i + 1];
      if (disperse || off[2 * i] || off[2 * i + 1]) {
        let tx = 0, ty = 0;
        if (push) {
          const dx = x - hx, dy = y - hy, d2 = dx * dx + dy * dy;
          if (d2 < reach2) { const d = Math.sqrt(d2) || 1e-3, m = (Math.exp(-d2 / sig2) * push * (0.9 + 0.2 * luck[i])) / d; tx = dx * m; ty = dy * m; }
        }
        const j = 2 * i;
        vel[j] = (vel[j] + (tx - off[j]) * K) * D; vel[j + 1] = (vel[j + 1] + (ty - off[j + 1]) * K) * D;
        off[j] += vel[j] * dt; off[j + 1] += vel[j + 1] * dt;
        if (!tx && !ty && Math.abs(off[j]) + Math.abs(off[j + 1]) < 0.02 && Math.abs(vel[j]) + Math.abs(vel[j + 1]) < 0.01) { off[j] = 0; off[j + 1] = 0; vel[j] = 0; vel[j + 1] = 0; } else busy = true;
        x += off[2 * i]; y += off[2 * i + 1];
      }
      if (gt < 1) {
        // each dot sets off a little after the last, and comes in on an ease that slows as it lands
        const local = Math.min(1, Math.max(0, (gt - luck[i] * 0.45) / 0.55)), e = 1 - Math.pow(1 - local, 3), r = (1 - e) * gather;
        x += from[2 * i] * r; y += from[2 * i + 1] * r;
      }
      g.fillRect(x - s / 2, y - s / 2, s, s);
    }
    settled = !busy && gt >= 1 && !shimmer && here === 0;
    return !settled || (pointer && disperse > 0);
  }
  function tick(now) { frame = 0; if (draw(now)) frame = requestAnimationFrame(tick); else { moving = false; last = 0; } }
  const go = () => { if (!frame) frame = requestAnimationFrame(tick); };
  const onMove = (e) => { const r = c.getBoundingClientRect(); pointer = [((e.clientX - r.left) / r.width) * w, ((e.clientY - r.top) / r.height) * h]; go(); };
  const onLeave = () => { pointer = null; go(); };
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerleave", onLeave);
  const mo = new MutationObserver(go);
  mo.observe(host, { attributes: true, attributeFilter: ["style", "data-o-theme", "class"] });
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(go) : null;
  ro?.observe(host);
  if (draw()) go();
  ctx.add(() => { cancelAnimationFrame(frame); host.removeEventListener("pointermove", onMove); host.removeEventListener("pointerleave", onLeave); mo.disconnect(); ro?.disconnect(); c.remove(); host.oClouds = (host.oClouds ?? []).filter((r) => r !== record); });
  return { count, redraw: () => draw() };
}

/* ----------------------------------------------------------------- style */

const CSS = `
.o-fig{/*TOKENS light*/--o-ground:#f3efe6;--o-ink:#1a1a1a;--o-w-dot:1.05;--o-d-dot:0.1;--o-d-count:0.96;--o-d-highlight:0.85;--o-m-disperse:0.7;--o-m-gather:1;--o-m-shimmer:0.5;/*END*/
display:block;position:relative;user-select:none;-webkit-user-select:none;touch-action:pan-y}
.o-fig>svg{display:block;width:100%;height:auto;overflow:visible}
.o-fig>canvas.o-cloud{position:absolute;left:0;top:0;width:100%;height:auto;pointer-events:none}
.o-fig[data-o-theme="dark"]{/*TOKENS dark*/--o-ground:#000000;--o-ink:#f4f1e8;--o-w-dot:1;--o-d-dot:0.17;--o-d-count:1;--o-d-highlight:0;/*END*/}
@media (prefers-color-scheme:dark){.o-fig[data-o-theme="auto"]{/*TOKENS dark*/--o-ground:#000000;--o-ink:#f4f1e8;--o-w-dot:1;--o-d-dot:0.17;--o-d-count:1;--o-d-highlight:0;/*END*/}}
.o-fig:focus-visible{outline:1.5px solid var(--o-focus);outline-offset:4px;border-radius:8px}
.o-fig .o-live{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.o-fig svg :is(path,circle,rect,line,ellipse){vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.o-fig .o-face-top{fill:var(--o-face-top)}
.o-fig .o-face-left{fill:color-mix(in srgb,var(--o-face-left) calc(var(--o-shade)*100%),var(--o-face-top))}
.o-fig .o-face-right{fill:color-mix(in srgb,var(--o-face-right) calc(var(--o-shade)*100%),var(--o-face-top))}
.o-fig .o-outline{fill:none;stroke:var(--o-outline);stroke-width:var(--o-w-outline);transition:stroke 200ms,stroke-width 200ms}
.o-fig .o-hit{fill:none;stroke:none;pointer-events:none}
.o-fig .o-outline.o-strong{stroke:var(--o-strong);stroke-width:var(--o-w-strong)}
.o-fig .o-travel{transition:opacity 140ms ease-out}
.o-fig .o-out{opacity:0}
.o-fig.o-nogrid .o-gridlayer{display:none}
@media (prefers-reduced-motion:reduce){.o-fig .o-outline,.o-fig .o-travel{transition:none}}
.o-fig .o-edge{stroke:var(--o-edge);stroke-width:var(--o-w-edge)}
.o-fig path.o-edge:not([class*="o-face"]){fill:none}
.o-fig .o-shine{fill:none;stroke:var(--o-shine);stroke-width:1}
.o-fig .o-detail{stroke:var(--o-detail);stroke-width:var(--o-w-detail)}
.o-fig .o-grid{stroke:var(--o-grid);stroke-width:var(--o-w-detail)}
.o-fig .o-hatch{stroke:var(--o-hatch);stroke-width:var(--o-w-detail)}
.o-fig .o-mark{fill:var(--o-mark);stroke:none}
.o-fig .o-idle{fill:var(--o-idle);stroke:none}
.o-fig .o-faint{fill:var(--o-detail);stroke:none}
.o-fig .o-nofill{fill:none}
.o-fig .o-dashed{stroke-dasharray:1.5 2.5}
.o-fig .o-ping .o-dashed{stroke-dasharray:1 2.2}
.o-fig .o-label{fill:var(--o-label);stroke:none;font-family:"Geist Mono",ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.12em;font-weight:500}
.o-fig .o-focus{stroke:var(--o-focus);stroke-width:var(--o-w-focus)}
.o-fig .o-focus.o-thin{stroke-width:0.6}
.o-fig .o-focus-fill{fill:var(--o-focus);stroke:none}
.o-fig .o-focus-tint{fill:none;stroke:none;pointer-events:fill}
`;
const styled = new WeakSet();
function inject(doc) {
  if (styled.has(doc)) return;
  styled.add(doc);
  const s = doc.createElement("style");
  s.setAttribute("data-oscillon-style", "");
  s.textContent = CSS.replaceAll(".o-fig", '.o-fig[data-o-engine="oscillon"]');   // only this engine's figures
  doc.head.appendChild(s);
}

/* ----------------------------------------------------------------- check */

/** The most points a figure may draw: more and motion stutters on an ordinary laptop (P4). */
const BUDGET = 150000;
/**
 * The rules a figure breaks as drawn now (RULES.md): [{ rule, level: "fail" | "warn", says, fix }]. What it reads: the
 * clouds the figure drew (their surfaces, points, camera and place in the frame), the svg (which should be empty),
 * and the canvas's pixels (one ink, neither burnt out nor faint).
 */
function checkOscillon(host, svg, figure) {
  const out = [], say = (rule, level, says, fix) => out.push({ rule, level, says, fix });
  const clouds = host.oClouds ?? [];
  // P1: in points, and only in points
  if (!clouds.length) say("P1 points", "fail", "the figure draws no cloud", "build it from surf.* surfaces and draw them with O.cloud(ctx, O.camera(), surfaces)");
  const painted = [...svg.querySelectorAll("path, circle, rect, line, ellipse, polygon, polyline, text")].filter((n) => {
    const cs = getComputedStyle(n); return cs.display !== "none" && cs.visibility !== "hidden" && ((cs.fill !== "none" && cs.fillOpacity !== "0") || (cs.stroke !== "none" && cs.strokeOpacity !== "0"));
  });
  if (painted.length) say("P1 points", "fail", `${painted.length} shape${painted.length > 1 ? "s are" : " is"} drawn in the svg (lines or fills)`, "draw every part as a surface in the cloud; Oscillon has no outlines or faces");
  // P2: one cloud, so the dots of every part add up together and share one fit
  if (clouds.length > 1) say("P2 one cloud", "warn", `the figure draws ${clouds.length} clouds`, "list every surface in one O.cloud() call");
  const total = clouds.reduce((m, c) => m + c.count, 0);
  // P4: within the budget
  if (total > BUDGET) say("P4 budget", "fail", `${total.toLocaleString("en")} points, over the ${BUDGET.toLocaleString("en")} budget`, "lower count in O.cloud(); 60 000 to 120 000 is plenty for a figure");
  for (const c of clouds) {
    // V1: the one view
    if (Math.abs(c.angle - VIEW.angle) > 1e-6 || Math.abs(c.tilt - VIEW.tilt) > 1e-6)
      say("V1 view", "fail", `the camera is turned to ${c.angle}° / ${c.tilt}°, not ${VIEW.angle}° / ${VIEW.tilt}°`, "use O.camera() as it is; turn the object with surf.tilt instead");
    // C1: fills its frame, and stays inside it
    const [x0, y0, x1, y1] = c.box, [w, h] = c.frame, fill = Math.max((x1 - x0) / w, (y1 - y0) / h);
    if (x0 < -1 || y0 < -1 || x1 > w + 1 || y1 > h + 1) say("C1 frame", "fail", "points fall outside the frame", "leave O.cloud() to fit the camera; don't move points after it");
    if (fill < 0.6) say("C1 frame", "warn", `the figure fills ${Math.round(fill * 100)}% of its frame`, "lower pad in O.cloud(), or give the figure a frame of its own shape");
    // P3: flat solids rounded, so they read by loops, not as wireframes
    const all = c.surfaces.reduce((m, s) => m + s.area * s.weight, 0) || 1;
    const facets = c.surfaces.filter((s) => s.kind === "tri" || s.kind === "quad").reduce((m, s) => m + s.area * s.weight, 0) / all;
    if (facets > 0.3) say("P3 rounded", "warn", `${Math.round(facets * 100)}% of the figure is flat triangles and quads`, "build boxes and blocks with surf.slab or surf.extrude, radius > 0, so their edges trace loops");
    const sharp = c.surfaces.filter((s) => (s.kind === "slab" || s.kind === "extrude") && !(s.radius > 0)).length;
    if (sharp) say("P3 rounded", "warn", `${sharp} slab or extrusion with square corners`, "give it a radius (a tenth of its width or so)");
    // F1: one focus, carried by density: the densest surfaces, clearly denser than the rest
    if (!figure.study) {
      const ws = [...new Set(c.surfaces.map((s) => s.weight))].sort((a, b) => b - a), top = ws[0] ?? 1, next = ws[1] ?? 1;
      if (top < 1.3) say("F1 focus", "fail", "nothing is denser than the rest, so the figure has no focus", "give the part it's about weight 2 to 4");
      else if (top / next < 1.25) say("F1 focus", "fail", `the focus (weight ${top}) hardly stands out from the next (weight ${next})`, "make the focus at least a quarter denser than any other part, or the others lighter");
      if (top > 5) say("F1 focus", "warn", `the focus has weight ${top}`, "keep it at 4 or under, or it burns out (L2)");
    }
  }
  // L1, L2: the canvas, as drawn: one ink; not burnt out; not faint
  const cs = getComputedStyle(host), ink = cs.getPropertyValue("--o-ink").trim(), rgb = toRGB(ink);
  for (const c of clouds) {
    const d = pixels(c.canvas);
    let covered = 0, burnt = 0, off = 0, sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3]; if (a < 8) continue;
      covered++; sum += a; if (a >= 250) burnt++;
      if (rgb && a > 40 && Math.abs(d[i] - rgb[0]) + Math.abs(d[i + 1] - rgb[1]) + Math.abs(d[i + 2] - rgb[2]) > 60) off++;
    }
    if (!covered) { say("L2 density", "fail", "the canvas is empty", "check d-count and d-dot aren't 0, and that the figure has surfaces"); continue; }
    if (off / covered > 0.01) say("L1 one ink", "fail", `${Math.round((off / covered) * 100)}% of the dots aren't the ink colour`, "draw only in --o-ink; Oscillon has one ink on one ground");
    const b = burnt / covered, mean = sum / covered / 255;
    if (b > 0.08) say("L2 density", "fail", `${Math.round(b * 100)}% of the figure is burnt solid`, "lower the weights there, or count; the densest part should still show grain");
    else if (b > 0.03) say("L2 density", "warn", `${Math.round(b * 100)}% of the figure is burnt solid`, "lower the densest weights a little");
    // faint: the dots, on average, under half the strength of one dot at the agreed look (light 0.1; dark 0.17, halved)
    if (mean < 0.04) say("L2 density", "warn", "the figure is faint: its dots barely show", "raise count or the main surfaces' weights");
  }
  return out;
}
/** A canvas's pixels, read from a copy, so the figure's own canvas stays fast to draw on. */
function pixels(canvas) {
  const copy = canvas.ownerDocument.createElement("canvas"); copy.width = canvas.width; copy.height = canvas.height;
  const g = copy.getContext("2d", { willReadFrequently: true }); g.drawImage(canvas, 0, 0);
  return g.getImageData(0, 0, copy.width, copy.height).data;
}
function toRGB(c) {
  const m = /^#([0-9a-f]{6})$/i.exec(c); if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  const r = /rgba?\(([^)]+)\)/.exec(c); return r ? r[1].split(",").slice(0, 3).map(Number) : null;
}

/* ----------------------------------------------------------------- Orchestro's check, for its solids */

const BLUE = "rgb(0, 123, 255)";
/** The least share of the frame's width the subject may take (C3): a judgement, to be tuned by eye. */
const SUBJECT_MIN = 0.15;
/** The box of what a figure draws, in viewBox units, leaving out the grid layer (which bleeds by design). */
function contentBox(svg) {
  // measured on screen and mapped back, so transformed groups (faces) count where they are drawn
  const m = svg.getScreenCTM?.()?.inverse();
  if (!m) return null;
  const pt = svg.createSVGPoint();
  const toBox = (x, y) => { pt.x = x; pt.y = y; const q = pt.matrixTransform(m); return [q.x, q.y]; };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of svg.querySelectorAll(".o-solids > *, .o-floor > *:not(.o-gridlayer), .o-over > *")) {
    const r = n.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    for (const [x, y] of [toBox(r.left, r.top), toBox(r.right, r.bottom)]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
/**
 * The rules a drawn figure can be checked against (RULES.md): each finding is
 * { rule, level: "fail" | "warn", says, fix }. Run on a figure at rest.
 */
function checkFigure(svg, { hovers, subjects, control = false }) {
  const out = [], say = (rule, level, says, fix) => out.push({ rule, level, says, fix });
  const { x: vx, y: vy, width: w, height: h } = svg.viewBox.baseVal;
  const box = contentBox(svg);
  if (!box) { say("C1 frame", "fail", "the figure draws nothing", "draw into the scene in draw()"); return out; }
  if (box.x < vx - 1 || box.y < vy - 1 || box.x + box.w > vx + w + 1 || box.y + box.h > vy + h + 1)
    say("C1 frame", "fail", `the drawing reaches ${Math.round(box.x)},${Math.round(box.y)} to ${Math.round(box.x + box.w)},${Math.round(box.y + box.h)}, outside the ${Math.round(w)} × ${Math.round(h)} frame`, "fit the camera to the most extreme pose, or mount with { fit: true }");
  const cover = (box.w * box.h) / (w * h);
  if (cover < 0.3) say("C2 fill", "warn", `the drawing covers ${Math.round(cover * 100)}% of the frame`, "fit the camera to the subject rather than its surroundings, or mount with { fit: true }");
  if (!subjects.length) say("C3 subject", "warn", "the figure does not name its subject", "call ctx.subject(...solids) with the parts the figure is about");
  else {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const s of subjects) for (const [x, y] of s.outline?.() ?? []) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const sw = (x1 - x0) / w;
    if (sw < SUBJECT_MIN) say("C3 subject", "warn", `the subject is ${Math.round(sw * 100)}% of the frame's width, under ${SUBJECT_MIN * 100}%`, "make the subject bigger against its setting");
  }
  // one focus, visible (F: RULES.md I6, STYLE.md)
  // the focus is always blue hatching (F2): an area, a beam or a patch
  const marks = [...svg.querySelectorAll(".o-focus-area")].filter((n) => {
    const tint = n.querySelector(".o-focus-tint");
    const drawn = tint?.tagName === "rect" ? Number(tint.getAttribute("width")) > 0 : !!tint?.getAttribute("d");
    return drawn && getComputedStyle(n).opacity !== "0" && !n.closest(".o-out") && !n.classList.contains("o-focus-part");
  });
  // a focus on a face turned away from the viewer is hidden by the engine: it is on the wrong side of its part
  const away = (n) => { for (let p = n.parentElement; p && p !== svg; p = p.parentElement) if (p.style?.display === "none") return true; return false; };
  if (!control && [...svg.querySelectorAll(".o-focus-area")].some((n) => !n.closest(".o-out") && away(n))) say("C8 focus seen", "fail", "the focus is on a face turned away from the viewer, so it is hidden", "hatch the face of the part that faces the viewer: on a prism, the other cap (face 0 or 1)");
  if (svg.querySelector(".o-ping, .o-focus-fill, .o-focus-edge")) say("F2 hatching", "fail", "the focus is drawn as a dot or an outline", "the focus is always blue hatching: focus.patch on the part's face, focus.area or focus.beam");
  // a control (a page's own switch, figure.control) is a tool, not an illustration, and a brand mark (figure.mark) is a
  // logo, whole in itself: neither carries a focus at all
  if (control) { if (marks.length) say("C4 focus", "fail", `a control carries ${marks.length} focus mark(s)`, "a control has no focus: drop its focus.patch, area or beam"); }
  else if (marks.length !== 1) say("C4 focus", "fail", `${marks.length} focus marks at rest`, "one focus: one hatched area, beam or patch, there at rest");
  // blue nowhere but the focus
  const stray = [...svg.querySelectorAll("*")].filter((n) => {
    const cs = getComputedStyle(n);
    const blue = (cs.stroke === BLUE && cs.strokeWidth !== "0px" && cs.stroke !== "none") || cs.fill === BLUE;
    return blue && !n.closest(".o-focus-area") && !["linearGradient", "stop", "defs", "clipPath"].includes(n.tagName);
  });
  if (stray.length) say("C5 blue", "fail", `${stray.length} element(s) outside the focus draw in blue`, "blue only through focus.area, beam or patch");
  // highlights under every line (L1)
  for (const n of svg.querySelectorAll(".o-shine")) if (!n.closest(".o-l-lights")) { say("L1 highlight", "fail", "a highlight is drawn outside its solid's highlight layer", "draw highlights only through the solids"); break; }
  for (const n of svg.querySelectorAll(".o-l-faces *")) {
    if (n.classList.contains("o-bar")) continue;          // a wire's bar is drawn as wide strokes: its body, not a line
    const cs = getComputedStyle(n);
    if (cs.stroke !== "none" && cs.strokeWidth !== "0px" && n.tagName !== "stop") { say("L1 highlight", "fail", "a face draws a line, which its highlight would cross", "faces are fills only; lines go in the lines layer"); break; }
  }
  // the focus can be seen: most of it is not behind other solids (C8). A solid standing on a floor focus (a stage on
  // its path) is not hiding it: the focus runs under what stands on it, so those points do not count
  const owner = new Map();
  for (const sc of new Set(hovers.map((x) => x.sc))) for (const x of sc.solids) owner.set(x.g, x);
  const onFloor = (e) => { const g = e.closest(".o-solid"), x = g && owner.get(g); return !!x && x.bounds().min[2] <= 0.5; };
  for (const m of marks) {
    // hatching never covers what the face carries: a label, a dot (an eye, a screw), a vent or a line of detail (C11)
    const tint = m.querySelector(".o-focus-tint"), face = m.parentNode;
    if (tint && face) {
      const box = (n) => { try { return n.getBBox(); } catch { return null; } };
      const own = m.classList.contains("o-focus-patch") ? box(tint) : null;
      if (own) {
        const covered = [...face.children].filter((n) => n !== m && !n.classList.contains("o-face"))
          .flatMap((n) => (n.tagName === "g" ? [...n.querySelectorAll("text, circle, path")] : [n]))
          // labels, dots and line details (vents, text lines drawn as paths); a panel or a ring round the patch is its frame
          .filter((n) => {
            if (n.tagName === "text" || (n.tagName === "circle" && !n.classList.contains("o-nofill")) || (n.tagName === "path" && n.classList.contains("o-detail"))) return true;
            // a smaller panel inside the patch is a feature (a line of text, a key), not the patch's frame
            if (n.tagName === "rect" && n.classList.contains("o-detail")) { const b = box(n); return b && b.width * b.height < 0.6 * own.width * own.height && b.x >= own.x - 0.2 && b.y >= own.y - 0.2 && b.x + b.width <= own.x + own.width + 0.2 && b.y + b.height <= own.y + own.height + 0.2; }
            return false;
          })
          .filter((n) => { const b = box(n); return b && b.width + b.height > 0 && b.x < own.x + own.width - 0.2 && own.x < b.x + b.width - 0.2 && b.y < own.y + own.height - 0.2 && own.y < b.y + b.height - 0.2; });
        if (covered.length) say("C11 covered", "fail", `the focus hatching lies over ${covered.length} thing(s) the face carries (${[...new Set(covered.map((n) => (n.tagName === "text" ? "a label" : n.tagName === "circle" ? "a dot" : "a detail")))].join(", ")})`, "hatch a plain part of the object instead: an empty panel, a knob, a lid; never words or key features");
      }
    }
    // a patch shows at least three of its lines (C10)
    if (m.classList.contains("o-focus-patch")) {
      const k = svg.getScreenCTM?.()?.a || 1, b = m.querySelector(".o-focus-tint").getBoundingClientRect(), side = Math.min(b.width, b.height) / k;
      if (side && side < 3 * HATCH_GAP) say("C10 patch", "warn", `the focus patch is ${side.toFixed(1)} viewBox units across, too small to show its hatching`, "put the patch on a bigger face or a bigger panel of it");
    }
    const floorFocus = !!m.closest(".o-floor");
    const r = m.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    let present = 0, seen = 0;
    for (let i = 1; i < 8; i++) for (let j = 1; j < 8; j++) {
      const x = r.left + (r.width * i) / 8, y = r.top + (r.height * j) / 8;
      const hits = svg.ownerDocument.elementsFromPoint(x, y).filter((e) => svg.contains(e));
      const own = (e) => e === m || m.contains(e);
      if (!hits.some(own)) continue;
      if (floorFocus && !own(hits[0]) && onFloor(hits[0])) continue;
      present++;
      if (own(hits[0])) seen++;
    }
    if (present >= 4 && seen / present < 0.6) say("C8 focus seen", "warn", `only ${Math.round((100 * seen) / present)}% of the focus can be seen; the rest is behind other solids`, "turn or move the focus, or what stands in front of it, so the focus is in plain view at rest");
  }
  // corners slightly rounded (STYLE.md)
  for (const sc of new Set(hovers.map((x) => x.sc))) {
    const odd = sc.solids.filter((x) => x.kind === "box" && (x.radius < 0.5 || x.radius > 3));
    if (odd.length) say("C7 corner", "warn", `${odd.length} box(es) with a corner radius outside 0.5 to 3`, "round corners slightly: a radius of 0.5 to 3");
  }
  // labels readable
  for (const t of svg.querySelectorAll("text")) {
    const px = t.getBoundingClientRect().height;
    if (px && px < 6) { say("C6 label", "warn", `a label is ${px.toFixed(1)}px tall on screen`, "make it larger, or leave it out: labels are only for objects that carry them"); break; }
  }
  if (!hovers.length) say("I1 answer", "fail", "the figure does not answer the pointer", "give it interact() over the parts a hand would reach for");
  for (const sc of new Set(hovers.map((x) => x.sc))) {
    const hit = sc.collisions();
    if (hit.length) say("S2 solid", "fail", `${hit.length} pair(s) of objects pass through each other (${hit.slice(0, 3).map((pair) => pair.map((x) => x.name ?? (x.structure ? `structure (${x.kind})` : `a ${x.kind}`)).join(" and ")).join("; ")})`, "move parts only the way the object allows, and keep their motion clear of their neighbours");
  }
  // one view (V1): the brand's camera, so a family of figures sits together
  for (const sc of new Set(hovers.map((x) => x.sc))) {
    if (Math.abs(sc.cam.angle - VIEW.angle) > 1e-6 || Math.abs(sc.cam.tilt - VIEW.tilt) > 1e-6)
      say("V1 view", "fail", `the camera is turned to ${sc.cam.angle}° / ${sc.cam.tilt}°, not the brand's ${VIEW.angle}° / ${VIEW.tilt}°`, "use O.camera() as it is, and turn or lay out the object so its important face shows");
  }
  // motion (M1, M3, S6): every part through the whole of its gestures stays clear of its neighbours and in the frame,
  // and drives nothing into a solid it was not already in at rest, joined or not (S6: paint order is per solid)
  const inside = (sc, rigid = true) => {
    const out = new Map(), list = sc.solids.filter((x) => !x.floor), I = xf.identity();
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      if (rigid && xf.same(list[i].xform ?? I, list[j].xform ?? I)) continue;     // moving together, rigidly: nothing can sink
      if (overlaps(list[i], list[j])) out.set(list[i].id + "-" + list[j].id, [list[i], list[j]]);
    }
    return out;
  };
  for (const hv of hovers) {
    if (!hv.sweep) continue;
    const atRest = inside(hv.sc, false), sunk = new Map();
    hv.sweep((part) => { for (const [k, pair] of inside(hv.sc)) if (!atRest.has(k) && !sunk.has(part)) sunk.set(part, pair.map((x) => `${x.name ?? (x.structure ? "structure" : "a solid")} (${x.kind})`).join(" into ")); });
    for (const [part, pair] of sunk) say("S6 sunk", "fail", `on its way, "${part}" goes into another solid (${pair}), so one of them is painted wholly over the other`, "nothing moves into another solid: seat what goes into a hole (lathe { seat }, as button() does), or keep it above the surface it presses on");
    const clash = new Map(), outside = new Set();
    hv.sweep((part) => {
      for (const [a, b] of hv.sc.collisions()) if (!clash.has(part)) clash.set(part, [a, b].map((x) => x.name ?? (x.structure ? `structure (${x.kind})` : `a ${x.kind}`)).join(" and "));
      for (const x of hv.sc.solids) for (const [px, py] of x.outline?.() ?? []) if (px < vx - 1 || py < vy - 1 || px > vx + w + 1 || py > vy + h + 1) outside.add(part);
    });
    for (const [part, pair] of clash) say("M1 sweep", "fail", `on its way, "${part}" passes through another object (${pair})`, "keep the gesture clear of its neighbours: a smaller angle or lift, another pivot, or more room");
    if (outside.size) say("M1 sweep", "fail", `on their way, ${[...outside].map((x) => `"${x}"`).join(", ")} leave the frame`, "fit the camera to the furthest each gesture goes");
    for (const m of hv.motions ?? []) {
      if ((m.kind === "act" || m.kind === "release") && m.run > ACT_MAX) say("M3 timing", "warn", `an act on "${m.part}" runs ${m.run} ms`, `keep an act, delay and stagger included, under ${ACT_MAX} ms`);
      if (m.kind === "hold" && m.period < HOLD_MIN) say("M3 timing", "warn", `a hold on "${m.part}" cycles every ${m.period} ms`, `keep a hold's cycle at ${HOLD_MIN} ms or more: calm, not busy`);
    }
  }
  return out;
}

/* ----------------------------------------------------------------- mount */

/**
 * Mounts every element under `root` that names a figure, for pages written by hand (a deck, the assets page):
 *   <div data-orchestro="sandboxes" data-grid="false" data-theme="auto" data-play></div>
 * figures: { name: figure } or an array of figures. Each element gets its handle as el.orchestro, so a deck's
 * step script can call el.orchestro.phase(k). Returns the handles.
 */
function mountAll(figures, root = document, defaults = {}) {
  const byName = Array.isArray(figures) ? Object.fromEntries(figures.map((f) => [f.name, f])) : figures;
  const out = [];
  for (const el of root.querySelectorAll("[data-orchestro]")) {
    if (el.orchestro) continue;
    const fig = byName[el.dataset.orchestro];
    if (!fig) { console.warn(`[oscillon] no figure named "${el.dataset.orchestro}"`); continue; }
    const d = el.dataset, flag = (k) => (k in d ? d[k] !== "false" : undefined);
    out.push(mount(el, fig, { ...defaults, grid: flag("grid") ?? defaults.grid ?? true, play: flag("play") ?? defaults.play ?? false, fit: flag("fit") ?? defaults.fit ?? false, theme: d.theme ?? defaults.theme ?? "light" }));
  }
  return out;
}

/**
 * Puts a figure in `host`. A figure is { name, means, frame?, draw(ctx) },
 * draw returning { set?, destroy? }. ctx gives the svg, the frame [w, h],
 * read(text) for the read-out, join(tick) for the clock, onPointer(handlers)
 * and add(fn) for tear-down. Returns { set, destroy }.
 */
function mount(host, figure, { frame, value, onRead, grid = false, fit = false, check = false, theme = "light", tokens = null, play = false } = {}) {
  inject(host.ownerDocument);
  const [w, h] = frame ?? figure.frame ?? [400, 320];
  host.classList.add("o-fig");
  host.classList.toggle("o-nogrid", !grid);
  host.setAttribute("role", "img");
  host.setAttribute("aria-label", figure.means ?? figure.name);
  host.dataset.oTheme = theme;
  host.dataset.oEngine = "oscillon";
  // tokens: the page's own values for the style's roles, e.g. { focus: "#0057ff", "face-top": "#fafafa" }
  for (const [k, v] of Object.entries(tokens ?? {})) host.style.setProperty(`--o-${k}`, v);
  const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, "aria-hidden": "true" }, host);
  // the read-out, said to a screen reader as it changes
  const live = host.ownerDocument.createElement("span");
  live.className = "o-live";
  live.setAttribute("aria-live", "polite");
  host.appendChild(live);
  const downs = [], hovers = [], subjects = [], controls = {};
  const ctx = {
    svg, frame: [w, h], host, hovers, controls, play,
    /** Names the solids the figure is about, for the subject check (C3). */
    subject: (...solids) => subjects.push(...solids),
    read: (text) => { if (host.dataset.read === text) return; host.dataset.read = text; live.textContent = text === "rest" ? "" : text; onRead?.(text); },
    join: (tick) => { const j = join(host, tick); downs.push(j.leave); return j; },
    onPointer: (handlers) => downs.push(pointer(host, svg, handlers)),
    add: (fn) => downs.push(fn),
  };
  const made = figure.draw(ctx, value) ?? {};
  // fit: the viewBox is set to the drawing at rest, padded, at the frame's own shape (the C1 / C2 fix)
  if (fit) {
    const b = contentBox(svg);
    if (b) {
      const pad = 0.08, k = Math.max((b.w * (1 + 2 * pad)) / w, (b.h * (1 + 2 * pad)) / h), vw = w * k, vh = h * k;
      svg.setAttribute("viewBox", [b.x + b.w / 2 - vw / 2, b.y + b.h / 2 - vh / 2, vw, vh].map(r2).join(" "));
    }
  }
  const handle = {
    set: (v) => made.set?.(v),
    /** Shows or hides the floor grid and the texture drawn on it (rule F1). */
    grid: (on) => host.classList.toggle("o-nogrid", !on),
    /** "light", "dark" or "auto" (the reader's system setting). */
    theme: (t) => (host.dataset.oTheme = t),
    /** The page's own values for the style's roles, e.g. { focus: "#0057ff" }; null for a role restores the style's. */
    tokens: (map) => { for (const [k, v] of Object.entries(map ?? {})) v == null ? host.style.removeProperty(`--o-${k}`) : host.style.setProperty(`--o-${k}`, v); },
    /** Starts or stops the unseen hand that walks the parts. */
    play: (on = true) => controls.play?.(on),
    /** A deck's build step: phase(0) is rest. */
    phase: (k) => controls.phase?.(k),
    /** The rules this figure breaks as drawn now (RULES.md): [{ rule, level, says, fix }]. */
    check: () => checkOscillon(host, svg, figure),
    destroy() { made.destroy?.(); downs.reverse().forEach((f) => f()); svg.remove(); live.remove(); delete host.dataset.read; delete host.orchestro; },
  };
  host.orchestro = handle;                     // for a deck's step script to find
  if (check) requestAnimationFrame(() => { for (const f of handle.check()) console.warn(`[oscillon] ${figure.name}: ${f.rule} ${f.level}: ${f.says}. Fix: ${f.fix}.`); });
  return handle;
}

return { clamp, lerp, VIEW, camera, el, closed, line, hull, join, reducedMotion, spring, bezier, easeOut, tween, pointer, scene, paintOrder, xf, box, cylinder, tube, faceted, wedge, frustum, prism, cutout, shell, tray, rod, wire, lathe, button, arc, pipe, dots, ring, label, slots, panel, hatch, trace, grid, focus, hover, lift, slide, drag, recoil, tilt, press, grow, hinge, spin, hop, riffle, rock, bob, beat, sweep, interact, POINTS, surf, cloud, mountAll, mount };
})();
window.Oscillon_cube = (() => {
/*
 * Cube: flat faces and straight edges, to see how Oscillon draws them. All six faces are seen through, so the box
 * reads by its edges, rounded like the tiles', where its walls turn and their points pile up into soft bands, and the far faces show behind the near ones.
 */
const O = window.Oscillon;

const cube = {
  name: "cube",
  means: "A cube, traced in points, its edges brightest.",
  frame: [360, 360],
  study: true,          // a study of how a shape draws, not a figure about something: it has no focus (F1)
  draw(ctx) {
    O.cloud(ctx, O.camera(), [O.surf.slab([34, 34, 34], { at: [0, 0, 0], radius: 6 })], { count: 60000, pad: 40 });
  },
};

return { cube };
})();
window.Oscillon_lightbulb = (() => {
/*
 * Lightbulb, drawn in Oscillon's own way: a cloud of points on its surfaces. The glass is one turned surface, seen
 * through, so its rim traces itself brightest; the cap is a turned sleeve wound with thread rings; the stem and wires
 * stand inside the glass. Its focus is the filament, a fine coil drawn densest of all, glowing in the middle.
 */
const O = window.Oscillon;

const lightbulb = {
  name: "lightbulb",
  means: "A lightbulb, traced in points, its filament glowing brightest.",
  frame: [360, 360],
  draw(ctx) {
    const { surf } = O;
    const threads = [];
    for (let z = 4; z < 14; z += 1.8) threads.push(surf.ring(6.5, 0.5, { at: [0, 0, z], weight: 0.7 }));
    const coil = (t) => {
      const x = -5 + 10 * t, z = 34 + 3.2 * Math.sin(Math.PI * t), a = t * Math.PI * 2 * 16;
      return [x, 0.8 * Math.cos(a), z + 0.8 * Math.sin(a)];
    };
    O.cloud(ctx, O.camera(), [
      surf.lathe([[0, 0], [2.4, 0.3], [3.6, 1.4], [4.4, 2.2]]),
      surf.lathe([[5.4, 2.2], [6.1, 3], [6.1, 14], [6.6, 15]], { weight: 0.6 }),
      ...threads,
      surf.lathe([[6, 15], [6.3, 18], [8.6, 22], [12.6, 27], [15.6, 32], [16.8, 38], [16.4, 44], [14.6, 49], [11, 53.5], [6, 56.3], [0, 57.2]]),
      surf.lathe([[2.6, 15], [1.4, 21], [1, 26]], { weight: 1.3 }),
      surf.curve((t) => [-1 - 4 * t, 0, 26 + 8 * t], { thick: 0.15, weight: 1.5 }),
      surf.curve((t) => [1 + 4 * t, 0, 26 + 8 * t], { thick: 0.15, weight: 1.5 }),
      surf.curve(coil, { thick: 0.2, weight: 3.5, steps: 800 }),
    ], { count: 100000 });
  },
};

return { lightbulb };
})();
window.Oscillon_prism = (() => {
/*
 * Prism: a triangular prism lying on one side, to see slanted faces and a ridge. One rounded triangle pushed out into
 * a solid: its corners are rounded, so its two ends trace loops, as the tiles' rims do, and along the ridge the walls
 * turn away from the viewer and their points pile up into a soft bright line.
 */
const O = window.Oscillon;

const prism = {
  name: "prism",
  means: "A triangular prism on its side, traced in points, its ends and ridge brightest.",
  frame: [360, 360],
  study: true,          // a study of how a shape draws, not a figure about something: it has no focus (F1)
  draw(ctx) {
    O.cloud(ctx, O.camera(), [O.surf.extrude([[-17, 0], [17, 0], [0, 27]], 48, { radius: 4 })], { count: 60000, pad: 40 });
  },
};

return { prism };
})();
window.Oscillon_rocket = (() => {
/*
 * Rocket, drawn in Oscillon's own way: the body and nose one turned surface, three fins, a band round its waist, and
 * under it the plume, a turned flare of exhaust. Seen through, the body's sides trace themselves brightest. Its focus
 * is the plume, the densest cloud in the figure.
 */
const O = window.Oscillon;

const rocket = {
  name: "rocket",
  means: "A rocket lifting off on its plume, traced in points; the plume brightest.",
  frame: [360, 360],
  draw(ctx) {
    const { surf } = O;
    const fins = [90, 210, 330].map((d) => {
      const c = Math.cos((d * Math.PI) / 180), s = Math.sin((d * Math.PI) / 180);
      return surf.tri([7.5 * c, 7.5 * s, 7], [7.5 * c, 7.5 * s, 22], [16 * c, 16 * s, 2], { weight: 1.2 });
    });
    const parts = [
      surf.lathe([[5.6, -2], [4.2, 1.5], [3.2, 4]], { weight: 1.2 }),
      surf.lathe([[3.2, 4], [7, 5], [7.5, 8], [7.5, 40], [7.1, 47], [5.7, 54], [3.2, 60], [0, 63]]),
      surf.ring(7.7, 0.35, { at: [0, 0, 40], weight: 1.2 }),
      ...fins,
      surf.lathe([[3.4, -2], [5.4, -8], [6.4, -15], [5.6, -23], [3, -29], [0, -32]], { weight: 2 }),
    ];
    // lifting off on a slant, leaning towards the viewer's right
    O.cloud(ctx, O.camera(), parts.map((p) => surf.tilt(p, { axis: "y", deg: 32, pivot: [0, 0, 20] })), { count: 70000 });
  },
};

return { rocket };
})();
window.Oscillon_sphere = (() => {
/*
 * Sphere: the plainest round, to see how Oscillon draws a surface turning away. Points spread evenly over the ball;
 * seen through, they pack into a bright rim at its edge and thin out at its middle, as a phosphor sphere does.
 */
const O = window.Oscillon;

const sphere = {
  name: "sphere",
  means: "A sphere, traced in points, its rim brightest.",
  frame: [360, 360],
  study: true,          // a study of how a shape draws, not a figure about something: it has no focus (F1)
  draw(ctx) {
    O.cloud(ctx, O.camera(), [O.surf.sphere(20, { at: [0, 0, 20] })], { count: 60000, pad: 40 });
  },
};

return { sphere };
})();
window.Oscillon_tiles = (() => {
/*
 * Tiles, drawn in Oscillon's own way: four rounded slabs in a loose stack, each turned a little further than the one
 * under it, so their rims sweep round like the loops of an oscillon. Every slab is seen through; where rims cross the
 * points add up. Its focus is the top tile, traced densest.
 */
const O = window.Oscillon;

const tiles = {
  name: "tiles",
  means: "A loose stack of four tiles, turning as they rise, traced in points; the top one brightest.",
  frame: [360, 360],
  draw(ctx) {
    const { surf } = O;
    const slabs = [0, 1, 2, 3].map((i) => surf.slab([40, 40, 3], { at: [0, 0, i * 7], radius: 7, turn: i * 12, weight: i === 3 ? 2.2 : 1 }));
    O.cloud(ctx, O.camera(), slabs, { count: 90000 });
  },
};

return { tiles };
})();
window.Stitch = (() => {
/*
 * Stitch draw engine.
 *
 * Scaffolded 2026-10-27 from Orchestro's engine: its camera, solids, scene, details, focus and
 * interaction, with the API below unchanged (figures are mounted with mount(), and mountAll() still looks for
 * [data-orchestro] elements). The look is not here: every tone and line weight is between the TOKENS markers, written
 * from engine/style.json by apply.mjs, and the camera between the VIEW markers. CHANGES.md logs every change.
 * Nothing touches the document until mount() is called.
 *
 * What a figure may call. Read this index; the code below it should not need reading.
 *
 * A Stitch figure is O.camera(), O.cell parts and O.stitch() (Camera and Stitching below), and nothing else: the svg
 * solids, details and focus further down are Orchestro's machinery, kept so the API carries over, but drawing with them
 * breaks rule D1 (RULES.md). handle.check() reads Stitch's rules off a figure; engine/check.mjs runs them in a browser.
 *
 * A figure       { name, means, frame?: [w, h], control?, mark?, draw(ctx) }, draw building a scene and calling interact();
 *                control: true for a page's own switch (a theme pull, a toggle): it carries no focus, and no blue;
 *                mark: true for a brand mark, a logo made as an object: the mark is the subject, so it carries none either
 *   ctx          { svg, frame, host, read(text), join(tick), subject(...solids), add(teardown) }
 * Camera
 *   camera()                              the 2:1 isometric camera: { project, unproject(sx, sy, z), fit(points, frame, pad) }
 *   cam.fit(points, ctx.frame, pad)       scales and centres so the world points fill the frame; give it the most extreme pose
 * Scene
 *   scene(ctx.svg, cam)                   { update(), floorFace(), join(...solids), collisions() }; call update() once built
 *   grid(sc, [x0, y0, x1, y1], cell)      the floor grid (thins itself, G1); returns the floor face, for hatched tiles
 * Solids (all take structure: true for what holds things and never moves, S3)
 *   box(sc, { at, size: [w, d, h], radius, floor })       at is centre-bottom; floor: true paints it under everything
 *   cylinder(sc, { at, r, h })            upright
 *   tube(sc, { from, to, r0, r1 })        lying along a horizontal axis; aim(from, to) turns it
 *   wedge(sc, { at, size, high })         a ramp rising to the side named by high: "+x", "-x", "+y", "-y"
 *   frustum(sc, { at, size, top })        a tapered block
 *   prism(sc, { points, z, h })           any convex outline, stood up
 *   shell(sc, { at, length, profile, wall, axis, open })  a hollow body open at one end, any convex cross-section: a
 *                                         mailbox, a tunnel; its inside shows through the opening when it faces the viewer.
 *                                         axis "z", open "end": a box or tub open at the top, one piece, that things stand
 *                                         in: its inside paints behind them and its near walls in front (profile in x, y)
 *   cutout(sc, { outline, z, h })         a flat piece cut along any outline, convex or not: a jigsaw piece; pieces that
 *                                         meet edge to edge read as one surface, and collide by their real outline;
 *                                         sides: "hatch" draws its sides in grey hatching, gap apart on screen, not shaded
 *   tray(sc, { at, size, wall })          an open box: { solids, floor }
 *   pipe(sc, { points, r })               joined tubes with collars: [solids]
 *   rod(sc, { points, r })                one round bar bent along a path, one continuous piece: a shackle, a handle, a cable
 *   wire(sc, { paths, r, light })         one round bar along several paths, moulded as one piece: crossings and joins merge
 *                                         into one outline (lettering, a bent-wire frame); lit and shaded where the light
 *                                         (a world direction; the brand's by default) really falls. wire.paths: screen points
 *   arc(c, radius, from, to, { u, v })    points along a circular arc, for a rod's bends
 *   lathe(sc, { at, profile: [[r, z]], seat, smooth })  a round solid turned from a convex profile: a domed button, a
 *                                         knob, a bulb, a nose; seat hides what sinks below a hole's rim; smooth (a ball, a
 *                                         globe) shades it without the line where its tones meet
 *   button(sc, { at, r, dome })           a push button modelled whole: a domed cap in its collar, joined: { cap, collar }
 *   solid.face(name)                      a face to draw in: "top", and on a box "+x" "-x" "+y" "-y" "left" "right";
 *                                         on a prism, wedge or frustum any face by its index (a prism's caps: 0, 1)
 *   solid.pose(m)                         where the transform m takes it from home; interact's gestures do this for you
 *   xf.rotate(axis, deg, pivot), xf.translate(d), xf.compose(a, b), xf.apply(m, p)   transforms, rarely needed by hand
 * On a face (world units, from the face's top-left as the viewer reads it)
 *   dots(face, [[s, t]], r, cls)          screws ("o-mark"), LEDs ("o-idle", "o-faint")
 *   slots(face, [s, t], n, opts)          a vent
 *   panel(face, [s0, t0, s1, t1], r)      a rounded panel line
 *   hatch(face, [s0, t0, s1, t1], gap)    grey hatching: texture only
 *   trace(face, paths, cls)               printed lines along world points on the face: a seam, a map's coastlines
 *   label(face, text, [s, t], size)       an engraved label, only where the object would carry one
 * Stitching (Stitch's own way of drawing: a figure is cells of crosses; see the cells section)
 *   stitch(ctx, cam, parts, { pad, fit }) fits the camera to the parts and stitches them: { redraw() }; parts may be
 *                                         (t) => parts, for bespoke motion (fit: its widest pose). While Play is on every
 *                                         figure moves by its parts: a focus thread flickers, glass glows with rays, a
 *                                         focus solid lifts and turns, and all sew in; a part's motion: names its own
 *   cell.box({ at, size, turn }), cell.prism({ points, plane, at, length, turn }), cell.cylinder({ from, to, r }),
 *   cell.sphere({ at, r }), cell.lathe({ at, profile })   solids; each takes focus: true (double crosses, the figure's
 *                                         one focus) and glass: true (outline only, what's behind shows)
 *   cell.thread({ points }), cell.seam({ points })        a one-stitch line over things; a line of bare cells on a surface
 * Focus (exactly one per figure, there at rest; the only blue; always blue hatching)
 *   focus.area(face).set(worldPoints)     a blue-hatched area on a face (H1); move(face, worldPoints) travels to another (I6);
 *                                         give a list of outlines for one focus in several pieces (the lines of a page)
 *   focus.beam(face).set({ from, angle, width, spread, reach })   an area that starts at its source (B1)
 *   focus.solid(solid | [solids])         the whole of a part hatched as one, every face the viewer sees: a hammer's head
 *   focus.patch(face, [s0, t0, s1, t1], { r })   a hatched panel on a face: the picked part's lid, label, chest panel;
 *                                         move(face, rect) travels (I6). Always hatching, never a dot or an outline (F2)
 * Interaction
 *   interact(ctx, sc, parts, opts)        the whole of a figure's pointer, keyboard, touch, play and step work:
 *                                         parts [{ solid | solids, name, ... }], opts { move: { lift } | { slide },
 *                                         focus: { mark, on(part) -> [face, at] }, rest, read, change, follow, leave, steps,
 *                                         drop(part, amount 0-1) when a dragged part is let go }
 *                                         a part may carry gesture: one, or a list that nests (each later one in the part's own frame)
 * Gestures (what a part does when picked, as the real object would; RULES.md M1-M4)
 *   pose, while picked: lift(n), slide([dx, dy, dz]), press(n), hinge({ solids, pivot, axis, angle }),
 *                       grow(by, { pivot }): taller by `by` times from its base, a bar rising
 *   pose, while held:   drag([dx, dy, dz]): follows a press-and-drag towards d, springs home; drop(part, amount) on release
 *                       tilt({ pivot, axis, angle }): swings with the hand's sideways drag, either way, springs home
 *   act, on let-go:     recoil([dx, dy, dz], { delay, ms }): one dip along d as a dragged part snaps home, by how far it went
 *   act, once on pick:  spin({ solids, pivot, axis, turns }), hop(h), riffle(h, { stagger }), rock({ solids, pivot, axis, angle })
 *   hold, while picked: spin({ held: true, period, sym }), bob(h, { stagger }), beat({ pivot, axis, angle }), sweep(r)
 *   all take { solids } (a subset of the part; group them, [[body, mast], ...], to move a group as one in a wave),
 *   { delay } (ms, for follow-through), and those that turn { pivot, axis }
 *   spring(x), tween(v)                   for a figure's own motion (an aim); never under-damped (I5)
 * On a page
 *   mount(el, figure, opts)               opts { grid, theme: "light" | "dark" | "auto", tokens, play, fit, check, onRead }
 *                                         returns { grid(on), theme(t), tokens(map), play(on), phase(k), check(), destroy() }
 *   mountAll(figures, root)               mounts every [data-orchestro="name"] element
 *   react.js: <OrchestroFigure figure grid theme tokens play phase onRead />
 *
 * Layers of this file, top to bottom: camera, svg, clock, input, scene, solids, faces, focus, hover,
 * interact, style, check, mount.
 */

const NS = "http://www.w3.org/2000/svg";
const rad = (d) => (d * Math.PI) / 180;
const r2 = (n) => Math.round(n * 100) / 100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------------------------------------------------------------- camera */

/**
 * An orthographic camera. angle turns the world about z (45 gives the classic
 * isometric diamond), tilt is how far it looks down (30 gives the 2:1 view).
 */
/** The brand's one view (V1): every figure is seen from here; turn the object, never the camera. */
const VIEW = /*VIEW*/{ angle: 35, tilt: 23 }/*END*/;
function camera({ angle = VIEW.angle, tilt = VIEW.tilt, scale = 1 } = {}) {
  const ca = Math.cos(rad(angle)), sa = Math.sin(rad(angle));
  const st = Math.sin(rad(tilt)), ct = Math.cos(rad(tilt));
  const cam = {
    scale, ox: 0, oy: 0, angle, tilt,
    /** The direction from the scene towards the viewer, in world space. */
    toViewer: [sa * ct, ca * ct, st],
    project([x, y, z]) {
      const X = x * ca - y * sa, Y = x * sa + y * ca;
      return [cam.ox + cam.scale * X, cam.oy + cam.scale * (Y * st - z * ct)];
    },
    /** The world point under a screen point, on the plane at height z. */
    unproject(sx, sy, z = 0) {
      const X = (sx - cam.ox) / cam.scale, Y = ((sy - cam.oy) / cam.scale + z * ct) / st;
      return [X * ca + Y * sa, -X * sa + Y * ca, z];
    },
    /** How near the viewer a world point is: larger is nearer. */
    depth([x, y, z]) { return (x * sa + y * ca) * ct + z * st; },
    /** Which way a horizontal direction points on screen: < 0 left, > 0 right. */
    screenX([nx, ny]) { return nx * ca - ny * sa; },
    /** Scales and centres the camera so the world points fill the frame, less pad. */
    fit(points, [w, h], pad = 24) {
      cam.scale = 1; cam.ox = 0; cam.oy = 0;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of points) {
        const [sx, sy] = cam.project(p);
        x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
      }
      cam.scale = Math.min((w - 2 * pad) / (x1 - x0 || 1), (h - 2 * pad) / (y1 - y0 || 1));
      cam.ox = w / 2 - (cam.scale * (x0 + x1)) / 2;
      cam.oy = h / 2 - (cam.scale * (y0 + y1)) / 2;
      return cam;
    },
  };
  return cam;
}

/* ------------------------------------------------------------------- svg */

/** One svg node. `cls` is the class; every other key is an attribute. */
function el(tag, attrs = {}, parent = null) {
  const node = parent ? parent.ownerDocument.createElementNS(NS, tag) : document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] != null) node.setAttribute(k === "cls" ? "class" : k, String(attrs[k]));
  if (parent) parent.appendChild(node);
  return node;
}
const closed = (pts) => (pts.length < 2 ? "" : "M" + pts.map((p) => r2(p[0]) + " " + r2(p[1])).join("L") + "Z");
const line = (pts) => (pts.length < 2 ? "" : "M" + pts.map((p) => r2(p[0]) + " " + r2(p[1])).join("L"));

/** The convex hull of screen points (monotone chain). */
function hull(points) {
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) {
    while (lower.length > 1 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length > 1 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** The indices of the one cyclic run of `items` that pass `keep`, in order. */
function cyclicRun(items, keep) {
  const n = items.length, ok = items.map(keep);
  if (ok.every(Boolean)) return items.map((_, i) => i);
  let start = ok.findIndex((v, i) => v && !ok[(i + n - 1) % n]);
  if (start < 0) return [];
  const out = [];
  for (let k = 0; k < n && ok[(start + k) % n]; k++) out.push((start + k) % n);
  return out;
}

/* ----------------------------------------------------------------- clock */

const motion = { reduced: false, watching: false };
const loop = { items: new Set(), raf: 0, last: 0, seen: null };

function watchMotion(win) {
  if (motion.watching || !win.matchMedia) return;
  motion.watching = true;
  const q = win.matchMedia("(prefers-reduced-motion: reduce)");
  motion.reduced = q.matches;
  q.addEventListener?.("change", () => { motion.reduced = q.matches; loop.items.forEach(wakeItem); });
}
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - loop.last) / 1000));
  loop.last = now;
  let more = false;
  for (const it of loop.items) {
    if (!it.awake || !it.visible) continue;
    it.awake = !!it.tick(dt, now);
    more = more || it.awake;
  }
  loop.raf = more ? requestAnimationFrame(frame) : 0;
}
function wakeItem(it) {
  it.awake = true;
  if (!loop.raf && typeof requestAnimationFrame === "function") {
    loop.last = performance.now();
    loop.raf = requestAnimationFrame(frame);
  }
}
/**
 * Joins the page's one frame loop. tick(dt seconds, now ms) returns true while
 * it still has something to move. The loop sleeps when nothing moves, and
 * while `host` is offscreen.
 */
function join(host, tick) {
  const win = host.ownerDocument.defaultView;
  watchMotion(win);
  const it = { tick, awake: true, visible: true, host };
  if (win.IntersectionObserver) {
    loop.seen ??= new win.IntersectionObserver((entries) => {
      for (const e of entries) for (const x of loop.items) if (x.host === e.target) {
        x.visible = e.isIntersecting;
        if (x.visible) wakeItem(x);
      }
    }, { rootMargin: "80px" });
    loop.seen.observe(host);
  }
  loop.items.add(it);
  wakeItem(it);
  return {
    wake: () => wakeItem(it),
    leave: () => { loop.items.delete(it); loop.seen?.unobserve(host); },
  };
}
const reducedMotion = () => motion.reduced;

/**
 * A damped spring at rest on x. Set .target to move it; step(dt) returns whether it is moving.
 * Never under-damped: damping below critical is raised to it, so nothing bounces (I5).
 */
function spring(x, { stiffness = 170, damping = 26 } = {}) {
  damping = Math.max(damping, 2 * Math.sqrt(stiffness));
  const s = {
    x, v: 0, target: x,
    step(dt) {
      if (motion.reduced) { s.x = s.target; s.v = 0; return false; }
      const n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
      for (let i = 0; i < n; i++) {
        s.v += (-stiffness * (s.x - s.target) - damping * s.v) * h;
        s.x += s.v * h;
      }
      if (Math.abs(s.x - s.target) < 1e-3 && Math.abs(s.v) < 1e-2) { s.x = s.target; s.v = 0; return false; }
      return true;
    },
  };
  return s;
}

/** A cubic-bezier easing, solved for x by Newton's method with a bisection fallback. */
function bezier(x1, y1, x2, y2) {
  const ax = 3 * x1 - 3 * x2 + 1, bx = 3 * x2 - 6 * x1, cx = 3 * x1;
  const ay = 3 * y1 - 3 * y2 + 1, by = 3 * y2 - 6 * y1, cy = 3 * y1;
  const X = (u) => ((ax * u + bx) * u + cx) * u, Y = (u) => ((ay * u + by) * u + cy) * u;
  const dX = (u) => (3 * ax * u + 2 * bx) * u + cx;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let u = t;
    for (let i = 0; i < 6; i++) {
      const d = dX(u), e = X(u) - t;
      if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break;
      u -= e / d;
    }
    if (!(u >= 0 && u <= 1) || Math.abs(X(u) - t) > 1e-4) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 30; i++) { u = (lo + hi) / 2; if (X(u) < t) lo = u; else hi = u; }
    }
    return Y(u);
  };
}
/** Cosmos's --motion-ease-out. */
const easeOut = bezier(0.23, 1, 0.32, 1);

/** A tween at rest on v. to(target, now, delay) retargets from where it is. */
function tween(v, ms = 600, ease = easeOut) {
  const t = {
    from: v, to: v, t0: -Infinity, ms,
    value(now) {
      if (motion.reduced) return t.to;
      const p = clamp((now - t.t0) / t.ms, 0, 1);
      return lerp(t.from, t.to, ease(p));
    },
    done(now) { return motion.reduced || now - t.t0 >= t.ms; },
    set(target, now, delay = 0) {
      if (target === t.to) return;
      t.from = t.value(now); t.to = target; t.t0 = now + delay;
    },
  };
  return t;
}

/* ----------------------------------------------------------------- input */

/** The pointer over the figure, in frame units: move([x, y]), leave(). Returns its tear-down. */
function pointer(host, svg, { move, leave }) {
  const at = (e) => {
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    return [vb.x + ((e.clientX - r.left) / r.width) * vb.width, vb.y + ((e.clientY - r.top) / r.height) * vb.height];
  };
  const onMove = (e) => move(at(e), e), onLeave = (e) => leave(e);
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerdown", onMove);
  host.addEventListener("pointerleave", onLeave);
  return () => {
    host.removeEventListener("pointermove", onMove);
    host.removeEventListener("pointerdown", onMove);
    host.removeEventListener("pointerleave", onLeave);
  };
}

/* ----------------------------------------------------------------- scene */

/**
 * A scene: a floor layer, painted first, and a layer of solids that the scene
 * keeps in depth order, so a figure may add them in any order.
 */
function scene(svg, cam) {
  const floor = el("g", { cls: "o-floor" }, svg);
  const layer = el("g", { cls: "o-solids" }, svg);
  const over = el("g", { cls: "o-over" }, svg);
  const solids = [];
  let order = "";
  const sc = {
    svg, cam, floor, layer, over, solids, order: [], live: [],
    /** Adds a solid. One made with { floor: true } (a slab others stand on) is painted with the floor, under every other solid. */
    add(solid) {
      solids.push(solid);
      // remember each solid's pose, so the checker can tell parts that move together from parts that move apart (S6)
      if (solid.pose) { const pose = solid.pose; solid.pose = (m) => { solid.xform = m; return pose(m); }; }
      (solid.floor ? floor : layer).appendChild(solid.g);
      return solid;
    },
    /** Redraws what moved, and only then puts the solids back in depth order. */
    update() {
      let moved = false;
      for (const s of solids) if (s.dirty !== false) { s.draw(); s.dirty = false; moved = true; }
      if (!moved) return;
      const sorted = paintOrder(cam, solids.filter((s) => !s.floor));
      sc.order = sorted;
      const now = sorted.map((s) => s.id).join(",");
      if (now !== order) { order = now; for (const s of sorted) layer.appendChild(s.g); }
    },
    /** The floor's plane, z = 0, as a face to draw in: u along x, v along y. */
    floorFace() { return planeFace(cam, floor, [0, 0, 0], [1, 0, 0], [0, 1, 0], Infinity, Infinity); },
    /** Makes several solids one object (a torch's body, neck and head), which may touch and overlap each other. */
    join(...parts) {
      // joins merge: anything already joined to one of these comes along, so joining a drum to each of its
      // buttons in turn makes one object of all of them
      const k = ++ids, olds = new Set(parts.map((p) => p.object).filter(Boolean));
      for (const x of solids) if (olds.has(x.object)) x.object = k;
      for (const p of parts) p.object = k;
      return parts;
    },
    /** Pairs of separate objects whose solids pass through each other, as they stand now (S2). */
    collisions(eps = 0.25) {
      const out = [], list = solids;
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.object && a.object === b.object) continue;
        if (overlaps(a, b, eps)) out.push([a, b]);
      }
      return out;
    },
  };
  return sc;
}

/**
 * Back to front for solids with world bounds { min, max }. Only pairs that
 * overlap on screen are ordered: one wholly below the other, or wholly behind it
 * along x or y (behind meaning away from the viewer), goes first; pairs that
 * overlap on every axis fall back to their centres' depth. The ordered pairs are
 * then sorted topologically, the farthest first among those free to go.
 */
function paintOrder(cam, list) {
  const v = cam.toViewer, n = list.length;
  const b = list.map((s) => s.bounds());
  const behind = (i, j) => {           // whether i must be painted before j
    const A = b[i], B = b[j];
    if (A.max[2] <= B.min[2] + 1e-6) return true;
    if (B.max[2] <= A.min[2] + 1e-6) return false;
    for (const k of [0, 1]) {
      if (v[k] > 0 && A.max[k] <= B.min[k] + 1e-6) return true;
      if (v[k] > 0 && B.max[k] <= A.min[k] + 1e-6) return false;
      if (v[k] < 0 && A.min[k] >= B.max[k] - 1e-6) return true;
      if (v[k] < 0 && B.min[k] >= A.max[k] - 1e-6) return false;
    }
    return list[i].depth() < list[j].depth();
  };
  // only solids that overlap on screen need an order between them: constraining the rest can only make
  // cycles (two posts at opposite corners are apart along x one way and along y the other)
  const box = list.map((s) => {
    const o = s.outline?.() ?? [];
    if (!o.length) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of o) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return [x0, y0, x1, y1];
  });
  // a pair needs an order only if their silhouettes really overlap: boxes that merely share a bounding rectangle
  // add constraints that make cycles (a tall divider, the shelves beside it and a drawer above them), and a broken
  // cycle can paint a pulled drawer over the one above it
  const hulls = list.map((s) => s.outline?.() ?? []);
  const overlap = (i, j) => !box[i] || !box[j] || (box[i][0] < box[j][2] && box[j][0] < box[i][2] && box[i][1] < box[j][3] && box[j][1] < box[i][3] && convexOverlap(hulls[i], hulls[j]));
  const after = Array.from({ length: n }, () => []), need = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (!overlap(i, j)) continue;
    if (behind(i, j)) { after[i].push(j); need[j]++; } else { after[j].push(i); need[i]++; }
  }
  const out = [], free = [];
  for (let i = 0; i < n; i++) if (!need[i]) free.push(i);
  while (out.length < n) {
    if (!free.length) {                 // a cycle: take the farthest left
      let k = -1;
      for (let i = 0; i < n; i++) if (need[i] > 0 && (k < 0 || list[i].depth() < list[k].depth())) k = i;
      need[k] = 0; free.push(k);
    }
    free.sort((i, j) => list[i].depth() - list[j].depth());
    const i = free.shift();
    if (need[i] < 0) continue;
    need[i] = -1;
    out.push(list[i]);
    for (const j of after[i]) if (need[j] > 0 && --need[j] === 0) free.push(j);
  }
  return out;
}

/**
 * Whether two solids' volumes overlap by more than eps: their world bounds, and for an upright round solid (a
 * cylinder or a lathe, not tilted) its circle rather than its square, so a box beside a round table is not inside it.
 */
function overlaps(a, b, eps = 0.25) {
  if (a.kind === "shell-inside" || b.kind === "shell-inside") return false;
  // a shell is hollow: only its walls and its closed end count
  if (a.slabs) return a.slabs().some((bb) => overlaps({ kind: "slab", bounds: () => bb }, b, eps));
  if (b.slabs) return b.slabs().some((bb) => overlaps(a, { kind: "slab", bounds: () => bb }, eps));
  const A = a.bounds(), B = b.bounds();
  if (![0, 1, 2].every((k) => Math.min(A.max[k], B.max[k]) - Math.max(A.min[k], B.min[k]) > eps)) return false;
  if (a.kind === "cutout" || b.kind === "cutout") return outlinesOverlap(footprintOf(a), footprintOf(b), eps);
  const round = (x, X) => (x.kind === "cylinder" || x.kind === "lathe") && (!x.xform || xf.upright(x.xform))
    ? { c: [(X.min[0] + X.max[0]) / 2, (X.min[1] + X.max[1]) / 2], r: (X.max[0] - X.min[0]) / 2 } : null;
  const ra = round(a, A), rb = round(b, B);
  if (ra && rb) return Math.hypot(ra.c[0] - rb.c[0], ra.c[1] - rb.c[1]) < ra.r + rb.r - eps;
  const circle = ra ?? rb, box = ra ? B : A;
  if (!circle) return true;
  const dx = Math.max(box.min[0] - circle.c[0], 0, circle.c[0] - box.max[0]), dy = Math.max(box.min[1] - circle.c[1], 0, circle.c[1] - box.max[1]);
  return Math.hypot(dx, dy) < circle.r - eps;
}

/** Whether two convex screen polygons overlap by more than a hair (separating axes). */
function convexOverlap(P, Q, eps = 0.05) {
  if (P.length < 3 || Q.length < 3) return true;
  for (const poly of [P, Q]) for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], nx = a[1] - b[1], ny = b[0] - a[0];
    const l = Math.hypot(nx, ny);
    if (!l) continue;
    let p0 = Infinity, p1 = -Infinity, q0 = Infinity, q1 = -Infinity;
    for (const [x, y] of P) { const d = (x * nx + y * ny) / l; p0 = Math.min(p0, d); p1 = Math.max(p1, d); }
    for (const [x, y] of Q) { const d = (x * nx + y * ny) / l; q0 = Math.min(q0, d); q1 = Math.max(q1, d); }
    if (p1 <= q0 + eps || q1 <= p0 + eps) return false;
  }
  return true;
}

/* ------------------------------------------------------------ transforms */

/**
 * Rigid transforms: { R, t }, a 3 × 3 rotation (row-major) and a translation, mapping p to R p + t.
 * Every solid takes one through pose(m), from where it was built (its home); interact() builds them
 * from a part's gestures, so a figure rarely makes one itself.
 */
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const xf = {
  identity: () => ({ R: I3.slice(), t: [0, 0, 0] }),
  translate: (d) => ({ R: I3.slice(), t: [d[0], d[1], d[2]] }),
  /** A turn of `deg` degrees about `axis` ("x", "y", "z" or a vector) through `pivot`, right-handed. */
  rotate(axis, deg, pivot = [0, 0, 0]) {
    const a = typeof axis === "string" ? { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[axis] : axis;
    const l = Math.hypot(...a) || 1, [x, y, z] = a.map((v) => v / l), c = Math.cos(rad(deg)), s = Math.sin(rad(deg)), C = 1 - c;
    const R = [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C];
    const Rp = xf.dir({ R }, pivot);
    return { R, t: [pivot[0] - Rp[0], pivot[1] - Rp[1], pivot[2] - Rp[2]] };
  },
  /** a after b: p -> a(b(p)). */
  compose(a, b) {
    const A = a.R, B = b.R, R = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
    const t = xf.dir(a, b.t);
    return { R, t: [t[0] + a.t[0], t[1] + a.t[1], t[2] + a.t[2]] };
  },
  apply: (m, p) => { const R = m.R; return [R[0] * p[0] + R[1] * p[1] + R[2] * p[2] + m.t[0], R[3] * p[0] + R[4] * p[1] + R[5] * p[2] + m.t[1], R[6] * p[0] + R[7] * p[1] + R[8] * p[2] + m.t[2]]; },
  dir: (m, v) => { const R = m.R; return [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]]; },
  /** Whether m keeps up as up: only a turn about z and a move, so an upright solid stays upright. */
  /** A stretch along z by s, about the height z0: a bar growing from its base. Upright, so a box or cylinder stays one. */
  stretch: (s, z0 = 0) => ({ R: [1, 0, 0, 0, 1, 0, 0, 0, s], t: [0, 0, z0 - s * z0] }),
  upright: (m) => Math.abs(m.R[2]) + Math.abs(m.R[5]) + Math.abs(m.R[6]) + Math.abs(m.R[7]) < 1e-9,
  same: (a, b) => a.R.every((v, i) => Math.abs(v - b.R[i]) < 1e-9) && a.t.every((v, i) => Math.abs(v - b.t[i]) < 1e-9),
};

/**
 * Paints a convex solid given as world vertices and faces (index lists): each visible face in the tone of
 * the way it points, the edges between visible faces, the silhouette as the outline. edges "all" draws every
 * edge between two visible faces (a wedge); "tone" only those where the tone changes (a tilted box, whose
 * rounded corners are many faces), and, without `corner`, none between two sides (a tilted cylinder).
 */
function meshPainter(cam, facesLayer, edgeNode) {
  const v = cam.toViewer, fills = [];
  const normal = (f, pts, mid) => {          // Newell's method, unit length, turned outwards (the solid is convex)
    let nx = 0, ny = 0, nz = 0, cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < f.length; i++) {
      const a = pts[f[i]], b = pts[f[(i + 1) % f.length]];
      nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]);
      cx += a[0]; cy += a[1]; cz += a[2];
    }
    const l = Math.hypot(nx, ny, nz) || 1, out = (cx / f.length - mid[0]) * nx + (cy / f.length - mid[1]) * ny + (cz / f.length - mid[2]) * nz < 0 ? -1 : 1;
    return [(out * nx) / l, (out * ny) / l, (out * nz) / l];
  };
  const tone = (n) => (n[2] > 0.5 ? "o-face-top" : cam.screenX([n[0], n[1]]) > 0 ? "o-face-right" : "o-face-left");
  return {
    normal,
    draw(pts, faces, { edges = "all", corner = true } = {}) {
      const mid = [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length);
      const scr = pts.map((p) => cam.project(p)), ns = faces.map((f) => normal(f, pts, mid));
      const seen = ns.map((n) => n[0] * v[0] + n[1] * v[1] + n[2] * v[2] > 1e-6);
      while (fills.length < faces.length) fills.push(el("path", {}, facesLayer));
      faces.forEach((f, i) => {
        fills[i].setAttribute("d", seen[i] ? closed(f.map((k) => scr[k])) : "");
        if (seen[i]) fills[i].setAttribute("class", tone(ns[i]));
      });
      for (let i = faces.length; i < fills.length; i++) fills[i].setAttribute("d", "");
      const owners = new Map();
      faces.forEach((f, i) => f.forEach((a, j) => { const b = f[(j + 1) % f.length], key = a < b ? a + "," + b : b + "," + a; (owners.get(key) ?? owners.set(key, []).get(key)).push(i); }));
      let d = "";
      for (const [key, fs] of owners) {
        if (edges === "none") break;
        if (fs.length !== 2 || !seen[fs[0]] || !seen[fs[1]]) continue;
        if (edges === "tone") {
          const t0 = tone(ns[fs[0]]), t1 = tone(ns[fs[1]]);
          if (t0 === t1 || (!corner && t0 !== "o-face-top" && t1 !== "o-face-top")) continue;
        }
        const [a, b] = key.split(",").map(Number);
        d += `M${r2(scr[a][0])} ${r2(scr[a][1])}L${r2(scr[b][0])} ${r2(scr[b][1])}`;
      }
      edgeNode.setAttribute("d", d);
      return hull(scr);
    },
    clear() { for (const f of fills) f.setAttribute("d", ""); edgeNode.setAttribute("d", ""); },
  };
}

/* ---------------------------------------------------------------- solids */

let ids = 0;
/** Moving structure is a mistake in the figure, so it is refused out loud (S3). */
const still = (solid) => { if (solid.structure) throw new Error(`S3: a ${solid.kind} marked as structure does not move`); };

/** A rounded rectangle footprint as samples {p: [x, y], n: [nx, ny]}, anticlockwise from +x. */
function roundRect(x0, y0, x1, y1, r, steps = 3) {
  r = clamp(r, 0.01, Math.min(x1 - x0, y1 - y0) / 2);
  const out = [];
  for (const [cx, cy, a0] of [[x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180], [x1 - r, y0 + r, 270]]) {
    for (let k = 0; k <= steps; k++) {
      const a = rad(a0 + (90 * k) / steps), c = Math.cos(a), s = Math.sin(a);
      out.push({ p: [cx + r * c, cy + r * s], n: [c, s] });
    }
  }
  return out;
}
function circleRing(cx, cy, r, steps = 48) {
  const out = [];
  for (let k = 0; k < steps; k++) {
    const a = (k / steps) * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a);
    out.push({ p: [cx + r * c, cy + r * s], n: [c, s] });
  }
  return out;
}

/**
 * An upright solid: a footprint ring stood from z0 to z1. Its faces are
 * filled by the way they point (top, left, right), its silhouette drawn as
 * the outline, the top's near edge as an edge, a shine just inside it, and,
 * for a box, the vertical edge where the left and right faces meet.
 * pose(m) puts it where m takes its home: a turn about z keeps it upright and
 * drawn as above; any other turn (a hinge, a tilt) draws it as a convex mesh,
 * the same tones and lines.
 */
function upright(sc, ring, z0, z1, { corner = true, shine = true } = {}) {
  const { cam } = sc, P = (q, z) => cam.project([q.p[0], q.p[1], z]);
  const g = el("g", { cls: "o-solid" });
  // three layers, always in this order (L1): faces, then highlights, then every grey line
  const faces = el("g", { cls: "o-l-faces" }, g), lights = el("g", { cls: "o-l-lights" }, g), lines = el("g", { cls: "o-l-lines" }, g);
  // one flat tone per way a side turns, curved or not (L2)
  const base = el("path", { cls: "o-face-left" }, faces);
  const right = el("path", { cls: "o-face-right" }, faces);
  const topFill = el("path", { cls: "o-face-top" }, faces);
  const rim = el("path", { cls: "o-shine" }, lights);
  const topEdge = el("path", { cls: "o-edge" }, lines);
  const vert = el("path", { cls: "o-edge" }, lines);
  const meshEdge = el("path", { cls: "o-edge" }, lines);
  const decals = el("g", {}, lines);
  const outline = el("path", { cls: "o-outline" }, lines);
  const painter = meshPainter(cam, faces, meshEdge);
  const v = cam.toViewer, faces_ = (q) => q.n[0] * v[0] + q.n[1] * v[1] > 1e-6;
  const homeRing = ring.map((q) => ({ p: [...q.p], n: [...q.n] })), H0 = z0, H1 = z1, N = ring.length;
  const meshFaces = [[...Array(N).keys()].reverse(), [...Array(N).keys()].map((i) => i + N), ...[...Array(N).keys()].map((i) => [i, (i + 1) % N, ((i + 1) % N) + N, i + N])];
  let shape = [];
  const body = {
    g, decals, z0, z1, ring, verts: null,
    /** The silhouette as drawn last, in screen points. */
    outline: () => shape,
    emphasis(on) { outline.classList.toggle("o-strong", !!on); },
    pose(m) {
      if (xf.upright(m)) {
        const R = m.R;
        body.verts = null;
        ring.splice(0, N, ...homeRing.map((q) => ({ p: [R[0] * q.p[0] + R[1] * q.p[1] + m.t[0], R[3] * q.p[0] + R[4] * q.p[1] + m.t[1]], n: [R[0] * q.n[0] + R[1] * q.n[1], R[3] * q.n[0] + R[4] * q.n[1]] })));
        // an upright pose may stretch the body along z (grow), about the height t carries it from
        body.z0 = H0 * m.R[8] + m.t[2]; body.z1 = H1 * m.R[8] + m.t[2];
      } else {
        body.verts = [...homeRing.map((q) => xf.apply(m, [q.p[0], q.p[1], H0])), ...homeRing.map((q) => xf.apply(m, [q.p[0], q.p[1], H1]))];
      }
    },
    bounds() {
      if (body.verts) return { min: [0, 1, 2].map((k) => Math.min(...body.verts.map((p) => p[k]))), max: [0, 1, 2].map((k) => Math.max(...body.verts.map((p) => p[k]))) };
      return { min: [Math.min(...ring.map((q) => q.p[0])), Math.min(...ring.map((q) => q.p[1])), body.z0], max: [Math.max(...ring.map((q) => q.p[0])), Math.max(...ring.map((q) => q.p[1])), body.z1] };
    },
    draw() {
      if (body.verts) {
        for (const n of [base, right, topFill, rim, topEdge, vert]) n.setAttribute("d", "");
        shape = painter.draw(body.verts, meshFaces, { edges: "tone", corner });
        outline.setAttribute("d", closed(shape));
        return;
      }
      painter.clear();
      const tp = ring.map((q) => P(q, body.z1)), bt = ring.map((q) => P(q, body.z0));
      shape = hull(tp.concat(bt));
      outline.setAttribute("d", closed(shape));
      base.setAttribute("d", closed(shape));
      const rr = cyclicRun(ring, (q) => faces_(q) && cam.screenX(q.n) > 0);
      right.setAttribute("d", rr.length ? closed(rr.map((i) => tp[i]).concat(rr.map((i) => bt[i]).reverse())) : "");
      vert.setAttribute("d", "");
      if (corner && rr.length) {
        const ends = [rr[0], rr[rr.length - 1]], i = cam.depth([...ring[ends[0]].p, 0]) > cam.depth([...ring[ends[1]].p, 0]) ? ends[0] : ends[1];
        vert.setAttribute("d", line([tp[i], bt[i]]));
      }
      topFill.setAttribute("d", closed(tp));
      topEdge.setAttribute("d", closed(tp));
      if (shine) {
        const near = cyclicRun(ring, faces_), k = (0.9 / cam.scale) * 1.4;
        rim.setAttribute("d", line(near.map((i) => P({ p: [ring[i].p[0] - ring[i].n[0] * k, ring[i].p[1] - ring[i].n[1] * k] }, body.z1))));
      }
    },
  };
  return body;
}

/**
 * The common part of a box and a cylinder: an upright body posed from its home, and the faces drawn on it,
 * each placed by the pose and hidden while it is turned away from the viewer.
 */
function uprightSolid(sc, body, { kind, home, structure, frames, center, extra = {} }) {
  const made = {};
  let m = xf.identity();
  const solid = {
    id: ++ids, g: body.g, kind, structure, home: [...home], ...extra,
    get at() { return xf.apply(m, home); },
    get pose_() { return m; },
    /** Puts the solid where the transform m takes its home; the scene's next update redraws it. */
    pose(next) {
      if (xf.same(next, m)) return;
      still(solid);
      m = next; body.pose(m); solid.dirty = true;
    },
    /** Moves it so its home point `at` comes to p. */
    moveTo(p) { solid.pose(xf.translate(p.map((v, k) => v - home[k]))); },
    /** Puts it at its home plus d, a world offset. */
    offset(d) { solid.pose(xf.translate(d)); },
    depth() { return sc.cam.depth(xf.apply(m, center)); },
    bounds: () => body.bounds(),
    outline: () => body.outline(),
    emphasis: (on) => body.emphasis(on),
    draw() {
      body.draw();
      const v = sc.cam.toViewer;
      for (const k in made) {
        const [o, u, vv, , , n] = frames[k];
        const nn = xf.dir(m, n);
        made[k].place(xf.apply(m, o), xf.dir(m, u), xf.dir(m, vv));
        made[k].g.style.display = nn[0] * v[0] + nn[1] * v[1] + nn[2] * v[2] > 1e-6 ? "" : "none";
      }
    },
    face(name) {
      if (!frames[name]) throw new Error(`a ${kind} has no face "${name}"; it has ${Object.keys(frames).join(", ")}`);
      if (!made[name]) {
        const [o, u, vv, fw, fh] = frames[name];
        made[name] = planeFace(sc.cam, body.decals, xf.apply(m, o), xf.dir(m, u), xf.dir(m, vv), fw, fh);
      }
      return made[name];
    },
  };
  return solid;
}

/**
 * A box: centre-bottom at `at`, `size` [w, d, h], corners rounded by `radius`.
 * Its faces are named "top", "+x", "-x", "+y", "-y", and "left" / "right"
 * for the two upright faces the camera sees.
 */
function box(sc, { at = [0, 0, 0], size = [40, 40, 16], radius = 1.6, floor = false, structure = floor } = {}) {
  const [w, d, h] = size, [cx, cy, z] = at;
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2, z1 = z + h;
  const body = upright(sc, roundRect(x0, y0, x1, y1, radius), z, z1);
  // each face: origin, across, down, its size, and the way it points
  const frames = {
    top: [[x0, y0, z1], [1, 0, 0], [0, 1, 0], w, d, [0, 0, 1]],
    "+y": [[x0, y1, z1], [1, 0, 0], [0, 0, -1], w, h, [0, 1, 0]],
    "+x": [[x1, y1, z1], [0, -1, 0], [0, 0, -1], d, h, [1, 0, 0]],
    "-y": [[x1, y0, z1], [-1, 0, 0], [0, 0, -1], w, h, [0, -1, 0]],
    "-x": [[x0, y0, z1], [0, 1, 0], [0, 0, -1], d, h, [-1, 0, 0]],
  };
  const solid = uprightSolid(sc, body, { kind: "box", home: at, structure, frames, center: [cx, cy, z + h / 2], extra: { floor, radius } });
  const face = solid.face;
  solid.face = (name) => {
    if (name === "left" || name === "right") {
      const v = sc.cam.toViewer, side = { "+x": [1, 0], "-x": [-1, 0], "+y": [0, 1], "-y": [0, -1] };
      name = Object.keys(side).find((k) => side[k][0] * v[0] + side[k][1] * v[1] > 0 && (sc.cam.screenX(side[k]) > 0) === (name === "right"));
    }
    return face(name);
  };
  return sc.add(solid);
}

/** An upright cylinder: centre-bottom at `at`, radius r, height h. Its "top" face is centred on the axis. */
function cylinder(sc, { at = [0, 0, 0], r = 16, h = 20, structure = false } = {}) {
  const [cx, cy, z] = at;
  const body = upright(sc, circleRing(cx, cy, r), z, z + h, { corner: false });
  const frames = { top: [[cx, cy, z + h], [1, 0, 0], [0, 1, 0], 2 * r, 2 * r, [0, 0, 1]] };
  return sc.add(uprightSolid(sc, body, { kind: "cylinder", home: at, structure, frames, center: [cx, cy, z + h / 2] }));
}

/**
 * A tube lying along a horizontal axis, from `from` to `to` (both on the
 * axis), radius r0 at `from` and r1 at `to`: a torch body, a pipe, a roller.
 * aim(from, to) moves it.
 */
function tube(sc, { from = [0, 0, 8], to = [40, 0, 8], r0 = 8, r1 = 8, steps = 36, structure = false } = {}) {
  const { cam } = sc;
  const g = el("g", { cls: "o-solid" });
  const faces = el("g", { cls: "o-l-faces" }, g), lights = el("g", { cls: "o-l-lights" }, g), lines = el("g", { cls: "o-l-lines" }, g);
  // flat tones, as on every solid (L2): the side, and the half of the surface that faces up in the top tone.
  // A curved surface carries no highlight line (L3)
  const side = el("path", { cls: "o-face-left" }, faces);
  const upper = el("path", { cls: "o-face-top" }, faces);
  const capFill = el("path", { cls: "o-face-right" }, faces);
  const capEdge = el("path", { cls: "o-edge" }, lines);
  const decals = el("g", {}, lines);
  const outline = el("path", { cls: "o-outline" }, lines);
  let A = from, B = to, shape = [], top = null;
  // a ring round the axis ax (3D, unit): e1 across it and level, e2 across it and as near up as it goes
  const basis = (ax) => {
    let e1 = [-ax[1], ax[0], 0], l = Math.hypot(e1[0], e1[1]);
    e1 = l > 1e-6 ? [e1[0] / l, e1[1] / l, 0] : [1, 0, 0];
    return [e1, [ax[1] * e1[2] - ax[2] * e1[1], ax[2] * e1[0] - ax[0] * e1[2], ax[0] * e1[1] - ax[1] * e1[0]]];
  };
  const disc = (c, r, ax) => {
    const [e1, e2] = basis(ax), out = [];
    for (let k = 0; k < steps; k++) {
      const t = (k / steps) * 2 * Math.PI, a = r * Math.cos(t), b = r * Math.sin(t);
      out.push(cam.project([c[0] + a * e1[0] + b * e2[0], c[1] + a * e1[1] + b * e2[1], c[2] + a * e1[2] + b * e2[2]]));
    }
    return out;
  };
  const axis = () => { const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], l = Math.hypot(...d) || 1; return d.map((x) => x / l); };
  const topFrame = () => {
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1, ax = [(B[0] - A[0]) / len, (B[1] - A[1]) / len, 0];
    return [[(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, A[2] + Math.max(r0, r1)], ax, [-ax[1], ax[0], 0]];
  };
  const solid = {
    id: ++ids, g, decals, kind: "tube", structure, home: [[...from], [...to]],
    aim(a, b) {
      still(solid);
      if (a.every((v, k) => v === A[k]) && b.every((v, k) => v === B[k])) return;
      A = a; B = b; solid.dirty = true;
    },
    offset(d) { const [a, b] = solid.home; solid.aim(a.map((v, k) => v + d[k]), b.map((v, k) => v + d[k])); },
    /** Puts the tube where the transform m takes its home ends. */
    pose(m) { const [a, b] = solid.home; solid.aim(xf.apply(m, a), xf.apply(m, b)); },
    get ends() { return [A, B]; },
    outline: () => shape,
    emphasis(on) { outline.classList.toggle("o-strong", !!on); },
    /** "top": the plane touching the tube along its top line, centred on its middle, u along the axis. */
    face(name) {
      if (name !== "top") throw new Error("a tube has one face to draw in: top");
      return (top ??= planeFace(cam, decals, ...topFrame(), Infinity, Infinity));
    },
    depth() { return cam.depth([(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2]); },   // its middle, tilted or not
    bounds() {
      const r = Math.max(r0, r1);
      return { min: [0, 1, 2].map((k) => Math.min(A[k], B[k]) - r), max: [0, 1, 2].map((k) => Math.max(A[k], B[k]) + r) };
    },
    draw() {
      const ax = axis(), da = disc(A, r0, ax), db = disc(B, r1, ax);
      const all = hull(da.concat(db));
      shape = all;
      top?.place(...topFrame());
      side.setAttribute("d", closed(all));
      outline.setAttribute("d", closed(all));
      const half = steps / 2;
      upper.setAttribute("d", closed(da.slice(0, half + 1).concat(db.slice(0, half + 1).reverse())));
      // the end that faces the viewer shows its cap
      const v = cam.toViewer, towardB = ax[0] * v[0] + ax[1] * v[1] + ax[2] * v[2] > 0;
      capFill.setAttribute("d", closed(towardB ? db : da));
      capFill.setAttribute("class", cam.screenX(towardB ? ax : [-ax[0], -ax[1]]) > 0 ? "o-face-right" : "o-face-left");
      capEdge.setAttribute("d", closed(towardB ? db : da));
    },
  };
  return sc.add(solid);
}

/**
 * A convex solid with flat faces: `vertices` in world space, `faces` as lists
 * of vertex indices, anticlockwise seen from outside. Each visible face takes
 * the tone of the way it points (up, left or right), edges between two visible
 * faces are edges, the silhouette is the outline. The base for wedges and
 * frustums; sharp-cornered, so keep it for shapes a box cannot make.
 */
function faceted(sc, { vertices, faces, structure = false, kind = "faceted" }) {
  const { cam } = sc, v = cam.toViewer;
  const g = el("g", { cls: "o-solid" });
  const fl = el("g", { cls: "o-l-faces" }, g);
  el("g", { cls: "o-l-lights" }, g);
  const ln = el("g", { cls: "o-l-lines" }, g);
  const fills = faces.map(() => el("path", {}, fl));
  const edges = el("path", { cls: "o-edge" }, ln);
  const decals = el("g", {}, ln);
  const outline = el("path", { cls: "o-outline" }, ln);
  const home = vertices.map((p) => [...p]);
  let at = vertices.map((p) => [...p]), shape = [], top = null;
  const own = new Map();                // faces drawn in by index: face(i) -> planeFace, placed on every draw
  const normal = (f, pts) => {          // Newell's method, unit length
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < f.length; i++) {
      const a = pts[f[i]], b = pts[f[(i + 1) % f.length]];
      nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  };
  const upmost = () => faces.reduce((best, f, i) => (normal(f, at)[2] > normal(faces[best], at)[2] ? i : best), 0);
  const topFrame = () => frameOf(upmost());
  // a face's plane: from its first vertex along its first edge, v across it (n x u)
  const frameOf = (i) => {
    const f = faces[i], o = at[f[0]], a = at[f[1]], n = normal(f, at);
    const l = Math.hypot(a[0] - o[0], a[1] - o[1], a[2] - o[2]) || 1, u = [(a[0] - o[0]) / l, (a[1] - o[1]) / l, (a[2] - o[2]) / l];
    return [o, u, [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]]];
  };
  const solid = {
    id: ++ids, g, decals, kind, structure, home,
    offset(d) { solid.moveTo(d); },
    /** Puts the solid at its home moved by d. */
    moveTo(d) { solid.pose(xf.translate(d)); },
    /** Puts the solid where the transform m takes its home vertices. */
    pose(m) { const next = home.map((p) => xf.apply(m, p)); if (next.every((p, i) => p.every((x, k) => Math.abs(x - at[i][k]) < 1e-9))) return; still(solid); at = next; solid.dirty = true; },
    depth() { const c = [0, 1, 2].map((k) => at.reduce((s, p) => s + p[k], 0) / at.length); return cam.depth(c); },
    bounds() { return { min: [0, 1, 2].map((k) => Math.min(...at.map((p) => p[k]))), max: [0, 1, 2].map((k) => Math.max(...at.map((p) => p[k]))) }; },
    outline: () => shape,
    emphasis(on) { outline.classList.toggle("o-strong", !!on); },
    /**
     * "top": the plane of its most upward face, from that face's first vertex along its first edge. A number i is
     * faces[i] itself, wherever it turns: a prism's caps are 0 (at z) and 1 (at z + h), so a standing shield can
     * be drawn on, and hatched across, its front (F4).
     */
    face(name) {
      if (Number.isInteger(name)) {
        if (!faces[name]) throw new Error(`a faceted solid has faces 0 to ${faces.length - 1}, not ${name}`);
        if (!own.has(name)) {
          const f = planeFace(cam, decals, ...frameOf(name), Infinity, Infinity), n = normal(faces[name], at);
          f.g.style.display = n[0] * v[0] + n[1] * v[1] + n[2] * v[2] > 1e-6 ? "" : "none";
          own.set(name, f);
        }
        return own.get(name);
      }
      if (name !== "top") throw new Error("a faceted solid has one face to draw in by name, top, or any face by its index");
      if (!top) {
        // the face's size, in its own (s, t): the spread of its corners along u and v, so a patch can size itself
        const [o, u, vv] = topFrame(), f = faces[upmost()];
        const st = f.map((k) => { const d = at[k].map((x, j) => x - o[j]); return [d[0] * u[0] + d[1] * u[1] + d[2] * u[2], d[0] * vv[0] + d[1] * vv[1] + d[2] * vv[2]]; });
        const span = (j) => Math.max(...st.map((q) => q[j])) - Math.min(...st.map((q) => q[j]));
        top = planeFace(cam, decals, o, u, vv, span(0), span(1));
      }
      return top;
    },
    draw() {
      const scr = at.map((p) => cam.project(p)), seen = faces.map((f) => { const n = normal(f, at); return n[0] * v[0] + n[1] * v[1] + n[2] * v[2] > 1e-6 ? n : null; });
      shape = hull(scr);
      outline.setAttribute("d", closed(shape));
      faces.forEach((f, i) => {
        const n = seen[i];
        fills[i].setAttribute("d", n ? closed(f.map((k) => scr[k])) : "");
        if (n) fills[i].setAttribute("class", n[2] > 0.5 ? "o-face-top" : cam.screenX([n[0], n[1]]) > 0 ? "o-face-right" : "o-face-left");
      });
      // an edge shared by two visible faces is an edge; one on the silhouette is the outline's
      const owners = new Map();
      faces.forEach((f, i) => f.forEach((a, j) => { const b = f[(j + 1) % f.length], key = a < b ? a + "," + b : b + "," + a; (owners.get(key) ?? owners.set(key, []).get(key)).push(i); }));
      let d = "";
      for (const [key, fs] of owners) if (fs.length === 2 && seen[fs[0]] && seen[fs[1]]) { const [a, b] = key.split(",").map(Number); d += `M${r2(scr[a][0])} ${r2(scr[a][1])}L${r2(scr[b][0])} ${r2(scr[b][1])}`; }
      edges.setAttribute("d", d);
      // what is drawn on a face shows only while that face is turned towards the viewer, as on a box
      if (top) { top.place(...topFrame()); top.g.style.display = seen[upmost()] ? "" : "none"; }
      for (const [i, f] of own) { f.place(...frameOf(i)); f.g.style.display = seen[i] ? "" : "none"; }
    },
  };
  return sc.add(solid);
}

/** A wedge, a ramp: footprint `size` [w, d] centred at `at`, rising from nothing at one end to `h` at the end named by `high` ("+x", "-x", "+y" or "-y"). */
function wedge(sc, { at = [0, 0, 0], size = [40, 30, 16], high = "+x", structure = false } = {}) {
  const [cx, cy, z] = at, [w, d, h] = size, x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2;
  // built rising to +x, then turned about its centre
  const turn = { "+x": [1, 0], "+y": [0, 1], "-x": [-1, 0], "-y": [0, -1] }[high];
  if (!turn) throw new Error(`wedge: high is "+x", "-x", "+y" or "-y", not ${high}`);
  const rot = ([x, y, zz]) => { const dx = x - cx, dy = y - cy; return [cx + dx * turn[0] - dy * turn[1], cy + dx * turn[1] + dy * turn[0], zz]; };
  const vertices = [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [x1, y0, z + h], [x1, y1, z + h]].map(rot);
  const faces = [[0, 3, 2, 1], [1, 2, 5, 4], [0, 4, 5, 3], [0, 1, 4], [3, 5, 2]];
  return faceted(sc, { vertices, faces, structure, kind: "wedge" });
}

/** A frustum, a tapered block: base `size` [w, d] centred at `at`, `h` tall, its top `top` [tw, td] (smaller), centred above. */
function frustum(sc, { at = [0, 0, 0], size = [40, 40, 24], top = [20, 20], structure = false } = {}) {
  const [cx, cy, z] = at, [w, d, h] = size, [tw, td] = top;
  const ring = (a, b, zz) => [[cx - a / 2, cy - b / 2, zz], [cx + a / 2, cy - b / 2, zz], [cx + a / 2, cy + b / 2, zz], [cx - a / 2, cy + b / 2, zz]];
  const vertices = [...ring(w, d, z), ...ring(tw, td, z + h)];
  const faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  return faceted(sc, { vertices, faces, structure, kind: "frustum" });
}

/** A prism: any convex outline `points` [[x, y], ...] (anticlockwise) stood from z to z + h, drawn like a box with sharp corners. */
function prism(sc, { points, z = 0, h = 16, structure = false }) {
  const n = points.length, cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  for (let i = 0; i < n; i++) if (cross(points[i], points[(i + 1) % n], points[(i + 2) % n]) <= 0) throw new Error("prism: the outline must be convex and anticlockwise; split a concave shape into convex pieces and join them");
  const vertices = [...points.map(([x, y]) => [x, y, z]), ...points.map(([x, y]) => [x, y, z + h])];
  const faces = [[...points.keys()].reverse(), [...points.keys()].map((i) => i + n), ...points.map((_, i) => [i, (i + 1) % n, ((i + 1) % n) + n, i + n])];
  return faceted(sc, { vertices, faces, structure, kind: "prism" });
}

/**
 * A cutout: a flat piece cut from a sheet along any outline, convex or not: a jigsaw piece, a gasket, a stencil.
 * outline is [[x, y]] in world units, either way round; the piece lies from z to z + h. Its sides take one flat tone
 * per way they turn (L2), with an edge only at a real corner; its "top" face is the sheet's top, in world x and y
 * (s = x, t = y, before any pose), so seams, details and the focus are given where they lie. Cutouts that meet edge
 * to edge at the same height are one surface there: the side between them is not drawn, only the seam along the top,
 * and collisions test the real outline rather than its bounding box, so a knob can sit in its blank. It moves
 * upright only: slid, lifted or turned about z, as a piece on a table is.
 */
function cutout(sc, { outline: pts, z = 0, h = 3, sides = "shade", gap = 3, structure = false }) {
  const { cam } = sc, v = cam.toViewer;
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; area += x0 * y1 - x1 * y0; }
  const home = (area < 0 ? pts.slice().reverse() : pts.slice()).map(([x, y]) => [x, y]), N = home.length;
  const g = el("g", { cls: "o-solid" });
  const faces = el("g", { cls: "o-l-faces" }, g), lights = el("g", { cls: "o-l-lights" }, g), lines = el("g", { cls: "o-l-lines" }, g);
  const wallsG = el("g", {}, faces), walls = [];
  const topFill = el("path", { cls: "o-face-top" }, faces);
  const rim = el("path", { cls: "o-shine" }, lights);
  const hatchNode = el("path", { cls: "o-hatch o-nofill" }, lines);
  const edgeNode = el("path", { cls: "o-edge" }, lines);
  const decals = el("g", {}, lines);
  const outline = el("path", { cls: "o-outline" }, lines);
  // the outline is open lines (a seam is not outline), so the piece's area for picking is a hidden closed shape
  const hit = el("path", { cls: "o-hit" }, lines);
  let m = xf.identity(), poly = home.map((p) => [...p]), z0 = z, shape = [], top = null;
  const normals = () => poly.map((a, i) => { const b = poly[(i + 1) % N], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dy / l, -dx / l]; });
  const others = () => sc.solids.filter((x) => x !== solid && x.kind === "cutout");
  const solid = {
    id: ++ids, g, decals, kind: "cutout", structure, home: [...home],
    /** The outline as it lies now, and the heights it spans: for collisions and shared edges. */
    get footprint() { return { poly, z0, z1: z0 + h }; },
    pose(next) {
      if (xf.same(next, m)) return;
      if (!xf.upright(next)) throw new Error("a cutout moves upright only: slide, lift or turn it about z");
      still(solid);
      m = next; poly = home.map(([x, y]) => xf.apply(m, [x, y, 0]).slice(0, 2)); z0 = z + m.t[2];
      // a neighbour's sides depend on where this piece is: redraw every cutout
      solid.dirty = true; for (const o of others()) o.dirty = true;
    },
    offset(d) { solid.pose(xf.translate(d)); },
    moveTo(d) { solid.pose(xf.translate(d)); },
    outline: () => shape,
    emphasis(on) { outline.classList.toggle("o-strong", !!on); },
    face(name) {
      if (name !== "top") throw new Error("a cutout has one face to draw in: top");
      return (top ??= planeFace(cam, decals, xf.apply(m, [0, 0, z + h]), xf.dir(m, [1, 0, 0]), xf.dir(m, [0, 1, 0]), Infinity, Infinity));
    },
    depth() { const c = poly.reduce((t, p) => [t[0] + p[0] / N, t[1] + p[1] / N], [0, 0]); return cam.depth([c[0], c[1], z0 + h / 2]); },
    bounds() { return { min: [Math.min(...poly.map((p) => p[0])), Math.min(...poly.map((p) => p[1])), z0], max: [Math.max(...poly.map((p) => p[0])), Math.max(...poly.map((p) => p[1])), z0 + h] }; },
    draw() {
      const z1 = z0 + h, ns = normals();
      const tp = poly.map(([x, y]) => cam.project([x, y, z1])), bt = poly.map(([x, y]) => cam.project([x, y, z0]));
      // a side another cutout shares, at the same height, is inside the surface: not drawn
      const near = others().map((o) => o.footprint).filter((f) => Math.abs(f.z0 - z0) < 0.05 && Math.abs(f.z1 - z1) < 0.05);
      const shared = poly.map((a, i) => {
        const b = poly[(i + 1) % N], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        return near.some((f) => onBoundary(mid, f.poly, 0.05));
      });
      const seen = ns.map((n, i) => !shared[i] && n[0] * v[0] + n[1] * v[1] > 1e-6);
      const order = [...Array(N).keys()].filter((i) => seen[i]).sort((i, j) => {
        const d = (k) => cam.depth([(poly[k][0] + poly[(k + 1) % N][0]) / 2, (poly[k][1] + poly[(k + 1) % N][1]) / 2, z0]);
        return d(i) - d(j);
      });
      while (walls.length < order.length) walls.push(el("path", {}, wallsG));
      order.forEach((i, k) => {
        const j = (i + 1) % N;
        walls[k].setAttribute("d", closed([tp[i], tp[j], bt[j], bt[i]]));
        walls[k].setAttribute("class", sides === "hatch" ? "o-face-top" : cam.screenX(ns[i]) > 0 ? "o-face-right" : "o-face-left");
      });
      for (let k = order.length; k < walls.length; k++) walls[k].setAttribute("d", "");
      topFill.setAttribute("d", closed(tp));
      // lines: the top's edge over a side that shows, and seams, are edges; a corner between two sides that show is an
      // edge; the rest of the top's edge, the foot of every side that shows, and where a side turns away, are outline
      // a side's lines (its foot, its corners, its hatching) show only where the top does not hide them: on a piece
      // that is not convex, a side can run on behind another part of the top
      let ed = "", out = "", sh = "", ht = "";
      const behind = (a, b) => segmentParts(a, b, tp, false).map((q) => line(q)).join("");
      const k = (0.9 / cam.scale) * 1.4;
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N, p = (i + N - 1) % N;
        if (seen[i] || shared[i]) ed += line([tp[i], tp[j]]); else out += line([tp[i], tp[j]]);
        if (seen[i]) {
          out += behind(bt[i], bt[j]);
          const [a, b] = [poly[i], poly[j]].map(([x, y]) => cam.project([x - ns[i][0] * k, y - ns[i][1] * k, z1]));
          sh += line([a, b]);
          if (sides === "hatch") ht += hatchQuad([tp[i], tp[j], bt[j], bt[i]], gap).map(([a, b]) => behind(a, b)).join("");
        }
        if (seen[i] !== seen[p] && !shared[i] && !shared[p]) out += behind(tp[i], bt[i]);
        else if (seen[i] && seen[p] && ns[i][0] * ns[p][0] + ns[i][1] * ns[p][1] < 0.82) ed += behind(tp[i], bt[i]);
      }
      hatchNode.setAttribute("d", ht);
      edgeNode.setAttribute("d", ed);
      outline.setAttribute("d", out);
      rim.setAttribute("d", sh);
      shape = hull(tp.concat(bt));
      hit.setAttribute("d", closed(shape));
      top?.place(xf.apply(m, [0, 0, z + h]), xf.dir(m, [1, 0, 0]), xf.dir(m, [0, 1, 0]));
    },
  };
  return sc.add(solid);
}

/** The pieces of segment a-b that lie inside polygon poly (keep true) or outside it (keep false), in screen space. */
function segmentParts(a, b, poly, keep) {
  const ts = [0, 1], dx = b[0] - a[0], dy = b[1] - a[1];
  for (let i = 0; i < poly.length; i++) {
    const c = poly[i], d = poly[(i + 1) % poly.length], ex = d[0] - c[0], ey = d[1] - c[1], den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((c[0] - a[0]) * ey - (c[1] - a[1]) * ex) / den, u = ((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) / den;
    if (t > 1e-6 && t < 1 - 1e-6 && u >= -1e-9 && u <= 1 + 1e-9) ts.push(t);
  }
  ts.sort((x, y) => x - y);
  const at = (t) => [a[0] + dx * t, a[1] + dy * t], parts = [];
  for (let i = 0; i + 1 < ts.length; i++) {
    if (ts[i + 1] - ts[i] < 1e-6 || inside(at((ts[i] + ts[i + 1]) / 2), poly) !== keep) continue;
    const last = parts[parts.length - 1];
    if (last && Math.abs(last.t1 - ts[i]) < 1e-9) last.t1 = ts[i + 1]; else parts.push({ t0: ts[i], t1: ts[i + 1] });
  }
  return parts.map(({ t0, t1 }) => [at(t0), at(t1)]);
}
/** The brand's hatching across a convex screen quad: lines at 45 degrees, top left to bottom right, gap apart on screen. */
function hatchQuad(quad, gap) {
  // lines x - y = c, gap apart measured square to them
  const cs = quad.map(([x, y]) => x - y), step = gap * Math.SQRT2, lo = Math.min(...cs), hi = Math.max(...cs), out = [];
  for (let c = Math.ceil(lo / step) * step; c <= hi; c += step) {
    const span = Math.max(...quad.map((p) => Math.abs(p[0]) + Math.abs(p[1]))) + 10;
    out.push(...segmentParts([c - span, -span], [c + span, span], quad, true));
  }
  return out;
}
/** Whether point p lies on the boundary of polygon poly, within eps. */
function onBoundary(p, poly, eps) {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
    const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1);
    if (Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy) < eps) return true;
  }
  return false;
}
/** Whether two outlines' insides overlap by more than eps: edges that cross, or a corner well inside the other. */
function outlinesOverlap(P, Q, eps) {
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  for (let i = 0; i < P.length; i++) for (let j = 0; j < Q.length; j++) {
    const a = P[i], b = P[(i + 1) % P.length], c = Q[j], d = Q[(j + 1) % Q.length];
    const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
    const la = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, lc = Math.hypot(d[0] - c[0], d[1] - c[1]) || 1;
    if (d1 / lc * (d2 / lc) < -eps * eps && d3 / la * (d4 / la) < -eps * eps) return true;
  }
  const deep = (p, poly) => inside(p, poly) && !onBoundary(p, poly, eps);
  return P.some((p) => deep(p, Q)) || Q.some((q) => deep(q, P));
}
/** A solid's outline on the floor plan, for collisions with a cutout: its own, a circle, or its bounding rectangle. */
function footprintOf(x) {
  if (x.kind === "cutout") return x.footprint.poly;
  const B = x.bounds();
  if ((x.kind === "cylinder" || x.kind === "lathe") && (!x.xform || xf.upright(x.xform))) {
    const c = [(B.min[0] + B.max[0]) / 2, (B.min[1] + B.max[1]) / 2], r = (B.max[0] - B.min[0]) / 2;
    return [...Array(24).keys()].map((k) => [c[0] + r * Math.cos((k * Math.PI) / 12), c[1] + r * Math.sin((k * Math.PI) / 12)]);
  }
  return [[B.min[0], B.min[1]], [B.max[0], B.min[1]], [B.max[0], B.max[1]], [B.min[0], B.max[1]]];
}

/**
 * A shell: a hollow body of one even wall, its cross-section any convex outline, run along x or y and open at one end:
 * a mailbox, a tunnel, a pipe's mouth, a drawer's case. profile is [[a, b]]: a across the run (along +y for a run along
 * x, along -x for a run along y), b up; at is where the run starts, length how far it goes, open "end" or "start".
 * Seen from outside it is a solid; when its open end faces the viewer, its rim shows as a ring, and inside it the
 * walls, floor and back that face the viewer, seen only through the opening, each a step darker than outside, out of
 * the light: a floor in the light side tone, a wall or back in the dark one, the walls hatched grey along the run.
 * Its flat outer sides take details: face("+x" | "-x" | "+y" | "-y" | "top"), whichever it has.
 */
function shell(sc, { at = [0, 0, 0], length = 60, profile, wall = 1.2, axis = "x", open = "end", structure = false }) {
  const { cam } = sc, v = cam.toViewer;
  // the run, and the profile's two directions across it: a along ac, b along up (for a run along z, b along y)
  const ax = axis === "x" ? [1, 0, 0] : axis === "y" ? [0, 1, 0] : [0, 0, 1];
  const ac = axis === "x" ? [0, 1, 0] : axis === "y" ? [-1, 0, 0] : [1, 0, 0], up = axis === "z" ? [0, 1, 0] : [0, 0, 1];
  // open at the top, a box or a tub holds things: its inside is drawn as its own solid, behind what stands in it, and
  // its near walls and rim in front
  const split = axis === "z";
  let area = 0;
  for (let i = 0; i < profile.length; i++) { const [a0, b0] = profile[i], [a1, b1] = profile[(i + 1) % profile.length]; area += a0 * b1 - a1 * b0; }
  const P = area < 0 ? profile.slice().reverse() : profile.slice(), N = P.length;
  // the inside: every side moved in by the wall, its corners where neighbouring sides meet again
  const lineOf = (i) => { const [a0, b0] = P[i], [a1, b1] = P[(i + 1) % N], l = Math.hypot(a1 - a0, b1 - b0) || 1, n = [-(b1 - b0) / l, (a1 - a0) / l]; return { p: [a0 + n[0] * wall, b0 + n[1] * wall], d: [(a1 - a0) / l, (b1 - b0) / l] }; };
  const Q = P.map((_, i) => {
    const A = lineOf((i + N - 1) % N), B = lineOf(i), den = A.d[0] * B.d[1] - A.d[1] * B.d[0];
    if (Math.abs(den) < 1e-9) return B.p;
    const t = ((B.p[0] - A.p[0]) * B.d[1] - (B.p[1] - A.p[1]) * B.d[0]) / den;
    return [A.p[0] + A.d[0] * t, A.p[1] + A.d[1] * t];
  });
  const W = (sAlong, [a, b]) => [0, 1, 2].map((k) => at[k] + ax[k] * sAlong + ac[k] * a + up[k] * b);
  const sOpen = open === "start" ? 0 : length, sShut = length - sOpen, sBack = sShut + (open === "start" ? -wall : wall);
  const out = open === "start" ? ax.map((x) => -x) : ax;
  const home = [...P.map((q) => W(0, q)), ...P.map((q) => W(length, q))];
  const shutRing = sShut === 0 ? [...Array(N).keys()] : [...Array(N).keys()].map((i) => i + N);
  const faces = [...P.map((_, i) => [i, (i + 1) % N, ((i + 1) % N) + N, i + N]), sShut === 0 ? shutRing.slice().reverse() : shutRing];
  const homeOpen = P.map((q) => W(sOpen, q)), homeIn = Q.map((q) => W(sOpen, q)), homeBack = Q.map((q) => W(sBack, q));

  const g = el("g", { cls: "o-solid" });
  const fl = el("g", { cls: "o-l-faces" }, g);
  const meshG = el("g", {}, fl);
  const ig = split ? el("g", { cls: "o-solid" }) : null;
  const ifl = split ? el("g", { cls: "o-l-faces" }, ig) : fl;
  if (split) el("g", { cls: "o-l-lights" }, ig);
  const iln = split ? el("g", { cls: "o-l-lines" }, ig) : null;
  const id = "o-clip" + ++ids, clipPath = el("path", {}, el("clipPath", { id }, split ? ig : g));
  const inG = el("g", { "clip-path": `url(#${id})` }, ifl), back = el("path", {}, inG), walls = [];
  const rimFill = el("path", { "fill-rule": "evenodd" }, fl);
  el("g", { cls: "o-l-lights" }, g);
  const ln = el("g", { cls: "o-l-lines" }, g);
  const edges = el("path", { cls: "o-edge" }, ln);
  const inHatch = el("path", { cls: "o-hatch o-nofill", "clip-path": `url(#${id})` }, iln ?? ln);
  const inEdges = el("path", { cls: "o-edge", "clip-path": `url(#${id})` }, iln ?? ln);
  const rimEdges = el("path", { cls: "o-edge" }, ln);
  const decals = el("g", {}, ln);
  const outline = el("path", { cls: "o-outline" }, ln);
  // split, what stands in it is pointed at through its mouth: its own area for picking leaves the mouth out
  const hitPath = split ? el("path", { cls: "o-hit", "fill-rule": "evenodd" }, ln) : null;
  let mouthScr = null;
  const painter = meshPainter(cam, meshG, edges);
  const tone = (n) => (n[2] > 0.5 ? "o-face-top" : cam.screenX([n[0], n[1]]) > 0 ? "o-face-right" : "o-face-left");
  // inside, out of the light, each side is a step darker: a floor takes the light side tone, a wall or back the dark one
  const shade = (n) => (n[2] > 0.5 ? "o-face-left" : "o-face-right");
  // each inner side's normal, facing into the hollow (the outer side's, turned round)
  const inward = P.map((_, i) => { const [a0, b0] = P[i], [a1, b1] = P[(i + 1) % N], l = Math.hypot(a1 - a0, b1 - b0) || 1, n = [-(b1 - b0) / l, (a1 - a0) / l]; return [0, 1, 2].map((k) => ac[k] * n[0] + up[k] * n[1]); });

  // the flat outer sides, by the way they point, for details
  const named = { "+x": [1, 0, 0], "-x": [-1, 0, 0], "+y": [0, 1, 0], "-y": [0, -1, 0], top: [0, 0, 1] }, made = {};
  const frameOf = (name) => {
    const want = named[name];
    if (!want) throw new Error(`a shell has no face "${name}"; ask for "+x", "-x", "+y", "-y" or "top"`);
    const sides = P.map((_, i) => ({ f: faces[i], n: inward[i].map((x) => -x) }));
    const shutN = open === "start" ? ax : ax.map((x) => -x);
    const hit = [...sides, { f: faces[N], n: shutN }].find((x) => x.n[0] * want[0] + x.n[1] * want[1] + x.n[2] * want[2] > 0.999);
    if (!hit) throw new Error(`this shell has no flat side facing "${name}"`);
    const pts = hit.f.map((k) => home[k]), n = hit.n;
    // u reads left to right on screen, v down it, both in the face's plane
    let u = Math.abs(n[2]) > 0.9 ? [1, 0, 0] : [-n[1], n[0], 0];
    if (Math.abs(n[2]) > 0.9 && axis === "y") u = [0, 1, 0];
    const lu = Math.hypot(...u); u = u.map((x) => x / lu);
    if (cam.screenX([u[0], u[1]]) < 0) u = u.map((x) => -x);
    let w = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
    const p0 = cam.project([0, 0, 0]), p1 = cam.project(w);
    if (p1[1] < p0[1]) w = w.map((x) => -x);
    const S = pts.map((p) => p[0] * u[0] + p[1] * u[1] + p[2] * u[2]), T = pts.map((p) => p[0] * w[0] + p[1] * w[1] + p[2] * w[2]);
    const s0 = Math.min(...S), t0 = Math.min(...T), q = pts[0], dq = s0 - S[0], dt = t0 - T[0];
    return { o: [q[0] + u[0] * dq + w[0] * dt, q[1] + u[1] * dq + w[1] * dt, q[2] + u[2] * dq + w[2] * dt], u, v: w, n, w: Math.max(...S) - s0, h: Math.max(...T) - t0 };
  };
  let m = xf.identity(), shape = [];
  const centre = () => { const at = home.map((p) => xf.apply(m, p)); return cam.depth([0, 1, 2].map((k) => at.reduce((t, p) => t + p[k], 0) / at.length)); };
  const solid = {
    id: ++ids, g, decals, kind: "shell", structure, home: home.map((p) => [...p]),
    /** Its walls and its closed end as boxes, for collisions: a shell is hollow, and what stands in it is not in it. */
    slabs() {
      const box = (pts) => { const at = pts.map((p) => xf.apply(m, p)); return { min: [0, 1, 2].map((k) => Math.min(...at.map((p) => p[k]))), max: [0, 1, 2].map((k) => Math.max(...at.map((p) => p[k]))) }; };
      const out = P.map((_, i) => { const j = (i + 1) % N; return box([P[i], P[j], Q[i], Q[j]].flatMap((q) => [W(0, q), W(length, q)])); });
      out.push(box([...P.map((q) => W(sShut, q)), ...P.map((q) => W(sBack, q))]));
      return out;
    },
    pose(next) { if (xf.same(next, m)) return; still(solid); m = next; solid.dirty = true; },
    offset(d) { solid.pose(xf.translate(d)); },
    moveTo(d) { solid.pose(xf.translate(d)); },
    outline: () => shape,
    hit: split ? (p) => inside(p, shape) && !(mouthScr && inside(p, mouthScr)) : undefined,
    emphasis(on) { outline.classList.toggle("o-strong", !!on); },
    face(name) {
      if (!made[name]) { const f = frameOf(name); made[name] = { f, face: planeFace(cam, decals, xf.apply(m, f.o), xf.dir(m, f.u), xf.dir(m, f.v), f.w, f.h) }; }
      return made[name].face;
    },
    // split, its near walls are painted after what stands in it
    depth() { return centre() + (split ? 1e4 : 0); },
    bounds() { const at = home.map((p) => xf.apply(m, p)); return { min: [0, 1, 2].map((k) => Math.min(...at.map((p) => p[k]))), max: [0, 1, 2].map((k) => Math.max(...at.map((p) => p[k]))) }; },
    draw() {
      const at = home.map((p) => xf.apply(m, p));
      shape = painter.draw(at, faces, { edges: "tone", corner: false });
      outline.setAttribute("d", closed(shape));
      for (const k in made) {
        const { f, face } = made[k], nn = xf.dir(m, f.n);
        face.place(xf.apply(m, f.o), xf.dir(m, f.u), xf.dir(m, f.v));
        face.g.style.display = nn[0] * v[0] + nn[1] * v[1] + nn[2] * v[2] > 1e-6 ? "" : "none";
      }
      const o = xf.dir(m, out), seen = o[0] * v[0] + o[1] * v[1] + o[2] * v[2] > 1e-6;
      const scr = (pts) => pts.map((p) => cam.project(xf.apply(m, p)));
      if (!seen) {
        mouthScr = null; hitPath?.setAttribute("d", closed(shape));
        for (const n of [clipPath, back, rimFill, inEdges, inHatch, rimEdges, ...walls]) n.setAttribute("d", "");
        return;
      }
      // the rim: a ring round the opening; inside it, through the opening, the back and the sides that face the viewer
      const mouth = scr(homeIn), lip = scr(homeOpen), deep = scr(homeBack);
      mouthScr = mouth;
      hitPath?.setAttribute("d", closed(shape) + closed(mouth));
      rimFill.setAttribute("d", closed(lip) + closed(mouth));
      rimFill.setAttribute("class", tone(o));
      rimEdges.setAttribute("d", closed(lip) + closed(mouth));
      clipPath.setAttribute("d", closed(mouth));
      back.setAttribute("d", closed(deep));
      back.setAttribute("class", shade(o));
      const list = [];
      for (let i = 0; i < N; i++) {
        const n = xf.dir(m, inward[i]);
        if (n[0] * v[0] + n[1] * v[1] + n[2] * v[2] <= 1e-6) continue;
        const j = (i + 1) % N, c = [homeBack[i], homeBack[j], homeIn[j], homeIn[i]].map((p) => xf.apply(m, p));
        list.push({ i, j, n, d: cam.depth(c.reduce((t, p) => [t[0] + p[0] / 4, t[1] + p[1] / 4, t[2] + p[2] / 4], [0, 0, 0])) });
      }
      list.sort((a, b) => a.d - b.d);
      while (walls.length < list.length) walls.push(el("path", {}, inG));
      let ed = closed(deep);
      list.forEach((x, k) => {
        walls[k].setAttribute("d", closed([deep[x.i], deep[x.j], mouth[x.j], mouth[x.i]]));
        walls[k].setAttribute("class", shade(x.n));
      });
      for (let k = list.length; k < walls.length; k++) walls[k].setAttribute("d", "");
      // a line along the run only where two inside sides that show change tone
      for (const x of list) {
        const y = list.find((z) => z.i === x.j);
        if (y && shade(x.n) !== shade(y.n)) ed += line([deep[x.j], mouth[x.j]]);
      }
      inEdges.setAttribute("d", ed);
      // the walls in the shade inside are hatched along the run, so the hollow reads as going back (floors are not)
      let hd = "";
      for (const x of list) {
        if (x.n[2] > 0.5) continue;
        const span = Math.hypot(Q[x.j][0] - Q[x.i][0], Q[x.j][1] - Q[x.i][1]), n = Math.floor(span / 1.8);
        for (let k = 1; k <= n; k++) {
          const t = k / (n + 1), a = [0, 1].map((c) => deep[x.i][c] + (deep[x.j][c] - deep[x.i][c]) * t), b = [0, 1].map((c) => mouth[x.i][c] + (mouth[x.j][c] - mouth[x.i][c]) * t);
          hd += line([a, b]);
        }
      }
      inHatch.setAttribute("d", hd);
    },
  };
  sc.add(solid);
  if (split) {
    // the inside, painted before what stands in the shell; the shell's own draw draws it, so it never needs its own
    solid.inside = sc.add({
      id: ++ids, g: ig, kind: "shell-inside", structure: true, home: [], dirty: false,
      outline: () => shape, emphasis() {}, draw() {}, pose() {},
      depth: () => centre() - 1e4, bounds: () => solid.bounds(),
    });
  }
  return solid;
}

/**
 * A tray, an open box: a base and four walls, joined as one object. Returns
 * { solids, floor }: the solids (for interact's part, or structure), and the
 * face of the tray's inside floor, to draw what it holds.
 */
function tray(sc, { at = [0, 0, 0], size = [50, 40, 12], wall = 2, structure = false } = {}) {
  const [cx, cy, z] = at, [w, d, h] = size, t = wall;
  const base = box(sc, { at: [cx, cy, z], size: [w, d, t], radius: 1.2, structure });
  const walls = [
    [cx, cy - d / 2 + t / 2, w, t], [cx, cy + d / 2 - t / 2, w, t],
    [cx - w / 2 + t / 2, cy, t, d - 2 * t], [cx + w / 2 - t / 2, cy, t, d - 2 * t],
  ].map(([x, y, ww, dd]) => box(sc, { at: [x, y, z + t], size: [ww, dd, h - t], radius: 0.5, structure }));
  // the walls along x run the full width; the others fit between them, so no two pass through each other
  sc.join(base, ...walls);
  return { solids: [base, ...walls], floor: base.face("top") };
}

/**
 * A rod: one round bar of radius r bent along a path of world points: a padlock's shackle, a handle, a cable, a
 * hook. It is one continuous piece, not a chain of parts. In an orthographic view a round bar is as wide as its
 * diameter whichever way it runs, so the rod is drawn as its path's outline at that width, round at the ends, in
 * flat tones (L2): its side, and a lit band towards the light. Use arc() for its bends. End it where it meets
 * another solid (a shackle stops at the lock body's top), never inside one. pose(m) moves it like any solid.
 */
function rod(sc, { points, r = 2, structure = false }) {
  const { cam } = sc;
  const g = el("g", { cls: "o-solid" });
  const faces = el("g", { cls: "o-l-faces" }, g);
  el("g", { cls: "o-l-lights" }, g);
  const lines = el("g", { cls: "o-l-lines" }, g);
  const side = el("path", { cls: "o-face-right" }, faces);
  const lit = el("path", { cls: "o-face-top" }, faces);
  const decals = el("g", {}, lines);
  const outline = el("path", { cls: "o-outline" }, lines);
  const home = points.map((p) => [...p]);
  let at = home.map((p) => [...p]), shape = [];
  // the path's outline at half-width h on screen, shifted by d, with round ends
  const band = (scr, h, d = [0, 0]) => {
    const n = scr.length, left = [], right = [], tan = [];
    for (let i = 0; i < n; i++) {
      const a = scr[Math.max(0, i - 1)], b = scr[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const t = [(b[0] - a[0]) / l, (b[1] - a[1]) / l], nn = [-t[1], t[0]];
      tan.push(t);
      left.push([scr[i][0] + nn[0] * h + d[0], scr[i][1] + nn[1] * h + d[1]]);
      right.push([scr[i][0] - nn[0] * h + d[0], scr[i][1] - nn[1] * h + d[1]]);
    }
    const cap = (p, t, from) => {
      const out = [], a0 = Math.atan2(t[1], t[0]) + from;
      for (let k = 1; k < 8; k++) { const a = a0 - (k * Math.PI) / 8; out.push([p[0] + h * Math.cos(a) + d[0], p[1] + h * Math.sin(a) + d[1]]); }
      return out;
    };
    return [...left, ...cap(scr[n - 1], tan[n - 1], Math.PI / 2), ...right.reverse(), ...cap(scr[0], tan[0], -Math.PI / 2)];
  };
  const solid = {
    id: ++ids, g, decals, kind: "rod", structure, home,
    pose(m) { const next = home.map((p) => xf.apply(m, p)); if (next.every((p, i) => p.every((x, k) => Math.abs(x - at[i][k]) < 1e-9))) return; still(solid); at = next; solid.dirty = true; },
    offset(d) { solid.pose(xf.translate(d)); },
    moveTo(d) { solid.pose(xf.translate(d)); },
    outline: () => shape,
    emphasis(on) { outline.classList.toggle("o-strong", !!on); },
    face() { throw new Error("a rod has no face to draw in; put details and the focus on the solids it joins"); },
    depth() { const c = [0, 1, 2].map((k) => at.reduce((s, p) => s + p[k], 0) / at.length); return cam.depth(c); },
    bounds() { return { min: [0, 1, 2].map((k) => Math.min(...at.map((p) => p[k])) - r), max: [0, 1, 2].map((k) => Math.max(...at.map((p) => p[k])) + r) }; },
    draw() {
      const scr = at.map((p) => cam.project(p)), h = r * cam.scale;
      shape = band(scr, h);
      side.setAttribute("d", closed(shape));
      outline.setAttribute("d", closed(shape));
      lit.setAttribute("d", closed(band(scr, h * 0.45, [-h * 0.22, -h * 0.3])));
    },
  };
  return sc.add(solid);
}

/**
 * A wire: one round bar of radius r along several paths of world points, moulded as one piece, so where its paths
 * cross, branch or meet, the bar merges into one outline with no seam: a letter in tube lettering (a t's cross, an
 * e's bar into its bowl), a bent-wire frame. Drawn as strokes along the paths' centre lines: the outline underneath,
 * as wide as the bar and its line, then the side tone over it, then the lit band, so every inner edge is covered.
 * Same flat tones as a rod (L2); keep its paths in one plane, as a moulded piece would be. pose(m) moves it.
 * It is shaded in three flat tones (L2) where the light really falls: at each point, the side of the bar's round
 * section turned to the light is lit, the side turned from it is in shade, and the middle takes the side tone. So the
 * bands move round the bar as it turns, and the plane a wire stands in reads. light: the direction the light comes
 * from, in world space; by default the brand's, up and to the viewer's left (the way a box's faces are toned).
 */
function wire(sc, { paths, r = 2, light = null, structure = false }) {
  const { cam } = sc;
  const g = el("g", { cls: "o-solid" });
  const faces = el("g", { cls: "o-l-faces" }, g);
  el("g", { cls: "o-l-lights" }, g);
  const lines = el("g", { cls: "o-l-lines" }, g);
  // strokes in the figure's own units (not the page's), round at every end and join
  // they are the bar's body, not lines over a face (L1): marked o-bar
  const stroke = (parent, role) => el("path", { cls: "o-bar", fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round",
    style: `stroke:var(--o-${role});vector-effect:none` }, parent);
  // the light: by default up, and to the viewer's left (the way the box faces are toned)
  const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  const V = cam.toViewer, left = [-Math.cos(rad(cam.angle)), Math.sin(rad(cam.angle)), 0];
  const LIGHT = unit(light ?? [0, 0, 1].map((u, k) => 0.85 * u + 0.55 * left[k] + 0.25 * V[k]));
  // a band's centre line: each point moved round its section, towards the light (k > 0) or away (k < 0), by the
  // path's own direction there; only the part of the section the eye can see, so a band never leaves the bar
  const band = (path, k) => path.map((p, i) => {
    const a = unit([0, 1, 2].map((j) => path[Math.min(path.length - 1, i + 1)][j] - path[Math.max(0, i - 1)][j]));
    const flat = (v) => { const d = v.reduce((s, x, j) => s + x * a[j], 0); return v.map((x, j) => x - d * a[j]); };
    const eye = unit(flat(V)), toward = flat(LIGHT);
    // the light's direction round the section, kept to the visible half (towards the eye)
    const facing = toward.reduce((s, x, j) => s + x * eye[j], 0);
    const n = unit(toward.map((x, j) => x - Math.min(0, facing) * eye[j]));
    const q = cam.project([0, 1, 2].map((j) => p[j] + n[j] * r * k));
    return [q[0], q[1]];
  });
  const outline = stroke(faces, "outline"), side = stroke(faces, "face-left"), shade = stroke(faces, "face-right"), lit = stroke(faces, "face-top");
  const decals = el("g", {}, lines);
  // its outline is a stroke, so its area for picking is a hidden closed shape
  const hit = el("path", { cls: "o-hit" }, lines);
  const home = paths.map((path) => path.map((p) => [...p]));
  let at = home.map((path) => path.map((p) => [...p])), shape = [], strong = false;
  const all = () => at.flat();
  const solid = {
    id: ++ids, g, decals, kind: "wire", structure, home, paths: [],
    pose(m) { at = home.map((path) => path.map((p) => xf.apply(m, p))); still(solid); solid.dirty = true; },
    offset(d) { solid.pose(xf.translate(d)); },
    moveTo(d) { solid.pose(xf.translate(d)); },
    outline: () => shape,
    emphasis(on) { strong = !!on; outline.style.stroke = on ? "var(--o-strong)" : "var(--o-outline)"; outline.classList.toggle("o-strong", strong); solid.dirty = true; },
    face() { throw new Error("a wire has no face to draw in; put details and the focus on the solids it joins"); },
    depth() { const c = [0, 1, 2].map((k) => all().reduce((s, p) => s + p[k], 0) / all().length); return cam.depth(c); },
    bounds() { return { min: [0, 1, 2].map((k) => Math.min(...all().map((p) => p[k])) - r), max: [0, 1, 2].map((k) => Math.max(...all().map((p) => p[k])) + r) }; },
    draw() {
      const scr = at.map((path) => path.map((p) => cam.project(p))), h = r * cam.scale, d = (pts, o = [0, 0]) => line(pts.map(([x, y]) => [x + o[0], y + o[1]]));
      solid.paths = scr;
      const all = scr.map((pts) => d(pts)).join("");
      outline.setAttribute("d", all); outline.setAttribute("stroke-width", r2(2 * h + (strong ? 3.2 : 2.5)));
      side.setAttribute("d", all); side.setAttribute("stroke-width", r2(2 * h));
      shade.setAttribute("d", at.map((path) => line(band(path, -0.55))).join("")); shade.setAttribute("stroke-width", r2(h * 0.85));
      lit.setAttribute("d", at.map((path) => line(band(path, 0.45))).join("")); lit.setAttribute("stroke-width", r2(h * 0.75));
      // its silhouette, for picking and the checks: the hull of its bar
      shape = hull(scr.flat().flatMap(([x, y]) => [[x - h, y - h], [x + h, y - h], [x + h, y + h], [x - h, y + h]]));
      hit.setAttribute("d", closed(shape));
    },
  };
  return sc.add(solid);
}

/**
 * A lathe: a round solid turned about an upright axis from a profile, [[r, z], ...] from the bottom up (z above
 * `at`): a domed button, a knob, a bulb's glass, a rocket's nose, a bottle. Keep the profile convex (r never dips
 * then swells); a shape with a waist is two lathes, joined. Drawn as one solid in flat tones (L2), each band in the
 * tone of the way it faces, with an edge only where the top meets the side. A flat top (last r > 0) has a "top" face.
 * seat: a world height below which it is out of sight, inside the hole or collar it sits in (a button's cap): it is
 * cut there as it moves, so it sinks in behind the rim and is always painted above what it sits in.
 */
function lathe(sc, { at = [0, 0, 0], profile, steps = 32, structure = false, seat = null, smooth = false }) {
  const { cam } = sc, [cx, cy, z0] = at, N = steps;
  const g = el("g", { cls: "o-solid" });
  const faces = el("g", { cls: "o-l-faces" }, g);
  el("g", { cls: "o-l-lights" }, g);
  const lines = el("g", { cls: "o-l-lines" }, g);
  const edgeNode = el("path", { cls: "o-edge" }, lines);
  const decals = el("g", {}, lines);
  const outline = el("path", { cls: "o-outline" }, lines);
  const painter = meshPainter(cam, faces, edgeNode);
  // the profile, cut where it goes below its seat (the top of the collar or hole it sits in), as local z
  const cut = (zMin) => {
    if (zMin == null || zMin <= profile[0][1]) return profile;
    const out = [];
    for (let j = 0; j + 1 < profile.length; j++) {
      const [ra, za] = profile[j], [rb, zb] = profile[j + 1];
      if (za < zMin && zb > zMin) out.push([ra + ((rb - ra) * (zMin - za)) / (zb - za), zMin]);
      if (zb >= zMin) out.push([rb, zb]);
    }
    return out.length >= 2 ? out : [[0, profile.at(-1)[1]], [0, profile.at(-1)[1]]];
  };
  // rings of N points; a ring of radius 0 is one point (an apex)
  const mesh = (prof) => {
    const verts = [], ringAt = [], M = prof.length;
    for (const [r, z] of prof) {
      ringAt.push(verts.length);
      if (r <= 1e-6) verts.push([cx, cy, z0 + z]);
      else for (let k = 0; k < N; k++) { const a = (k / N) * 2 * Math.PI; verts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), z0 + z]); }
    }
    const idx = (j, k) => (prof[j][0] <= 1e-6 ? ringAt[j] : ringAt[j] + (k % N)), fs = [];
    if (prof[0][0] > 1e-6) fs.push([...Array(N).keys()].map((k) => idx(0, k)).reverse());
    for (let j = 0; j + 1 < M; j++) for (let k = 0; k < N; k++) {
      const f = [idx(j, k), idx(j, k + 1), idx(j + 1, k + 1), idx(j + 1, k)].filter((v, i, a) => a.indexOf(v) === i);
      if (f.length >= 3) fs.push(f);
    }
    if (prof[M - 1][0] > 1e-6) fs.push([...Array(N).keys()].map((k) => idx(M - 1, k)));
    return { verts, faces: fs };
  };
  let m = xf.identity(), shape = [], top = null, geo = null;
  const build = () => {
    // a seat hides what has gone into the hole: only for poses that keep it upright, where z is still z
    const zMin = seat != null && xf.upright(m) ? seat - z0 - m.t[2] : null, { verts, faces: fs } = mesh(cut(zMin));
    geo = { at: verts.map((p) => xf.apply(m, p)), faces: fs };
  };
  build();
  const [rt, zt] = profile[profile.length - 1];
  const solid = {
    id: ++ids, g, decals, kind: "lathe", structure, home: [...at],
    pose(next) { if (xf.same(next, m)) return; still(solid); m = next; build(); solid.dirty = true; },
    offset(d) { solid.pose(xf.translate(d)); },
    moveTo(p) { solid.pose(xf.translate(p.map((v, k) => v - at[k]))); },
    outline: () => shape,
    emphasis(on) { outline.classList.toggle("o-strong", !!on); },
    face(name) {
      if (name !== "top" || rt <= 1e-6) throw new Error("a lathe has one face to draw in, its flat top, and only if its profile ends with r > 0");
      return (top ??= planeFace(cam, decals, xf.apply(m, [cx, cy, z0 + zt]), xf.dir(m, [1, 0, 0]), xf.dir(m, [0, 1, 0]), 2 * rt, 2 * rt));
    },
    depth() { const c = [0, 1, 2].map((k) => geo.at.reduce((t, p) => t + p[k], 0) / geo.at.length); return cam.depth(c); },
    bounds() { return { min: [0, 1, 2].map((k) => Math.min(...geo.at.map((p) => p[k]))), max: [0, 1, 2].map((k) => Math.max(...geo.at.map((p) => p[k]))) }; },
    draw() {
      // a smooth round surface (a ball, a globe) takes its tones without the line where they meet
      shape = painter.draw(geo.at, geo.faces, { edges: smooth ? "none" : "tone", corner: false });
      outline.setAttribute("d", closed(shape));
      if (top) {
        top.place(xf.apply(m, [cx, cy, z0 + zt]), xf.dir(m, [1, 0, 0]), xf.dir(m, [0, 1, 0]));
        const n = xf.dir(m, [0, 0, 1]), v = cam.toViewer;
        top.g.style.display = n[0] * v[0] + n[1] * v[1] + n[2] * v[2] > 1e-6 ? "" : "none";
      }
    },
  };
  return sc.add(solid);
}

/**
 * A push button, modelled as one: a domed cap of radius r sitting in its collar, the collar as structure on the
 * surface at `at`, the two joined (the cap goes into its collar, so they are one assembly). Returns { cap, collar };
 * give the cap to interact with gesture press(), no deeper than its skirt. dome is the crown's height as a share of r;
 * a flat-topped cap (dome: 0) has a "top" face for an icon.
 */
function button(sc, { at = [0, 0, 0], r = 6, dome = 0.42, skirt = 1.8 } = {}) {
  const [x, y, z] = at, w = Math.max(1, r * 0.2);
  const collar = lathe(sc, { at: [x, y, z], profile: [[r + w, 0], [r + w, w * 0.6], [r + w * 0.6, w * 0.9], [r + 0.3, w * 0.9]], structure: true });
  const crown = dome > 0 ? [20, 35, 50, 62, 74, 84, 90].map((d) => [r * Math.cos(rad(d)), skirt + r * dome * Math.sin(rad(d))]) : [[r * 0.94, skirt + 0.5]];
  // the cap sits in the collar's hole: below the collar's top it is out of sight, so pressed it sinks in, behind the rim
  const cap = lathe(sc, { at: [x, y, z + w * 0.5], profile: [[r, 0], [r, skirt], ...crown], seat: z + w * 0.9 });
  sc.join(collar, cap);
  return { cap, collar };
}

/** Points along a circular arc for a rod's bend: centre c, radius, from and to in degrees, in the plane of u and v. */
function arc(c, radius, from, to, { u = [1, 0, 0], v = [0, 0, 1], steps = 16 } = {}) {
  const out = [];
  for (let k = 0; k <= steps; k++) {
    const a = rad(from + ((to - from) * k) / steps), x = radius * Math.cos(a), y = radius * Math.sin(a);
    out.push([c[0] + u[0] * x + v[0] * y, c[1] + u[1] * x + v[1] * y, c[2] + u[2] * x + v[2] * y]);
  }
  return out;
}

/** A pipe along a path of world points, radius r, as joined tubes with a collar at each bend. Horizontal runs only. */
function pipe(sc, { points, r = 4, structure = false }) {
  const parts = [];
  for (let i = 0; i + 1 < points.length; i++) parts.push(tube(sc, { from: points[i], to: points[i + 1], r0: r, r1: r, structure }));
  for (let i = 1; i + 1 < points.length; i++) parts.push(cylinder(sc, { at: [points[i][0], points[i][1], points[i][2] - r * 1.15], r: r * 1.15, h: r * 2.3, structure }));
  sc.join(...parts);
  return parts;
}

/* ----------------------------------------------------------------- faces */

/**
 * A plane to draw in: origin o, unit directions u (across) and v (down), in
 * world space. Everything drawn into face.g is in world units on that plane,
 * mapped to the screen by one affine transform; strokes keep their weight.
 */
function planeFace(cam, parent, o, u, v, w, h) {
  const g = el("g", { cls: "o-face" }, parent);
  const face = {
    g, w, h, scale: cam.scale,
    /** The face's linear map to the screen, [a, b, c, d]: (s, t) lands at s * (a, b) + t * (c, d) from its origin. */
    m: [1, 0, 0, 1],
    /** Called after each place(): what is drawn at a fixed screen angle (blue hatching, H1) redraws itself. */
    placed: new Set(),
    place(o2, u2 = u, v2 = v) {
      o = o2; u = u2; v = v2;
      const E = cam.project(o), U = cam.project([o[0] + u[0], o[1] + u[1], o[2] + u[2]]), V = cam.project([o[0] + v[0], o[1] + v[1], o[2] + v[2]]);
      face.m = [U[0] - E[0], U[1] - E[1], V[0] - E[0], V[1] - E[1]];
      face.E = E;
      g.setAttribute("transform", `matrix(${[...face.m, E[0], E[1]].map((n) => r2(n * 1000) / 1000).join(" ")})`);
      for (const f of face.placed) f();
    },
    /** The world point at (s, t) on this face. */
    at(s, t) { return [o[0] + u[0] * s + v[0] * t, o[1] + u[1] * s + v[1] * t, o[2] + u[2] * s + v[2] * t]; },
    /** The face's (s, t) for a world point on (or over) its plane. */
    local(p) {
      const d = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
      return [d[0] * u[0] + d[1] * u[1] + d[2] * u[2], d[0] * v[0] + d[1] * v[1] + d[2] * v[2]];
    },
  };
  face.place(o, u, v);
  return face;
}

/** Dots on a face: screws, LEDs. cls "o-mark" (dark), "o-idle" (grey) or "o-faint" (lighter grey). */
function dots(face, points, r = 1, cls = "o-mark") {
  return points.map(([s, t]) => el("circle", { cx: s, cy: t, r, cls }, face.g));
}
/** A ring on a face; dashed unless solid is true. */
function ring(face, [s, t], r, { cls = "o-detail", dashed = true } = {}) {
  return el("circle", { cx: s, cy: t, r, cls: cls + (dashed ? " o-dashed" : "") + " o-nofill" }, face.g);
}
/** An engraved label on a face, in mono caps. size is the cap height's em, in world units. Use only when the object would carry it. */
function label(face, text, [s, t], size = 4) {
  const node = el("text", { x: s, y: t, cls: "o-label", "font-size": size }, face.g);
  node.textContent = String(text).toUpperCase();
  return node;
}
/** A row of n short slanted slots, a vent: from (s, t), each len long, gap apart. */
function slots(face, [s, t], n = 6, { len = 3, gap = 1.6, slant = 0.6 } = {}) {
  let d = "";
  for (let i = 0; i < n; i++) d += `M${r2(s + i * gap)} ${r2(t)}l${r2(slant)} ${r2(-len)}`;
  return el("path", { d, cls: "o-detail o-nofill" }, face.g);
}
/** A rounded rectangle on a face. */
function panel(face, [s0, t0, s1, t1], r = 1, cls = "o-detail o-nofill") {
  return el("rect", { x: s0, y: t0, width: s1 - s0, height: t1 - t0, rx: r, cls }, face.g);
}
/** Grey hatching on a face, inside [s0, t0, s1, t1]: lines along t, gap apart. Texture only. */
function hatch(face, [s0, t0, s1, t1], gap = 1.6, cls = "o-hatch") {
  let d = "";
  for (let s = s0 + gap / 2; s < s1; s += gap) d += `M${r2(s)} ${r2(t0)}V${r2(t1)}`;
  return el("path", { d, cls: cls + " o-nofill" }, face.g);
}
/**
 * Lines printed on a face, along paths of world points on (or seen through) its plane: a seam, a map's coastlines.
 * cls "o-detail", or "o-hatch" for a fainter line. Returns { node, set(paths) }, set redrawing them. Drawn in screen
 * space from the face's own (s, t), redrawn as the face moves, so long lines measure where they are drawn.
 */
function trace(face, paths = [], cls = "o-detail") {
  const node = el("path", { cls: cls + " o-nofill" }, face.g.parentNode);
  let loc = [];
  const draw = () => {
    const [a, b, c, d] = face.m, [ex, ey] = face.E;
    node.setAttribute("d", loc.map((p) => line(p.map(([s, t]) => [ex + s * a + t * c, ey + s * b + t * d]))).join(""));
  };
  face.placed.add(draw);
  const set = (ps) => { loc = ps.map((p) => p.map((q) => face.local(q))); draw(); };
  set(paths);
  return { node, set };
}
const GRID_MIN = 28;
/**
 * The floor's tile grid over [x0, y0, x1, y1] in world units, cell apart, fading out towards its edge.
 * Returns the floor face it is drawn in: texture drawn there (hatched tiles) goes with the grid when
 * the grid is turned off (rule F1).
 */
function grid(sc, [x0, y0, x1, y1], cell = 20) {
  const f = sc.floorFace();
  // never denser than GRID_MIN viewBox units between lines on screen: a tile is coarsened by whole steps (G1)
  const o = sc.cam.project([0, 0, 0]), ex = sc.cam.project([1, 0, 0]), ey = sc.cam.project([0, 1, 0]);
  const X = [ex[0] - o[0], ex[1] - o[1]], Y = [ey[0] - o[0], ey[1] - o[1]], cross = Math.abs(X[0] * Y[1] - X[1] * Y[0]);
  const gapPerUnit = Math.min(cross / Math.hypot(...Y), cross / Math.hypot(...X));   // screen distance between lines one unit apart
  cell *= Math.max(1, Math.ceil(GRID_MIN / (cell * gapPerUnit)));
  let d = "";
  for (let x = x0; x <= x1 + 1e-6; x += cell) d += `M${r2(x)} ${r2(y0)}V${r2(y1)}`;
  for (let y = y0; y <= y1 + 1e-6; y += cell) d += `M${r2(x0)} ${r2(y)}H${r2(x1)}`;
  const id = "o-fade" + ++ids, defs = el("defs", {}, sc.svg);
  const gr = el("radialGradient", { id: id + "g", cx: 0.5, cy: 0.5, r: 0.5 }, defs);
  el("stop", { offset: 0.35, "stop-color": "#fff" }, gr);
  el("stop", { offset: 1, "stop-color": "#fff", "stop-opacity": 0 }, gr);
  const m = el("mask", { id, maskContentUnits: "objectBoundingBox" }, defs);
  el("rect", { width: 1, height: 1, fill: `url(#${id}g)` }, m);
  f.g.setAttribute("mask", `url(#${id})`);
  f.g.classList.add("o-gridlayer");
  el("path", { d, cls: "o-grid o-nofill" }, f.g);
  return f;
}

/* ----------------------------------------------------------------- focus */

const FADE = 140;
/** How far apart blue hatch lines are on screen, in viewBox units, on every face of every figure (H1). */
const HATCH_GAP = 3;
/** Their one angle on screen, whatever the face: 45° clockwise from the horizontal, top left to bottom right (H1). */
const HATCH_ANGLE = 45;
/**
 * Blue hatch lines over [s0, t0, s1, t1] on a face, as a path in its (s, t): at HATCH_ANGLE on screen and
 * HATCH_GAP apart there, whichever way the face turns. Lines are levels of one screen measure, so they stay
 * fixed to the face and a moving area uncovers them.
 */
function blueHatch(face, [s0, t0, s1, t1], polys = null) {
  const [a, b, c, d] = face.m, k = rad(HATCH_ANGLE), n = [-Math.sin(k), Math.cos(k)];   // the lines' screen normal
  const m = [a * n[0] + b * n[1], c * n[0] + d * n[1]], mm = Math.hypot(...m);           // that normal's measure in (s, t)
  if (mm < 1e-6) return "";                                                               // the face is edge-on
  const e = [-m[1] / mm, m[0] / mm], cs = (s0 + s1) / 2, ct = (t0 + t1) / 2;
  const lv = [[s0, t0], [s1, t0], [s0, t1], [s1, t1]].map(([s, t]) => m[0] * s + m[1] * t);
  let out = "";
  for (let L = Math.ceil(Math.min(...lv) / HATCH_GAP) * HATCH_GAP; L <= Math.max(...lv); L += HATCH_GAP) {
    const off = (L - (m[0] * cs + m[1] * ct)) / (mm * mm), ps = cs + m[0] * off, pt = ct + m[1] * off;
    // trimmed to the box, so the hatching reaches no further than what it fills
    let lo = -Infinity, hi = Infinity;
    for (const [p, q, a0, a1] of [[ps, e[0], s0, s1], [pt, e[1], t0, t1]]) {
      if (Math.abs(q) < 1e-9) continue;
      const u0 = (a0 - p) / q, u1 = (a1 - p) / q;
      lo = Math.max(lo, Math.min(u0, u1)); hi = Math.min(hi, Math.max(u0, u1));
    }
    if (hi - lo <= 1e-6) continue;
    if (!polys) { out += `M${r2(ps + e[0] * lo)} ${r2(pt + e[1] * lo)}L${r2(ps + e[0] * hi)} ${r2(pt + e[1] * hi)}`; continue; }
    // an area's lines are cut to its outline here, not only clipped, so each line is only as long as it is drawn
    // and the hatching measures where it shows (C1)
    const cuts = [];
    for (const poly of polys) for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], d = [b[0] - a[0], b[1] - a[1]], den = e[0] * d[1] - e[1] * d[0];
      if (Math.abs(den) < 1e-12) continue;
      const u = ((a[0] - ps) * d[1] - (a[1] - pt) * d[0]) / den, w = ((a[0] - ps) * e[1] - (a[1] - pt) * e[0]) / den;
      if (w >= 0 && w < 1) cuts.push(u);
    }
    cuts.sort((x, y) => x - y);
    for (let k = 0; k + 1 < cuts.length; k += 2) {
      const u0 = Math.max(lo, cuts[k]), u1 = Math.min(hi, cuts[k + 1]);
      if (u1 - u0 > 1e-6) out += `M${r2(ps + e[0] * u0)} ${r2(pt + e[1] * u0)}L${r2(ps + e[0] * u1)} ${r2(pt + e[1] * u1)}`;
    }
  }
  return out;
}
/** move(face, at) for a focus mark: it fades out where it is and in where it goes (rule I6). */
function traveller(node, face, at, put) {
  node.classList.add("o-travel");
  let here = face, where = at, timer = 0;
  return (face2, at2 = where) => {
    if (face2 === here && at2.length === where.length && at2.every((v, i) => v === where[i])) { clearTimeout(timer); node.classList.remove("o-out"); return; }
    here = face2; where = at2;
    clearTimeout(timer);
    if (motion.reduced) { put(face2, at2); return; }
    node.classList.add("o-out");
    timer = setTimeout(() => { put(here, where); node.classList.remove("o-out"); }, FADE);
  };
}

/**
 * The focus: the one blue thing in a figure. area(face) hatches a region of a
 * face in blue lines (one screen angle and spacing for every face, H1) with a thin blue edge, and no fill (a beam on the floor, a path, a zone),
 * given its outline as world points; patch() hatches a rounded rectangle on a
 * face; beam() is an area that starts at its source. The focus is always blue
 * hatching (F2): ping(), led() and edge() are refused.
 * Each returns a handle whose set() moves it; set(null) clears an area.
 */
const focus = {
  area(face) {
    const g = el("g", { cls: "o-focus-area" }, face.g);
    const id = "o-clip" + ++ids;
    const clip = el("path", {}, el("clipPath", { id }, g));
    const tint = el("path", { cls: "o-focus-tint" }, g);
    const lines = el("path", { cls: "o-focus o-nofill o-thin", "clip-path": `url(#${id})` }, g);
    const edge = el("path", { cls: "o-focus o-nofill o-thin" }, g);
    let here = face, last = null, box = null, polys = null;
    const draw = () => lines.setAttribute("d", box ? blueHatch(here, box, polys) : "");
    const seen = new Set(), hook = (f) => { if (!seen.has(f)) { seen.add(f); f.placed.add(() => here === f && draw()); } };
    hook(face);
    // the area's outline: one, or several apart that make one focus (the lines of a typed page)
    const many = (pts) => !!pts && pts.length > 0 && Array.isArray(pts[0]) && Array.isArray(pts[0][0]);
    const put = (locs, f) => {
      if (f !== here) { here = f; last = null; hook(f); }
      const shapes = locs.filter((l) => l.length > 2), d = shapes.map(closed).join("");
      if (d === last) return;
      last = d;
      for (const n of [clip, tint, edge]) n.setAttribute("d", d);
      box = null; polys = shapes.length ? shapes : null;
      if (d) {
        box = [Infinity, Infinity, -Infinity, -Infinity];
        for (const [s, t] of shapes.flat()) box = [Math.min(box[0], s), Math.min(box[1], t), Math.max(box[2], s), Math.max(box[3], t)];
      }
      draw();
    };
    const local = (points, f) => (!points ? [] : many(points) ? points.map((pl) => pl.map((p) => f.local(p))) : [points.map((p) => f.local(p))]);
    /** The area's outline, as world points on the face's plane (by default the one it is on), or a list of outlines
     *  that together make the one focus; null clears it. */
    const set = (points, f = here) => put(local(points, f), f);
    // move(face, points) takes the area to another part, fading across (I6), as a patch's move does; the points are
    // read on that face as it is now, so a part that starts to move during the fade still gets its own outline
    const travel = traveller(g, face, [], (f, loc) => { f.g.appendChild(g); put(loc, f); });
    return { g, set, move: (f, points) => travel(f, local(points, f)) };
  },
  /**
   * The whole of a part as the focus: every face of it the viewer sees, hatched as one, its silhouette edge to edge
   * (F4): a hammer's head, a key. solids: one solid, or several that make one part (a key's bow and blade). It rides
   * with the part wherever the part moves, and is drawn with each solid, so what stands in front still covers it.
   */
  solid(solids) {
    const list = [solids].flat(), groups = [];
    list.forEach((x, i) => {
      // one focus: the first group is the mark, the rest are its parts
      // first in the solid's lines, so its edges, its details (a key's cuts, a vent) and its outline all read over it
      const layer = x.g.querySelector(".o-l-lines");
      const g = el("g", { cls: i ? "o-focus-area o-focus-part" : "o-focus-area o-focus-body" });
      layer.insertBefore(g, layer.firstChild);
      const id = "o-clip" + ++ids, clip = el("path", {}, el("clipPath", { id }, g));
      const tint = el("path", { cls: "o-focus-tint" }, g);
      const lines = el("path", { cls: "o-focus o-nofill o-thin", "clip-path": `url(#${id})` }, g);
      const edge = el("path", { cls: "o-focus o-nofill o-thin" }, g);
      const screen = { m: [1, 0, 0, 1] };
      const redraw = () => {
        const shape = x.outline() ?? [];
        const d = shape.length > 2 ? closed(shape) : "";
        for (const n of [clip, tint, edge]) n.setAttribute("d", d);
        if (!d) { lines.setAttribute("d", ""); return; }
        const xs = shape.map((p) => p[0]), ys = shape.map((p) => p[1]);
        lines.setAttribute("d", blueHatch(screen, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], [shape]));
      };
      const draw0 = x.draw;
      x.draw = function () { draw0.apply(this, arguments); redraw(); };
      groups.push({ g, redraw });
      redraw();
    });
    return { g: groups[0].g, set() { groups.forEach((q) => q.redraw()); } };
  },
  /**
   * A patch: blue hatching in a rounded rectangle [s0, t0, s1, t1] on a face, with a thin blue edge: the live
   * unit's lid, a drawer's label holder, a chest panel. r rounds its corners (half its shorter side makes a disc);
   * a fifth number in the rectangle rounds that one alone, for parts of different shapes.
   * move(face, rect) takes it to another part, fading across (I6). Make it big enough to show its hatching: at
   * least three lines (C10).
   */
  patch(face, rect, { r = 1 } = {}) {
    const g = el("g", { cls: "o-focus-area o-focus-patch" }, face.g);
    const id = "o-clip" + ++ids;
    const clip = el("rect", {}, el("clipPath", { id }, g));
    const tint = el("rect", { cls: "o-focus-tint" }, g);
    const lines = el("path", { cls: "o-focus o-nofill o-thin", "clip-path": `url(#${id})` }, g);
    const edge = el("rect", { cls: "o-focus o-nofill o-thin" }, g);
    let here = face, box = rect;
    const draw = () => lines.setAttribute("d", blueHatch(here, box)), seen = new Set();
    const set = ([s0, t0, s1, t1, rc = r], f = here) => {
      here = f; box = [s0, t0, s1, t1];
      if (!seen.has(f)) { seen.add(f); f.placed.add(() => here === f && draw()); }
      const rr = Math.min(rc, (s1 - s0) / 2, (t1 - t0) / 2);
      for (const n of [clip, tint, edge]) { n.setAttribute("x", s0); n.setAttribute("y", t0); n.setAttribute("width", s1 - s0); n.setAttribute("height", t1 - t0); n.setAttribute("rx", rr); }
      draw();
    };
    set(rect);
    return { g, set, move: traveller(g, face, rect, (f, rc) => { f.g.appendChild(g); set(rc, f); }) };
  },
  /**
   * A beam: a blue area on a face that starts at its source, as wide as the source, and opens out (B1).
   * set({ from, angle, width, spread, reach }) in world units and degrees; from is the source's centre on the face's plane.
   */
  beam(face) {
    const area = focus.area(face);
    return {
      g: area.g,
      set({ from, angle, width, spread = 20, reach = 60 }) {
        const a = rad(angle), d = [Math.cos(a), Math.sin(a)], n = [-d[1], d[0]], w = width / 2, z = from[2], pts = [];
        pts.push([from[0] + n[0] * w, from[1] + n[1] * w, z]);
        for (let k = 0; k <= 16; k++) {
          const b = a + rad(spread) - (2 * rad(spread) * k) / 16;
          pts.push([from[0] + reach * Math.cos(b), from[1] + reach * Math.sin(b), z]);
        }
        pts.push([from[0] - n[0] * w, from[1] - n[1] * w, z]);
        area.set(pts);
      },
    };
  },
  // the focus is always blue hatching (F2): a dot or a lit outline is refused out loud
  ping() { throw new Error("F2: the focus is always blue hatching, never a dot: use focus.patch(face, [s0, t0, s1, t1]) on the part's face"); },
  led() { throw new Error("F2: the focus is always blue hatching, never a lit dot: use focus.patch(face, [s0, t0, s1, t1]) round the indicator, or on the panel it lights"); },
  edge() { throw new Error("F2: the focus is always blue hatching, never an outline: use focus.patch on a face of the object, or focus.area round it"); },
};

/* ----------------------------------------------------------------- hover */

function inside([x, y], poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * Hover over a scene's targets, with intent (RULES.md, S4, S5, I2, I3, I4).
 * targets: [{ solid, ... }], any shape the figure likes; call it once the
 * scene is drawn at rest, since rest silhouettes are the hit areas. change(t)
 * is called with the new target, or null for rest. move(point) also reports
 * every pointer move, for figures that follow the pointer between targets,
 * and leave() when the pointer leaves the figure.
 * Returns { current, pick(t), release() }.
 */
function hover(ctx, sc, targets, { change, move, leave, dwell = 90, linger = 180, slow = 0.25 } = {}) {
  const solidsOf = (t) => t.solids ?? [t.solid];
  const rest = new Map(targets.map((t) => [t, solidsOf(t).map((s) => s.outline().slice())]));
  targets.forEach((t, i) => solidsOf(t).forEach((s) => { s.g.dataset.oTarget = String(i); }));
  ctx.hovers?.push({ targets, sc });
  const state = { current: null };
  let pending = null, since = 0, timer = 0, last = null, speed = 0;
  // What is under the pointer is the front-most solid whose silhouette holds it, as drawn now, in paint
  // order (S4): a target, or structure that blocks the pointer. Only where nothing is hit does the picked
  // target keep its rest spot, so a part that moves away from the pointer is not dropped (S5).
  const under = (p) => {
    const order = sc.order.length ? sc.order : sc.solids;
    for (let i = order.length - 1; i >= 0; i--) {
      if (!(order[i].hit ? order[i].hit(p) : inside(p, order[i].outline?.() ?? []))) continue;
      return targets.find((x) => solidsOf(x).includes(order[i])) ?? null;
    }
    const cur = state.current;
    return cur && rest.get(cur).some((o) => inside(p, o)) ? cur : null;
  };
  const commit = (t) => {
    clearTimeout(timer);
    if (t === state.current) return;
    state.current = t;
    change?.(t);
  };
  // A new target is taken when the pointer is slow over it, or has paused on it for `dwell`;
  // every move resets the pause, so a fast sweep takes nothing until it slows or stops (I2).
  // Rest is taken only after `linger` off every target (I3).
  const consider = (now) => {
    clearTimeout(timer);
    if (pending === state.current) return;
    if (!pending) { timer = setTimeout(() => commit(null), linger); return; }
    if (speed < slow && now - since >= 30) return commit(pending);
    timer = setTimeout(() => commit(pending), dwell);
  };
  ctx.onPointer({
    move(p, e) {
      // a tap picks at once, and the pick stays until a tap elsewhere (touch has no hover to read intent from)
      if (e?.pointerType === "touch" && e.type === "pointerdown") { pending = under(p); commit(pending); move?.(p, state.current); return; }
      const now = e?.timeStamp ?? performance.now();
      if (last) {
        const d = Math.hypot(p[0] - last.p[0], p[1] - last.p[1]), dt = Math.max(1, now - last.t);
        speed = speed * 0.6 + (d / dt) * 0.4;
      }
      last = { p, t: now };
      const t = under(p);
      if (t !== pending) { pending = t; since = now; }
      consider(now);
      move?.(p, state.current);
    },
    leave(e) {
      if (e?.pointerType === "touch") return;
      pending = null; since = performance.now(); last = null; speed = 0; consider(since); leave?.();
    },
  });
  const doc = ctx.host.ownerDocument, outside = (e) => { if (!ctx.host.contains(e.target) && state.current) { pending = null; commit(null); leave?.(); } };
  doc.addEventListener("pointerdown", outside);
  ctx.add(() => { clearTimeout(timer); doc.removeEventListener("pointerdown", outside); });
  return Object.assign(state, { pick: (t) => { pending = t; commit(t); }, release: () => { pending = null; commit(null); } });
}

/* -------------------------------------------------------------- gestures */

/**
 * Gestures: what a part does when it is picked, the way the real object would. Three kinds:
 *   pose  it springs there while picked and back on release: lift, slide, press, hinge
 *   act   it plays once on pick and ends where it began: spin (n turns), hop, riffle, rock
 *   hold  it runs while picked, then settles: spin({ held: true }), bob, beat, sweep
 * Every gesture takes { solids } (the part's own by default: give a subset to move one piece, the antenna
 * of a head), { delay } in ms (follow-through: the head lifts, then the antenna starts) and, for those that
 * turn, { pivot, axis }. A part's gestures nest: each after the first acts in the part's own frame, as if
 * the ones before had not happened, so [lift(4), spin({ solids: [vane] })] spins the vane about its own
 * axis and lifts it with the head. Motion stays calm (RULES.md M1-M4): springs never bounce, acts end
 * where they began within a budget, holds settle when the pointer leaves, and under reduced motion only
 * the poses land, at once.
 */
const gesture = (kind, o, at, extra = {}) => ({
  kind, at, solids: o.solids ?? null, delay: o.delay ?? 0, ms: o.ms ?? 640, stagger: o.stagger ?? 0,
  period: o.period ?? 1000, pivot: o.pivot ?? null, axis: o.axis ?? "z", ...extra,
});
const progress = (st, g, i) => clamp((st.e - i * g.stagger) / g.ms, 0, 1);
/** Straight up, n units, while picked. */
const lift = (n, o = {}) => gesture("pose", o, (st) => xf.translate([0, 0, n * st.k]));
/** Along a rail, d = [dx, dy, dz], while picked: a drawer, a rack unit. */
const slide = (d, o = {}) => gesture("pose", o, (st) => xf.translate(d.map((v) => v * st.k)));
/** Along d, as far as the hand drags it: a pull cord, a lever, a handle. It follows the pointer from rest towards d,
 *  giving less the further it goes, and springs home when let go; interact's drop(part, amount) hears the release. */
const drag = (d, o = {}) => gesture("pose", o, (st) => xf.translate(d.map((v) => v * (st.drag ?? st.k))), { drag: d });
/** About { pivot, axis }, as far as the hand drags it sideways, up to { angle } either way: a pendant on its chain, a
 *  sign on its hook. Positive angle swings to the viewer's right as the hand goes right; springs home when let go. */
/** Once, along d, when a dragged part is let go, scaled by how far it was dragged: a pull cord's bounce on its chain as
 *  it snaps home. One dip and back, never an oscillation (I5); give it a delay so it lands as the part arrives. */
const recoil = (d, o = {}) => gesture("release", { ms: 460, ...o }, (st, i, sl) => xf.translate(d.map((v) => v * (st.amp ?? 1) * Math.sin(Math.PI * progress(st, sl.g, i)))));
const tilt = (o) => gesture("pose", o, (st, i, sl) => xf.rotate(sl.axis, (o.angle ?? 20) * (st.side ?? st.k), sl.pivot), { tilt: true });
/** Straight down, n units, while picked: a button, a key. */
const press = (n, o = {}) => gesture("pose", o, (st) => xf.translate([0, 0, -n * st.k]));
/** Taller by `by` times its height while picked, from its base (pivot's z, the floor by default): a bar on a chart rising. */
const grow = (by, o = {}) => gesture("pose", o, (st, i, sl) => xf.stretch(1 + (by - 1) * st.k, o.pivot ? o.pivot[2] : 0));
/** Turns `angle` degrees about `axis` through `pivot` while picked: an arm at the shoulder, a lid at its hinge. */
const hinge = (o) => gesture("pose", o, (st, i, sl) => xf.rotate(sl.axis, (o.angle ?? 90) * st.k, sl.pivot));
/**
 * Spins about `axis` (z by default) through `pivot` (the solids' centre by default). Once on pick, `turns`
 * turns in `ms`; or with { held: true }, round and round every `period` ms while picked, settling on release
 * at the next turn, or the next of `sym` equal positions (a two-bladed vane: sym 2).
 */
const spin = (o = {}) => o.held
  ? gesture("hold", { period: 900, ...o }, (st, i, sl) => xf.rotate(sl.axis, 360 * st.phase, sl.pivot), { settle: "whole", sym: o.sym ?? 1 })
  : gesture("act", { ms: 720, ...o }, (st, i, sl) => xf.rotate(sl.axis, 360 * (o.turns ?? 1) * easeOut(progress(st, sl.g, i)), sl.pivot));
/** Up `h` and back down once, on pick: a rocket's hop. With { stagger } each solid goes in turn. */
const hop = (h = 8, o = {}) => gesture("act", { ms: 620, ...o }, (st, i, sl) => xf.translate([0, 0, h * Math.sin(Math.PI * progress(st, sl.g, i))]));
/** Cards riffling: each solid hops a little, one after another. */
const riffle = (h = 3, o = {}) => hop(h, { ms: 360, stagger: 60, ...o });
/** Tips `angle` degrees about `axis` through `pivot` and back, once: a parcel nudged, a nod. */
const rock = (o) => gesture("act", { ms: 600, ...o }, (st, i, sl) => xf.rotate(sl.axis, (o.angle ?? 10) * Math.sin(Math.PI * progress(st, sl.g, i)), sl.pivot));
/** Rises and falls `h` every `period` ms while picked; with { stagger } (a share of a cycle) as a wave across the solids. */
const bob = (h = 2.5, o = {}) => gesture("hold", { period: 900, ...o }, (st, i, sl) => xf.translate([0, 0, st.level * h * (1 - Math.cos(2 * Math.PI * (st.phase - i * (o.stagger ?? 0)))) / 2]), { settle: "fade" });
/** Swings `angle` degrees either way about `axis` through `pivot` while picked: a baton beating time. */
const beat = (o) => gesture("hold", { period: 760, ...o }, (st, i, sl) => xf.rotate(sl.axis, st.level * (o.angle ?? 16) * Math.sin(2 * Math.PI * st.phase), sl.pivot), { settle: "fade" });
/** Circles `r` units about where it stands, on the level, while picked: a magnifier scanning. */
const sweep = (r = 3, o = {}) => gesture("hold", { period: 1400, ...o }, (st) => { const a = 2 * Math.PI * st.phase; return xf.translate([st.level * r * Math.cos(a), st.level * r * Math.sin(a), 0]); }, { settle: "fade" });

/** The longest an act may run, delay and stagger included, and the shortest a hold's cycle (M3). */
const ACT_MAX = 900, HOLD_MIN = 450;

/* -------------------------------------------------------------- interact */

/**
 * One part answers at a time, the way RULES.md says: the whole of a figure's
 * pointer work in one call, so no rule is left to the figure to remember.
 *
 * parts: [{ solid } or { solids: [...] }, plus anything the figure wants].
 * A part's solids are joined into one object. A part may carry its own
 * `gesture` (one, or a list that nests: see the gestures above). Options:
 *   move     { lift: n } or { slide: [dx, dy, dz] }: the gesture of every part that names none.
 *            Every motion runs on the engine's springs and tweens, never the figure's own (I5).
 *   focus    { mark, on(part) -> [face, at] }: the focus mark travels to the picked part, or to `rest` (I6);
 *            for focus.patch, on(part) -> [face, [s0, t0, s1, t1]].
 *   rest     the part the focus marks when nothing is picked.
 *   read     (part) -> the read-out's few words; "rest" when nothing is picked (I1).
 *   change   (part or null): anything else the figure does when the pick changes.
 *   follow   (point, part or null) on every pointer move, for figures that track the pointer (an aim).
 *   leave    () when the pointer leaves the figure.
 *   steps    [part or null, ...]: what phase(k) shows for a deck's step k; by default phase(0) is rest and
 *            phase(k) the k-th part.
 * The picked part's outline goes strong (I7). The figure also answers the keyboard (arrows, Home, End,
 * Escape) and a tap; mount's { play: true } walks through the parts on its own. Returns hover's handle.
 */
function interact(ctx, sc, parts, { move = null, focus: mark = null, rest = null, read = (p) => p.name ?? "part", change, follow, leave, steps = null, drop } = {}) {
  const base = move?.lift != null ? lift(move.lift) : move?.slide ? slide(move.slide) : null;
  const centre = (solids) => {
    const b = solids.map((x) => x.bounds()), lo = [0, 1, 2].map((k) => Math.min(...b.map((q) => q.min[k]))), hi = [0, 1, 2].map((k) => Math.max(...b.map((q) => q.max[k])));
    return lo.map((v, k) => (v + hi[k]) / 2);
  };
  const items = parts.map((p) => {
    const solids = p.solids ?? [p.solid];
    const slots = [p.gesture ?? base].flat().filter(Boolean).map((g) => {
      // solids may be grouped, [[body, mast], [body, mast]]: a group moves as one, so a wave keeps a mast on its body
      const groups = (g.solids ?? solids).map((x) => [x].flat()), on = groups.flat(), idx = groups.flatMap((grp, i) => grp.map(() => i));
      for (const x of on) if (x.structure) throw new Error("S3: a part that moves cannot be structure");
      if ((g.kind === "act" || g.kind === "release") && g.delay + g.ms + g.stagger * (groups.length - 1) > ACT_MAX) console.warn(`[stitch] M3: an act on "${read(p)}" runs ${g.delay + g.ms + g.stagger * (groups.length - 1)} ms, over ${ACT_MAX}; make it quicker`);
      if (g.kind === "hold" && g.period < HOLD_MIN) console.warn(`[stitch] M3: a hold on "${read(p)}" cycles every ${g.period} ms, under ${HOLD_MIN}; slow it down`);
      return { g, on, idx, n: groups.length, axis: g.axis, pivot: g.pivot ?? centre(on), phase: 0, level: spring(0), v: 0, a: 0, target: 0, stopping: false };
    });
    // a drag moves its solids by the sum of the drag gestures on the way to them: the reach is the furthest of them goes
    const drags = slots.filter((sl) => sl.g.drag), reach = drags.reduce((a, sl) => a.map((v, i) => v + sl.g.drag[i]), [0, 0, 0]);
    return { p, solids, slots, k: spring(0), hand: spring(0), side: spring(0), tr: -Infinity, amp: 0, drags: drags.length > 0, tilts: slots.some((sl) => sl.g.tilt), reach, t0: -Infinity, picked: false };
  });
  for (const it of items) {
    if (it.solids.length > 1) sc.join(...it.solids);
    for (const s of it.solids) s.name ??= read(it.p);
  }
  // each solid's transform: the part's gestures composed, the last innermost
  const frameOf = (it, stateOf) => {
    const M = new Map();
    for (let j = it.slots.length - 1; j >= 0; j--) {
      const sl = it.slots[j], st = stateOf(it, sl);
      sl.on.forEach((x, i) => M.set(x, xf.compose(sl.g.at(st, sl.idx[i], sl), M.get(x) ?? xf.identity())));
    }
    return M;
  };
  const live = (now) => (it, sl) => ({ k: clamp(it.k.x, 0, 1), e: reducedMotion() ? Infinity : now - (sl.g.kind === "release" ? it.tr : it.t0) - sl.g.delay, amp: it.amp, phase: sl.phase, level: clamp(sl.level.x, 0, 1), drag: sl.g.drag ? clamp(it.hand.x, 0, 1) : undefined, side: sl.g.tilt ? clamp(it.side.x, -1, 1) : undefined });
  const apply = (stateOf) => { for (const it of items) for (const [x, m] of frameOf(it, stateOf)) x.pose(m); };
  const clock = ctx.join((dt, now) => {
    let moving = false;
    for (const it of items) {
      if (it.k.step(dt)) moving = true;
      if (it.hand.step(dt)) moving = true;
      if (it.side.step(dt)) moving = true;
      for (const sl of it.slots) {
        const g = sl.g;
        if (g.kind === "act" && !reducedMotion() && now - it.t0 < g.delay + g.ms + g.stagger * (sl.n - 1) + 32) moving = true;
        if (g.kind === "release" && !reducedMotion() && now - it.tr < g.delay + g.ms + g.stagger * (sl.n - 1) + 32) moving = true;
        if (g.kind !== "hold") continue;
        const want = it.picked && !reducedMotion() && now - it.t0 >= g.delay, v0 = 1000 / g.period;
        sl.level.target = want ? 1 : 0;
        if (sl.level.step(dt)) moving = true;
        if (reducedMotion()) { sl.level.x = 0; sl.phase = g.settle === "whole" ? Math.round(sl.phase * g.sym) / g.sym : 0; sl.stopping = false; continue; }
        if (want) { sl.stopping = false; sl.phase += v0 * dt; moving = true; if (now - it.t0 < g.delay + 32) moving = true; continue; }
        if (g.settle === "whole") {
          // slow to a stop, evenly, on the next of its `sym` equal positions, no sooner than a quarter turn on
          const q = 1 / g.sym, off = sl.phase / q - Math.round(sl.phase / q);
          if (!sl.stopping && Math.abs(off) < 1e-6) continue;
          if (!sl.stopping) {
            let dist = Math.ceil(sl.phase / q - 1e-9) * q - sl.phase;
            if (dist < 0.25 * q) dist += q;
            Object.assign(sl, { stopping: true, target: sl.phase + dist, v: v0, a: (v0 * v0) / (2 * dist) });
          }
          sl.v = Math.max(0, sl.v - sl.a * dt);
          sl.phase = Math.min(sl.target, sl.phase + sl.v * dt);
          if (sl.v <= 1e-3 || sl.phase >= sl.target - 1e-6) { sl.phase = sl.target; sl.stopping = false; } else moving = true;
        } else if (sl.level.x > 1e-3) { sl.phase += v0 * dt; moving = true; } else sl.phase = 0;
      }
    }
    apply(live(now));
    sc.update();
    return moving;
  });
  const handle = hover(ctx, sc, parts, {
    change(p) {
      const now = performance.now();
      for (const it of items) {
        const was = it.picked;
        it.picked = it.p === p;
        if (it.picked && !was) it.t0 = now;
        it.k.target = it.picked ? 1 : 0;
        for (const x of it.solids) x.emphasis(it.picked);
      }
      const on = p ?? rest;
      if (mark && on) mark.mark.move(...mark.on(on));
      ctx.read(p ? read(p) : "rest");
      change?.(p);
      clock.wake();
    },
    move: follow,
    leave,
  });
  // for the checker (M1): every part through its whole motion, the others where they are; then back
  const entry = ctx.hovers?.[ctx.hovers.length - 1];
  if (entry) {
    entry.motions = items.flatMap((it) => it.slots.map((sl) => ({ part: read(it.p), kind: sl.g.kind, run: sl.g.delay + sl.g.ms + sl.g.stagger * (sl.n - 1), period: sl.g.period })));
    entry.sweep = (visit, n = 10) => {
      const now = performance.now();
      for (const it of items) {
        if (!it.slots.length) continue;
        for (let q = 0; q <= n; q++) {
          const f = q / n;
          apply((other, sl) => other === it
            ? { k: f, e: f * (sl.g.ms + sl.g.stagger * (sl.n - 1)), phase: sl.phase + f, level: 1 }
            : live(now)(other, sl));
          sc.update();
          visit(read(it.p), f);
        }
      }
      apply(live(performance.now()));
      sc.update();
    };
  }

  // the keyboard: the figure takes focus; arrows step through the parts, Escape returns to rest
  const host = ctx.host, n = parts.length;
  host.tabIndex = 0;
  host.setAttribute("role", "group");
  const key = (e) => {
    const i = parts.indexOf(handle.current), step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step) handle.pick(parts[i < 0 ? (step > 0 ? 0 : n - 1) : (i + step + n) % n]);
    else if (e.key === "Home") handle.pick(parts[0]);
    else if (e.key === "End") handle.pick(parts[n - 1]);
    else if (e.key === "Escape") { handle.release(); leave?.(); }
    else return;
    stopPlay();
    e.preventDefault();
  };
  const blur = () => { if (!ctx.host.matches(":hover")) { handle.release(); leave?.(); } };
  host.addEventListener("keydown", key);
  host.addEventListener("blur", blur);

  // play: an unseen hand picks each part in turn, then rests, until a real one arrives (for decks, thumbnails)
  let playing = false, ptimer = 0, k = -1, held = false;
  const tick = () => {
    if (!playing || held) return;
    k = (k + 1) % (n + 1);
    if (k === n) { handle.release(); leave?.(); } else handle.pick(parts[k]);
    ptimer = setTimeout(tick, k === n ? 1600 : 2200);
  };
  const startPlay = () => { if (playing || reducedMotion()) return; playing = true; ptimer = setTimeout(tick, 900); };
  const stopPlay = () => { playing = false; clearTimeout(ptimer); };
  const enter = () => { held = true; clearTimeout(ptimer); };
  const exit = () => { held = false; if (playing) { clearTimeout(ptimer); ptimer = setTimeout(tick, 1200); } };
  host.addEventListener("pointerenter", enter);
  host.addEventListener("pointerleave", exit);
  ctx.controls.play = (on) => (on ? startPlay() : (stopPlay(), handle.release()));
  if (ctx.play) startPlay();

  // steps: a deck's build. phase(0) is rest; phase(k) picks steps[k], or the k-th part
  ctx.controls.phase = (s) => {
    stopPlay();
    const p = steps ? steps[s] ?? null : s > 0 ? parts[(s - 1) % n] : null;
    if (p) handle.pick(p); else { handle.release(); leave?.(); }
  };

  // the hand: press on a part that drags and pull; it follows along its reach, giving less near the end, and stays
  // picked while held, wherever the pointer goes; let go and it springs home, and drop() hears how far it went
  let grip = null;
  const frameAt = (e) => {
    const r = ctx.svg.getBoundingClientRect(), vb = ctx.svg.viewBox.baseVal;
    return [vb.x + ((e.clientX - r.left) / r.width) * vb.width, vb.y + ((e.clientY - r.top) / r.height) * vb.height];
  };
  const grab = (e) => {
    if (e.button > 0) return;
    const it = items[Number(e.target.closest?.("[data-o-target]")?.dataset.oTarget)];
    if (!it?.drags && !it?.tilts) return;
    // the reach on screen; a part that only tilts measures its swing against a reach straight down
    const a = sc.cam.project([0, 0, 0]), b = sc.cam.project(it.drags ? it.reach : [0, 0, -20]), s = [b[0] - a[0], b[1] - a[1]];
    grip = { it, from: frameAt(e), s, len2: s[0] * s[0] + s[1] * s[1] || 1, id: e.pointerId };
    try { host.setPointerCapture(e.pointerId); } catch {}   // a synthetic press has no pointer to capture
    handle.pick(it.p);
    stopPlay();
  };
  const pull = (e) => {
    if (!grip || e.pointerId !== grip.id) return;
    const p = frameAt(e), d = [p[0] - grip.from[0], p[1] - grip.from[1]];
    const f = Math.max(0, (d[0] * grip.s[0] + d[1] * grip.s[1]) / grip.len2), h = grip.it.hand;
    if (grip.it.drags) { h.x = h.target = 1 - Math.exp(-1.4 * f); h.v = 0; }
    // sideways: across the reach, to the viewer's right positive; it gives less the further it goes
    const across = (d[0] * grip.s[1] - d[1] * grip.s[0]) / grip.len2, w = grip.it.side;
    if (grip.it.tilts) { w.x = w.target = Math.tanh(1.2 * across); w.v = 0; }
    handle.pick(grip.it.p);
    clock.wake();
  };
  const letGo = (e) => {
    if (!grip || e.pointerId !== grip.id) return;
    const { it } = grip, amount = it.hand.x;
    grip = null;
    it.hand.target = 0;
    it.side.target = 0;
    it.tr = performance.now(); it.amp = amount;
    clock.wake();
    drop?.(it.p, amount);
  };
  if (items.some((it) => it.drags || it.tilts)) {
    host.addEventListener("pointerdown", grab);
    host.addEventListener("pointermove", pull);
    host.addEventListener("pointerup", letGo);
    host.addEventListener("pointercancel", letGo);
  }

  ctx.add(() => {
    stopPlay();
    host.removeEventListener("pointerdown", grab);
    host.removeEventListener("pointermove", pull);
    host.removeEventListener("pointerup", letGo);
    host.removeEventListener("pointercancel", letGo);
    host.removeEventListener("keydown", key);
    host.removeEventListener("blur", blur);
    host.removeEventListener("pointerenter", enter);
    host.removeEventListener("pointerleave", exit);
  });
  ctx.read("rest");
  return handle;
}

/* ----------------------------------------------------------------- style */

const CSS = `
.o-fig{/*TOKENS light*/--o-ground:#eeeae2;--o-ink:#2a2826;--o-x-count:0.3;--o-x-thread:0.09;--o-x-gap:0.2;--o-x-focus:0.73;--o-x-wobble:0;--o-m-pace:0.4;--o-m-sew:0.5;--o-m-flicker:0.5;--o-m-glow:0.6;--o-m-lift:0.5;/*END*/
display:block;position:relative;user-select:none;-webkit-user-select:none;touch-action:pan-y}
.o-fig{position:relative}
.o-fig>svg{display:block;width:100%;height:auto;overflow:visible}
.o-fig>canvas.o-x{position:absolute;pointer-events:none}
.o-fig[data-o-theme="dark"]{/*TOKENS dark*/--o-ground:#051c2c;--o-ink:#eeeae2;/*END*/}
@media (prefers-color-scheme:dark){.o-fig[data-o-theme="auto"]{/*TOKENS dark*/--o-ground:#051c2c;--o-ink:#eeeae2;/*END*/}}
.o-fig:focus-visible{outline:1.5px solid var(--o-ink);outline-offset:4px;border-radius:8px}
.o-fig .o-live{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.o-fig svg :is(path,circle,rect,line,ellipse){vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}
.o-fig .o-face-top{fill:var(--o-ink)}
.o-fig .o-face-left{fill:color-mix(in srgb,var(--o-ink) calc(var(--o-shade)*100%),var(--o-ink))}
.o-fig .o-face-right{fill:color-mix(in srgb,var(--o-ink) calc(var(--o-shade)*100%),var(--o-ink))}
.o-fig .o-outline{fill:none;stroke:var(--o-ink);stroke-width:var(--o-w-outline);transition:stroke 200ms,stroke-width 200ms}
.o-fig .o-hit{fill:none;stroke:none;pointer-events:none}
.o-fig .o-outline.o-strong{stroke:var(--o-ink);stroke-width:var(--o-w-strong)}
.o-fig .o-travel{transition:opacity 140ms ease-out}
.o-fig .o-out{opacity:0}
.o-fig.o-nogrid .o-gridlayer{display:none}
@media (prefers-reduced-motion:reduce){.o-fig .o-outline,.o-fig .o-travel{transition:none}}
.o-fig .o-edge{stroke:var(--o-ink);stroke-width:var(--o-w-edge)}
.o-fig path.o-edge:not([class*="o-face"]){fill:none}
.o-fig .o-shine{fill:none;stroke:var(--o-ink);stroke-width:1}
.o-fig .o-detail{stroke:var(--o-ink);stroke-width:var(--o-w-detail)}
.o-fig .o-grid{stroke:var(--o-ink);stroke-width:var(--o-w-detail)}
.o-fig .o-hatch{stroke:var(--o-ink);stroke-width:var(--o-w-detail)}
.o-fig .o-mark{fill:var(--o-ink);stroke:none}
.o-fig .o-idle{fill:var(--o-ink);stroke:none}
.o-fig .o-faint{fill:var(--o-ink);stroke:none}
.o-fig .o-nofill{fill:none}
.o-fig .o-dashed{stroke-dasharray:1.5 2.5}
.o-fig .o-ping .o-dashed{stroke-dasharray:1 2.2}
.o-fig .o-label{fill:var(--o-ink);stroke:none;font-family:"Geist Mono",ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.12em;font-weight:500}
.o-fig .o-focus{stroke:var(--o-ink);stroke-width:var(--o-w-focus)}
.o-fig .o-focus.o-thin{stroke-width:0.6}
.o-fig .o-focus-fill{fill:var(--o-ink);stroke:none}
.o-fig .o-focus-tint{fill:none;stroke:none;pointer-events:fill}
`;
const styled = new WeakSet();
function inject(doc) {
  if (styled.has(doc)) return;
  styled.add(doc);
  const s = doc.createElement("style");
  s.setAttribute("data-stitch-style", "");
  s.textContent = CSS.replaceAll(".o-fig", '.o-fig[data-o-engine="stitch"]');   // only this engine's figures
  doc.head.appendChild(s);
}

/* ----------------------------------------------------------------- cells */

/**
 * Stitch's way of drawing (CHANGES.md): a figure is a grid of cells over its frame, and a cross in every cell a solid
 * covers, as on a cross-stitch sampler. The camera casts a ray through each cell's centre and finds the face nearest
 * the viewer. Faces are solid fields of crosses, with no tone; an edge is a gap: a cell is left bare where it borders a
 * nearer face, or another face at a crease, so parts and folds read by the line of bare ground between them, and the
 * silhouette is where the stitching stops. Parts thinner than a cell are threads (one stitch wide); a seam is a line
 * of bare cells along a surface. The focus is in the same ink, in double crosses (an upright cross over the diagonal
 * one), a little heavier. Numbers are tokens:
 * --o-x-count (how many stitches across the frame), --o-x-thread (weight of a cross), --o-x-gap (inset of a cross in its
 * cell), --o-x-focus (how much heavier the focus's crosses are), --o-x-wobble (how far a cross strays, as if by hand).
 */
const v3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};
const turnZ = (p, deg) => { const c = Math.cos(rad(deg)), s = Math.sin(rad(deg)); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; };
/** A convex solid as half-spaces n·p <= d, one face per plane: the ray meets it on the interval where it is inside all
 * of them, and the face nearest the viewer is the plane that ends that interval. */
function convexHit(planes, o, v) {
  let lo = -Infinity, hi = Infinity, face = -1;
  for (let i = 0; i < planes.length; i++) {
    const { n, d } = planes[i], den = v3.dot(n, v), num = d - v3.dot(n, o);
    if (Math.abs(den) < 1e-12) { if (num < 0) return null; continue; }
    const t = num / den;
    if (den > 0) { if (t < hi) { hi = t; face = i; } } else if (t > lo) lo = t;
    if (lo > hi) return null;
  }
  return face < 0 ? null : { t: hi, face: planes[face].face };
}
function convex(planes, pts, opts) {
  return { pts, focus: !!opts.focus, glass: !!opts.glass, motion: opts.motion, hit: (o, v) => convexHit(planes, o, v) };
}
/** The solids a figure is stitched from. Positions are world units, z up; turn is degrees about the vertical. Any solid
 * takes focus: true (double crosses) and glass: true (only its outline is stitched, and what's behind it shows), and any
 * part motion: "flicker" | "glow" | "lift" | "none" to choose its motion over the engine's (see motionOf). */
const cell = {
  /** A box, at its centre-bottom. */
  box({ at = [0, 0, 0], size: [w, d, h], turn = 0, focus, glass, motion } = {}) {
    const ax = [turnZ([1, 0, 0], turn), turnZ([0, 1, 0], turn), [0, 0, 1]], c = v3.add(at, [0, 0, h / 2]), half = [w / 2, d / 2, h / 2];
    const names = [["+x", "-x"], ["+y", "-y"], ["top", "bottom"]], planes = [], pts = [];
    ax.forEach((n, i) => {
      planes.push({ n, d: v3.dot(n, c) + half[i], face: names[i][0] });
      planes.push({ n: v3.mul(n, -1), d: -v3.dot(n, c) + half[i], face: names[i][1] });
    });
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1])
      pts.push(v3.add(c, v3.add(v3.mul(ax[0], sx * half[0]), v3.add(v3.mul(ax[1], sy * half[1]), v3.mul(ax[2], sz * half[2])))));
    return convex(planes, pts, { focus, glass, motion });
  },
  /** Any convex outline [[u, v]], extruded: across the plane "xz" (a ridge along y), "yz" (along x) or "xy" (upright),
   * from `at` for `length`. */
  prism({ points, plane = "xy", at = [0, 0, 0], length, turn = 0, focus, glass, motion } = {}) {
    const axes = { xy: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], xz: [[1, 0, 0], [0, 0, 1], [0, 1, 0]], yz: [[0, 1, 0], [0, 0, 1], [1, 0, 0]] }[plane];
    const [U, V, E] = axes.map((a) => turnZ(a, turn));
    const P = (u, w, e) => v3.add(at, v3.add(v3.mul(U, u), v3.add(v3.mul(V, w), v3.mul(E, e))));
    let area = 0;
    points.forEach((p, i) => { const q = points[(i + 1) % points.length]; area += p[0] * q[1] - q[0] * p[1]; });
    const sgn = area > 0 ? 1 : -1, planes = [], pts = [];
    points.forEach((p, i) => {
      const q = points[(i + 1) % points.length], eu = q[0] - p[0], ew = q[1] - p[1];
      const n = v3.norm(v3.add(v3.mul(U, sgn * ew), v3.mul(V, -sgn * eu)));
      planes.push({ n, d: v3.dot(n, P(p[0], p[1], 0)), face: "side" + i });
      pts.push(P(p[0], p[1], 0), P(p[0], p[1], length));
    });
    planes.push({ n: E, d: v3.dot(E, P(0, 0, length)), face: "end" }, { n: v3.mul(E, -1), d: -v3.dot(E, at), face: "start" });
    return convex(planes, pts, { focus, glass, motion });
  },
  /** A round bar from `from` to `to`, of radius r: upright, lying, any way. */
  cylinder({ from, to, r, focus, glass, motion } = {}) {
    const ax = v3.sub(to, from), L = Math.hypot(...ax), a = v3.norm(ax);
    const hit = (o, v) => {
      const w = v3.sub(o, from), va = v3.dot(v, a), wa = v3.dot(w, a);
      const dv = v3.sub(v, v3.mul(a, va)), dw = v3.sub(w, v3.mul(a, wa));
      const A = v3.dot(dv, dv), B = 2 * v3.dot(dv, dw), C = v3.dot(dw, dw) - r * r;
      let lo = -Infinity, hi = Infinity, face = "side";
      if (A < 1e-12) { if (C > 0) return null; } else {
        const disc = B * B - 4 * A * C; if (disc < 0) return null;
        const s = Math.sqrt(disc); lo = (-B - s) / (2 * A); hi = (-B + s) / (2 * A);
      }
      if (Math.abs(va) < 1e-12) { if (wa < 0 || wa > L) return null; } else {
        let t0 = -wa / va, t1 = (L - wa) / va, f0 = "start", f1 = "end";
        if (t0 > t1) { [t0, t1] = [t1, t0]; [f0, f1] = [f1, f0]; }
        if (t0 > lo) lo = t0;
        if (t1 < hi) { hi = t1; face = f1; }
      }
      return lo > hi ? null : { t: hi, face };
    };
    const pts = [];
    const u = v3.norm(Math.abs(a[2]) < 0.9 ? [-a[1], a[0], 0] : [1, 0, 0]), w = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
    for (let k = 0; k < 12; k++) { const c = Math.cos(k * Math.PI / 6) * r, s = Math.sin(k * Math.PI / 6) * r, off = v3.add(v3.mul(u, c), v3.mul(w, s)); pts.push(v3.add(from, off), v3.add(to, off)); }
    return { pts, focus: !!focus, glass: !!glass, motion, hit };
  },
  /** A ball. */
  sphere({ at, r, focus, glass, motion } = {}) {
    const hit = (o, v) => {
      const w = v3.sub(o, at), b = v3.dot(w, v), c = v3.dot(w, w) - r * r, disc = b * b - c;
      return disc < 0 ? null : { t: -b + Math.sqrt(disc), face: "surface" };
    };
    const pts = [];
    for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; pts.push(v3.add(at, [Math.cos(a) * r, Math.sin(a) * r, 0]), v3.add(at, [0, Math.cos(a) * r, Math.sin(a) * r]), v3.add(at, [Math.cos(a) * r, 0, Math.sin(a) * r])); }
    return { pts, focus: !!focus, glass: !!glass, motion, hit };
  },
  /** A round solid turned about the vertical through `at`, from a profile [[r, z]] rising in z: a bulb, a nose cone.
   * One smooth surface; where the profile ends wide, a flat cap. */
  lathe({ at = [0, 0, 0], profile, focus, glass, motion } = {}) {
    const P = [...profile].sort((p, q) => p[1] - q[1]), z0 = P[0][1], z1 = P[P.length - 1][1], R = Math.max(...P.map((p) => p[0]));
    const rAt = (z) => { for (let i = 1; i < P.length; i++) if (z <= P[i][1]) { const [ra, za] = P[i - 1], [rb, zb] = P[i]; return ra + (rb - ra) * ((z - za) / (zb - za || 1)); } return P[P.length - 1][0]; };
    const bound = cell.cylinder({ from: v3.add(at, [0, 0, z0]), to: v3.add(at, [0, 0, z1]), r: R });
    const inside = (p) => { const z = p[2] - at[2]; return z >= z0 && z <= z1 && Math.hypot(p[0] - at[0], p[1] - at[1]) <= rAt(z); };
    const hit = (o, v) => {
      const b = bound.hit(o, v); if (!b) return null;
      const span = 2 * R + (z1 - z0), steps = 64, dt = span / steps;
      for (let k = 0; k <= steps; k++) {
        const t = b.t - k * dt;
        if (inside(v3.add(o, v3.mul(v, t)))) {
          let a = t, c = t + dt;
          for (let i = 0; i < 8; i++) { const m = (a + c) / 2; inside(v3.add(o, v3.mul(v, m))) ? (a = m) : (c = m); }
          const z = o[2] + v[2] * a - at[2];
          return { t: a, face: z > z1 - 1e-3 * span ? "top" : z < z0 + 1e-3 * span ? "bottom" : "side" };
        }
      }
      return null;
    };
    const pts = [];
    for (const [r, z] of P) for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; pts.push(v3.add(at, [Math.cos(a) * r, Math.sin(a) * r, z])); }
    return { pts, focus: !!focus, glass: !!glass, motion, hit };
  },
  /** A part thinner than a cell along world points: one stitch wide, over whatever is behind it (a filament, a wire). */
  thread({ points, focus, motion } = {}) { return { pts: points, focus: !!focus, motion, line: points, kind: "thread" }; },
  /** A line of bare cells along world points on a surface: a groove, a band, a lid's line. */
  seam({ points } = {}) { return { pts: [], line: points, kind: "seam" }; },
};

/* ---------------------------------------------------------------- motion */

/**
 * Stitch's motion (CHANGES.md), for every figure, from what its parts are, while Play is on (t in seconds; t = 0 is
 * rest, the still look). A part may name its own with motion:, else the engine picks:
 *   flicker  a thread that is the focus shivers from where it starts: a plume, a lit filament (--o-m-flicker)
 *   glow     glass gives light: rays of thread grow out from its outline and pulse (--o-m-glow)
 *   lift     a solid that is the focus rises a little and turns to and fro (--o-m-lift)
 * and every figure sews itself in when Play starts, row by row from the bottom up, left to right and back again, as
 * a sampler is stitched (--o-m-sew, 0 for none).
 */
function motionOf(p) {
  if (p.motion) return p.motion;
  if (p.kind === "thread") return p.focus ? "flicker" : "none";
  if (p.glass) return "glow";
  return p.hit && p.focus ? "lift" : "none";
}
const wave = (t, k) => 0.22 * Math.sin(t * 9 + k * 1.7) + 0.1 * Math.sin(t * 23 + k * 2.3);
/** A solid moved rigidly: lifted by dz and turned by deg about the vertical through pivot. */
function posed(p, pivot, dz, deg) {
  const back = (q) => v3.add(turnZ(v3.sub(q, v3.add(pivot, [0, 0, dz])), -deg), pivot);
  return { ...p, pts: p.pts.map((q) => v3.add(turnZ(v3.sub(q, pivot), deg), v3.add(pivot, [0, 0, dz]))), hit: (o, v) => p.hit(back(o), turnZ(v, -deg)) };
}
/** Rays from a glass part's outline, in the plane facing the viewer, at strength lit (0 none, 1 full): each starts just
 * off the outline in its own direction, so the rays hug the shape. */
function rays(cam, p, lit, t, n = 11) {
  const sp = p.pts.map((q) => cam.project(q)), xs = sp.map((q) => q[0]), ys = sp.map((q) => q[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, cz = p.pts.reduce((a, q) => a + q[2], 0) / p.pts.length;
  const dirs = Array.from({ length: n }, (_, k) => ((-35 + (250 * k) / (n - 1)) * Math.PI) / 180);
  const ext = dirs.map((a) => Math.max(...sp.map(([x, y]) => (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a))));
  const R = ext.reduce((s, e) => s + e, 0) / n, out = [];
  dirs.forEach((a, k) => {
    const r0 = ext[k] + 0.22 * R, r1 = r0 + lit * R * (k % 2 ? 0.28 : 0.45) * (1 + 0.18 * Math.sin(t * 4 + k));
    if (r1 - r0 < 1) return;
    out.push(cell.thread({ points: [r0, r1].map((r) => cam.unproject(cx + Math.cos(a) * r, cy - Math.sin(a) * r, cz)) }));
  });
  return out;
}
/** The parts as they are at time t, each moved by its motion; m: the motion tokens. */
function moving(cam, parts, t, m) {
  if (t <= 0) return parts;
  const out = [];
  parts.forEach((p, k) => {
    const how = motionOf(p);
    if (how === "flicker" && p.line && m.flicker > 0) {
      const [p0] = p.line, s = m.flicker * 2;
      const line = p.line.map((q, i) => {
        if (!i) return q;
        const f = s * wave(t, k * 7 + i), d = v3.sub(q, p0), sway = s * 5 * Math.sin(t * 6 + k + i);
        return v3.add(v3.add(p0, v3.mul(d, 1 + f)), [sway, -sway, 0]);
      });
      out.push({ ...p, line, pts: line });
    } else if (how === "glow" && p.hit && m.glow > 0) {
      out.push(p, ...rays(cam, p, m.glow * Math.min(1, t / 0.8), t));
    } else if (how === "lift" && p.hit && m.lift > 0) {
      const xs = p.pts.map((q) => q[0]), ys = p.pts.map((q) => q[1]), zs = p.pts.map((q) => q[2]);
      const pivot = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, Math.min(...zs)];
      const h = Math.max(...zs) - Math.min(...zs), up = Math.min(1, t / 0.6), rise = m.lift * (0.6 * h + 10) * up * (0.8 + 0.2 * Math.sin(t * 2.4));
      out.push(posed(p, pivot, rise, m.lift * 14 * up * Math.sin(t * 1.6)));
    } else out.push(p);
  });
  return out;
}

/** Reads the stitch tokens and tones off the figure. */
function stitchLook(host) {
  const cs = getComputedStyle(host), num = (k, d) => { const v = parseFloat(cs.getPropertyValue("--o-" + k)); return isFinite(v) ? v : d; };
  return {
    count: Math.round(24 + 96 * num("x-count", 0.38)), thread: num("x-thread", 0.2), gap: num("x-gap", 0.12),
    focus: num("x-focus", 0.6), wobble: num("x-wobble", 0), ink: cs.getPropertyValue("--o-ink").trim() || "#000",
    m: { pace: num("m-pace", 0.4), sew: num("m-sew", 0.5), flicker: num("m-flicker", 0.5), glow: num("m-glow", 0.6), lift: num("m-lift", 0.5) },
  };
}
/** Every cell of the grid: what covers it (key, depth, focus) and whether it is stitched. */
function stitchCells(cam, parts, [W, H], n) {
  const s = W / n, nx = n, ny = Math.ceil(H / s), N = nx * ny, v = cam.toViewer;
  const sid = new Int32Array(N).fill(-1), key = new Int32Array(N).fill(-1), depth = new Float64Array(N).fill(-Infinity), foc = new Uint8Array(N), on = new Uint8Array(N);
  const faces = new Map(), solids = parts.filter((p) => p.hit && !p.glass), glass = parts.filter((p) => p.hit && p.glass);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const o = cam.unproject((i + 0.5) * s, (j + 0.5) * s, 0), d0 = cam.depth(o), c = j * nx + i;
    solids.forEach((p, k) => {
      const h = p.hit(o, v); if (!h) return;
      const d = d0 + h.t;
      if (d > depth[c]) {
        const fk = k + ":" + h.face; if (!faces.has(fk)) faces.set(fk, faces.size);
        depth[c] = d; key[c] = faces.get(fk); sid[c] = k; foc[c] = p.focus ? 1 : 0;
      }
    });
  }
  // a gap where a cell borders a solid in front of it, or another face of its own solid (a crease: the later face
  // gives way); solids that meet flush, as stacked parts do, don't part, and a face one cell wide isn't cut away
  const tol = 1.5 * s / cam.scale;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = j * nx + i; if (key[c] < 0) continue;
    let bare = false;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
      const q = b * nx + a; if (key[q] < 0 || key[q] === key[c]) continue;
      const crease = sid[q] === sid[c];
      if (!(crease ? key[q] < key[c] : depth[q] > depth[c] + tol)) continue;
      // a strip one cell wide keeps its stitches: a gap is cut only where the face goes on behind it
      const a2 = i - di, b2 = j - dj;
      if (a2 >= 0 && b2 >= 0 && a2 < nx && b2 < ny && key[b2 * nx + a2] === key[c]) { bare = true; break; }
    }
    on[c] = bare ? 0 : 1;
  }
  // glass: its outline only, where nothing opaque is in front of it
  for (const p of glass) {
    const gd = new Float64Array(N).fill(-Infinity);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const o = cam.unproject((i + 0.5) * s, (j + 0.5) * s, 0), h = p.hit(o, v);
      if (h) gd[j * nx + i] = cam.depth(o) + h.t;
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const c = j * nx + i; if (gd[c] === -Infinity || gd[c] < depth[c] - tol) continue;
      const rim = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => { const a = i + di, b = j + dj; return a < 0 || b < 0 || a >= nx || b >= ny || gd[b * nx + a] === -Infinity; });
      if (rim) { on[c] = 1; foc[c] = p.focus ? 1 : 0; }
    }
  }
  // threads and seams, stepped cell by cell along their projected lines
  const walk = (pts, fn) => {
    for (let k = 1; k < pts.length; k++) {
      const a = cam.project(pts[k - 1]), b = cam.project(pts[k]), da = cam.depth(pts[k - 1]), db = cam.depth(pts[k]);
      const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (s * 0.5)));
      for (let m = 0; m <= steps; m++) {
        const f = m / steps, i = Math.floor((a[0] + (b[0] - a[0]) * f) / s), j = Math.floor((a[1] + (b[1] - a[1]) * f) / s);
        if (i >= 0 && j >= 0 && i < nx && j < ny) fn(j * nx + i, da + (db - da) * f);
      }
    }
  };
  // seams first, each keeping a row of stitches between it and the last (grooves closer than two cells don't merge)
  const cut = new Int32Array(N).fill(-1);
  parts.forEach((p, n) => {
    if (p.kind !== "seam") return;
    walk(p.line, (c, d) => {
      if (key[c] < 0 || Math.abs(d - depth[c]) > 2 * tol) return;
      const i = c % nx, j = (c - i) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < nx && b < ny && cut[b * nx + a] >= 0 && cut[b * nx + a] !== n) return; }
      on[c] = 0; cut[c] = n;
    });
  });
  for (const p of parts) if (p.kind === "thread") walk(p.line, (c, d) => { if (d >= depth[c] - tol) { on[c] = 1; foc[c] = p.focus ? 1 : 0; depth[c] = d; } });
  const shown = new Int32Array(solids.length);
  for (let c = 0; c < N; c++) if (on[c] && sid[c] >= 0 && key[c] >= 0) shown[sid[c]]++;
  return { nx, ny, s, on, foc, shown, solids };
}
/**
 * Stitches a figure: fits the camera to the parts (pad in frame units), lays the cells, and draws the crosses on a
 * canvas over the figure's svg, at the screen's own resolution. It redraws itself when the figure's tokens or theme
 * change. Returns { redraw() }.
 *
 * Every figure moves while Play is on, by the engine's motion (the motion section: sew in, flicker, glow, lift), and
 * only then: Play off, or prefers-reduced-motion, and it is back at rest. It is stitched again in steps, at --o-m-pace
 * (a stop-motion pace, as a stitched animation would move). For anything more, parts may be a function of time,
 * (t) => parts, t in seconds from when Play starts (0 is rest), with fit: the parts at their widest.
 */
function stitch(ctx, cam, parts, { pad = 36, fit } = {}) {
  const { host, svg, frame } = ctx, doc = host.ownerDocument, win = doc.defaultView;
  const at = typeof parts === "function" ? parts : () => parts;
  let t = 0;
  // the camera holds still: fitted to the rest pose and, once fitted, to the furthest the motion reaches
  const rest = (fit ?? at(0)).filter((p) => p.pts.length);
  cam.fit(rest.flatMap((p) => p.pts), frame, pad);
  const reach = rest.flatMap((p) => (motionOf(p) === "glow" && p.hit ? rays(cam, p, 1.25, 0).flatMap((r) => r.pts) : motionOf(p) === "lift" && p.hit ? p.pts.map((q) => v3.add(q, [0, 0, 0.4 * (Math.max(...p.pts.map((z) => z[2])) - Math.min(...p.pts.map((z) => z[2]))) + 10])) : []));
  if (reach.length) cam.fit([...rest.flatMap((p) => p.pts), ...reach], frame, pad);
  const cv = doc.createElement("canvas");
  cv.className = "o-x"; cv.setAttribute("aria-hidden", "true");
  host.appendChild(cv);
  let look = null, grid = null;
  let drawnParts = [];
  function lay() { look = stitchLook(host); drawnParts = moving(cam, at(t), t, look.m); grid = stitchCells(cam, drawnParts, frame, look.count); }
  function paint() {
    if (!grid) return;
    const r = svg.getBoundingClientRect(), hr = host.getBoundingClientRect(), dpr = win.devicePixelRatio || 1;
    if (!r.width) return;
    Object.assign(cv.style, { left: r.left - hr.left - host.clientLeft + "px", top: r.top - hr.top - host.clientTop + "px", width: r.width + "px", height: r.height + "px" });
    const cw = Math.round(r.width * dpr), ch = Math.round(r.height * dpr);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    const vb = svg.viewBox.baseVal, k = (r.width * dpr) / vb.width, g = cv.getContext("2d");
    const { nx, ny, s, on, foc } = grid, S = s * k, inset = Math.round(look.gap * S * 2) / 2;
    const jit = (c, m) => { const x = Math.sin(c * 12.9898 + m * 78.233) * 43758.5453; return (x - Math.floor(x) - 0.5) * look.wobble * S; };
    g.clearRect(0, 0, cv.width, cv.height);
    g.strokeStyle = look.ink; g.lineCap = "square";
    // sewing in: the first `sewn` cells in sewing order are stitched so far: from the bottom row up, the first row left
    // to right, the next back right to left, and so on
    const sewFor = 0.4 + 2.6 * look.m.sew, sewing = t > 0 && look.m.sew > 0 && t < sewFor;
    let sewn = Infinity;
    if (sewing) { let n = 0; for (let c = 0; c < on.length; c++) n += on[c]; sewn = Math.floor(n * (t / sewFor)); }
    const rank = new Int32Array(on.length);
    if (sewing) { let r = 0; for (let row = 0; row < ny; row++) for (let q = 0; q < nx; q++) { const c = (ny - 1 - row) * nx + (row % 2 ? nx - 1 - q : q); if (on[c]) rank[c] = r++; } }
    for (const heavy of [0, 1]) {
      g.lineWidth = Math.max(0.8, look.thread * S * (heavy ? 1 + look.focus : 1));
      g.beginPath();
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const c = j * nx + i; if (!on[c] || foc[c] !== heavy || (sewing && rank[c] >= sewn)) continue;
        const px = Math.round((i * s - vb.x) * k), py = Math.round((j * s - vb.y) * k), pw = Math.round(((i + 1) * s - vb.x) * k) - px, ph = Math.round(((j + 1) * s - vb.y) * k) - py;
        const x0 = px + inset, y0 = py + inset, x1 = px + pw - inset, y1 = py + ph - inset;
        g.moveTo(x0 + jit(c, 1), y0 + jit(c, 2)); g.lineTo(x1 + jit(c, 3), y1 + jit(c, 4));
        g.moveTo(x1 + jit(c, 5), y0 + jit(c, 6)); g.lineTo(x0 + jit(c, 7), y1 + jit(c, 8));
        if (heavy) { const mx = (x0 + x1) / 2, my = (y0 + y1) / 2; g.moveTo(mx, y0); g.lineTo(mx, y1); g.moveTo(x0, my); g.lineTo(x1, my); }
      }
      g.stroke();
    }
  }
  const redraw = () => { lay(); paint(); };
  const mo = new win.MutationObserver(redraw);
  mo.observe(host, { attributes: true, attributeFilter: ["style", "data-o-theme", "class"] });
  const ro = new win.ResizeObserver(paint);
  ro.observe(svg);
  const mq = win.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener?.("change", redraw);
  // the object's own motion, in steps, only while Play is on
  const still = win.matchMedia("(prefers-reduced-motion: reduce)");
  let raf = 0, t0 = 0, last = -Infinity;
  const tick = (now) => {
    raf = win.requestAnimationFrame(tick);
    const pace = 4 + 20 * (look ? look.m.pace : 0.4);
    if (now - last < 1000 / pace) return;
    last = now; t = (now - t0) / 1000; redraw();
  };
  const play = (on) => {
    win.cancelAnimationFrame(raf); raf = 0;
    if (on && !still.matches) { t0 = win.performance.now(); last = -Infinity; raf = win.requestAnimationFrame(tick); }
    else if (t !== 0) { t = 0; redraw(); }
  };
  if (ctx.controls) ctx.controls.play = play;
  ctx.drawn = { cam, frame, get grid() { return grid; }, get parts() { return drawnParts; }, get t() { return t; } };
  ctx.add(() => { win.cancelAnimationFrame(raf); mo.disconnect(); ro.disconnect(); mq.removeEventListener?.("change", redraw); cv.remove(); });
  redraw();
  if (ctx.play) play(true);
  return { redraw };
}

/* ----------------------------------------------------------------- check */

/** The box of what a figure draws, in viewBox units, leaving out the grid layer (which bleeds by design). */
function contentBox(svg) {
  // measured on screen and mapped back, so transformed groups (faces) count where they are drawn
  const m = svg.getScreenCTM?.()?.inverse();
  if (!m) return null;
  const pt = svg.createSVGPoint();
  const toBox = (x, y) => { pt.x = x; pt.y = y; const q = pt.matrixTransform(m); return [q.x, q.y]; };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of svg.querySelectorAll(".o-solids > *, .o-floor > *:not(.o-gridlayer), .o-over > *")) {
    const r = n.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    for (const [x, y] of [toBox(r.left, r.top), toBox(r.right, r.bottom)]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
/** The rules of RULES.md that can be read off a figure as drawn: [{ rule, level, says, fix }]. */
const SUBJECT_MIN = 0.4, GRAIN = [24, 100], FOCUS_MAX = 0.45, PART_MIN = 3;
function checkStitch(drawn, svg, figure) {
  const out = [], say = (rule, level, says, fix) => out.push({ rule, level, says, fix });
  const study = !!figure.study, plain = study || !!figure.control || !!figure.mark;
  const marks = [...svg.querySelectorAll("path,circle,rect,line,ellipse,polygon,polyline,text")].filter((n) => !n.closest("defs"));
  if (marks.length) say("D1 cells", "fail", `the figure draws ${marks.length} thing(s) in the svg, not in stitches`, "build it from O.cell parts and O.stitch(); nothing is drawn in the svg");
  if (!drawn || !drawn.grid) { say("D1 cells", "fail", "the figure isn't stitched: it never calls O.stitch()", "build it from O.cell parts and give them to O.stitch(ctx, O.camera(), parts)"); return out; }
  const { cam, frame: [W, H], grid: { nx, ny, s, on, foc, shown, solids }, parts } = drawn;
  if (Math.abs(cam.angle - VIEW.angle) > 1e-6 || Math.abs(cam.tilt - VIEW.tilt) > 1e-6)
    say("D2 camera", "fail", `the camera is at ${cam.angle}° / ${cam.tilt}°, not the engine's ${VIEW.angle}° / ${VIEW.tilt}°`, "use O.camera() as it is, and turn the object instead");
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, n = 0, nf = 0, edge = 0, inner = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = j * nx + i;
    if (on[c]) { n++; nf += foc[c]; x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); if (i === 0 || j === 0 || i === nx - 1 || (j + 1) * s >= H) edge++; }
    else if (i > 0 && i < nx - 1 && j > 0 && j < ny - 1 && ((on[c - 1] && on[c + 1]) || (on[c - nx] && on[c + nx]))) inner++;
  }
  if (!n) { say("D3 frame", "fail", "nothing is stitched", "the parts are outside the frame, or all glass and seams; give the figure a solid"); return out; }
  if (edge) say("D3 frame", "fail", `${edge} stitch(es) touch the frame's edge, so the figure is cut off`, "make the parts smaller, give O.stitch a bigger pad, or a fit: with the widest pose");
  const fw = ((x1 - x0 + 1) * s) / W, fh = ((y1 - y0 + 1) * s) / H;
  if (Math.max(fw, fh) < SUBJECT_MIN) say("D3 frame", "warn", `the figure fills only ${Math.round(Math.max(fw, fh) * 100)}% of the frame`, "the camera fits the parts: a thread or glow reaching far out shrinks the rest; shorten it");
  const across = Math.max(x1 - x0 + 1, y1 - y0 + 1);
  if (across < GRAIN[0]) say("D4 grain", "warn", `the figure is only ${across} stitches across, too coarse to read`, "raise --o-x-count, or draw the object larger in its frame");
  if (across > GRAIN[1]) say("D4 grain", "warn", `the figure is ${across} stitches across, too fine to read as stitching`, "lower --o-x-count");
  const focusParts = parts.filter((p) => p.focus);
  if (!plain && !focusParts.length) say("L1 focus", "fail", "the figure has no focus", "mark the one part it's about focus: true (a thread, a solid or glass)");
  if (study && focusParts.length) say("L1 focus", "warn", "a study carries a focus", "studies show how the engine draws; take focus: true off, or make it a figure");
  if (focusParts.length && nf < 4) say("L1 focus", "fail", `the focus shows in only ${nf} stitch(es)`, "make the focus part bigger or bring it in front; hidden behind a solid, it isn't seen");
  if (nf / n > FOCUS_MAX) say("L1 focus", "warn", `the focus is ${Math.round((nf / n) * 100)}% of the stitches, so nothing stands apart from it`, "make the focus one part of the object, not most of it");
  if (!study && !inner) say("L2 edges", "warn", "no gaps part the figure inside: it reads as one blob", "build it from the parts it's made of, so their edges come out as gaps, or add a seam where the object has a line");
  solids.forEach((p, k) => { if (!p.glass && shown[k] < PART_MIN) say("F3 thin", "warn", `a solid (${k + 1}) shows in only ${shown[k]} stitch(es)`, "a part thinner than a cell is a thread: O.cell.thread along it; or leave it out"); });
  return out;
}

/**
 * Mounts every element under `root` that names a figure, for pages written by hand (a deck, the assets page):
 *   <div data-orchestro="sandboxes" data-grid="false" data-theme="auto" data-play></div>
 * figures: { name: figure } or an array of figures. Each element gets its handle as el.orchestro, so a deck's
 * step script can call el.orchestro.phase(k). Returns the handles.
 */
function mountAll(figures, root = document, defaults = {}) {
  const byName = Array.isArray(figures) ? Object.fromEntries(figures.map((f) => [f.name, f])) : figures;
  const out = [];
  for (const el of root.querySelectorAll("[data-orchestro]")) {
    if (el.orchestro) continue;
    const fig = byName[el.dataset.orchestro];
    if (!fig) { console.warn(`[stitch] no figure named "${el.dataset.orchestro}"`); continue; }
    const d = el.dataset, flag = (k) => (k in d ? d[k] !== "false" : undefined);
    out.push(mount(el, fig, { ...defaults, grid: flag("grid") ?? defaults.grid ?? true, play: flag("play") ?? defaults.play ?? false, fit: flag("fit") ?? defaults.fit ?? false, theme: d.theme ?? defaults.theme ?? "light" }));
  }
  return out;
}

/**
 * Puts a figure in `host`. A figure is { name, means, frame?, draw(ctx) },
 * draw returning { set?, destroy? }. ctx gives the svg, the frame [w, h],
 * read(text) for the read-out, join(tick) for the clock, onPointer(handlers)
 * and add(fn) for tear-down. Returns { set, destroy }.
 */
function mount(host, figure, { frame, value, onRead, grid = false, fit = false, check = false, theme = "light", tokens = null, play = false } = {}) {
  inject(host.ownerDocument);
  const [w, h] = frame ?? figure.frame ?? [400, 320];
  host.classList.add("o-fig");
  host.classList.toggle("o-nogrid", !grid);
  host.setAttribute("role", "img");
  host.setAttribute("aria-label", figure.means ?? figure.name);
  host.dataset.oTheme = theme;
  host.dataset.oEngine = "stitch";
  // tokens: the page's own values for the style's roles, e.g. { focus: "#0057ff", "face-top": "#fafafa" }
  for (const [k, v] of Object.entries(tokens ?? {})) host.style.setProperty(`--o-${k}`, v);
  const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, "aria-hidden": "true" }, host);
  // the read-out, said to a screen reader as it changes
  const live = host.ownerDocument.createElement("span");
  live.className = "o-live";
  live.setAttribute("aria-live", "polite");
  host.appendChild(live);
  const downs = [], hovers = [], subjects = [], controls = {};
  const ctx = {
    svg, frame: [w, h], host, hovers, controls, play,
    /** Names the solids the figure is about, for the subject check (C3). */
    subject: (...solids) => subjects.push(...solids),
    read: (text) => { if (host.dataset.read === text) return; host.dataset.read = text; live.textContent = text === "rest" ? "" : text; onRead?.(text); },
    join: (tick) => { const j = join(host, tick); downs.push(j.leave); return j; },
    onPointer: (handlers) => downs.push(pointer(host, svg, handlers)),
    add: (fn) => downs.push(fn),
  };
  const made = figure.draw(ctx, value) ?? {};
  // fit: the viewBox is set to the drawing at rest, padded, at the frame's own shape (the C1 / C2 fix)
  if (fit) {
    const b = contentBox(svg);
    if (b) {
      const pad = 0.08, k = Math.max((b.w * (1 + 2 * pad)) / w, (b.h * (1 + 2 * pad)) / h), vw = w * k, vh = h * k;
      svg.setAttribute("viewBox", [b.x + b.w / 2 - vw / 2, b.y + b.h / 2 - vh / 2, vw, vh].map(r2).join(" "));
    }
  }
  const handle = {
    set: (v) => made.set?.(v),
    /** Shows or hides the floor grid and the texture drawn on it (rule F1). */
    grid: (on) => host.classList.toggle("o-nogrid", !on),
    /** "light", "dark" or "auto" (the reader's system setting). */
    theme: (t) => (host.dataset.oTheme = t),
    /** The page's own values for the style's roles, e.g. { focus: "#0057ff" }; null for a role restores the style's. */
    tokens: (map) => { for (const [k, v] of Object.entries(map ?? {})) v == null ? host.style.removeProperty(`--o-${k}`) : host.style.setProperty(`--o-${k}`, v); },
    /** Starts or stops the unseen hand that walks the parts. */
    play: (on = true) => controls.play?.(on),
    /** A deck's build step: phase(0) is rest. */
    phase: (k) => controls.phase?.(k),
    /** The rules this figure breaks as drawn now (RULES.md): [{ rule, level, says, fix }]. */
    check: () => checkStitch(ctx.drawn, svg, figure),
    destroy() { made.destroy?.(); downs.reverse().forEach((f) => f()); svg.remove(); live.remove(); delete host.dataset.read; delete host.orchestro; },
  };
  host.orchestro = handle;                     // for a deck's step script to find
  if (check) requestAnimationFrame(() => { for (const f of handle.check()) console.warn(`[stitch] ${figure.name}: ${f.rule} ${f.level}: ${f.says}. Fix: ${f.fix}.`); });
  return handle;
}

return { clamp, lerp, VIEW, camera, el, closed, line, hull, join, reducedMotion, spring, bezier, easeOut, tween, pointer, scene, paintOrder, xf, box, cylinder, tube, faceted, wedge, frustum, prism, cutout, shell, tray, rod, wire, lathe, button, arc, pipe, dots, ring, label, slots, panel, hatch, trace, grid, focus, hover, lift, slide, drag, recoil, tilt, press, grow, hinge, spin, hop, riffle, rock, bob, beat, sweep, interact, cell, stitch, mountAll, mount };
})();
window.Stitch_cube = (() => {
/*
 * A cube: flat faces and straight edges. How it tells three faces apart, and where the edges are.
 *
 * Drawn in stitch cells: one box; its three faces part along the bare cells of its edges.
 */
const O = window.Stitch;

const cube = {
  name: "cube",
  study: true,
  means: "A cube",
  frame: [360, 360],
  draw(ctx) {
    O.stitch(ctx, O.camera(), [O.cell.box({ at: [0, 0, 0], size: [100, 100, 100] })]);
  },
};

return { cube };
})();
window.Stitch_lightbulb = (() => {
/*
 * A lightbulb: a glass bulb on a threaded cap, a filament inside. Its focus: the filament, or the light it gives.
 *
 * Drawn in stitch cells: the glass is outline only, so the filament (the focus, heavier) shows inside it; the cap is a cylinder with seams for its grooves. While it plays the engine lights it: the glass glows with rays; the filament holds still (motion: none).
 */
const O = window.Stitch;

const lightbulb = {
  name: "lightbulb",
  means: "A lightbulb, its filament lit",
  frame: [360, 360],
  draw(ctx) {
    const cam = O.camera(), parts = [
      O.cell.lathe({ glass: true, profile: [[20, 70], [30, 95], [52, 130], [60, 160], [56, 185], [42, 207], [22, 220], [0, 224]] }),
      O.cell.cylinder({ from: [0, 0, 4], to: [0, 0, 16], r: 12 }),
      O.cell.cylinder({ from: [0, 0, 16], to: [0, 0, 72], r: 24 }),
    ];
    const ring = (z) => Array.from({ length: 25 }, (_, k) => [Math.cos(k * Math.PI / 12) * 24, Math.sin(k * Math.PI / 12) * 24, z]);
    for (let k = 1; k < 4; k++) parts.push(O.cell.seam({ points: ring(16 + k * 14) }));
    const zig = [];
    for (let k = 0; k <= 6; k++) zig.push([-18 + k * 6, 0, 150 + (k % 2 ? 9 : 0)]);
    parts.push(O.cell.thread({ points: [[-8, 0, 72], [-18, 0, 150], ...zig, [18, 0, 150], [8, 0, 72]], focus: true, motion: "none" }));
    O.stitch(ctx, cam, parts);
  },
};

return { lightbulb };
})();
window.Stitch_prism = (() => {
/*
 * A triangular prism lying on one side: slanted faces and a sharp ridge.
 *
 * Drawn in stitch cells: a triangle extruded along y; the ridge is a line of bare cells.
 */
const O = window.Stitch;

const prism = {
  name: "prism",
  study: true,
  means: "A triangular prism lying on one side",
  frame: [360, 360],
  draw(ctx) {
    O.stitch(ctx, O.camera(), [O.cell.prism({ points: [[-55, 0], [55, 0], [0, 75]], plane: "xz", at: [0, -70, 0], length: 140 })]);
  },
};

return { prism };
})();
window.Stitch_rocket = (() => {
/*
 * A rocket: a body, a nose, fins, its exhaust. Its focus: the plume.
 *
 * Drawn in stitch cells: a turned body and nose, four thin fins, a nozzle; the plume (the focus) is threads fanning down from it; the engine flickers them while it plays.
 */
const O = window.Stitch;

const rocket = {
  name: "rocket",
  means: "A rocket, its plume firing",
  frame: [360, 360],
  draw(ctx) {
    const body = [
      O.cell.lathe({ profile: [[26, 40], [26, 150]] }),
      O.cell.lathe({ profile: [[26, 150], [22, 175], [12, 196], [0, 206]] }),
      O.cell.lathe({ profile: [[12, 24], [18, 40]] }),
      O.cell.seam({ points: Array.from({ length: 25 }, (_, k) => [Math.cos(k * Math.PI / 12) * 26, Math.sin(k * Math.PI / 12) * 26, 120]) }),
    ];
    for (const a of [0, 90, 180, 270]) body.push(O.cell.prism({ points: [[20, 40], [58, 22], [58, 48], [20, 92]], plane: "xz", at: [0, -6, 0], length: 12, turn: a }));
    for (const [dx, dy, len] of [[0, 0, 70], [-14, 6, 54], [14, -6, 54], [-6, -14, 46], [6, 14, 46], [-22, 0, 34], [22, 0, 34]])
      body.push(O.cell.thread({ points: [[dx * 0.4, dy * 0.4, 22], [dx, dy, 22 - len]], focus: true }));
    O.stitch(ctx, O.camera(), body);
  },
};

return { rocket };
})();
window.Stitch_sphere = (() => {
/*
 * A sphere: the plainest round. How this engine draws a curved surface turning away from the viewer.
 *
 * Drawn in stitch cells: one ball, so it reads by its silhouette alone.
 */
const O = window.Stitch;

const sphere = {
  name: "sphere",
  study: true,
  means: "A sphere",
  frame: [360, 360],
  draw(ctx) {
    O.stitch(ctx, O.camera(), [O.cell.sphere({ at: [0, 0, 60], r: 60 })]);
  },
};

return { sphere };
})();
window.Stitch_tiles = (() => {
/*
 * A stack of four tiles: the same flat part repeated, and how parts overlap.
 *
 * Drawn in stitch cells: four slabs stacked flush, each turned a little more as they rise: they read as one block, parted by their creases, with corners overhanging. The top tile is the focus.
 */
const O = window.Stitch;

const tiles = {
  name: "tiles",
  means: "A stack of four tiles",
  frame: [360, 360],
  draw(ctx) {
    const parts = [];
    for (let k = 0; k < 4; k++) parts.push(O.cell.box({ at: [0, 0, k * 28], size: [120, 120, 28], turn: k * 9, focus: k === 3 }));
    O.stitch(ctx, O.camera(), parts);
  },
};

return { tiles };
})();
window.Play = {
  oscillon: { mount: window.Oscillon.mount, figures: Object.fromEntries([window.Oscillon_cube, window.Oscillon_lightbulb, window.Oscillon_prism, window.Oscillon_rocket, window.Oscillon_sphere, window.Oscillon_tiles].flatMap((m) => Object.values(m)).filter((f) => f && f.draw).map((f) => [f.name, f])) },
  stitch: { mount: window.Stitch.mount, figures: Object.fromEntries([window.Stitch_cube, window.Stitch_lightbulb, window.Stitch_prism, window.Stitch_rocket, window.Stitch_sphere, window.Stitch_tiles].flatMap((m) => Object.values(m)).filter((f) => f && f.draw).map((f) => [f.name, f])) }
};
