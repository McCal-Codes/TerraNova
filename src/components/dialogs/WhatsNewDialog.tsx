import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { ChangelogDialog } from "./ChangelogDialog";
import { ReleaseNotesList } from "./ReleaseNotesList";
import { ChromeIconButton } from "@/components/ui/editorChrome";
import { appNestedCardClass, appPanelClass } from "@/components/ui/surfaceStyles";
import { fetchReleases, getAppVersion, type ReleaseData, type ReleaseSection } from "@/utils/fetchReleases";
import {
  WHATS_NEW_SEEN_KEY,
  WHATS_NEW_SUPPRESS_KEY,
  isWhatsNewSeenForVersion,
  isWhatsNewSuppressed,
} from "@/utils/whatsNewPrefs";

export { WHATS_NEW_SUPPRESS_KEY } from "@/utils/whatsNewPrefs";

const HIGHLIGHT_SECTION_NAMES = new Set(["what's new", "highlights"]);

export function useWhatsNew() {
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    getAppVersion().then(setAppVersion);
  }, []);

  const seen = appVersion !== null && isWhatsNewSeenForVersion(appVersion);

  const suppressed = isWhatsNewSuppressed();

  return {
    shouldShow: appVersion !== null && !seen && !suppressed,
    dismiss(suppress: boolean) {
      try {
        if (appVersion) localStorage.setItem(WHATS_NEW_SEEN_KEY, appVersion);
        if (suppress) localStorage.setItem(WHATS_NEW_SUPPRESS_KEY, "true");
        else localStorage.removeItem(WHATS_NEW_SUPPRESS_KEY);
      } catch {}
    },
  };
}

interface WhatsNewDialogProps {
  open: boolean;
  onClose: (suppress: boolean) => void;
}

function findHighlightSections(sections: ReleaseSection[]): ReleaseSection[] {
  const matched = sections.filter((s) => HIGHLIGHT_SECTION_NAMES.has(s.title.toLowerCase()));
  if (matched.length > 0) return matched;
  return sections.slice(0, 1);
}

export function WhatsNewDialog({ open, onClose }: WhatsNewDialogProps) {
  const [view, setView] = useState<"highlights" | "changelog">("highlights");
  const [suppress, setSuppress] = useState(false);
  const [showAllVersions, setShowAllVersions] = useState(false);

  const [releases, setReleases] = useState<ReleaseData[]>([]);
  const [appVersion, setAppVersion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    Promise.all([fetchReleases(), getAppVersion()])
      .then(([data, ver]) => {
        setReleases(data);
        setAppVersion(ver);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [open]);

  const latest = releases[0] ?? null;
  const highlights = latest ? findHighlightSections(latest.sections) : [];
  const hasHighlights = highlights.some((section) => section.items.length > 0);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose(suppress);
      }
    },
    [open, onClose, suppress],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={() => onClose(suppress)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="whats-new-title"
          className={`${appPanelClass} shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden`}
          onClick={(event) => event.stopPropagation()}
        >
          <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-tn-border shrink-0">
            <div className="min-w-0">
              {view === "changelog" && (
                <button
                  type="button"
                  onClick={() => setView("highlights")}
                  className="mb-2 flex items-center gap-1 text-xs text-tn-text-muted hover:text-tn-text transition-colors"
                  aria-label="Back to highlights"
                >
                  <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                    <path d="M10 3L5 8l5 5V3z" />
                  </svg>
                  Back
                </button>
              )}
              <p className="text-[10px] uppercase tracking-wider text-tn-accent/90 mb-1">
                v{appVersion || "…"}
                {latest?.date ? ` · ${latest.date}` : ""}
              </p>
              <h2 id="whats-new-title" className="text-base font-semibold text-tn-text">
                {view === "changelog" ? "Full changelog" : "What's new"}
              </h2>
              {view === "highlights" && latest?.name && (
                <p className="text-xs text-tn-text-muted mt-1 leading-relaxed">{latest.name}</p>
              )}
            </div>
            <ChromeIconButton
              size="sm"
              label="Close"
              onClick={() => onClose(suppress)}
              icon={<X className="h-4 w-4" strokeWidth={2} />}
            />
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4">
            {loading && (
              <div className="flex items-center justify-center py-10">
                <span className="text-sm text-tn-text-muted animate-pulse">Loading release notes…</span>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                <p className="text-sm text-tn-text-muted">Could not load release notes</p>
                <p className="text-xs text-tn-text-muted/70 max-w-sm">{error}</p>
              </div>
            )}

            {!loading && !error && view === "highlights" && (
              hasHighlights ? (
                <ReleaseNotesList sections={highlights} />
              ) : (
                <div className={`${appNestedCardClass} px-3 py-3`}>
                  <p className="text-sm text-tn-text">No highlights were found for this release.</p>
                  <p className="text-xs text-tn-text-muted mt-1">
                    Open the full changelog to view all release notes.
                  </p>
                </div>
              )
            )}

            {!loading && !error && view === "changelog" && latest && (
              <ReleaseNotesList sections={latest.sections} />
            )}
          </div>

          <footer className="flex flex-col gap-3 px-5 py-4 border-t border-tn-border shrink-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 min-w-0">
              <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
                <input
                  type="checkbox"
                  checked={suppress}
                  onChange={(event) => setSuppress(event.target.checked)}
                  className="w-3.5 h-3.5 accent-tn-accent"
                />
                <span className="text-xs text-tn-text-muted">Don&apos;t show on startup</span>
              </label>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {view === "highlights" && (
                  <button
                    type="button"
                    onClick={() => setView("changelog")}
                    className="text-xs text-tn-accent hover:opacity-80 transition-opacity"
                  >
                    Full changelog
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAllVersions(true)}
                  className="text-xs text-tn-text-muted hover:text-tn-text transition-colors"
                >
                  Past versions
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onClose(suppress)}
              className="shrink-0 self-end sm:self-auto px-4 py-2 text-xs rounded bg-tn-accent text-tn-bg font-medium hover:opacity-90"
            >
              Got it
            </button>
          </footer>
        </div>
      </div>
      <ChangelogDialog open={showAllVersions} onClose={() => setShowAllVersions(false)} />
    </>
  );
}
