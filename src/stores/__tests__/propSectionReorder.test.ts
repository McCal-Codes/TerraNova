import { describe, expect, it } from "vitest";

function mapActiveIndexAfterMove(activeIdx: number, fromIndex: number, toIndex: number): number {
  if (activeIdx === fromIndex) return toIndex;
  if (fromIndex < activeIdx && toIndex >= activeIdx) return activeIdx - 1;
  if (fromIndex > activeIdx && toIndex <= activeIdx) return activeIdx + 1;
  return activeIdx;
}

describe("prop section reorder index mapping", () => {
  it("moves active tab index when reordering props", () => {
    expect(mapActiveIndexAfterMove(2, 2, 0)).toBe(0);
    expect(mapActiveIndexAfterMove(2, 0, 2)).toBe(1);
    expect(mapActiveIndexAfterMove(1, 2, 0)).toBe(2);
  });
});
