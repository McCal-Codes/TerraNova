import { useUIStore } from "@/stores/uiStore";
import { getAtmosphereHelpContent } from "./atmosphereHelpContent";
import { AtmosphereSyncToggle } from "./AtmosphereSyncToggle";

interface AtmosphereSceneSyncFooterProps {
  className?: string;
}

/** Compact Sync 3D control for Simple mode scene cards and side panels. */
export function AtmosphereSceneSyncFooter({ className = "mx-3 mb-3" }: AtmosphereSceneSyncFooterProps) {
  const syncAtmospherePreview = useUIStore((state) => state.syncAtmospherePreview);
  const toggleSyncAtmospherePreview = useUIStore((state) => state.toggleSyncAtmospherePreview);
  const syncHelp = getAtmosphereHelpContent("sync-3d");

  return (
    <div className={`flex items-center justify-between gap-2 border-t border-tn-border/30 pt-2 ${className}`}>
      <p className="text-[10px] text-tn-text-muted" title={syncHelp.bullets.join(" ")}>
        Sync 3D preview (optional)
      </p>
      <AtmosphereSyncToggle
        enabled={syncAtmospherePreview}
        onToggle={toggleSyncAtmospherePreview}
      />
    </div>
  );
}
