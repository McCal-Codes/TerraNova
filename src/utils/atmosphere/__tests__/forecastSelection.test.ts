import { describe, expect, it } from "vitest";
import {
  collectForecastWeatherIds,
  getEffectiveForecastHour,
  readForecastHour,
  selectForecastWeatherId,
} from "../forecastSelection";

describe("forecastSelection", () => {
  it("reads Hytale array WeatherForecasts by hour", () => {
    const doc = {
      WeatherForecasts: [
        { Hour: 0, Weather: "Night_Clear", Weight: 100 },
        { Hour: 12, Weather: "Day_Sunny", Weight: 100 },
      ],
    };
    expect(readForecastHour(doc, 12)).toEqual([
      { WeatherId: "Day_Sunny", Weight: 100 },
    ]);
    expect(collectForecastWeatherIds(doc)).toEqual(["Night_Clear", "Day_Sunny"]);
    expect(selectForecastWeatherId(doc.WeatherForecasts, 12)).toBe("Day_Sunny");
  });

  it("selects the highest-weight weather in the nearest forecast hour bucket", () => {
    const weatherId = selectForecastWeatherId({
      0: [{ WeatherId: "Night_Clear", Weight: 2 }],
      12: [
        { WeatherId: "Day_Cloudy", Weight: 3 },
        { WeatherId: "Day_Sunny", Weight: 8 },
      ],
    }, 13);

    expect(weatherId).toBe("Day_Sunny");
  });

  it("returns inherited forecasts when local hour is empty", () => {
    const localDoc = { Parent: "Env_Zone1", WeatherForecasts: {} };
    const mergedDoc = {
      WeatherForecasts: {
        12: [{ WeatherId: "Zone1_Sunny", Weight: 100 }],
      },
    };

    const effective = getEffectiveForecastHour(localDoc, mergedDoc, 12);
    expect(effective.source).toBe("inherited");
    expect(effective.entries[0]?.WeatherId).toBe("Zone1_Sunny");
  });

  it("prefers local forecasts over inherited values", () => {
    const localDoc = {
      WeatherForecasts: {
        12: [{ WeatherId: "Local_Weather", Weight: 100 }],
      },
    };
    const mergedDoc = {
      WeatherForecasts: {
        12: [{ WeatherId: "Parent_Weather", Weight: 100 }],
      },
    };

    const effective = getEffectiveForecastHour(localDoc, mergedDoc, 12);
    expect(effective.source).toBe("local");
    expect(effective.entries[0]?.WeatherId).toBe("Local_Weather");
  });
});
