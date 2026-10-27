/*
 * The camera: world (x, y, z) to the page. No DOM.
 *
 * World space has x and y on the ground and z up. The camera is orthographic: it turns the ground by
 * `azimuth` (degrees), squashes y by `tilt` (the sine of the elevation; 0.5 is the 2:1 view), and lifts
 * z by cos(elevation). `scene.S` is the scale in page units per world unit, `scene.zm` the height that
 * lands at the page's middle. The page is a 600 x 600 box.
 */

/** the direction on the ground that points at the viewer, as [sin az, cos az]: used to tell edges that face you from edges seen edge-on */
export const toViewer = (view) => { const az = (view.azimuth * Math.PI) / 180; return [Math.sin(az), Math.cos(az)]; };

/** returns project(x, y, z) -> [px, py] */
export function makeProjector(view, scene) {
  const az = (view.azimuth * Math.PI) / 180, c = Math.cos(az), s = Math.sin(az), zf = Math.sqrt(1 - view.tilt ** 2), S = scene.S, zm = scene.zm;
  return (x, y, z) => [300 + S * (x * c - y * s), 300 + S * ((x * s + y * c) * view.tilt - (z - zm) * zf)];
}
