import { focusRing } from "@/components/ui/settingsPrimitives";
import { useBugReportStore } from "@/stores/bugReportStore";

/**
 * About: identity, credits, legal and release notes.
 *
 * Not a CategoryPanel — About holds no settings, so rendering it through the
 * registry would show an empty settings area above static content. It is
 * extracted for the same reason as the other panels (SettingsDialog stays a
 * shell) without pretending to be registry-driven.
 */

export interface AboutPanelProps {
  appVersion: string;
  onShowLegal: (which: "license" | "notice") => void;
  onShowWhatsNew: () => void;
  onShowChangelog: () => void;
  onOpenAlphaChecklist?: () => void;
}

const card = "rounded border border-tn-border/60 bg-tn-bg/60 px-3 py-2.5";
const linkButton = `flex-1 rounded border border-tn-border bg-tn-bg px-3 py-2 text-left text-sm hover:bg-tn-surface ${focusRing}`;

export function AboutPanel({
  appVersion,
  onShowLegal,
  onShowWhatsNew,
  onShowChangelog,
  onOpenAlphaChecklist,
}: AboutPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="about-identity" className="flex flex-col gap-1 rounded border border-tn-border/60 bg-tn-bg/60 p-4">
        <h3 id="about-identity" className="text-sm font-semibold text-tn-text">TerraNova</h3>
        <p className="text-[11px] text-tn-text-muted">
          Offline design studio for Hytale World Generation V2
        </p>
        <p className="mt-1 text-[11px] text-tn-text-muted">v{appVersion || "…"}</p>
      </section>

      <section aria-labelledby="about-credits" className="flex flex-col gap-2">
        <h3 id="about-credits" className="text-sm font-medium text-tn-text">Author and contributors</h3>
        <div className={`${card} flex flex-col gap-0.5`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-tn-text">McCal</span>
            <span className="rounded border border-tn-border/50 px-1.5 py-0.5 text-[10px] text-tn-text-muted">
              McCal-Codes
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-tn-text-muted">
            TerraNova — Hytale worldgen editor, preview, atmosphere stack, Bridge integration, and
            the McCal-Codes closed alpha.
          </p>
        </div>
        <p className="text-[11px] leading-relaxed text-tn-text-muted">
          McCal-Codes, nmang004, ZenithDevHQ, LeoWherle, derrickmehaffy — see{" "}
          <a
            href="https://github.com/McCal-Codes/TerraNova/graphs/contributors"
            className={`text-tn-accent hover:opacity-80 ${focusRing}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub contributors
          </a>
          .
        </p>
      </section>

      <section aria-labelledby="about-legal" className="flex flex-col gap-2">
        <h3 id="about-legal" className="text-sm font-medium text-tn-text">Legal</h3>
        <div className={`${card} flex flex-col gap-1 text-[11px] text-tn-text-muted`}>
          <p>© 2024–2026 McCal.</p>
          <p>TerraNova is not affiliated with or endorsed by Hypixel Studios.</p>
          <p>Hytale is a trademark of Hypixel Studios.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => onShowLegal("license")} className={linkButton}>
            <span className="font-medium text-tn-text">License</span>
            <p className="mt-0.5 text-xs text-tn-text-muted">GNU Lesser General Public License v2.1</p>
          </button>
          <button type="button" onClick={() => onShowLegal("notice")} className={linkButton}>
            <span className="font-medium text-tn-text">Copyright notices</span>
            <p className="mt-0.5 text-xs text-tn-text-muted">Third-party acknowledgements</p>
          </button>
        </div>
      </section>

      <section aria-labelledby="about-support" className="flex flex-col gap-2">
        <h3 id="about-support" className="text-sm font-medium text-tn-text">Support</h3>
        <button
          type="button"
          onClick={() => useBugReportStore.getState().requestOpen()}
          className={`${linkButton} flex-none`}
        >
          <span className="font-medium text-tn-text">Report a bug</span>
          <p className="mt-0.5 text-xs text-tn-text-muted">
            Copy a debug bundle and open the GitHub issue form
          </p>
        </button>
      </section>

      <section aria-labelledby="about-notes" className="flex flex-col gap-2">
        <h3 id="about-notes" className="text-sm font-medium text-tn-text">Release notes</h3>
        <div className="flex gap-2">
          <button type="button" onClick={onShowWhatsNew} className={linkButton}>
            View What&apos;s New
          </button>
          <button type="button" onClick={onShowChangelog} className={linkButton}>
            All changelogs
          </button>
        </div>
        {onOpenAlphaChecklist ? (
          <button
            type="button"
            onClick={onOpenAlphaChecklist}
            className={`w-full rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-left text-sm hover:bg-amber-500/10 ${focusRing}`}
          >
            <span className="font-medium text-tn-text">View “What to test” checklist</span>
            <p className="mt-0.5 text-xs text-tn-text-muted">
              Closed-alpha tester focus areas for this build
            </p>
          </button>
        ) : null}
      </section>
    </div>
  );
}
