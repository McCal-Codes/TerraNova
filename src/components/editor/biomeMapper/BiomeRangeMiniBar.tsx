import { useCallback, useRef } from "react";
import type { BiomeDragMode } from "@/utils/biomeRangeDomain";
import { biomeRangePct } from "@/utils/biomeRangeColors";

export function BiomeRangeMiniBar({
  min,
  max,
  color,
  isSelected,
  onDragMin,
  onDragMax,
  onDragMove,
}: {
  min: number;
  max: number;
  color: string;
  isSelected: boolean;
  onDragMin: (e: React.PointerEvent) => void;
  onDragMax: (e: React.PointerEvent) => void;
  onDragMove: (e: React.PointerEvent) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const left = biomeRangePct(min);
  const width = biomeRangePct(max) - left;
  const isNarrow = width < 3;

  return (
    <div ref={barRef} data-range-bar className="relative h-full bg-white/[0.04] rounded overflow-hidden">
      <div className="absolute top-0 bottom-0 w-px bg-white/[0.06]" style={{ left: "25%" }} />
      <div className="absolute top-0 bottom-0 w-px bg-white/[0.08]" style={{ left: "50%" }} />
      <div className="absolute top-0 bottom-0 w-px bg-white/[0.06]" style={{ left: "75%" }} />
      <div
        className="absolute top-0.5 bottom-0.5 rounded-sm cursor-grab active:cursor-grabbing"
        style={{
          left: `${left}%`,
          width: `${width}%`,
          minWidth: 14,
          backgroundColor: isNarrow ? `${color}88` : `${color}55`,
          border: isSelected ? `1.5px solid ${color}` : `1px solid ${color}`,
          boxShadow: isSelected
            ? `0 0 8px ${color}55`
            : isNarrow
              ? `0 0 4px ${color}44`
              : undefined,
        }}
        onPointerDown={onDragMove}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-l-sm"
          onPointerDown={onDragMin}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-r-sm"
          onPointerDown={onDragMax}
        />
      </div>
    </div>
  );
}

export function useMiniBarDragHandlers(
  index: number,
  startDrag: (e: React.PointerEvent, mode: BiomeDragMode) => void,
) {
  const onDragMin = useCallback((e: React.PointerEvent) => startDrag(e, "min"), [startDrag]);
  const onDragMax = useCallback((e: React.PointerEvent) => startDrag(e, "max"), [startDrag]);
  const onDragMove = useCallback((e: React.PointerEvent) => startDrag(e, "move"), [startDrag]);
  void index;
  return { onDragMin, onDragMax, onDragMove };
}
