import { memo, type RefObject } from "react";
import { Settings2 } from "lucide-react";
import { ChromeIconButton } from "@/components/ui/editorChrome";

interface ComparisonChromeProps {
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  settingsButtonRef?: RefObject<HTMLButtonElement | null>;
}

export const ComparisonChrome = memo(function ComparisonChrome({
  settingsOpen,
  onSettingsOpenChange,
  settingsButtonRef,
}: ComparisonChromeProps) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-tn-border bg-tn-surface px-2">
      <span className="text-[11px] font-medium text-tn-text-muted">Compare previews</span>
      <ChromeIconButton
        ref={settingsButtonRef}
        size="sm"
        label={settingsOpen ? "Close compare settings" : "Open compare settings"}
        active={settingsOpen}
        onClick={() => onSettingsOpenChange(!settingsOpen)}
        icon={<Settings2 className="h-3.5 w-3.5" strokeWidth={2} />}
      />
    </div>
  );
});
