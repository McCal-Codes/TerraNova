/**
 * Backward-compatible barrel: re-exports the public API from the modular density/ directory.
 * All existing import paths (e.g. "../utils/densityEvaluator") continue to work.
 */
export {
  createEvaluationContext,
  evaluateDensityGrid,
  getEvalStatus,
} from "./density";

export type {
  DensityGridResult,
  EvaluationOptions,
  EvaluationContext,
} from "./density";
