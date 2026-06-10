import { describe, it, expect } from "vitest";
import { handleTop, resolveHandleRow, isPortLabelSignificant } from "../nodeLayout";

describe("resolveHandleRow", () => {
  it("centers a lone output among multiple inputs", () => {
    expect(resolveHandleRow(0, "output", 3, 1)).toBe(1);
  });

  it("keeps input rows unchanged", () => {
    expect(resolveHandleRow(0, "input", 3, 1)).toBe(0);
    expect(resolveHandleRow(2, "input", 3, 1)).toBe(2);
  });

  it("leaves symmetric layouts alone", () => {
    expect(resolveHandleRow(0, "output", 1, 1)).toBe(0);
    expect(resolveHandleRow(1, "output", 2, 2)).toBe(1);
  });
});

describe("isPortLabelSignificant", () => {
  it("hides generic Input/Output labels", () => {
    expect(isPortLabelSignificant("Input")).toBe(false);
    expect(isPortLabelSignificant("Output")).toBe(false);
  });

  it("shows meaningful port names", () => {
    expect(isPortLabelSignificant("Condition")).toBe(true);
    expect(isPortLabelSignificant("True")).toBe(true);
  });
});

describe("handleTop", () => {
  it("offsets rows by ROW_H", () => {
    expect(handleTop(0)).toBe(14);
    expect(handleTop(1)).toBe(42);
  });
});
