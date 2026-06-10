import {
  ALPHA_DISCORD_CONTACT,
  ALPHA_TEST_FOCUS_ITEMS,
  ALPHA_WHAT_TO_TEST_VERSION,
  markAlphaWhatToTestDismissed,
} from "@/constants/alphaTestFocus";
import { useBugReportStore } from "@/stores/bugReportStore";

interface AlphaWhatToTestDialogProps {
  open: boolean;
  onClose: () => void;
  onOpenOnboarding?: () => void;
}

/** Temporary closed-alpha checklist — remove or gate when alpha ends. */
export function AlphaWhatToTestDialog({ open, onClose, onOpenOnboarding }: AlphaWhatToTestDialogProps) {
  if (!open) return null;

  function handleDismiss() {
    markAlphaWhatToTestDismissed();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 p-4"
      onClick={handleDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="alpha-test-title"
        className="w-full max-w-lg max-h-[85vh] rounded-lg border border-amber-500/30 bg-tn-panel shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-tn-border shrink-0 bg-amber-500/5">
          <p className="text-[10px] uppercase tracking-wider text-amber-400/90 mb-1">
            Closed alpha · {ALPHA_WHAT_TO_TEST_VERSION}
          </p>
          <h2 id="alpha-test-title" className="text-base font-semibold text-tn-text">
            What to test
          </h2>
          <p className="text-xs text-tn-text-muted mt-1 leading-relaxed">
            Thank you for testing TerraNova closed alpha. Work through these focus areas and file bugs
            with the in-app reporter. Bridge is not in scope for this first alpha — expect weekly alpha
            builds. Serious issues: reach {ALPHA_DISCORD_CONTACT} on Discord.
          </p>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
          {ALPHA_TEST_FOCUS_ITEMS.map((item) => (
            <section
              key={item.id}
              className="rounded border border-tn-border/70 bg-tn-bg/40 px-3 py-2.5"
            >
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <h3 className="text-sm font-medium text-tn-text">{item.title}</h3>
                <span className="text-[10px] text-tn-accent shrink-0">{item.area}</span>
              </div>
              <ol className="text-xs text-tn-text-muted space-y-1 list-decimal pl-4 leading-relaxed">
                {item.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {item.id === "onboarding-sync" && onOpenOnboarding && (
                <button
                  type="button"
                  onClick={onOpenOnboarding}
                  className="mt-2 px-3 py-1.5 text-xs rounded border border-tn-border bg-tn-bg/60 hover:bg-tn-surface text-tn-text"
                >
                  Run onboarding
                </button>
              )}
            </section>
          ))}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-t border-tn-border shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            {onOpenOnboarding && (
              <button
                type="button"
                onClick={onOpenOnboarding}
                className="text-xs text-tn-accent hover:underline"
              >
                Run onboarding
              </button>
            )}
            <button
              type="button"
              onClick={() => useBugReportStore.getState().requestOpen()}
              className="text-xs text-tn-accent hover:underline"
            >
              Open bug reporter
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDismiss}
              className="px-4 py-1.5 text-xs rounded bg-tn-accent text-tn-bg font-medium hover:opacity-90"
            >
              Got it
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
