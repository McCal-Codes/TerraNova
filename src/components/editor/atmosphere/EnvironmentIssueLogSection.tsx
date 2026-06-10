import { WandSparkles } from "lucide-react";
import { CollapsibleEditorSection } from "../CollapsibleEditorSection";
import { EditorCalloutSection, type EditorCalloutItem } from "../EditorCallouts";

interface EnvironmentIssueLogSectionProps {
  issues: EditorCalloutItem[];
  open: boolean;
  onToggle: () => void;
  isWeatherDirMissing: boolean;
  onCreateDefaultWeather: () => void;
}

export function EnvironmentIssueLogSection({
  issues,
  open,
  onToggle,
  isWeatherDirMissing,
  onCreateDefaultWeather,
}: EnvironmentIssueLogSectionProps) {
  return (
    <CollapsibleEditorSection
      title="Issue Log"
      description="Validation warnings and info for the loaded environment file."
      badge={issues.length > 0 ? `${issues.length}` : undefined}
      open={open}
      onToggle={onToggle}
    >
      <div className="flex flex-col gap-2">
        <EditorCalloutSection
          title="Issues"
          items={issues}
          emptyState="No obvious environment file problems were detected."
        />
        {isWeatherDirMissing && (
          <button
            type="button"
            onClick={onCreateDefaultWeather}
            aria-label="Create default weather file to fix missing weather directory"
            title="Create a default weather file to resolve the missing weather directory issue"
            className="inline-flex items-center gap-2 self-start rounded border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-300 transition-colors hover:border-amber-400/70 hover:bg-amber-400/20"
          >
            <WandSparkles className="h-3 w-3" aria-hidden="true" />
            Create Default Weather
          </button>
        )}
      </div>
    </CollapsibleEditorSection>
  );
}
