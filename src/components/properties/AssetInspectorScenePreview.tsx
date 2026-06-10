import { useMemo } from "react";
import { AtmosphereScenePreview } from "@/components/editor/atmosphere/AtmosphereScenePreview";
import { AtmosphereSceneSyncFooter } from "@/components/editor/atmosphere/AtmosphereSceneSyncFooter";
import { useEnvironmentScenePreview } from "@/hooks/useEnvironmentScenePreview";
import { useUIStore } from "@/stores/uiStore";
import type { JsonRecord } from "@/utils/atmosphere";

interface AssetInspectorScenePreviewProps {
  mode: "weather" | "environment";
  doc: JsonRecord;
  currentFile: string | null;
  projectPath: string | null;
  compact: boolean;
  lookupRevision: number;
}

export function AssetInspectorScenePreview({
  mode,
  doc,
  currentFile,
  projectPath,
  compact,
  lookupRevision,
}: AssetInspectorScenePreviewProps) {
  const previewHour = useUIStore((state) => state.atmospherePreviewHour);
  const setPreviewHour = useUIStore((state) => state.setAtmospherePreviewHour);

  const environmentName = useMemo(() => {
    if (!currentFile) return null;
    const base = currentFile.split(/[/\\]/).pop() ?? "";
    return base.replace(/\.json$/i, "") || null;
  }, [currentFile]);

  const environmentPreview = useEnvironmentScenePreview({
    environmentDoc: mode === "environment" ? doc : null,
    environmentName: mode === "environment" ? environmentName : null,
    currentFile,
    projectPath,
    previewHour,
    lookupRevision,
  });

  if (mode === "weather") {
    return (
      <div className="space-y-0">
        <AtmosphereScenePreview
          doc={doc}
          previewHour={previewHour}
          onPreviewHourChange={setPreviewHour}
          showSwatches={!compact}
          showHourSlider
          sliderIdPrefix="inspector-weather"
        />
        {!compact && <AtmosphereSceneSyncFooter />}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {environmentPreview.sceneWeatherDoc ? (
        <AtmosphereScenePreview
          doc={environmentPreview.sceneWeatherDoc}
          previewHour={previewHour}
          onPreviewHourChange={setPreviewHour}
          weatherLabel={environmentPreview.dominantEntry?.WeatherId ?? null}
          inherited={environmentPreview.effectiveForecast?.source === "inherited"}
          showSwatches={!compact}
          showHourSlider
          sliderIdPrefix="inspector-environment"
        />
      ) : (
        <div className="rounded-xl border border-dashed border-tn-border/50 bg-tn-surface/20 px-4 py-6 text-center text-[11px] text-tn-text-muted">
          {environmentPreview.dominantEntry?.WeatherId
            ? `Weather "${environmentPreview.dominantEntry.WeatherId}" is not loaded. Import or create it to preview the scene.`
            : "Add a forecast entry to preview resolved weather at the selected hour."}
        </div>
      )}
      {!compact && <AtmosphereSceneSyncFooter className="mb-0" />}
    </div>
  );
}
