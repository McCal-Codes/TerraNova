import { describe, expect, it } from "vitest";
import { getAtmosphereHelpContent } from "../atmosphereHelpContent";

describe("getAtmosphereHelpContent", () => {
  it("returns editor-specific copy with shared preview hour", () => {
    const weather = getAtmosphereHelpContent("weather-editor", "simple");
    const environment = getAtmosphereHelpContent("environment-editor", "simple");

    expect(weather.title).toBe("Weather editor");
    expect(environment.title).toBe("Environment editor");
    expect(weather.bullets.some((line) => line.includes("shared"))).toBe(true);
    expect(environment.bullets.some((line) => line.includes("Parent"))).toBe(true);
  });

  it("covers all help contexts", () => {
    const contexts = [
      "weather-editor",
      "environment-editor",
      "asset-inspector-weather",
      "asset-inspector-environment",
      "biome-atmosphere",
      "sync-3d",
      "forecast-strip",
      "import-banner",
      "parent-chain",
    ] as const;

    for (const context of contexts) {
      const content = getAtmosphereHelpContent(context);
      expect(content.title.length).toBeGreaterThan(0);
      expect(content.summary.length).toBeGreaterThan(0);
      expect(content.bullets.length).toBeGreaterThan(0);
    }
  });
});
