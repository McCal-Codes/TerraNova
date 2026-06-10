import { useCallback } from "react";
import { AtmosphereScenePreview } from "@/components/editor/atmosphere/AtmosphereScenePreview";
import { EnvironmentForecastStrip } from "@/components/editor/atmosphere/EnvironmentForecastStrip";
import { useEnvironmentScenePreview } from "@/hooks/useEnvironmentScenePreview";
import { useTauriIO } from "@/hooks/useTauriIO";
import { useUIStore } from "@/stores/uiStore";
import type { JsonRecord } from "@/utils/atmosphere";
interface BiomeAtmosphereForecastPanelProps {
  environmentDoc: JsonRecord | null;
  environmentName: string | null;
  currentFile: string | null;
  projectPath: string | null;
  onPreviewHourApplied?: (hour: number) => void;
}

export function BiomeAtmosphereForecastPanel({
  environmentDoc,
  environmentName,
  currentFile,
  projectPath,
  onPreviewHourApplied,
}: BiomeAtmosphereForecastPanelProps) {
  const previewHour = useUIStore((state) => state.atmospherePreviewHour);
  const setPreviewHour = useUIStore((state) => state.setAtmospherePreviewHour);
  const { openFile } = useTauriIO();

  const environmentPreview = useEnvironmentScenePreview({
    environmentDoc,
    environmentName,
    currentFile,
    projectPath,
    previewHour,
  });

  const handleSelectHour = useCallback((hour: number) => {
    setPreviewHour(hour);
    onPreviewHourApplied?.(hour);
  }, [onPreviewHourApplied, setPreviewHour]);

  const handleOpenWeatherFile = useCallback((path: string) => {
    void openFile(path);
  }, [openFile]);

  if (!environmentDoc || !environmentName) {
    return (
      <p className="text-[10px] text-tn-text-muted">
        Resolve an environment from the biome&apos;s EnvironmentProvider to see the 24-hour forecast schedule.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {environmentPreview.sceneWeatherDoc ? (
        <AtmosphereScenePreview
          doc={environmentPreview.sceneWeatherDoc}
          previewHour={previewHour}
          onPreviewHourChange={handleSelectHour}
          weatherLabel={environmentPreview.dominantEntry?.WeatherId ?? null}
          inherited={environmentPreview.effectiveForecast?.source === "inherited"}
          showSwatches={false}
          showHourSlider
          sliderIdPrefix="biome-atmosphere"
        />
      ) : (
        <div className="rounded-lg border border-dashed border-tn-border/50 bg-tn-bg/40 px-3 py-4 text-center text-[10px] text-tn-text-muted">
          {environmentPreview.dominantEntry?.WeatherId
            ? `Weather "${environmentPreview.dominantEntry.WeatherId}" is not available in Server/Weathers.`
            : "No dominant weather at the selected hour."}
        </div>
      )}
      <EnvironmentForecastStrip
        localDoc={environmentDoc}
        mergedDoc={environmentPreview.mergedEnvironment}
        previewHour={previewHour}
        weatherDocs={environmentPreview.weatherDocs}
        selectedDaypart={null}
        onSelectHour={handleSelectHour}
        lookupStatus={environmentPreview.lookupStatus}
        weatherFileCount={environmentPreview.weatherFileCount}
        lookupError={environmentPreview.lookupError}
        weatherPathIndex={environmentPreview.weatherPathIndex}
        onOpenWeatherFile={handleOpenWeatherFile}
      />
    </div>
  );
}
