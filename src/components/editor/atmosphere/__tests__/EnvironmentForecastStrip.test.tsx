import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { EnvironmentForecastStrip } from "../EnvironmentForecastStrip";

const localDoc = {
  WeatherForecasts: {
    12: [{ WeatherId: "Day_Sunny", Weight: 100 }],
  },
};

describe("EnvironmentForecastStrip", () => {
  it("opens weather file on double-click when path is indexed", () => {
    const onOpenWeatherFile = vi.fn();
    const onSelectHour = vi.fn();

    render(
      <EnvironmentForecastStrip
        localDoc={localDoc}
        mergedDoc={null}
        previewHour={12}
        weatherDocs={{ day_sunny: { SkyTopColor: { 12: "#112233" } } }}
        selectedDaypart={null}
        onSelectHour={onSelectHour}
        lookupStatus="ready"
        weatherFileCount={1}
        lookupError={null}
        weatherPathIndex={{ day_sunny: "C:/pack/Server/Weathers/Day_Sunny.json" }}
        onOpenWeatherFile={onOpenWeatherFile}
      />,
    );

    const hourButton = screen.getByLabelText(/12:00 Day_Sunny/i);
    fireEvent.click(hourButton);
    expect(onSelectHour).toHaveBeenCalledWith(12);

    fireEvent.doubleClick(hourButton);
    expect(onOpenWeatherFile).toHaveBeenCalledWith("C:/pack/Server/Weathers/Day_Sunny.json");
  });

  it("mentions double-click in helper copy", () => {
    render(
      <EnvironmentForecastStrip
        localDoc={localDoc}
        mergedDoc={null}
        previewHour={0}
        weatherDocs={{}}
        selectedDaypart={null}
        onSelectHour={() => {}}
        lookupStatus="idle"
        weatherFileCount={0}
        lookupError={null}
      />,
    );

    expect(screen.getByText(/Double-click to open/i)).toBeTruthy();
  });
});
