export function PreviewSwatchCard({ label, color, detail }: { label: string; color: string; detail: string }) {
  return (
    <div className="rounded border border-tn-border/50 bg-tn-bg/80 px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 shrink-0 rounded border border-white/15" style={{ backgroundColor: color }} />
        <p className="text-[10px] uppercase tracking-wider text-tn-text-muted">{label}</p>
      </div>
      <p className="mt-1 text-[11px] font-medium text-tn-text">{detail}</p>
    </div>
  );
}

export function PreviewValueCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded border border-tn-border/50 bg-tn-bg/80 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-tn-text-muted">{label}</p>
      <p className="mt-1 text-[13px] font-semibold text-tn-text">{value}</p>
      <p className="mt-1 text-[10px] text-tn-text-muted">{detail}</p>
    </div>
  );
}

export function PreviewInsightCard({
  label,
  title,
  detail,
  accent,
}: {
  label: string;
  title: string;
  detail: string;
  accent: string;
}) {
  return (
    <div className="rounded border border-tn-border/50 bg-tn-bg/80 px-3 py-3">
      <div className="flex items-center gap-2">
        <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
        <p className="text-[10px] uppercase tracking-wider text-tn-text-muted">{label}</p>
      </div>
      <p className="mt-1.5 text-[13px] font-semibold text-tn-text">{title}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-tn-text-muted">{detail}</p>
    </div>
  );
}
