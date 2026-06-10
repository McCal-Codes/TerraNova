import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useEnvironmentScenePreview } from "../useEnvironmentScenePreview";

vi.mock("../useEffectiveEnvironment", () => ({
  useEffectiveEnvironment: () => ({
    mergedEnvironment: {
      WeatherForecasts: {
        "12": [{ WeatherId: "Zone1_Sunny", Weight: 100 }],
      },
    },
    loading: false,
  }),
}));

vi.mock("../useWeatherAssetIndex", () => ({
  useWeatherAssetIndex: () => ({
    status: "ready" as const,
    options: [{ id: "Zone1_Sunny", path: "C:/Pack/Server/Weathers/Zone1_Sunny.json" }],
    pathIndex: { "zone1_sunny": "C:/Pack/Server/Weathers/Zone1_Sunny.json" },
    error: null,
  }),
}));

vi.mock("../useWeatherDocCache", () => ({
  useWeatherDocCache: () => ({
    zone1_sunny: {
      SkyTopColors: [{ Hour: 12, Color: "#224466" }],
      SkyBottomColors: [{ Hour: 12, Color: "#112233" }],
    },
  }),
}));

describe("useEnvironmentScenePreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves dominant weather doc at the preview hour", async () => {
    const { result } = renderHook(() => useEnvironmentScenePreview({
      environmentDoc: { WeatherForecasts: {} },
      environmentName: "Env_Zone1_Plains",
      currentFile: "C:/Pack/Server/Environments/Zone1/Env_Zone1_Plains.json",
      projectPath: "C:/Pack",
      previewHour: 12,
    }));

    await waitFor(() => {
      expect(result.current.dominantEntry?.WeatherId).toBe("Zone1_Sunny");
      expect(result.current.sceneWeatherDoc).not.toBeNull();
      expect(result.current.effectiveForecast?.source).toBe("inherited");
    });
  });
});
