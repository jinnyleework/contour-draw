# Visualiser: where we are

Draws objects as stacked contour slices ("cartographic" line work) and animates them. Reference studied:
`reference/hairline/` (MIT). We borrowed its habits (no words in the drawing, one highlight, springs for
continuous input, one frame loop that sleeps) but not its isometric hull technique: our look is slices.

## What exists

| Where | What |
| --- | --- |
| `sketches/v1/` | frozen: a generated mountain as contour slices (heightfield + marching squares) |
| `sketches/v2/` | objects as signed distance functions, sliced; binoculars, rocket, camera, vase, mug, torus; the rule-set sheet |
| `sketches/v3/` | rule A (weight and depth) with sliders |
| `sketches/v4/` | hover interaction: the split (layers part along y), plus push/lift/swirl |
| `sketches/v5/` | object actions (rocket, camera, binoculars) and the ambient idle (dropped) |
| `archive/` | frozen snapshots; `2026-10-25-binoculars-rule-sets.html` |
| `engine/` | **the engine**: modules, figures, tests, build. See `engine/README.md` |
| `engine-glass/` | **the second engine**: a copy of the engine plus the glass edition (hollow skins drawn twice, insides showing through). See its README |

## Decisions made

- Look: slices painted bottom-up with opaque fills, rule A weights. Chosen from five rule sets (A, B, C, D, baseline).
- Interaction: the cursor splits the stack along y, across the full width, with a small / medium / large gap. Click ripple removed.
- Motion: object actions in the same style. Rocket stays low, the flame carries it. Ambient idle dropped.

## Next

1. ~~Move the interaction into the engine~~ Done: `pointer.js`, `split.js` and a shift hook in the painter.
2. ~~Rule A controls in the page~~ Done: four sliders.
2b. ~~Intensity~~ Done, as Hairline does it: hover has two modes, animate (the cursor scrubs the action) and split; one
    intensity says how strongly the figure answers the cursor. Nothing plays on its own; `demo` shows the loop once.
3. ~~Touch~~ Done. **More objects**: lightbulb and record player are in; the lighthouse (beams sweep) is in too, and the toaster (the lever lets go, the toast pops); four more machines are in (typewriter, printer, gear train, cassette deck), twelve conceptual figures are in too (terrain, volcano, ripple tank, tile pyramid, spiral stair, ring tower, funnel, hourglass, whirlpool, crystal cluster, honeycomb, card fan), and twelve more are in (carousel, pocket watch, telescope, jack-in-the-box, windmill, gyroscope, umbrella, periscope submarine, seedling, drawer chest, bellows camera, percolator), and the vault door is in too (seen from above, so the slices are its rings; the wheel turns and the bars draw in). Earlier note: the vault door was to be (the dial turns, then the
   bolts draw back). Rules for each (like the rocket's "stays low") go in the figure.
4. **Per-part slicing axes** (rule D, from the archived sheet): barrels as rings along their length, lenses as
   concentric circles. Needs the painter to order sheets by their own axis.
5. ~~Package and publish~~ Done: `tools/publish.mjs`.
6. ~~A skill to drive the engine~~ Done: `.claude/skills/draw-contour/` (`SKILL.md`, `run-plan.md`), with `tools/check.mjs` and
   `tools/new-figure.mjs` behind it.
7. ~~Glass~~ Done, and kept as its own engine, `engine-glass/`: `glassOf`, and a second page with the glass rocket, camera and binoculars.
   The original engine has no glass in it. If glass should come back into the one engine, copy `src/glass.js`, `figures/glass.js` and the
   build changes across (the diff between the two folders is exactly that).
8. **Housekeeping**: `git init` in `visualiser/`; a way to take stills of a figure without a browser.

## Not planned

Ambient idle motion, click ripples, a React wrapper, a generator skill for agents. Revisit only if asked.
