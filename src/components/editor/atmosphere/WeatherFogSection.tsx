import { CollapsibleEditorSection } from "../CollapsibleEditorSection";
import type { WeatherDoc } from "./weatherEditorConstants";

interface WeatherFogSectionProps {
  doc: WeatherDoc;
  open: boolean;
  onToggle: () => void;
  onUpdateDoc: (updater: (previous: WeatherDoc) => WeatherDoc) => void;
}

export function WeatherFogSection({ doc, open, onToggle, onUpdateDoc }: WeatherFogSectionProps) {
  return (
    <CollapsibleEditorSection
      title="Fog Distance"
      description="Near and far fog bounds used by the preview volume."
      badge={Array.isArray(doc.FogDistance) ? `${doc.FogDistance[0]}..${doc.FogDistance[1]}` : undefined}
      open={open}
      onToggle={onToggle}
    >
      <div className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-[10px] text-tn-text-muted">Near</span>
        <input
          type="number"
          step={1}
          value={(doc.FogDistance as [number, number] | undefined)?.[0] ?? -96}
          onChange={(event) => {
            const value = Number.parseFloat(event.target.value);
            if (!Number.isFinite(value)) return;
            onUpdateDoc((previous) => ({
              ...previous,
              FogDistance: [value, (previous.FogDistance ?? [-96, 1024])[1]],
            }));
          }}
          className="flex-1 rounded border border-tn-border bg-tn-bg px-2 py-1 text-[10px] font-mono text-right text-tn-text"
        />
        <span className="w-10 shrink-0 text-center text-[10px] text-tn-text-muted">Far</span>
        <input
          type="number"
          step={1}
          value={(doc.FogDistance as [number, number] | undefined)?.[1] ?? 1024}
          onChange={(event) => {
            const value = Number.parseFloat(event.target.value);
            if (!Number.isFinite(value)) return;
            onUpdateDoc((previous) => ({
              ...previous,
              FogDistance: [(previous.FogDistance ?? [-96, 1024])[0], value],
            }));
          }}
          className="flex-1 rounded border border-tn-border bg-tn-bg px-2 py-1 text-[10px] font-mono text-right text-tn-text"
        />
      </div>
    </CollapsibleEditorSection>
  );
}
