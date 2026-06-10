import { describe, expect, it } from "vitest";
import {
  interpolateColorAtHour,
  normalizeColorToken,
  sampleColorAtHour,
} from "../colorTracks";

describe("colorTracks", () => {
  const timeline = [
    { Hour: 6, Color: "#000000" },
    { Hour: 12, Color: "#ffffff" },
    { Hour: 18, Color: "#ff0000" },
  ];

  it("normalizes native Hytale color tokens", () => {
    expect(normalizeColorToken("#ABCDEF")).toBe("#abcdef");
    expect(normalizeColorToken("rgba(#B35DFA, 0.62)")).toBe("#b35dfa");
  });

  it("hold-samples the last keyframe at or before the hour", () => {
    expect(sampleColorAtHour(timeline, 11)).toBe("#000000");
    expect(sampleColorAtHour(timeline, 12)).toBe("#ffffff");
    expect(sampleColorAtHour(timeline, 17)).toBe("#ffffff");
  });

  it("lerp-samples between keyframes for editor preview", () => {
    expect(interpolateColorAtHour(timeline, 9)).toBe("#808080");
    expect(interpolateColorAtHour(timeline, 6)).toBe("#000000");
  });
});
