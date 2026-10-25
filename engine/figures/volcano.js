import { len2, subtract, rcyl, byIntensity, clamp, sm } from "../src/math.js";
import { planes } from "../src/slice.js";

/*
 * A volcano: a steep cone with ridged flanks and an open crater. Move up it and the crater fills with lava, which
 * rises to the rim and spills over in three streams that run down the flank. At rest it is cold and dry. The cone is cut
 * once; the lava is cut again as it rises and flows.
 */
const volcTop = 0.5, volcStreams = [0.7, 2.8, 4.9];                      // the cone's height, and the angles of the three lava flows

/** the cone's radius at height z, with seven ridges that fade toward the crater */
const volcRadius = (z, th) => (0.15 + 0.35 * Math.pow(clamp(1 - z / volcTop, 0, 1), 1.4)) * (1 + 0.05 * Math.cos(7 * th) * (1 - z / volcTop));

export const volcano = {
  T: 4, zr: [0, 0.56], S: 330, zm: 0.24,
  active: [0, 2.4],                                              // the crater fills and the lava spills; the pose at 0 is the rest pose
  drive: (x, y) => clamp((480 - y) / 300, 0, 1),                 // up the volcano
  hint: "move up the volcano to make it erupt",
  parts: [
    { id: "cone", order: 0, box: { x: [-0.65, 0.65], y: [-0.65, 0.65] }, planes: planes(0, volcTop, 0.012), sdf: (x, y, z) => {
      const r = len2(x, y), cone = Math.max(r - volcRadius(z, Math.atan2(y, x)), -z, z - volcTop);
      return subtract(cone, Math.max(r - 0.1, 0.38 - z));                                                         // an open crater in the top
    } },
    { id: "lava", order: 1, dynamic: true, cell: 0.016, key: (p) => (p ? p.f.toFixed(2) : ""), box: { x: [-0.56, 0.56], y: [-0.56, 0.56] }, planes: planes(0.05, 0.52, 0.02), sdf: (x, y, z, { f }) => {
      const r = len2(x, y), th = Math.atan2(y, x), pool = Math.max(r - 0.097, z - (0.385 + 0.105 * clamp(f / 0.4, 0, 1)), 0.37 - z);   // lava rising in the crater
      let d = pool;
      const reach = volcTop - 0.01 - 0.42 * clamp((f - 0.35) / 0.65, 0, 1);                                      // how far down the flank the flows have run
      if (f > 0.36) for (const a of volcStreams) {
        const ang = ((((th - a - 0.12 * Math.sin(z * 14 + a)) + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
        d = Math.min(d, Math.max(Math.abs(r - volcRadius(z, th)) - 0.022, Math.abs(ang) * r - (0.05 + 0.08 * (volcTop - z)), reach - z, z - volcTop));   // a strip lying on the flank
      }
      return d;
    } },
  ],
  /**
   * k, the intensity: how much lava it gives.
   * 0: it fills the crater · 0.5: it spills down a third of the flank · 1: the flows run nearly to the foot
   */
  step(t, abs, k = 0.5) {
    const amount = byIntensity(k, [0.4, 0.75, 1]), e = sm(0, 2.4, t) * (1 - sm(2.9, 3.8, t));
    return { cone: {}, lava: { prm: e * amount > 0.02 ? { f: Math.round(e * amount * 40) / 40 } : null } };
  },
};
