export function EnvironmentMetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded border border-tn-border/50 bg-tn-bg/80 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-tn-text-muted">{label}</p>
      <p className="mt-1 text-[13px] font-semibold text-tn-text">{value}</p>
      {detail && <p className="mt-1 text-[10px] text-tn-text-muted">{detail}</p>}
    </div>
  );
}
