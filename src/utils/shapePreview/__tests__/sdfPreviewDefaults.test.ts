import { describe, expect, it } from "vitest";
import { isLikelyOriginCenteredSdfVoxelRange } from "../sdfPreviewDefaults";

describe("isLikelyOriginCenteredSdfVoxelRange", () => {
  it("flags non-negative-only ranges that miss origin-centered SDFs", () => {
    expect(isLikelyOriginCenteredSdfVoxelRange(0, 64)).toBe(true);
    expect(isLikelyOriginCenteredSdfVoxelRange(-32, 32)).toBe(false);
    expect(isLikelyOriginCenteredSdfVoxelRange(10, 80)).toBe(true);
  });
});
