import { FolderOpen, FolderPlus, Save, HelpCircle } from "lucide-react";
import type { AtmosphereEditorUIMode } from "@/stores/uiStore";
import { AtmosphereEditorModeToggle } from "./AtmosphereEditorModeToggle";
import { AtmosphereSyncToggle } from "./AtmosphereSyncToggle";

export type AtmosphereEditorVariant = "weather" | "environment";

interface AtmosphereEditorToolbarProps {
  variant: AtmosphereEditorVariant;
  fileName: string;
  hasDoc: boolean;
  isDirty: boolean;
  saveStatus: "idle" | "saved" | "error";
  canSave: boolean;
  editorUIMode: AtmosphereEditorUIMode;
  onEditorUIModeChange: (mode: AtmosphereEditorUIMode) => void;
  syncAtmospherePreview: boolean;
  onToggleSyncAtmospherePreview: () => void;
  onOpenDocs: () => void;
  onSave: () => void;
  lookupStatus?: string;
  weathersDirPath?: string | null;
  onLocateWeathers?: () => void;
}

export function AtmosphereEditorToolbar({
  variant,
  fileName,
  hasDoc,
  isDirty,
  saveStatus,
  canSave,
  editorUIMode,
  onEditorUIModeChange,
  syncAtmospherePreview,
  onToggleSyncAtmospherePreview,
  onOpenDocs,
  onSave,
  lookupStatus,
  weathersDirPath,
  onLocateWeathers,
}: AtmosphereEditorToolbarProps) {
  const title = variant === "weather" ? "Weather Editor" : "Environment Editor";
  const docsLabel = variant === "weather"
    ? "Open weather & environment guide (folders, inheritance, preview hour)"
    : "Open weather & environment guide (folders, inheritance, preview hour)";

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-tn-border bg-tn-surface px-4 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold text-tn-text">{title}</h2>
          <p className="mt-0.5 truncate text-[10px] text-tn-text-muted">{fileName}</p>
        </div>
        <button
          type="button"
          onClick={onOpenDocs}
          className="shrink-0 text-tn-text-muted transition-colors hover:text-tn-text"
          title={docsLabel}
          aria-label={docsLabel}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <AtmosphereEditorModeToggle mode={editorUIMode} onModeChange={onEditorUIModeChange} />
        {editorUIMode === "advanced" && (
          <AtmosphereSyncToggle
            enabled={syncAtmospherePreview}
            onToggle={onToggleSyncAtmospherePreview}
          />
        )}
        {variant === "environment" && onLocateWeathers && (
          <button
            type="button"
            onClick={onLocateWeathers}
            disabled={!hasDoc}
            title={weathersDirPath ?? "Locate or create Server/Weathers folder"}
            aria-label={lookupStatus === "ready" ? "Open Weathers folder" : "Create Weathers folder"}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] shadow-sm transition-colors ${
              !hasDoc
                ? "cursor-not-allowed border-tn-border/40 bg-tn-bg/50 text-tn-text-muted/50"
                : lookupStatus === "ready"
                  ? "border-tn-border/70 bg-tn-bg/70 text-tn-text-muted hover:border-tn-accent/50 hover:text-tn-text"
                  : "border-amber-400/40 bg-amber-400/10 text-amber-300 hover:border-amber-400/70 hover:bg-amber-400/20"
            }`}
          >
            {lookupStatus === "ready" ? <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" /> : <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />}
            {lookupStatus === "ready" ? "Weathers" : "Create Weathers"}
          </button>
        )}
        <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
          isDirty
            ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
            : "border-tn-border/60 bg-tn-bg/60 text-tn-text-muted"
        }`}>
          {isDirty ? "Unsaved changes" : "Saved"}
        </span>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          title={saveStatus === "saved" ? "File saved" : saveStatus === "error" ? "Save failed - click to retry" : "Save current file"}
          aria-label={saveStatus === "saved" ? "File saved" : saveStatus === "error" ? "Retry save" : "Save file"}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] shadow-sm transition-colors ${
            saveStatus === "saved"
              ? "border-green-500/60 bg-green-500/10 text-green-300"
              : saveStatus === "error"
                ? "border-red-500/60 bg-red-500/10 text-red-300"
                : "border-tn-border/70 bg-tn-bg/70 text-tn-text hover:border-tn-accent hover:text-tn-accent"
          } ${!canSave ? "cursor-not-allowed opacity-50" : ""}`}
        >
          <Save className="h-3.5 w-3.5" aria-hidden="true" />
          {saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Retry Save" : "Save"}
        </button>
      </div>
    </div>
  );
}
