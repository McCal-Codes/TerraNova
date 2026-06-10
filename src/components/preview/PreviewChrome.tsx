import { memo, useCallback } from "react";
import { Settings2 } from "lucide-react";
import { usePreviewStore } from "@/stores/previewStore";
import { useBridgeStore } from "@/stores/bridgeStore";
import { ToolbarButton } from "@/components/ui/editorChrome";
import { PreviewModeToggleGroup } from "./controls/PreviewControlPrimitives";
import { PreviewQuickToggles2D } from "./PreviewQuickToggles2D";
import { previewChromeBarClass } from "./previewChromeStyles";

interface PreviewChromeProps {
  isPropContext?: boolean;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
}

export const PreviewChrome = memo(function PreviewChrome({
  isPropContext = false,
  settingsOpen,
  onSettingsOpenChange,
}: PreviewChromeProps) {
  const mode = usePreviewStore((s) => s.mode);
  const setMode = usePreviewStore((s) => s.setMode);
  const isLoading = usePreviewStore((s) => s.isLoading);
  const isVoxelLoading = usePreviewStore((s) => s.isVoxelLoading);
  const voxelMeshData = usePreviewStore((s) => s.voxelMeshData);
  const isWorldLoading = usePreviewStore((s) => s.isWorldLoading);
  const bridgeConnected = useBridgeStore((s) => s.connected);

  const toggleSettings = useCallback(() => {
    onSettingsOpenChange(!settingsOpen);
  }, [onSettingsOpenChange, settingsOpen]);

  const anyLoading = isLoading || (isVoxelLoading && !voxelMeshData) || isWorldLoading;

  return (
    <div className={`h-9 ${previewChromeBarClass}`}>
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
        {!isPropContext ? (
          <>
            <PreviewModeToggleGroup
              mode={mode}
              onModeChange={setMode}
              bridgeConnected={bridgeConnected}
              loading={anyLoading}
            />
            {mode === "2d" ? <PreviewQuickToggles2D /> : null}
          </>
        ) : (
          <span className="text-[11px] text-tn-text-muted">Prop placement preview</span>
        )}
      </div>

      <ToolbarButton
        active={settingsOpen}
        onClick={toggleSettings}
        title={settingsOpen ? "Hide preview settings" : "Show preview settings"}
        aria-label={settingsOpen ? "Hide preview settings" : "Show preview settings"}
        icon={<Settings2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />}
        className="shrink-0"
      >
        Settings
      </ToolbarButton>
    </div>
  );
});
