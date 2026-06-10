interface AtmosphereSyncToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export function AtmosphereSyncToggle({ enabled, onToggle }: AtmosphereSyncToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors ${
        enabled
          ? "border-tn-accent/60 bg-tn-accent/10 text-tn-accent"
          : "border-tn-border/70 bg-tn-bg/70 text-tn-text-muted hover:border-tn-accent/40 hover:text-tn-text"
      }`}
      title="Push atmosphere preview colors to the 3D terrain preview panel"
    >
      Sync 3D
    </button>
  );
}
