import { memo, useCallback, type RefObject } from "react";
import { Settings2 } from "lucide-react";
import { usePreviewStore } from "@/stores/previewStore";
import { useBridgeStore } from "@/stores/bridgeStore";
import { ChromeIconButton } from "@/components/ui/editorChrome";
import { PreviewModeToggleGroup } from "./controls/PreviewControlPrimitives";
import { PreviewQuickToggles2D } from "./PreviewQuickToggles2D";
import { previewChromeBarClass } from "./previewChromeStyles";

interface PreviewChromeProps {
  isPropContext?: boolean;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  settingsButtonRef?: RefObject<HTMLButtonElement | null>;
}

export const PreviewChrome = memo(function PreviewChrome({
  isPropContext = false,
  settingsOpen,
  onSettingsOpenChange,
  settingsButtonRef,
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

      <ChromeIconButton
        ref={settingsButtonRef}
        size="sm"
        label={settingsOpen ? "Close preview settings" : "Open preview settings"}
        active={settingsOpen}
        onClick={toggleSettings}
        icon={<Settings2 className="h-3.5 w-3.5" strokeWidth={2} />}
      />
    </div>
  );
});
