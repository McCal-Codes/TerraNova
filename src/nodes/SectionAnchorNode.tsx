import { memo } from "react";
import { Handle, Position } from "@xyflow/react";

export interface SectionAnchorData {
  label: string;
  sectionKey: string;
  anchorKind?: string;
}

export const SectionAnchorNode = memo(function SectionAnchorNode({
  data,
}: {
  data: SectionAnchorData;
}) {
  const { label } = data;

  return (
    <div
      className="rounded-md border border-dashed border-amber-500/50 bg-amber-500/10 px-2.5 py-1.5 min-w-[120px] shadow-sm"
      style={{ pointerEvents: "all" }}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0 !w-1 !h-1" />
      <div className="text-[9px] uppercase tracking-wide text-amber-400/80 font-semibold mb-0.5">
        Anchor
      </div>
      <div className="text-[11px] font-medium text-amber-100/95 truncate" title={label}>
        {label}
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-1 !h-1" />
    </div>
  );
});
