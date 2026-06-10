import {
  buildColorString,
  interpolateColorAtHour,
  type HourColor,
} from "@/utils/atmosphere";
import { CollapsibleEditorSection } from "../CollapsibleEditorSection";
import { ColorTrackCard } from "./ColorTrackCard";
import { COLOR_TRACKS, HOURS, type ColorTrackKey, type WeatherDoc } from "./weatherEditorConstants";

interface WeatherColorTracksSectionProps {
  doc: WeatherDoc;
  open: boolean;
  onToggle: () => void;
  onUpdateColorTrack: (trackKey: ColorTrackKey, next: HourColor[]) => void;
}

export function WeatherColorTracksSection({
  doc,
  open,
  onToggle,
  onUpdateColorTrack,
}: WeatherColorTracksSectionProps) {
  return (
    <CollapsibleEditorSection
      title="Color Tracks"
      description="Keyframed weather colors."
      badge={`${COLOR_TRACKS.length} tracks`}
      open={open}
      onToggle={onToggle}
    >
      <div className="grid gap-3 2xl:grid-cols-2">
        {COLOR_TRACKS.map((track) => {
          const keyframes = (doc[track.key] as HourColor[] | undefined) ?? [];
          return (
            <ColorTrackCard
              key={track.key}
              label={track.label}
              keyframes={keyframes}
              isFocused={false}
              onChange={(index, next) => {
                onUpdateColorTrack(track.key, keyframes.map((entry, entryIndex) => (
                  entryIndex === index ? next : entry
                )));
              }}
              onRemove={(index) => {
                onUpdateColorTrack(track.key, keyframes.filter((_, entryIndex) => entryIndex !== index));
              }}
              onAdd={() => {
                const usedHours = new Set(keyframes.map((entry) => entry.Hour));
                const nextHour = HOURS.find((hour) => !usedHours.has(hour)) ?? 12;
                onUpdateColorTrack(track.key, [
                  ...keyframes,
                  { Hour: nextHour, Color: buildColorString(interpolateColorAtHour(keyframes, nextHour), 1) },
                ]);
              }}
            />
          );
        })}
      </div>
    </CollapsibleEditorSection>
  );
}
