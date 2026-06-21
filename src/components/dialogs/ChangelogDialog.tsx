import { useCallback, useEffect, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { ReleaseNotesList } from "./ReleaseNotesList";
import { ChromeIconButton } from "@/components/ui/editorChrome";
import { appNestedCardClass, appPanelClass } from "@/components/ui/surfaceStyles";
import { fetchReleases, type ReleaseData } from "@/utils/fetchReleases";

interface ChangelogDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ChangelogDialog({ open, onClose }: ChangelogDialogProps) {
  const [releases, setReleases] = useState<ReleaseData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetchReleases()
      .then((data) => {
        setReleases(data);
        if (data.length > 0) setExpanded(data[0].version);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [open]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    },
    [open, onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!open) return null;

  const latestVersion = releases[0]?.version;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-title"
        className={`${appPanelClass} shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-tn-border shrink-0">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-tn-accent/90 mb-1">
              Release history
            </p>
            <h2 id="changelog-title" className="text-base font-semibold text-tn-text">
              Changelog
            </h2>
            <p className="text-xs text-tn-text-muted mt-1 leading-relaxed">
              All published TerraNova releases
            </p>
          </div>
          <ChromeIconButton
            size="sm"
            label="Close"
            onClick={onClose}
            icon={<X className="h-4 w-4" strokeWidth={2} />}
          />
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-3">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <span className="text-sm text-tn-text-muted animate-pulse">Loading releases…</span>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <p className="text-sm text-tn-text-muted">Could not load releases</p>
              <p className="text-xs text-tn-text-muted/70 max-w-sm">{error}</p>
            </div>
          )}

          {!loading && !error && releases.length === 0 && (
            <div className={`${appNestedCardClass} px-3 py-3 text-center`}>
              <p className="text-sm text-tn-text-muted">No releases found</p>
            </div>
          )}

          {!loading && !error && (
            <div className="space-y-2">
              {releases.map((release) => {
                const isOpen = expanded === release.version;
                const isLatest = release.version === latestVersion;

                return (
                  <section
                    key={release.version}
                    className={`${appNestedCardClass} overflow-hidden`}
                  >
                    <button
                      type="button"
                      className="w-full flex items-start justify-between gap-3 px-3 py-3 hover:bg-tn-surface/40 transition-colors text-left"
                      aria-expanded={isOpen}
                      onClick={() => setExpanded(isOpen ? "" : release.version)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-semibold text-tn-text">
                            v{release.version}
                          </span>
                          {release.date && (
                            <span className="text-xs text-tn-text-muted">{release.date}</span>
                          )}
                          {isLatest && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-tn-accent/20 text-tn-accent font-medium">
                              Latest
                            </span>
                          )}
                        </div>
                        {release.name && release.name !== release.version && (
                          <p className="text-xs text-tn-text-muted mt-1 leading-relaxed">
                            {release.name}
                          </p>
                        )}
                      </div>
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 text-tn-text-muted transition-transform mt-0.5 ${isOpen ? "rotate-90" : ""}`}
                        aria-hidden
                      />
                    </button>

                    {isOpen && (
                      <div className="px-3 pb-3 pt-0 border-t border-tn-border/60">
                        {release.sections.length > 0 ? (
                          <div className="pt-3">
                            <ReleaseNotesList sections={release.sections} />
                          </div>
                        ) : (
                          <p className="pt-3 text-xs text-tn-text-muted italic">
                            No release notes available.
                          </p>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <footer className="flex justify-end px-5 py-4 border-t border-tn-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs rounded border border-tn-border bg-tn-bg hover:bg-tn-surface text-tn-text"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
