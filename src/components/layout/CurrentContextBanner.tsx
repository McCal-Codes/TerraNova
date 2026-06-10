import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { formatEditingContextDisplay } from "@/utils/editingContextLabel";
import { showInFolder } from "@/utils/ipc";
import { isTauriRuntime } from "@/utils/platform";

interface CurrentContextBannerProps {
  variant?: "titlebar" | "toolbar";
}

export function CurrentContextBanner({ variant = "toolbar" }: CurrentContextBannerProps) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const currentFile = useProjectStore((s) => s.currentFile);
  const isDirty = useProjectStore((s) => s.isDirty);
  const editingContext = useEditorStore((s) => s.editingContext);
  const biomeConfig = useEditorStore((s) => s.biomeConfig);
  const activeBiomeSection = useEditorStore((s) => s.activeBiomeSection);

  const display = useMemo(
    () => formatEditingContextDisplay({
      projectPath,
      currentFile,
      editingContext,
      biomeConfig,
      activeBiomeSection,
    }),
    [projectPath, currentFile, editingContext, biomeConfig, activeBiomeSection],
  );

  if (!currentFile && !projectPath) {
    return (
      <span className="text-[11px] text-tn-text-muted/60 truncate">No project open</span>
    );
  }

  const textClass = variant === "titlebar" ? "text-xs" : "text-[11px]";
  const tooltip = [
    display.relativePath,
    display.fileName && display.fileName !== display.primary ? display.fileName : null,
    isDirty ? "(unsaved changes)" : null,
  ].filter(Boolean).join(" · ");

  const handleReveal = () => {
    if (currentFile && isTauriRuntime()) {
      void showInFolder(currentFile);
    }
  };

  return (
    <button
      type="button"
      onClick={handleReveal}
      disabled={!currentFile || !isTauriRuntime()}
      title={tooltip || undefined}
      className={`flex items-center min-w-0 max-w-full gap-1 ${textClass} ${
        currentFile && isTauriRuntime()
          ? "hover:text-tn-text cursor-pointer"
          : "cursor-default"
      } text-tn-text-muted transition-colors`}
    >
      {display.packName && (
        <>
          <span className="truncate opacity-75 shrink-[2]">{display.packName}</span>
          <ChevronRight className="w-3 h-3 shrink-0 opacity-40" aria-hidden />
        </>
      )}
      <span className="truncate font-medium text-tn-text shrink">{display.primary}</span>
      {display.section && (
        <>
          <ChevronRight className="w-3 h-3 shrink-0 opacity-40" aria-hidden />
          <span className="truncate text-tn-accent shrink">{display.section}</span>
        </>
      )}
      {isDirty && (
        <span className="text-tn-accent shrink-0" title="Unsaved changes" aria-label="Unsaved changes">
          •
        </span>
      )}
    </button>
  );
}
