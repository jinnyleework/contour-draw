# v1: contour terrain

Static contour-slice drawing of a generated mountain. Frozen; do not edit, copy to v2 instead.

- Heightfield from seeded peaks, ridges, domain warp and ridged noise.
- Marching squares gives closed contour loops per level.
- Slices are lifted to their height and painted bottom-up with an opaque fill.
- Default seed 42; click for a new seed. Settings are the CFG block at the top of the file.
