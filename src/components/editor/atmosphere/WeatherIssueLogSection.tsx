import { CollapsibleEditorSection } from "../CollapsibleEditorSection";
import { EditorCalloutSection, type EditorCalloutItem } from "../EditorCallouts";

interface WeatherIssueLogSectionProps {
  issues: EditorCalloutItem[];
  open: boolean;
  onToggle: () => void;
}

export function WeatherIssueLogSection({ issues, open, onToggle }: WeatherIssueLogSectionProps) {
  return (
    <CollapsibleEditorSection
      title="Issue Log"
      description="Validation warnings and info for the loaded weather file."
      badge={issues.length > 0 ? `${issues.length}` : undefined}
      open={open}
      onToggle={onToggle}
    >
      <EditorCalloutSection
        title="Issues"
        items={issues}
        emptyState="No obvious weather file problems were detected."
      />
    </CollapsibleEditorSection>
  );
}
