import { describe, expect, it } from "vitest";
import { buildScenePreviewModel, describeSceneDaypart } from "../scenePreviewModel";

describe("scenePreviewModel", () => {
  it("describes dayparts from hour", () => {
    expect(describeSceneDaypart(2).label).toBe("Deep Night");
    expect(describeSceneDaypart(12).label).toBe("Midday");
    expect(describeSceneDaypart(19).label).toBe("Dusk");
  });

  it("positions sun during daylight hours", () => {
    const noon = buildScenePreviewModel({
      SkyTopColors: [{ Hour: 12, Color: "#88ccff" }],
      SkyBottomColors: [{ Hour: 12, Color: "#224466" }],
      SunColors: [{ Hour: 12, Color: "#ffee88" }],
    }, 12);
    expect(noon.sunVisible).toBe(true);
    expect(noon.sunX).toBeGreaterThan(40);

    const night = buildScenePreviewModel({}, 2);
    expect(night.sunVisible).toBe(false);
    expect(night.nightFactor).toBeGreaterThan(0);
  });
});
