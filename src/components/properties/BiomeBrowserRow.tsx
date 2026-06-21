import type { BiomeBrowserMeta } from "@/utils/biomeBrowserSummary";

interface BiomeBrowserRowProps {
  name: string;
  path: string;
  subtitle?: string;
  meta?: BiomeBrowserMeta;
  onOpen: () => void;
}

export function BiomeBrowserRow({ name, path, subtitle, meta, onOpen }: BiomeBrowserRowProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left px-2 py-1 rounded text-[10px] hover:bg-tn-accent/15 hover:text-tn-accent transition-colors group w-full"
      title={path}
    >
      <div className="flex items-center gap-2 min-w-0">
        {meta && meta.tintColors.length > 0 && (
          <span className="flex shrink-0 gap-px h-3 rounded overflow-hidden border border-tn-border/60" aria-hidden>
            {meta.tintColors.slice(0, 4).map((color) => (
              <span key={color} className="w-2 h-full" style={{ backgroundColor: color }} />
            ))}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-mono text-tn-text group-hover:text-tn-accent truncate">{name}</div>
          {subtitle && (
            <div className="text-tn-text-muted/70 group-hover:text-tn-accent/60 truncate">{subtitle}</div>
          )}
          {meta && (
            <div className="text-tn-text-muted/80 group-hover:text-tn-accent/70 truncate">
              {meta.environmentLabel}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
