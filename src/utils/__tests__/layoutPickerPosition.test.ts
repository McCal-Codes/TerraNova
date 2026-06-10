import { describe, it, expect } from "vitest";
import {
  clampLayoutPickerPosition,
  defaultLayoutPickerPosition,
} from "@/utils/layoutPickerPosition";

describe("layoutPickerPosition", () => {
  it("defaults to bottom-center with margin", () => {
    const pos = defaultLayoutPickerPosition(800, 600, 200, 32);
    expect(pos.x).toBe(300);
    expect(pos.y).toBe(556);
  });

  it("clamps custom position inside workspace", () => {
    const pos = clampLayoutPickerPosition(-50, 900, 400, 300, 120, 28);
    expect(pos.x).toBe(12);
    expect(pos.y).toBe(260);
  });
});
