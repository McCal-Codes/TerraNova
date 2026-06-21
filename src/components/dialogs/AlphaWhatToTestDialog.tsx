import {
  ALPHA_DISCORD_CONTACT,
  ALPHA_TEST_FOCUS_ITEMS,
  ALPHA_WHAT_TO_TEST_VERSION,
  markAlphaWhatToTestDismissed,
} from "@/constants/alphaTestFocus";
import { ModalShell } from "@/components/ui/ModalShell";
import { useBugReportStore } from "@/stores/bugReportStore";

interface AlphaWhatToTestDialogProps {
  open: boolean;
  onClose: () => void;
  onOpenOnboarding?: () => void;
}

/** Temporary closed-alpha checklist — remove or gate when alpha ends. */
export function AlphaWhatToTestDialog({ open, onClose, onOpenOnboarding }: AlphaWhatToTestDialogProps) {
  function handleDismiss() {
    markAlphaWhatToTestDismissed();
    onClose();
  }

  return (
    <ModalShell
      open={open}
      onClose={handleDismiss}
      title={`What to test · ${ALPHA_WHAT_TO_TEST_VERSION}`}
      widthClass="w-full max-w-lg"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
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
          <button
            type="button"
            onClick={handleDismiss}
            className="px-4 py-1.5 text-xs rounded bg-tn-accent text-tn-bg font-medium hover:opacity-90"
          >
            Got it
          </button>
        </div>
      }
    >
      <div className="-mt-2 -mx-1 mb-2 rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-wider text-amber-400/90 mb-1">Closed alpha</p>
        <p className="text-xs text-tn-text-muted leading-relaxed">
          Thank you for testing TerraNova closed alpha. Work through these focus areas and file bugs
          with the in-app reporter. This build adds Atmosphere tint editing, preview fidelity callouts,
          session-restore polish, and voxel legend toggles. Bridge is not in scope for this alpha — expect
          weekly alpha builds. Serious issues: reach {ALPHA_DISCORD_CONTACT} on Discord.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {ALPHA_TEST_FOCUS_ITEMS.map((item) => (
          <section
            key={item.id}
            className="rounded border border-tn-border bg-tn-bg px-3 py-2.5"
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
    </ModalShell>
  );
}
