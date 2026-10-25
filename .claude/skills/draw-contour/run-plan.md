# Running the Visualiser engine

The plan for working with `engine/`: what is there, the commands, the loop for one figure, what done means, how to ship it, and
what to do when something breaks. `SKILL.md` is the short version an agent follows; this is the runbook behind it.

## 1. What is there

```
engine/
  src/        the engine: math, contour, slice, camera, painter, scene, pointer, split, player      (do not edit for a figure)
  figures/    one file per figure + index.js that lists them                                         (a figure is one file here)
  page/       actions.template.html: the page every figure appears on                               (do not edit for a figure)
  tools/      build.mjs, publish.mjs, check.mjs, new-figure.mjs
  test/       66 tests
  dist/       what the build writes: actions.html (open from disk) and actions.publish.html (for the Artifact)
engine-glass/ the second engine: this engine plus glass (see its README). The skill does not use it
sketches/     v1 to v5: the history of how it was found. Read-only; not part of the engine.
archive/      frozen snapshots
reference/    the Hairline repo, for study
PLAN.md       where the project stands and what is next
```

Needs Node 20 or later (it was built on 23). No install step: there are no dependencies. A browser to look at the result.

## 2. Commands

All from `engine/`.

| Command | What it does |
| --- | --- |
| `npm test` | all tests: maths, contours, slicing, camera, painter, cursor, split, every figure's choreography, the checker, the scaffold |
| `node tools/new-figure.mjs <name>` | writes `figures/<name>.js` from a working template and registers it. `--remove <name>` undoes it |
| `node tools/check.mjs [name]` | checks one figure, or all. `FAIL` stops you; `warn` is for you to read |
| `node tools/build.mjs` | writes `dist/actions.html`. Finds every file in `figures/` on its own |
| `node tools/publish.mjs` | writes `dist/actions.publish.html` (one file) and `dist/publish/` (the page plus one file per module: publish this one with `files`) |
| `node tools/still.mjs <name>` | one PNG of eight poses at `dist/still-<name>.png` (needs Chrome; `--html` for the page only) |

## 3. The loop for one figure

1. **Concept.** An object, what the cursor does to it, where it rests. One idea. (`SKILL.md` step 1.)
2. **Scaffold.** `new-figure.mjs <name>`. The template already passes the checker, so you start from green.
3. **Fill in.** Parts cut along what moves, a `drive`, a `hint`, a `step` that reads the intensity. Keep it to about 80 lines.
4. **Check.** `check.mjs <name>`, then `npm test`. Fix every FAIL before looking at anything.
5. **Look.** Build, open the page, put the figure in five states (rest, halfway, full, intensity low and high, turned) and look at each.
6. **Ship.** Build, publish, update the Artifact, add the README row, update `PLAN.md`.

Each of 4 and 5 can send you back to 3. Do not skip 5 because 4 passed: the checker is mechanical.

## 4. Done means

- `node tools/check.mjs <name>` has no FAIL, and every `warn` has either been fixed or can be explained.
- `npm test` passes.
- At rest the figure is a composed drawing and nothing in it is lit, moving or running.
- At full, the action reads, nothing tears, and nothing leaves the page.
- Intensity 0 and intensity 1 both look intended, and 0.5 is what you first designed.
- A moving frame is under 25 ms and the markup under 450 kB.
- `engine/README.md` has a row for it in the intensity table.
- You have said what you did not check (a real mouse, a phone, an unusual angle).

## 5. Looking at it

Build, then open `engine/dist/actions.html` (`file://` and the absolute path). The page exposes `player`, and `MOTION`, `SPLIT`,
`VIEW` and `RULE` as globals, so a state can be set without a mouse:

- the cursor acting: `const c = player.cursor; c.x = 300; c.y = 150; c.tx = 300; c.ty = 150; c.s = 1; c.ts = 1; player.redraw()`
- the pointer away: `c.s = 0; c.ts = 0; player.redraw()`
- intensity: `MOTION.intensity = 1; SPLIT.intensity = 1; player.redraw()`
- turned: `VIEW.azimuth = -50; VIEW.tilt = 0.7; player.redraw()`
- a moment in the loop, held: `player.seek(3.2)`, and `player.play()` to let go
- the whole loop once: `player.demo()`

**Screenshots in the in-app browser lag one step.** Take two and trust the second, or check a number (the count of sheets, a cursor value)
before you trust a picture.

The page's own controls do the same by hand: the figure buttons, turn and tilt, the four look sliders, hover animate or split, intensity,
and the split's reach.

## 6. Shipping

1. `node tools/build.mjs && node tools/publish.mjs`
2. Publish `dist/publish/index.html` with `root: dist/publish` and `files` listing every other file in it (`engine.js`, `figures/*.js`); a figure change then touches one small file. To update the existing page, pass its link as `url`; the link so far is
   https://claude.ai/artifact/5Q81MgnancaTQ1rxySzJoC. A new figure then appears on the same page as a new button.
3. The link is **private**: only the owner can open it. Anyone else needs it shared from the page's Share menu.
4. Add the README row, update `PLAN.md`, and say in one line what was and was not checked.

## 7. When something breaks

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `check`: *closes inside its box* | the shape reaches the edge of the part's `box` at some plane or parameter | widen `box.x` / `box.y` by a few cells |
| `check`: *the figure responds* | `step()` gives the same parts and parameters at the start and end of `active` | make something depend on `t` |
| `check`: *intensity* | `step()` ignores `k` | map it: `byIntensity(k, [lo, mid, hi])` |
| `check`: *drive reaches both ends* | the mapping never gets to 0 or 1 inside the page | change its scale or offset; test it at the figure's own edges |
| `check`: a part is *never drawn* | it is `dynamic` but `step()` never gives it a `prm` | give it one, or make it static |
| a line is ragged or missing | a feature thinner than about two cells | a finer `cell` on that part |
| something inside glass is not visible | the glass sheets above it are opaque | `overlay: true` on the inner part |
| the drawing leaves the page, or is too small | `S` and `zm` | lower or raise `S`; `zm` is the height that lands mid-page |
| frames are slow | a big `box` or many `planes` on a dynamic part | shrink the box, raise the plane gap, coarser `cell` |
| markup is huge | many points per outline | coarser `cell`; the engine already thins outlines to a third of a pixel |
| a part sits on the wrong side of another at some angle | parts at one height are painted in `order` | note it; it is a known limit |
| the build says *"x" is declared in both* | two modules share a top-level name | rename yours: figure helpers live in module scope and share one namespace in the bundle |
| the page is blank | an error while slicing | the console says which part; run `check.mjs` on the figure |
| the pointer does nothing | `player.mode` is `split` (the figure does not move in split) | switch the hover mode to animate |

## 8. Known limits, and what is next

- **Painting order.** Parts at one height are painted in a fixed `order`. At extreme angles two overlapping parts can swap. Rule D from the
  archived sheet (per-part slicing axes) would fix it for rings and lenses, and is not built.
- **Browser-only code** (sleeping off screen, reduced motion, touch holds) has no automated test. It was checked by hand.
- **Not a git repository.** There is no history except the folders. `git init` in `visualiser/` is the next housekeeping step.
- **One page.** `page/actions.template.html` is the only page. A figure appears on it; there is no per-figure page.
- **Next figures:** the vault door (the dial turns with detents, then the bolts draw back). Candidates after it: a clock, a drawbridge, a compass.
- **Not planned:** ambient idle motion, click ripples, push/lift/swirl hover modes, a React wrapper.
