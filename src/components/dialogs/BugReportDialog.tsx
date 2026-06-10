import { useEffect, useState } from "react";
import {
  buildBugReportBundle,
  buildBugReportIssueUrl,
  bundleSummaryLines,
  formatBugReportClipboard,
  inferBugReportArea,
  type BugReportArea,
  type BugReportBundle,
  type BugReportErrorContext,
} from "@/utils/bugReport";
import { ALPHA_WHAT_TO_TEST_VERSION } from "@/constants/alphaTestFocus";
import { copyTextToClipboard } from "@/utils/devTools";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { openUrl, showInFolder } from "@/utils/ipc";
import { useToastStore } from "@/stores/toastStore";
import { isTauriRuntime } from "@/utils/platform";
import {
  capturePreviewScreenshotAttachment,
  formatAttachmentForBundle,
  pickBugReportFileAttachments,
  type BugReportAttachment,
} from "@/utils/bugReportAttachments";

const AREAS: BugReportArea[] = [
  "Preview",
  "Export",
  "Bridge",
  "Create Pack",
  "Onboarding",
  "Import",
  "Editor",
  "Other",
];

const AREA_HINTS: Partial<Record<BugReportArea, string>> = {
  Preview: "Include view mode (2D/3D/Voxel), whether auto-refresh was on, and any preview error text. Attach a screenshot from the preview pane when helpful.",
  Export: "Note export target folder and whether validation showed errors before export.",
  Bridge: "Include save name, mod folder, and whether the sidecar was connected.",
  "Create Pack": "Simple vs Advanced, template id, and prefab path if starter props were enabled.",
  Onboarding: "Which onboarding step failed and whether asset sync completed.",
  Import: "Source file path and whether this is a Hytale import or round-trip.",
  Editor: "Selected node type, canvas action, and validation messages if any.",
};

interface BugReportDialogProps {
  open: boolean;
  onClose: () => void;
  errorContext?: BugReportErrorContext | null;
}

export function BugReportDialog({ open, onClose, errorContext = null }: BugReportDialogProps) {
  const [area, setArea] = useState<BugReportArea>("Other");
  const [summary, setSummary] = useState("");
  const [steps, setSteps] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [bundle, setBundle] = useState<BugReportBundle | null>(null);
  const [attachments, setAttachments] = useState<BugReportAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  const debouncedSummary = useDebouncedValue(summary, 400);
  const debouncedSteps = useDebouncedValue(steps, 400);
  const debouncedExpected = useDebouncedValue(expected, 400);
  const debouncedActual = useDebouncedValue(actual, 400);

  useEffect(() => {
    if (!open) return;
    const inferred = inferBugReportArea(errorContext);
    if (inferred) setArea(inferred);
    if (errorContext?.message && !summary) {
      setSummary(errorContext.message.slice(0, 200));
    }
  }, [open, errorContext]); // eslint-disable-line react-hooks/exhaustive-deps -- seed once on open

  useEffect(() => {
    if (!open) {
      setAttachments([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const attachmentRefs = attachments.map(formatAttachmentForBundle);
    void buildBugReportBundle({
      report: {
        area,
        summary: debouncedSummary || undefined,
        steps: debouncedSteps || undefined,
        expected: debouncedExpected || undefined,
        actual: debouncedActual || undefined,
      },
      error: errorContext ?? undefined,
      attachments: attachmentRefs.length ? attachmentRefs : undefined,
    })
      .then(setBundle)
      .catch(() => setBundle(null))
      .finally(() => setLoading(false));
  }, [
    open,
    area,
    debouncedSummary,
    debouncedSteps,
    debouncedExpected,
    debouncedActual,
    attachments,
    errorContext,
  ]);

  async function handleCaptureScreenshot() {
    try {
      const att = await capturePreviewScreenshotAttachment();
      if (!att) return;
      setAttachments((prev) => [...prev, att]);
      addToast("Preview screenshot saved — attach it on GitHub after opening the issue", "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    }
  }

  async function handleAttachFiles() {
    try {
      const picked = await pickBugReportFileAttachments();
      if (picked.length === 0) return;
      setAttachments((prev) => [...prev, ...picked]);
      addToast(`Added ${picked.length} attachment(s)`, "success");
    } catch (err) {
      addToast(err instanceof Error ? err.message : String(err), "error");
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  if (!open) return null;

  async function handleCopyBundle() {
    if (!bundle) return;
    const ok = await copyTextToClipboard(formatBugReportClipboard(bundle));
    addToast(
      ok
        ? "Report copied — paste the JSON block into Session snapshot on GitHub"
        : "Could not copy debug bundle",
      ok ? "success" : "error",
    );
  }

  async function handleOpenGitHub() {
    if (!bundle) return;
    const ok = await copyTextToClipboard(formatBugReportClipboard(bundle));
    if (!ok) {
      addToast("Could not copy debug bundle to clipboard", "error");
      return;
    }
    const url = buildBugReportIssueUrl(bundle);
    if (isTauriRuntime()) {
      await openUrl(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    addToast("Opened GitHub — paste the copied JSON into Session snapshot and drag attachments onto the issue", "success");
  }

  const summaryLines = bundle ? bundleSummaryLines(bundle) : [];
  const areaHint = AREA_HINTS[area];

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bug-report-title"
        className="w-full max-w-lg rounded-lg border border-tn-border bg-tn-panel shadow-xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-tn-border shrink-0">
          <p className="text-[10px] uppercase tracking-wider text-amber-400/80 mb-1">
            Closed alpha · {ALPHA_WHAT_TO_TEST_VERSION}
          </p>
          <h2 id="bug-report-title" className="text-base font-semibold text-tn-text">
            File a bug report
          </h2>
          <p className="text-xs text-tn-text-muted mt-1">
            Issues are public on GitHub. Paths are redacted where possible; still avoid secrets in
            the summary.
          </p>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3 text-sm">
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
            {areaHint && (
              <p className="text-[11px] text-tn-text-muted leading-relaxed">{areaHint}</p>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-tn-text-muted">Short summary</span>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="One line for the issue title…"
              className="px-2 py-1.5 text-sm rounded border border-tn-border bg-tn-bg text-tn-text"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-tn-text-muted">Steps to reproduce</span>
            <textarea
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              rows={3}
              placeholder={"1. Open …\n2. Click …\n3. See …"}
              className="px-2 py-1.5 rounded border border-tn-border bg-tn-bg text-tn-text resize-none font-mono text-[12px]"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-tn-text-muted">Expected</span>
              <textarea
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
                rows={2}
                className="px-2 py-1.5 text-sm rounded border border-tn-border bg-tn-bg text-tn-text resize-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-tn-text-muted">Actual</span>
              <textarea
                value={actual}
                onChange={(e) => setActual(e.target.value)}
                rows={2}
                className="px-2 py-1.5 text-sm rounded border border-tn-border bg-tn-bg text-tn-text resize-none"
              />
            </label>
          </div>

          {errorContext && (
            <div className="rounded border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300/90">
              <p className="font-medium">Captured error</p>
              <p className="mt-1 break-words">{errorContext.message}</p>
            </div>
          )}

          {isTauriRuntime() && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-tn-text-muted uppercase tracking-wider">
                Screenshots &amp; files
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleCaptureScreenshot()}
                  className="px-3 py-1.5 text-xs rounded border border-tn-border hover:bg-tn-surface"
                >
                  Capture preview screenshot
                </button>
                <button
                  type="button"
                  onClick={() => void handleAttachFiles()}
                  className="px-3 py-1.5 text-xs rounded border border-tn-border hover:bg-tn-surface"
                >
                  Attach files…
                </button>
              </div>
              {attachments.length > 0 && (
                <ul className="space-y-1 text-[11px] text-tn-text-muted">
                  {attachments.map((att) => (
                    <li key={att.id} className="flex items-center gap-2 rounded border border-tn-border/60 bg-tn-bg/60 px-2 py-1">
                      <span className="flex-1 truncate font-mono">{att.name}</span>
                      <button
                        type="button"
                        onClick={() => void showInFolder(att.savedPath)}
                        className="text-tn-accent hover:underline shrink-0"
                      >
                        Show
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAttachment(att.id)}
                        className="text-tn-text-muted hover:text-tn-text shrink-0"
                        aria-label={`Remove ${att.name}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[10px] text-tn-text-muted leading-relaxed">
                Paths are listed in the copied report. After GitHub opens, drag these files onto the issue body.
              </p>
            </div>
          )}

          <div className="rounded border border-tn-border/60 bg-tn-bg/60 px-3 py-2">
            <p className="text-xs font-medium text-tn-text-muted uppercase tracking-wider mb-1.5">
              Auto-captured context
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
            Copy report
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
