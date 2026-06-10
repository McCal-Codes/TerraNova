import { useEffect, useState } from "react";
import {
  buildBugReportBundle,
  buildBugReportIssueUrl,
  bundleSummaryLines,
  type BugReportArea,
  type BugReportBundle,
  type BugReportErrorContext,
} from "@/utils/bugReport";
import { copyTextToClipboard } from "@/utils/devTools";
import { openUrl } from "@/utils/ipc";
import { useToastStore } from "@/stores/toastStore";
import { isTauriRuntime } from "@/utils/platform";

const AREAS: BugReportArea[] = [
  "Preview",
  "Export",
  "Bridge",
  "Create Pack",
  "Import",
  "Editor",
  "Other",
];

interface BugReportDialogProps {
  open: boolean;
  onClose: () => void;
  errorContext?: BugReportErrorContext | null;
}

export function BugReportDialog({ open, onClose, errorContext = null }: BugReportDialogProps) {
  const [area, setArea] = useState<BugReportArea>("Other");
  const [summary, setSummary] = useState("");
  const [bundle, setBundle] = useState<BugReportBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void buildBugReportBundle({
      area,
      userSummary: summary || undefined,
      error: errorContext ?? undefined,
    })
      .then(setBundle)
      .catch(() => setBundle(null))
      .finally(() => setLoading(false));
  }, [open, area, summary, errorContext]);

  if (!open) return null;

  async function handleCopyBundle() {
    if (!bundle) return;
    const text = JSON.stringify(bundle, null, 2);
    const ok = await copyTextToClipboard(text);
    addToast(
      ok
        ? "Debug bundle copied — paste into the Session snapshot field on GitHub"
        : "Could not copy debug bundle",
      ok ? "success" : "error",
    );
  }

  async function handleOpenGitHub() {
    if (!bundle) return;
    const text = JSON.stringify(bundle, null, 2);
    const copied = await copyTextToClipboard(text);
    if (!copied) {
      addToast("Could not copy debug bundle to clipboard", "error");
      return;
    }
    const url = buildBugReportIssueUrl(bundle, summary);
    if (isTauriRuntime()) {
      await openUrl(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    addToast("Opened GitHub — paste the copied JSON into Session snapshot", "success");
  }

  const summaryLines = bundle ? bundleSummaryLines(bundle) : [];

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bug-report-title"
        className="w-full max-w-md rounded-lg border border-tn-border bg-tn-panel shadow-xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-tn-border shrink-0">
          <h2 id="bug-report-title" className="text-base font-semibold text-tn-text">
            File a bug report
          </h2>
          <p className="text-xs text-tn-text-muted mt-1">
            Reports are public on GitHub. Local paths may be included to help reproduce issues.
          </p>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-tn-text-muted">What happened (optional)</span>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              placeholder="Short description for the issue title…"
              className="px-2 py-1.5 text-sm rounded border border-tn-border bg-tn-bg text-tn-text resize-none"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-tn-text-muted">Area</span>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value as BugReportArea)}
              className="px-2 py-1.5 text-sm rounded border border-tn-border bg-tn-bg text-tn-text"
            >
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>

          {errorContext && (
            <div className="rounded border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300/90">
              <p className="font-medium">Captured error</p>
              <p className="mt-1 break-words">{errorContext.message}</p>
            </div>
          )}

          <div className="rounded border border-tn-border/60 bg-tn-bg/60 px-3 py-2">
            <p className="text-xs font-medium text-tn-text-muted uppercase tracking-wider mb-1.5">
              Debug bundle
            </p>
            {loading && <p className="text-xs text-tn-text-muted">Collecting session data…</p>}
            {!loading && bundle && (
              <ul className="text-xs text-tn-text-muted space-y-0.5 list-disc pl-4">
                {summaryLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 px-5 py-4 border-t border-tn-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded border border-tn-border hover:bg-tn-surface"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!bundle || loading}
            onClick={() => void handleCopyBundle()}
            className="px-3 py-1.5 text-xs rounded border border-tn-border hover:bg-tn-surface disabled:opacity-50"
          >
            Copy debug bundle
          </button>
          <button
            type="button"
            disabled={!bundle || loading}
            onClick={() => void handleOpenGitHub()}
            className="px-4 py-1.5 text-xs rounded bg-tn-accent text-tn-bg font-medium hover:opacity-90 disabled:opacity-50"
          >
            Open GitHub issue
          </button>
        </footer>
      </div>
    </div>
  );
}
