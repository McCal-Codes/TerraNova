import { interpolateColorAtHour, interpolateValueAtHour } from "@/utils/atmosphere";
import { CollapsibleEditorSection } from "../CollapsibleEditorSection";
import { formatTrackValue } from "./weatherEditorUtils";
import { HOURS, type CloudLayer } from "./weatherEditorConstants";

interface WeatherCloudSectionProps {
  clouds: CloudLayer[];
  previewHour: number;
  open: boolean;
  onToggle: () => void;
}

export function WeatherCloudSection({ clouds, previewHour, open, onToggle }: WeatherCloudSectionProps) {
  if (clouds.length === 0) return null;

  return (
    <CollapsibleEditorSection
      title="Cloud Layers"
      description="Texture, color, and speed summaries for configured cloud stacks."
      badge={`${clouds.length} layers`}
      open={open}
      onToggle={onToggle}
    >
      <div className="space-y-2">
        {clouds.map((cloud, index) => {
          const gradient = Array.isArray(cloud.Colors) && cloud.Colors.length
            ? HOURS.map((hour) => `${interpolateColorAtHour(cloud.Colors ?? [], hour)} ${(hour / 23) * 100}%`).join(", ")
            : "";
          const speed = interpolateValueAtHour(cloud.Speeds ?? [], previewHour);
          return (
            <div key={`${cloud.Texture ?? "cloud"}-${index}`} className="rounded border border-tn-border/40 bg-tn-bg px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium text-tn-text">Layer {index + 1}</p>
                  <p className="text-[10px] text-tn-text-muted">{cloud.Texture ?? "No texture"}</p>
                </div>
                <div className="text-right text-[10px] text-tn-text-muted">
                  <p>{Array.isArray(cloud.Colors) ? cloud.Colors.length : 0} color keys</p>
                  <p>{Array.isArray(cloud.Speeds) ? cloud.Speeds.length : 0} speed keys</p>
                  <p>Speed now {formatTrackValue(speed)}</p>
                </div>
              </div>
              {gradient && (
                <div
                  className="mt-2 h-3 rounded border border-tn-border/40"
                  style={{ background: `linear-gradient(to right, ${gradient})` }}
                />
              )}
            </div>
          );
        })}
      </div>
    </CollapsibleEditorSection>
  );
}
