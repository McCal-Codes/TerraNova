import { memo } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useDiagnosticsStore } from "@/stores/diagnosticsStore";
import { useProjectStore } from "@/stores/projectStore";
import { useProjectLegacyStore } from "@/stores/projectLegacyStore";
import { computeIssueBadgeCount } from "@/utils/issueBadgeCount";
import { PipelineIndicator } from "./PipelineIndicator";
import { DiagnosticsStrip } from "../preview/DiagnosticsStrip";

/** Single context row: biome pipeline (when relevant) + diagnostics badge. */
export const EditorContextBar = memo(function EditorContextBar() {
  const editingContext = useEditorStore((s) => s.editingContext);
  const diagnosticsCount = useDiagnosticsStore((s) => s.diagnostics.length);
  const projectLegacyHits = useProjectLegacyStore((s) => s.hits);
  const currentFile = useProjectStore((s) => s.currentFile);
  const issueCount = computeIssueBadgeCount(diagnosticsCount, projectLegacyHits, currentFile);
  const packWideIssueCount = issueCount - diagnosticsCount;
  const showPipeline = editingContext === "Biome";

  if (!showPipeline && issueCount === 0) return null;

  return (
    <div className="flex h-7 shrink-0 items-stretch border-b border-tn-border bg-tn-bg">
      {showPipeline ? (
        <div className="min-w-0 flex-1 overflow-x-auto">
          <PipelineIndicator embedded />
        </div>
      ) : (
        <div className="flex-1" />
      )}
      {issueCount > 0 ? (
        <DiagnosticsStrip embedded packWideIssueCount={packWideIssueCount} />
      ) : null}
    </div>
  );
});
