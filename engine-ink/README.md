# Visualiser engine: ink

Draws flat figures as **scratchy pen-and-ink prints**: bold black ink with torn, pooled edges, pen lines that swell and thin,
hatching that breaks where the nib skipped, spatter off the edges, dry-brush voids in the solids and paper-tooth grain, in
**one ink**. The look comes from the boxers, the São Paulo footballers and the Last Supper card. Its main job is to take
**drawings you give it as images** and redraw them in this style. Made with `/create-draw-engine`. Only the page and tools shell
came from the other engines; the core (`src/ink.js`) is its own. Stills only: nothing animates. Style ledger: [STYLE.md](STYLE.md).

```
node tools/trace.mjs <image> <name>   # a drawing (png, jpg, webp...) becomes figures/<name>.js
node tools/export.mjs <name>          # the finished still: dist/<name>.png (1800 px) and dist/<name>.svg  (--all for every figure)
node tools/export.mjs <name> --figma  # (a figure with `frame: [w, h]` exports at exactly that size)
# for Figma: dist/<name>.figma.svg, plain paths, grain baked in as holes, no background
node tools/studio.mjs [name ...]      # dist/studio.html: figures side by side under the look sliders
npm test                              # the inker, the painter (the style pinned), tracing, every figure, the checker, the build
node tools/check.mjs [name]           # check a figure (or all): FAIL stops you, warn is for you to read
npm run build                         # dist/actions.html: every figure and the sliders, one file, opens from disk
node tools/new-figure.mjs <name>      # a figure drawn in code (sdf shapes), from the template
node tools/publish.mjs                # the page for the Artifact host: dist/publish/
```

## From a drawing to ink

```
image  ->  trace (tools/trace.mjs)  ->  masks  ->  sdf  ->  ink field (src/ink.js)  ->  loops  ->  paint (src/painter.js)  ->  svg / png
```

`trace.mjs` reads the picture (via `sips`), blurs away scan noise (`--clean`), and sorts every pixel by darkness:

| In the picture | In the print |
| --- | --- |
| darker than `--dark` (0.45) | solid ink |
| a strong colour (red, blue...) | solid ink: colour is only darkness |
| darker grey (between `--dark` and halfway to `--mid`) | hatched, and crossed by a second hatch |
| lighter grey (up to `--mid`, 0.72) | hatched one way |
| lighter than that | paper |

For a photo, `--drop <hex>` turns everything near that colour's hue to paper (a sea, a sky), `--ground hatch` keeps it as
hatching instead, and `--separate 2` cuts a paper line where two colours meet inside the ink. Only broad greys are hatched: the thin grey halo a scan leaves round every dark edge is opened away first. `--ink red` prints it all in
red instead of black; `--invert` is for light lines on a dark ground; `--size` is the mask's longest side (420 px; more is finer).
Pure black-and-white art (a woodcut, a silhouette) wants `--mid` equal to `--dark`, so nothing is hatched. A figure from a trace is a
file of run-length masks: retrace with other options rather than editing it.

## How a shape becomes ink

A shape is a signed distance function (drawn in code, or from a traced mask). `sampleShape` puts it on a 1.5 px grid once;
`inkField` makes the ink field from it for a look, and `traceField` (marching squares) turns it into closed loops, painted even-odd.
The noise is anchored to the shape, so the same drawing always prints the same way.

- **mark**: `fill` (the shape), `line` (a band along its outline, wider where the pen pressed; `weight` scales it), `hatch`
  (strokes inside it; `angle` in degrees, `tone` 0 light to 1 dark).
- **ink**: `black`, or `paper`, which carves a highlight out of the ink under it, as a cut block leaves it. One ink per
  drawing (`red` and `blue` exist for a drawing printed wholly in that colour; `misreg` and `density` only touch those).

## Card pictures

A figure with `frame: [474, 500]` is a card's picture box: every mark is clipped to it, and both exports come out exactly that
size. A picture should still end inside the frame on its own marks (stroke ends, whole bricks, a ragged edge), never be
sliced flat by it: `tools/check.mjs` warns when ink touches the frame. The full card rules (weights, paper between masses, what
to trace and what to draw, grain sizes, where files go) are in the `/draw-ink` skill, section 5. A picture can mix drawn and traced parts: trace a part with a name starting `_` (`node tools/trace.mjs crop.png _name`),
which makes a helper, not a figure, and lay its mask in at your own `area` with `bitmapSdf`.

## For Figma

Figma (like most design tools) drops svg filters, so the print grain would vanish. `--figma` paints the same drawing as plain
filled paths with the grain baked into the geometry as small irregular pin holes, no paper background (it sits on any card
colour), cropped to the drawing. Every figure is drawn at the same scale, so suits exported together keep their relative sizes.
Art shown much smaller than it is drawn loses its grain (the holes shrink below a pixel): `--grain-size k` makes the holes and
their spacing k times bigger. The cards use 1.6 for the dive (shown about its own size), 11 for the indices and wordmarks, and 5 with
`--grain 0.08` for the suits (inked at S 180, and wanted sparser).

## The look: `RULE` in `src/painter.js`

One slider each in `RULE_CONTROLS`, on the page and in the studio.

| Knob | Does |
| --- | --- |
| `line` | pen line weight, px |
| `pressure` | how much a pen line swells and thins along its length |
| `hatch` | hatch spacing, px (a shape's `tone` tightens it) |
| `scratch` | how uneven the hatching is: strokes of different weight, broken where the nib skipped |
| `pool` | ink pooling: the field is blurred, so ink fills inside corners and fine gaps |
| `spread` | ink gain: every edge moves out |
| `wobble` | slow drift of the edge, as a hand does |
| `rough` | the edge torn finely by the paper (`tooth` is its grain size, px) |
| `speckle` | ink spatter just off the edges |
| `dry` | dry-brush voids inside solids |
| `keep` | fine detail kept: where the ink, or the paper between it, is thinner than this many px, all the hand marks above are turned down, so a thin highlight or a fine line stays open |
| `dust` | the smallest speck kept, px² |
| `grain` | print grain: pin holes of paper through the ink |
| `misreg` | how far a coloured plate prints out of register, px |
| `density` | a coloured plate's opacity (it multiplies over black) |

Two rules are built into the inker, from the tuning: hatching never closes up (a stroke is at most a quarter of its spacing,
and hatching gains at most a little ink), and fine detail is kept (`keep`, above).

## Figures

| Figure | What it tests |
| --- | --- |
| `rocket` | drawn in code: a pen outline with a hatched shadow side, solid nose, band and fins, a paper glint, a solid flame |
| `lightbulb` | drawn in code: thin glass line, a fine filament inside it, threads carved in paper |
| `tileStack` | drawn in code: repeated flat cells, sharp corners, every mark kind once |
| `cup` | traced from a clean test sketch: outlines to ink, greys to hatching and cross-hatching, the red band to solid ink |
| `boxers` | traced from the boxing reference: a print that is already ink, redrawn with no hatching |
| `diver` | traced from a photo: the sea dropped by its hue (`--drop`), the diver left as a silhouette |
| `theDive` | the diver's traced masks set in a sea drawn by hand as a woodcut gradient: fine strokes at the horizon swelling to solid ink with white wave lines near us, glitter, a paper halo round the diver |
| `heart`, `spade`, `diamond`, `club` | the card suits, drawn sleek to sit with Didot (sharp points, a hairline stem flaring into a thin arched foot), inked at S 180 so their edges stamp like the indices (shared outlines in `figures/_suit.js`; a file starting with `_` is a helper, not a figure) |
| `twoDidot` … `qBodoni` | card indices: 2 and Q set in Didot, Baskerville, Big Caslon and Bodoni 72 (bold), rendered at one size and traced with `--frame --mid 0.45 --clean 0 --size 700`, so each font's 2 and Q share a scale |
| `aDidot` … `kDidot`, `jokerDidot`, `jokerStackDidot` | the full index set in Didot (A, 2–10, J, Q, K, JOKER across and stacked), all at the 2's scale: set at 520 px, traced with `--frame --frame-size 700 --mid 0.45 --clean 0` |
| `sicilyCapsDidot`, `sicilyLowerDidot` | the wordmarks SICILY 2025 and sicily 2025, same type size and scale |
| `halfCrown` | The Half Crown pub front, drawn by hand from `reference/half-crown.webp` for a card's 474 x 500 picture box (`frame`): photo pixels mapped to the frame, brick and glass hatched, the name traced from the photo (`figures/_half-crown-sign.js`, its F rebuilt from the E of THE, the A-board left out) |
| `star` | The Star by Hackney Downs, drawn by hand for a card's 474 x 500 box: the whole corner building in perspective (`starLevel` tilts each face's shapes with it); its lettering and the mural's face are still to be traced from the photo |
| `hackney` | Hackney Church Brew Co, a card picture in the 474 x 500 frame: the arch completed and drawn by hand (brick wall, voussoir ring, steel glazing, open doors, lights), with the sign's lettering and the crowd at the tables traced from the photo (`figures/_hackney-sign.js`, `figures/_hackney-crowd.js`; photo in `reference/hackney.webp`) |
| `spurstowe` | The Spurstowe Arms, a card picture: the pub alone, drawn by hand (pale brick as scattered strokes, dark quoins, arches and jambs, sash windows, coping and chimney), the ground floor completed where a car hid it, the sign lettered by hand after the photo's slab serifs (traced, it was too small to read; photo in `reference/spurstowe.png`) |
| `paperDress` | Paper Dress Vintage, a card picture: the wide shopfront kept whole, the storey above drawn in (windows, dentilled cornice); the sign (with `--local`) and the shop below it (chalkboards, clothes, mannequins, A-board) traced from the photo; mosaic piers as tiles, terrazzo as chips, a hatched canopy (`figures/_paper-dress-sign.js`, `figures/_paper-dress-shop.js`; photo in `reference/paper-dress.webp`) |
