import { describe, it, expect } from "vitest";
import { isDeveloperModeActive } from "../useDeveloperMode";

describe("isDeveloperModeActive", () => {
  it("is true when explicit developer mode is on", () => {
    expect(isDeveloperModeActive(true, false)).toBe(true);
  });

  it("is false when both flags are off outside dev auto path", () => {
    expect(isDeveloperModeActive(false, false)).toBe(false);
  });
});
