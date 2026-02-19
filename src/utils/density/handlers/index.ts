import type { NodeHandler } from "../evalContext";
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
  ]) {
    for (const [k, v] of build()) {
      map.set(k, v);
    }
  }
  return map;
}
