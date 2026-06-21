import type { BiomeRangeEntry } from "@/stores/slices/types";
import { biomeColor, biomeRangePct } from "@/utils/biomeRangeColors";

export function BiomeRangeCoverageStrip({
  ranges,
  selectedIndex,
  onSelect,
}: {
  ranges: BiomeRangeEntry[];
  selectedIndex: number | null;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="relative h-6 bg-black/20 rounded overflow-hidden">
      {[-0.5, 0, 0.5].map((v) => (
        <div
          key={v}
          className="absolute top-0 bottom-0 w-px bg-white/[0.06]"
          style={{ left: `${biomeRangePct(v)}%` }}
        />
      ))}
      {ranges.map((r, i) => {
        const left = biomeRangePct(r.Min);
        const width = biomeRangePct(r.Max) - left;
        const color = biomeColor(r.Biome);
        const isSel = i === selectedIndex;
        return (
          <div
            key={i}
            className="absolute top-0 bottom-0 cursor-pointer transition-opacity hover:opacity-100"
            style={{
              left: `${left}%`,
              width: `${width}%`,
              minWidth: 3,
              backgroundColor: color,
              opacity: isSel ? 0.95 : 0.4,
              outline: isSel ? `2px solid ${color}` : undefined,
              outlineOffset: -1,
              zIndex: isSel ? 10 : undefined,
            }}
            onClick={() => onSelect(i)}
            title={`${r.Biome}  [${r.Min.toFixed(2)}, ${r.Max.toFixed(2)}]`}
          />
        );
      })}
      <span className="absolute left-1 top-0.5 text-[8px] text-white/30 pointer-events-none leading-none">-1</span>
      <span className="absolute right-1 top-0.5 text-[8px] text-white/30 pointer-events-none leading-none">1</span>
      <span
        className="absolute top-0.5 text-[8px] text-white/30 pointer-events-none leading-none"
        style={{ left: "50%", transform: "translateX(-50%)" }}
      >
        0
      </span>
    </div>
  );
}
