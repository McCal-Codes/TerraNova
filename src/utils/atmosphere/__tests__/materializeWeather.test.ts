import { beforeEach, describe, expect, it, vi } from "vitest";
import { materializeWeatherFiles } from "../materializeWeather";

vi.mock("@/utils/ipc", () => ({
  copyFile: vi.fn(async () => {}),
  createDirectory: vi.fn(async () => {}),
  exportAssetFile: vi.fn(async () => {}),
  pathExists: vi.fn(async () => false),
}));

vi.mock("../defaultWeatherDoc", () => ({
  buildDefaultWeatherDoc: vi.fn((id: string) => ({ Id: id, SkyTopColors: [] })),
}));

import { copyFile, exportAssetFile, pathExists } from "@/utils/ipc";

describe("materializeWeatherFiles", () => {
  beforeEach(() => {
    vi.mocked(copyFile).mockClear();
    vi.mocked(exportAssetFile).mockClear();
    vi.mocked(pathExists).mockReset();
    vi.mocked(pathExists).mockResolvedValue(false);
  });

  it("imports bundled weather when destination does not exist", async () => {
    const result = await materializeWeatherFiles({
      weathersDir: "C:\\Pack\\Server\\Weathers",
      importIds: ["Zone1_Sunny"],
      bundledPathIndex: {
        zone1_sunny: "C:\\Cache\\Server\\Weathers\\Zone1_Sunny.json",
      },
    });

    expect(result).toEqual({ imported: 1, created: 0, skipped: 0, failed: 0 });
    expect(copyFile).toHaveBeenCalledWith(
      "C:\\Cache\\Server\\Weathers\\Zone1_Sunny.json",
      expect.stringMatching(/Pack[/\\]Server[/\\]Weathers[/\\]Zone1_Sunny\.json$/),
    );
  });

  it("skips import when destination exists and overwrite is false", async () => {
    vi.mocked(pathExists).mockResolvedValue(true);

    const result = await materializeWeatherFiles({
      weathersDir: "C:\\Pack\\Server\\Weathers",
      importIds: ["Zone1_Sunny"],
      bundledPathIndex: {
        zone1_sunny: "C:\\Cache\\Server\\Weathers\\Zone1_Sunny.json",
      },
    });

    expect(result).toEqual({ imported: 0, created: 0, skipped: 1, failed: 0 });
    expect(copyFile).not.toHaveBeenCalled();
  });

  it("creates placeholder weather for missing IDs", async () => {
    const result = await materializeWeatherFiles({
      weathersDir: "C:\\Pack\\Server\\Weathers",
      createIds: ["Custom_Weather"],
      bundledPathIndex: {},
    });

    expect(result).toEqual({ imported: 0, created: 1, skipped: 0, failed: 0 });
    expect(exportAssetFile).toHaveBeenCalledWith(
      expect.stringMatching(/Pack[/\\]Server[/\\]Weathers[/\\]Custom_Weather\.json$/),
      expect.objectContaining({ Id: "Custom_Weather" }),
    );
  });

  it("counts failed when bundled path is missing", async () => {
    const result = await materializeWeatherFiles({
      weathersDir: "C:\\Pack\\Server\\Weathers",
      importIds: ["Unknown_Weather"],
      bundledPathIndex: {},
    });

    expect(result).toEqual({ imported: 0, created: 0, skipped: 0, failed: 1 });
  });
});
