/*
 * The view. An ink figure is drawn on the page plane, like a print: nothing turns, nothing tilts, there is no depth, and what
 * covers what is the order the marks are laid down. `flat: true` tells the studio and the page to leave out turn and tilt.
 */

/** the plane: a figure's world units are page px over its S, centred on (300, 300), y up */
export const VIEW = { flat: true };
