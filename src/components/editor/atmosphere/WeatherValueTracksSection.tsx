import { interpolateValueAtHour, type HourValue } from "@/utils/atmosphere";
import { CollapsibleEditorSection } from "../CollapsibleEditorSection";
import { ValueTrackCard } from "./ValueTrackCard";
import { HOURS, VALUE_TRACKS, type ValueTrackKey, type WeatherDoc } from "./weatherEditorConstants";

interface WeatherValueTracksSectionProps {
  doc: WeatherDoc;
  open: boolean;
  onToggle: () => void;
  onUpdateValueTrack: (trackKey: ValueTrackKey, next: HourValue[]) => void;
}

export function WeatherValueTracksSection({
  doc,
  open,
  onToggle,
  onUpdateValueTrack,
}: WeatherValueTracksSectionProps) {
  return (
    <CollapsibleEditorSection
      title="Numeric Tracks"
      description="Scale, damping, and fog curve editors."
      badge={`${VALUE_TRACKS.length} tracks`}
      open={open}
      onToggle={onToggle}
    >
      <div className="grid gap-3 2xl:grid-cols-2">
        {VALUE_TRACKS.map((track) => {
          const keyframes = (doc[track.key] as HourValue[] | undefined) ?? [];
          return (
            <ValueTrackCard
              key={track.key}
              label={track.label}
              keyframes={keyframes}
              isFocused={false}
              onChange={(index, next) => {
                onUpdateValueTrack(track.key, keyframes.map((entry, entryIndex) => (
                  entryIndex === index ? next : entry
                )));
              }}
              onRemove={(index) => {
                onUpdateValueTrack(track.key, keyframes.filter((_, entryIndex) => entryIndex !== index));
              }}
              onAdd={() => {
                const usedHours = new Set(keyframes.map((entry) => entry.Hour));
                const nextHour = HOURS.find((hour) => !usedHours.has(hour)) ?? 12;
                onUpdateValueTrack(track.key, [
                  ...keyframes,
                  { Hour: nextHour, Value: interpolateValueAtHour(keyframes, nextHour) },
                ]);
              }}
            />
          );
        })}
      </div>
    </CollapsibleEditorSection>
  );
}
