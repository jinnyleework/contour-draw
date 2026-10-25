# Visualiser engine

Draws objects as stacked contour slices, in one weight-and-depth style, and animates them.
Plain JavaScript modules, no dependencies.

```
npm test          # 66 tests: maths, contour tracing, slicing, camera, painter, cursor, split, the three scenes, the build
npm run build     # writes dist/actions.html: one file, opens from disk

node tools/new-figure.mjs <name>     # start a figure from a working template, and register it
node tools/check.mjs [name]          # check a figure (or all): FAIL stops you, warn is for you to read
node tools/publish.mjs               # the page for the Artifact host: dist/actions.publish.html, and dist/publish/ (one file per module)
node tools/still.mjs <name>          # one PNG of eight poses: dist/still-<name>.png
```

To make a figure with an agent, use the skill in `.claude/skills/draw-contour/` (`/draw-contour <idea>`). Its `run-plan.md`
is the runbook for this engine.

## How an object becomes a drawing

```
shape (an SDF)  ->  slice at heights  ->  sheets of closed loops  ->  painter  ->  svg
 figures/*.js       src/slice.js          src/contour.js              src/painter.js
```

1. **Shape.** A shape is a signed distance function `sdf(x, y, z, prm)`: negative inside, positive outside.
   `src/math.js` has the pieces to build one (`rcyl`, `roundBox`, `smin`, `subtract`).
2. **Slice.** `slicePart` samples the sdf on a grid at each height and traces the zero line with marching
   squares (`src/contour.js`). A sheet is the result at one height: a list of closed loops.
3. **Paint.** `paint` draws sheets bottom-up, each with an opaque fill so higher ones cover lower ones, then
   weights every edge by rule A: silhouettes heavy, facing edges light, far edges and low sheets fainter.
4. **Play.** `createPlayer` runs a figure on one animation loop that sleeps whenever nothing needs it: pointer away
   and settled, off screen, tab hidden, or reduced motion.
5. **Hover.** Nothing moves until the pointer arrives, as in Hairline. The pointer drives a sprung cursor
   (`src/pointer.js`), and the hover mode decides what that does:
   - **animate**: the cursor *scrubs the figure's action*. Where it is over the drawing sets how far through the action
     the figure is (`scene.drive(x, y)`, 0 to 1, mapped onto `scene.active` by `hoverTime`), and leaving lets it spring
     back to rest. The rocket launches as you move up it; the camera zooms and shoots, and the binoculars adjust, as you
     move across.
   - **split**: `splitShift` (`src/split.js`) turns the cursor's height into a shift for each layer. Layers above lift,
     layers below drop, across the full width. The figure itself stays at rest.

## Writing a figure

A figure is a scene, in `figures/`:

```js
export const mug = {
  T: 6,                        // seconds in one loop
  active: [1.0, 3.2],          // the stretch of it the cursor scrubs; the pose at the start is the rest pose
  drive: (x, y) => 0,          // cursor position on the page -> 0..1 through that stretch
  hint: "move across to ...",  // shown on the page
  zr: [-0.5, 0.5],             // height range (rule A fades by height)
  S: 215, zm: 0,               // camera scale, and the height that sits mid-page
  parts: [
    { id: "body", order: 0, box: { x: [-0.8, 0.8], y: [-0.8, 0.8] }, planes: planes(-0.5, 0.5), sdf: (x, y, z) => /* ... */ },
    { id: "steam", order: 1, dynamic: true, key: (p) => p.k.toFixed(2), box: { ... }, planes: planes(0.5, 1.2), sdf: (x, y, z, p) => /* ... */ },
  ],
  step(t, abs, k = 0.5) {      // what each part does at time t, at intensity k
    return { body: {}, steam: { prm: { k: Math.sin(t) } } };
  },
};
```

- A **static** part is sliced once. A **dynamic** part is sliced again whenever `key(prm)` changes, so give it a
  small `box` and a coarse `key` (the rocket's flame re-slices 24 times a second and costs about a millisecond).
- `step` returns, per part id: `off: [dx, dy, dz]` to move it, `prm` for a dynamic part (`null` switches it off),
  `hide: true` to skip it. It may also return `pulse` to scale every stroke weight for a beat (the camera's flash).
- Split an object into parts along what moves. Each part is sliced at the same heights, and ties at one height
  go to the higher `order`.
- Register the scene in `figures/index.js`; the page makes a button for it.

## Following the cursor

`step(t, abs, k, pointer)` gets the cursor as a fourth argument when a figure wants it: `{ s, x, y, ground(z) }`, with `s` its strength
(0 to 1), `x, y` its place on the page, and `ground(z)` the point on the figure's ground under it at height z (the camera undone), or `null`
when nothing is pointing at it (the demo, a still, split mode). Most figures ignore it. The terrain uses it to raise a peak under the
cursor; give such a figure a fallback for `null` (a peak that wanders, as the terrain does), so its demo and stills still show the action.
`drive` must still reach 0 and 1, but for these figures it is only "is the cursor over it".

## Intensity

The way Hairline does it: how strongly the figure answers the pointer, one number from 0 (subtle) to 1 (strong), 0.5 by default. A figure turns it into its own
numbers with `byIntensity(k, [lo, mid, hi])`: two straight lines that meet at 0.5, where the value is what the figure
did before it had an intensity. Anything that is not a number is 0.5; the rest is clamped.

| Figure | What intensity changes | at 0 | at 0.5 | at 1 |
| --- | --- | --- | --- | --- |
| rocket | how far it rises; how long the flame swells | 0.1; 0.7 | 0.3; 1.24 | 0.55; 1.6 |
| camera | how far the lens zooms; how hard the flash lands | 0.5×; weight +0.5 | 1×; +1.4 | 1.5×; +2.4 |
| binoculars | how far the barrels slide apart; how far the wheel turns | 0.03; 1.5 rad | 0.07; 3 rad | 0.1; 5 rad |
| lightbulb | how many shells of light spread out; how hard it flickers | 3 shells; +0.15 | 6; +0.35 | 7; +0.6 |
| record player | how many turns the platter spins up | 1 | 3 | 6 |
| lighthouse | how far the beams sweep round | a quarter turn | two thirds of a turn | over a full turn |
| toaster | how high the toast pops | 0.14 | 0.3 | 0.46 (with a bounce) |
| vault door | how far the wheel turns; how far the bars draw in | 0.35 turn; 0.05 | 1 turn; 0.1 | 2 turns; 0.14 |
| carousel | how many turns the ride spins up | 1 | 2 | 4 |
| pocket watch | how many times the minute hand goes round | 1 | 3 | 6 |
| telescope | how far each draw tube slides out | 0.1 | 0.2 | 0.26 |
| jack-in-the-box | how high the head springs; how many turns of the crank | 0.25; 1 | 0.45; 2 | 0.65; 3 |
| windmill | how far the sails turn | half a turn | one and a half | three turns |
| gyroscope | how far the axle leans as it spins | 0.18 rad | 0.35 | 0.55 |
| umbrella | how wide the canopy opens | 0.6 | 0.85 | 1 |
| periscope submarine | how far the periscope rises | 0.2 | 0.35 | 0.46 |
| seedling | how tall the plant grows | 0.45 | 0.7 | 0.95 |
| drawer chest | how far each drawer slides out | 0.18 | 0.3 | 0.42 |
| bellows camera | how far the bellows open | 0.4 | 0.55 | 0.7 |
| percolator | how many bubbles it perks | 4 | 8 | 12 |
| terrain | how high the peak under the cursor rises | 0.3 | 0.5 | 0.7 |
| volcano | how much lava it gives | fills the crater | spills down a third | runs nearly to the foot |
| ripple tank | how big the ripples are | 0.025 | 0.045 | 0.065 |
| tile pyramid | how far each tier lifts | 0.05 | 0.09 | 0.13 |
| spiral stair | how far each tread turns from the last | 0.4 rad | 0.55 | 0.7 |
| ring tower | how far each frame twists | 0.12 rad | 0.22 | 0.36 |
| funnel | how far it drains | a third | most | to the neck |
| hourglass | how much sand runs | 0.4 | 0.7 | 0.95 |
| whirlpool | how deep the vortex goes | 0.08 | 0.15 | 0.19 |
| crystal cluster | how tall the crystals grow | 0.65 | 1 | 1.3 |
| honeycomb | how high the honey rises in each cell | 0.08 | 0.15 | 0.21 |
| card fan | how wide the fan opens | 0.18 rad per card | 0.28 | 0.4 |
| tile stack | how far each tile slides past the one below | 0.04 | 0.08 | 0.12 |
| hover split | how wide the gap opens (a fraction of its cap) | 0.35 | 0.7 | 1 |

A scene reads it as the third argument of `step`; the engine keeps `MOTION.intensity` (animate) and `SPLIT.intensity`
(split) as two numbers, and the page's single intensity control sets both. `player.setMode("animate" | "split")` picks
what the pointer does; `player.demo()` plays a figure's whole loop once, for a look at what it does.

## Thin parts, and parts inside glass

- **`cell`.** A part with thin features (a filament, a tonearm) sets its own finer grid cell, about a third of the thinnest
  feature. Loops are also thinned (Ramer-Douglas-Peucker, `simplifyLoop`) to within a third of a pixel, so the markup stays
  small; a finer cell thins less, so thin features keep their shape.
- **Thin upright features.** A stem, leg, pole or handle is cut as a small ring at every height, so with a wide gap it reads as dots.
  Give that part its own `planes(a, b, 0.01)` and keep the feature at least three cells thick. `tools/check.mjs` warns ("thin stems").
- **Things that open show their inside.** A drawer, box or hatch that the cursor opens is drawn hollow (a tray, a cavity), its rim a
  ring and not a plate, and it opens far enough to look in. A solid block that slides out reads as a plank.
- **Lay objects flat when the face matters.** Slices are horizontal, so a face seen from above becomes rings and outlines; a face standing upright becomes dashes.
- **`overlay: true`.** The glass of the lightbulb is drawn as stacked rings, which would hide anything inside it. A part
  marked `overlay` is painted after everything else whatever its height, so the filament and the halo show through.

## Touch

A finger works as the pointer. It acts while it is down, and the pose is held for 1.4 s after it lifts (`HOLD`), so a
tap reads as a look and not a flash. The drawing sets `touch-action: none`, so the page does not scroll under a finger.

## Rules the shapes must keep

- The sdf must be **positive everywhere on the edge of its `box`**, or the contour will not close.
- Keep slices the same `GAP` apart across parts so they interleave cleanly.
- **The painter orders by height alone.** A part cannot be drawn "in front of" another: a thin post in front of a bulb is covered by the
  bulb's higher sheets where they overlap on the page, and an `overlay` is painted over everything, plates included. Keep parts that must
  read as nearer from overlapping on the page at the default view (put posts at the sides), and use `overlay` only for things that show
  through everything. Look at the figure at full size at rest and check each overlapping pair.
- Top-level names are unique across modules (the build joins them into one script and checks this): prefix a figure's helpers with its name.

## Files

| File | Job |
| --- | --- |
| `src/math.js` | clamp, smoothstep, SDF building blocks |
| `src/contour.js` | marching squares on a rectangular grid |
| `src/slice.js` | planes, `slicePart`, `sheetsOf` (static or dynamic) |
| `src/camera.js` | world to page, orthographic |
| `src/pointer.js` | the sprung cursor: follows the pointer, strength rises and falls |
| `src/split.js` | the hover split: settings, the three gap sizes, the shift for a layer |
| `src/painter.js` | sheets to svg markup, rule A |
| `src/scene.js` | a scene at time t |
| `src/player.js` | the only file that touches the page |
| `figures/` | rocket, camera, binoculars, lightbulb, record player, lighthouse, toaster, vault door, carousel, pocket watch, telescope, jack-in-the-box, windmill, gyroscope, umbrella, periscope submarine, seedling, drawer chest, bellows camera, percolator, terrain, volcano, ripple tank, tile pyramid, spiral stair, ring tower, funnel, hourglass, whirlpool, crystal cluster, honeycomb, card fan, tile stack |
| `tools/build.mjs` | joins the modules and every figure in `figures/` into `dist/actions.html` |
| `tools/check.mjs` | checks a figure: its declaration, `step()`, that its shapes close inside their boxes, the cursor mapping, intensity, frame size and speed |
| `tools/new-figure.mjs` | writes a working template figure and registers it (`--remove` undoes it) |
| `tools/publish.mjs` | the build in the form the Artifact host wants |

## The page

`page/actions.template.html` is the shell: object buttons, the rule A sliders (weight, contrast, depth cue, height fade),
and hover: animate or split, one intensity (low / medium / high and a slider) for both, and the split's reach. A hint
says where to move the pointer, and `demo` plays the loop once. The sliders edit the `RULE` and
`SPLIT` objects in place; the player reads them on every frame.

## Not here yet

The other hover modes from `sketches/v4` (push, lift, swirl) were not carried over: the split is the one we kept.
Per-part slicing axes (rule D) are still only in the archived sheet.
