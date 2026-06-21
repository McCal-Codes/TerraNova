import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

export interface OverviewSectionBackdropData {
  label: string;
  color: string;
  width: number;
  height: number;
}

export const OverviewSectionBackdrop = memo(function OverviewSectionBackdrop({
  data,
}: NodeProps) {
  const { label, color, width, height } = data as unknown as OverviewSectionBackdropData;

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 14,
        border: `1px dashed ${color}40`,
        background: `linear-gradient(145deg, ${color}14 0%, ${color}06 55%, transparent 100%)`,
        boxShadow: `inset 0 0 0 1px ${color}12, 0 8px 32px rgba(0,0,0,0.18)`,
        pointerEvents: "none",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 11px",
          borderRadius: 8,
          background: `linear-gradient(180deg, ${color}28 0%, ${color}18 100%)`,
          border: `1px solid ${color}50`,
          color,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.03em",
          textTransform: "none",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          userSelect: "none",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 6px ${color}88`,
            flexShrink: 0,
          }}
        />
        {label}
      </div>
    </div>
  );
});
