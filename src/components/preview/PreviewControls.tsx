import { usePreviewStore } from "@/stores/previewStore";
import { SharedControls } from "./controls/SharedControls";
import { Controls2D } from "./controls/Controls2D";
import { Controls3D } from "./controls/Controls3D";
import { ControlsVoxel } from "./controls/ControlsVoxel";
import { ControlsWorld } from "./controls/ControlsWorld";
import { PositionOverlayControls } from "./controls/PositionOverlayControls";
import { ShapePreviewControls } from "./controls/ShapePreviewControls";

interface PreviewControlsProps {
  canExport?: boolean;
  onExport?: () => void | Promise<void>;
}

export function PreviewControls({ canExport, onExport }: PreviewControlsProps) {
  const mode = usePreviewStore((s) => s.mode);

  return (
    <div className="flex min-w-0 flex-col gap-2.5 p-3" role="region" aria-label="Preview settings">
      <SharedControls canExport={canExport} onExport={onExport} />
      {mode === "2d" && <Controls2D />}
      {mode === "3d" && <Controls3D />}
      {mode === "voxel" && <ControlsVoxel />}
      {mode === "world" && <ControlsWorld />}
      {(mode === "2d" || mode === "3d" || mode === "voxel") && <ShapePreviewControls />}
      {(mode === "2d" || mode === "3d") && <PositionOverlayControls />}
    </div>
  );
}
