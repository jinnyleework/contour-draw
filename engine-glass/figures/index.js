import { rocket } from "./rocket.js";
import { camera } from "./camera.js";
import { binoculars } from "./binoculars.js";
import { lightbulb } from "./lightbulb.js";
import { recordPlayer } from "./record.js";
import { lighthouse } from "./lighthouse.js";
import { GLASS } from "./glass.js";

/** the glass versions: the same figures hollowed, with their insides showing */
export { GLASS };

/** every figure the page offers, in the order of its buttons */
export const SCENES = { rocket, camera, binoculars, lightbulb, "record player": recordPlayer, lighthouse };
