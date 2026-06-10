import type { JsonRecord } from "@/utils/atmosphere";
import { AtmosphereScenePreview } from "./AtmosphereScenePreview";
import type { WeatherSceneDoc } from "./scenePreviewModel";

interface WeatherScenePreviewProps {
  doc: WeatherSceneDoc | JsonRecord;
  previewHour: number;
  onPreviewHourChange?: (hour: number) => void;
  compact?: boolean;
  sliderIdPrefix?: string;
}

/** Weather editor scene card — delegates to shared AtmosphereScenePreview. */
export function WeatherScenePreview({
  doc,
  previewHour,
  onPreviewHourChange,
  compact = false,
  sliderIdPrefix = "weather-scene",
}: WeatherScenePreviewProps) {
  return (
    <AtmosphereScenePreview
      doc={doc as WeatherSceneDoc}
      previewHour={previewHour}
      onPreviewHourChange={onPreviewHourChange}
      showSwatches={!compact}
      showHourSlider={compact && Boolean(onPreviewHourChange)}
      sliderIdPrefix={sliderIdPrefix}
    />
  );
}
