export function BiomeRangeToolbar({
  biomeCount,
  onAdd,
  onSplitEqual,
  onImport,
  hideAdd = false,
}: {
  biomeCount: number;
  onAdd: () => void;
  onSplitEqual: () => void;
  onImport?: () => void;
  hideAdd?: boolean;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
      {!hideAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="rounded bg-tn-accent/20 px-2 py-0.5 text-[10px] text-tn-accent transition-colors hover:bg-tn-accent/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
        >
          + Add
        </button>
      )}
      <button
        type="button"
        onClick={onSplitEqual}
        disabled={biomeCount < 2}
        className="text-[10px] px-2 py-0.5 rounded border border-tn-border bg-tn-surface text-tn-text-muted hover:text-tn-text hover:bg-tn-panel disabled:opacity-40 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
      >
        Split equally
      </button>
      {onImport && (
        <button
          type="button"
          onClick={onImport}
          className="text-[10px] px-2 py-0.5 rounded border border-tn-border bg-tn-surface text-tn-text-muted hover:text-tn-text hover:bg-tn-panel transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
        >
          Import…
        </button>
      )}
    </div>
  );
}
