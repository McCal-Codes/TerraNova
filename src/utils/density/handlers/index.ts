import type { NodeHandler } from "../evalContext";
import { getRegisteredDensityHandlers } from "../handlerRegistry";
import { buildSimpleHandlers } from "./simple";
import { buildArithmeticHandlers } from "./arithmetic";
import { buildClampingHandlers } from "./clamping";
import { buildSmoothHandlers } from "./smooth";
import { buildPositionHandlers } from "./position";
import { buildCombinatorHandlers } from "./combinators";
import { buildOverrideHandlers } from "./overrides";
import { buildCellNoiseHandlers } from "./cellNoise";
import { buildTransformHandlers } from "./transforms";
import { buildSdfHandlers } from "./sdfs";
import { buildWarpHandlers } from "./warps";
import { buildNoiseHandlers } from "./noise";
import { buildTerrainSpecificHandlers } from "./terrainSpecific";

export function buildAllHandlers(): Map<string, NodeHandler> {
  const map = new Map<string, NodeHandler>();
  for (const build of [
    buildSimpleHandlers,
    buildArithmeticHandlers,
    buildClampingHandlers,
    buildSmoothHandlers,
    buildPositionHandlers,
    buildCombinatorHandlers,
    buildOverrideHandlers,
    buildCellNoiseHandlers,
    buildTransformHandlers,
    buildSdfHandlers,
    buildWarpHandlers,
    buildNoiseHandlers,
    buildTerrainSpecificHandlers,
  ]) {
    for (const [k, v] of build()) {
      map.set(k, v);
    }
  }
  // Last, so a registered handler can add a missing type or correct a built-in.
  for (const [k, v] of getRegisteredDensityHandlers()) {
    map.set(k, v);
  }
  return map;
}
