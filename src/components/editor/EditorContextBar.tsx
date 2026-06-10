import { memo } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useDiagnosticsStore } from "@/stores/diagnosticsStore";
import { PipelineIndicator } from "./PipelineIndicator";
import { DiagnosticsStrip } from "../preview/DiagnosticsStrip";

/** Single context row: biome pipeline (when relevant) + diagnostics badge. */
export const EditorContextBar = memo(function EditorContextBar() {
  const editingContext = useEditorStore((s) => s.editingContext);
  const diagnosticsCount = useDiagnosticsStore((s) => s.diagnostics.length);
  const showPipeline = editingContext === "Biome";

  if (!showPipeline && diagnosticsCount === 0) return null;

  return (
    <div className="flex h-7 shrink-0 items-stretch border-b border-tn-border bg-tn-bg">
      {showPipeline ? (
        <div className="min-w-0 flex-1 overflow-x-auto">
          <PipelineIndicator embedded />
        </div>
      ) : (
        <div className="flex-1" />
      )}
      {diagnosticsCount > 0 ? <DiagnosticsStrip embedded /> : null}
    </div>
  );
});
