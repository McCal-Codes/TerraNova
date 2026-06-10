import { describe, expect, it } from "vitest";
import { hudAbsoluteStyle } from "@/utils/hudPositionStyle";

describe("hudAbsoluteStyle", () => {
  it("inverts x when anchored from the right", () => {
    const style = hudAbsoluteStyle({ x: 20, y: 0 }, { x: "right", y: "top" }, { right: 8, top: 4 });
    expect(style).toMatchObject({ position: "absolute", right: -12, top: 4 });
  });

  it("inverts y when anchored from the bottom", () => {
    const style = hudAbsoluteStyle({ x: 0, y: 15 }, { x: "left", y: "bottom" }, { left: 6, bottom: 10 });
    expect(style).toMatchObject({ position: "absolute", left: 6, bottom: -5 });
  });

  it("adds offsets when anchored from left/top", () => {
    const style = hudAbsoluteStyle({ x: 5, y: 7 }, { x: "left", y: "top" }, { left: 2, top: 3 });
    expect(style).toMatchObject({ position: "absolute", left: 7, top: 10 });
  });
});
