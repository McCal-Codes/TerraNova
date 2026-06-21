import { useState } from "react";
import { ChevronDown, ChevronRight, HelpCircle } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { getPropHelpContent, PROP_HELP_DOC_SLUG } from "./propHelpContent";

interface PropHelpCardProps {
  defaultOpen?: boolean;
}

export function PropHelpCard({ defaultOpen = false }: PropHelpCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const setRequestedDocSlug = useUIStore((state) => state.setRequestedDocSlug);
  const setRightPanelMode = useUIStore((state) => state.setRightPanelMode);
  const setRightPanelVisible = useUIStore((state) => state.setRightPanelVisible);
  const content = getPropHelpContent();

  const openGuide = () => {
    setRequestedDocSlug(PROP_HELP_DOC_SLUG);
    setRightPanelMode("docs");
    setRightPanelVisible(true);
  };

  return (
    <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2.5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-2 text-left"
        aria-expanded={open}
      >
        <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-300/90" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="text-[11px] font-medium text-sky-100/95">
            {content.title}
            {!open && (
              <span className="font-normal text-tn-text-muted"> — tap for tips</span>
            )}
          </span>
        </span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-tn-text-muted" aria-hidden />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-tn-text-muted" aria-hidden />
        )}
      </button>
      {open && (
        <div className="mt-2 space-y-2 border-t border-sky-500/15 pt-2 pl-[1.375rem]">
          <p className="text-[11px] leading-relaxed text-tn-text-muted">{content.summary}</p>
          <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-tn-text-muted">
            {content.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={openGuide}
            className="text-[10px] font-medium text-sky-300 transition-colors hover:text-sky-200"
          >
            Open full props &amp; placement guide
          </button>
        </div>
      )}
    </div>
  );
}
