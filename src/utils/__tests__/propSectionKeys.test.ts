import { describe, expect, it } from "vitest";
import { comparePropSectionKeys, sortPropSectionKeys } from "../propSectionKeys";

describe("propSectionKeys", () => {
  it("sorts Props[i] keys numerically, not lexicographically", () => {
    const keys = ["Props[10]", "Props[2]", "Props[0]", "Props[1]"];
    expect(sortPropSectionKeys(keys)).toEqual([
      "Props[0]",
      "Props[1]",
      "Props[2]",
      "Props[10]",
    ]);
  });

  it("places Props[10] after Props[9] when using compare", () => {
    expect(comparePropSectionKeys("Props[9]", "Props[10]")).toBeLessThan(0);
    expect(["Props[0]", "Props[1]", "Props[10]", "Props[2]"].sort(comparePropSectionKeys)).toEqual([
      "Props[0]",
      "Props[1]",
      "Props[2]",
      "Props[10]",
    ]);
  });
});
