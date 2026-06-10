import { usePreviewStore, type PropPreviewMode } from "@/stores/previewStore";
import { SharedControls } from "./SharedControls";

interface PropPreviewControlsProps {
  canExport?: boolean;
  onExport?: () => void | Promise<void>;
}

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-2 py-1.5 text-[10px] font-medium rounded border transition-colors ${
        active
          ? "bg-tn-accent/15 text-tn-accent border-tn-accent/40"
          : "bg-tn-bg text-tn-text-muted border-tn-border hover:text-tn-text"
      }`}
    >
      {label}
    </button>
  );
}

/** Sidebar controls for the dedicated prop preview pane (not density modes). */
export function PropPreviewControls({ canExport, onExport }: PropPreviewControlsProps) {
  const viewMode = usePreviewStore((s) => s.viewMode);
  const propPreviewMode = usePreviewStore((s) => s.propPreviewMode);
  const setPropPreviewMode = usePreviewStore((s) => s.setPropPreviewMode);

  const setMode = (mode: PropPreviewMode) => setPropPreviewMode(mode);

  return (
    <div className="flex flex-col gap-3 p-3 min-w-0" role="region" aria-label="Prop preview settings">
      <SharedControls canExport={canExport} onExport={onExport} />

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-tn-text-muted mb-1.5">
          Prop preview mode
        </p>
        <div className="flex gap-1">
          <ModeButton
            active={propPreviewMode === "placement"}
            label="2D Placement"
            onClick={() => setMode("placement")}
          />
          <ModeButton
            active={propPreviewMode === "prefab3d"}
            label="3D Prefab"
            onClick={() => setMode("prefab3d")}
          />
        </div>
      </div>

      <p className="text-[11px] text-tn-text-muted leading-snug">
        Edit prop nodes in the graph pane. Use 2D placement to see scatter samples, or 3D Prefab to
        inspect the mesh (like Hytale Creative Tools).
        {viewMode === "graph" && (
          <>
            {" "}
            Switch to <strong className="font-medium text-tn-text">Split</strong> to show graph and
            prop preview together.
          </>
        )}
      </p>
    </div>
  );
}
