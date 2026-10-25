---
name: draw-contour
description: Use when someone asks for a new Visualiser figure, or runs /draw-contour with an idea. Draws one object as stacked contour slices that answers the cursor, on the Visualiser engine (the engine/ folder of the project at /Users/jinnylee/Playground/visualiser), checks it, and publishes it.
argument-hint: "[idea]"
---

# Visualiser: create a figure

You are making one figure for the Visualiser engine (`engine/`): an object drawn as stacked contour slices, in one weight-and-depth line style, that answers the cursor. The rocket, camera, binoculars, lightbulb, record player and lighthouse in `engine/figures/` are the bar.

You write one file: `engine/figures/<name>.js`. The engine (`engine/src/`), the page (`engine/page/`) and the tools (`engine/tools/`) are fixed. Do not edit them to make a figure work. If a figure cannot be drawn with what the engine gives you, say so and stop; the engine changes only when the person asks for that.

All commands run from `engine/`. `run-plan.md`, next to this file, has the full runbook and what to do when something fails.

## Where the project is

The Visualiser project is `/Users/jinnylee/Playground/visualiser`. This skill works from any folder: paths below such as `engine/README.md` are
inside that project, and every command runs from `/Users/jinnylee/Playground/visualiser/engine`. If your working directory is somewhere else,
`cd` there first (or use absolute paths). If that folder does not exist, say so and stop: the skill needs the engine.

## 0. Orient

Read `engine/README.md` (the figure format, intensity, thin parts, overlays, touch). Then read the one example nearest your idea:

| Your idea moves like | Read |
| --- | --- |
| a part that rises, with something growing under or around it | `figures/rocket.js`, `figures/lightbulb.js` |
| a part that extends or slides | `figures/camera.js`, `figures/binoculars.js` |
| a part that turns or sweeps | `figures/record.js`, `figures/lighthouse.js` |

## 1. Concept

A concept is **an object, what the cursor does to it, and where it rests**. Offer two or three, one line each:

> **Name.** The object. Which part moves and how. Where the cursor goes to drive it. What intensity changes. What it looks like at rest.

Wait for the person to pick. If nobody is there to ask, take the one with the clearest rest pose and say which you took.

A good concept:
- is **one idea**: one action the cursor scrubs from rest to full, not two;
- has parts you can name **along what moves**: what stays still is one part, cut once; what moves is its own part;
- has a **cursor mapping that is a place**: up the figure, or across it, so the person can find it (`drive`, and a `hint` that says where);
- has a **rest pose that is already a drawing**: the figure is still until the pointer arrives, so rest is what most people see;
- has an **intensity that means how strongly it answers**: a distance, a count, a number of turns (a table of `[low, middle, high]`, with the middle being the figure as you first drew it);
- **shows its inside when it opens**: if the action opens, slides out or lifts off something, that thing is hollow and you can see in;
- has **no words in it**: identity comes from geometry, never lettering.

Drop a concept that needs a label to be understood, holds two ideas, or is a diagram (boxes and arrows).

## 2. Scaffold

```sh
cd engine && node tools/new-figure.mjs <name>
```

`<name>` is lowercase letters, digits and hyphens (`vault-door`). It writes `figures/<name>.js` from a template that already passes the checker, and registers it so the page gets a button. Now replace the template's parts, `drive`, `hint` and `step`. Keep the file to about 80 lines; a longer figure is usually two ideas.

## 3. Build it

Shapes are signed distance functions (negative inside). Use the helpers in `src/math.js`: `rcyl` (a rounded cylinder along any axis), `roundBox`, `smin`, `subtract`, `segDist`, `len2`. The rules that decide whether it works:

1. **The shape must be outside its box on every edge of the box**, at every plane. Leave a margin of a few cells, or its outlines never close. (`check.mjs` tests this.)
2. **Cut along what moves.** A part that never moves is static (cut once). A part that changes shape is `dynamic` with a `key(prm)` that changes only when the picture does, and a small `box`. A part that only moves is static and takes `off: [dx, dy, dz]` from `step`.
3. **A part thinner than about two grid cells needs a finer `cell`** on that part (a third of its thinnest feature). Otherwise its line is ragged or missing.
4. **Glass hides what is inside it.** The painter draws stacked sheets with opaque fills. Anything inside a shell (a filament, a lamp) is `overlay: true` so it is painted on top and shows through.
5. **Ties at one height go to the higher `order`**, so give nearer parts a higher order.
6. **`step(t, abs, k)`**: `t` is the moment in the loop, `abs` the clock (for flicker and shake), `k` the intensity from 0 to 1 with 0.5 the default. Map `k` with `byIntensity(k, [lo, mid, hi])`. At `t = active[0]` every part must be at rest: no flame, no beam, no lift.
7. **`drive(x, y)`** takes the cursor's position in the 600 x 600 page and returns 0 to 1: 0 where the figure is at rest, 1 where its action is complete. It must reach both ends.
8. **Budget**: a moving frame should be under 25 ms and the markup under 450 kB. Fewer planes and a coarser `cell` buy both. Dynamic parts are what cost.
9. Round everything: no sharp edges unless the object has them. Put a detail only this object would have (a thread, a strobe ring, a railing) where the eye lands.
10. Write `zr` (the object's height range), `S` (scale) and `zm` (the height that sits mid-page) so the figure fills the page without leaving it, at its rest pose and at the end of its action.
11. **Whatever opens must show its inside.** A drawer, a box, a hatch, a tube that slides: when the cursor opens it, the viewer must see that it is hollow. Draw containers as open trays (a floor and walls, the top left open), cut the space they leave behind in the part that holds them (the slot, the cavity), and slide them far enough, and in a staggered way, that you look down into each one. A solid block that slides out reads as a plank. Check the rim of anything you hollow: a rim drawn as a plate closes the opening (the jack-in-the-box did this), so cut the cavity from the rim too.
12. **Thin upright things need fine slices.** A stem, leg, pole, handle, spout or axle is cut as a small ring at every height, so at the usual gap (0.03) it reads as a row of dots. Give that part `planes(a, b, 0.01)` (a static part costs nothing for it) and make the feature at least three cells thick (a stem about 0.05 across, not 0.03). `check.mjs` warns "thin stems" when it sees rings at a wide gap; fix it rather than read past it. For a dynamic part, finer planes cost frame time: thicken the feature and coarsen `cell` to pay for it.
13. **Lay the object so its interesting face is horizontal.** Slices are horizontal, so a flat face seen from above becomes true rings and outlines (the vault door lying flat reads; standing upright it was dashes). Put the dial, the face, the opening on top.
14. **Name every top-level helper after the figure** (`gyroRotor`, `scopeTube`, not `tube` or `along`): the build joins all figures into one script and fails on a clash.
15. **Many copies of one shape in a dynamic part: measure only the nearest** (fold the angle onto one sector, as the carousel does) instead of looping over all of them per grid point. It is the difference between 200 ms and 25 ms.
16. **A figure can follow the cursor, not only be scrubbed by it.** `step(t, abs, k, pointer)` gets `{ s, x, y, ground(z) }` (see `engine/README.md`, "Following the cursor"); use it when the cursor's place should shape the figure (a peak under it). Give it a fallback for `pointer === null` so the demo and stills work.
17. **The painter orders by height alone, so never rely on a part being "in front of" another.** Sheets are painted bottom up with opaque fills; a thin part standing in front of a bulky one (a post in front of a glass bulb, a handle in front of a pot) is covered wherever a higher sheet of the bulky part overlaps it on the page, and a part that should sit above another (a plate on a bulb) is wrongly hidden if anything is painted after it. Design so that parts which must read as nearer **do not overlap on the page at the default view** (put the posts at the sides, not the front), or sit entirely above or below the other part's heights. Use `overlay: true` only for something that truly should show through everything (a filament, a halo), never for a thing that other parts must cover: an overlay is painted last, over plates and everything else (the hourglass's sand did this and hid its own top plate). Always look at the **default view** (rest, azimuth 35, tilt 0.5) at full size, not only the thumbnails, and check each pair of parts that overlap on the page: which is in front, and is that right?

## 4. Check

```sh
node tools/check.mjs <name> --quiet   # (omit --quiet to see passes) every FAIL must be fixed; read every warn
npm test                         # the whole engine still passes
```

`check.mjs` tests the declaration, `step()` at every time and intensity, that the shape closes inside its box, that the cursor mapping reaches both ends, that the picture changes as the cursor drives it and as intensity changes, that no frame has NaN, how big and how fast a frame is, and whether the drawing leaves the page. It cannot tell you whether it looks good. That is step 5.

## 5. Look

Do not say the look is done if you did not look.

```sh
node tools/build.mjs
```

First, one image of every pose: `node tools/still.mjs <name>` writes `engine/dist/still-<name>.png` (rest, halfway, full, intensity 0 and 1, turned -50 and 140, hover split); Read it. This covers most of the list below in one call. For a real mouse or a live check, open `engine/dist/actions.html` in the browser (`file://` + the absolute path). Select the figure, then set states directly, which is more reliable than moving a mouse:

```js
const sv = document.getElementById("art"), c = player.cursor;
c.x = 300; c.y = 150; c.tx = c.x; c.ty = c.y; c.s = 1; c.ts = 1; player.redraw();   // the cursor at page (300, 150), fully acting
MOTION.intensity = 1; SPLIT.intensity = 1; player.redraw();                          // intensity high
c.s = 0; c.ts = 0; player.redraw();                                                    // pointer away: the rest pose
VIEW.azimuth = -50; VIEW.tilt = 0.7; player.redraw();                                  // turned and tilted
```

The browser pane's screenshots lag one step behind what the page shows. Take the picture twice (the `zoom` action with the whole page as its region works), or confirm the state with a number first, and trust the second.

Look at, and answer, each of these:
- **Rest.** Is it a composed drawing on its own, with the figure recognisable at small size? Is anything moving or lit that should be dark?
- **Halfway and full.** Does the action read? Does anything tear, overlap wrongly, or leave the page?
- **Intensity low and high.** Do both look intended?
- **Turned.** At two or three angles (try -50, 140), does the stack still look right? (Parts at one height are painted in `order`, which can be wrong at an extreme angle: say so if you see it.)
- **Hover split.** Switch to split and move the cursor: do the layers part cleanly?

Fix what fails, then go back to step 4.

## 6. Hand over

```sh
node tools/build.mjs && node tools/publish.mjs
```

Then publish it as an Artifact **as files**, so a later merge or conflict returns only what changed: `file_path` = `engine/dist/publish/index.html`, `root` = `engine/dist/publish`, `files` = `["engine.js", "figures/index.js", "figures/<each figure>.js", ...]` (`ls -R engine/dist/publish`). If the person already has a link, update it in place with `url` (read `PLAN.md` or ask; the engine's link so far is https://claude.ai/artifact/5Q81MgnancaTQ1rxySzJoC). Otherwise make a new one. The artifact is private; say so. (`dist/actions.publish.html` is the same page as one file; use it only if the files form is refused.)

Add the figure to the intensity table in `engine/README.md` (what it changes, at 0, 0.5 and 1) and its name to the figures line, and update `PLAN.md`. Then tell the person, one line each:
- the concept: what the object is and what the cursor does to it;
- what intensity changes;
- what you checked (the checker, the tests, the looks) and what you did not (a real mouse, a phone);
- anything you saw but did not fix.

## 7. Adjust

When the person asks for a change, edit only `engine/figures/<name>.js`, run step 4 again and look again. The tenth change is held to the same bar as the first.

## What goes wrong

| If you catch yourself | Do this instead |
| --- | --- |
| editing `src/`, the template or the tools so the figure works | the figure is wrong, or the engine cannot draw it: change the figure, or stop and say so |
| writing a timer, `requestAnimationFrame` or a CSS animation | there is none: `step()` is a function of time and the player runs the loop |
| making the figure play itself | nothing runs until the pointer arrives; `demo` plays the loop once, and that is all |
| adding a label, a number or a letter to the drawing | say it with geometry; the page's hint line is the only text |
| coloring, filling or shading something | there is one stroke in four weights; weight and depth are the rule |
| a part that must be seen through a shell and is not | `overlay: true` |
| a ragged or missing thin line | a finer `cell` on that part |
| a dynamic part with a box much bigger than the part | shrink the box: cost goes with its area times its planes |
| a post or handle that looks like it is behind the part it should be in front of (or a plate hidden by an overlay) | the painter orders by height only: move it so it does not overlap on the page at the default view, and keep `overlay` for things that show through everything (rule 17) |
| a stem, leg or pole that shows as dots | `planes(a, b, 0.01)` on that part and make it at least three cells thick (rule 12) |
| a drawer, lid or hatch that opens onto a solid block or a closed top | draw it hollow (a tray, a cavity), keep the rim a ring, and open it far enough to look in |
| letting in a second idea | cut it: one figure, one action |
