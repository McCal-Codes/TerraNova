import { Info } from "lucide-react";
import { appNestedCardClass } from "@/components/ui/surfaceStyles";
import { useUIStore } from "@/stores/uiStore";
import type { ApproximatedPreviewNode } from "@/utils/graphDiagnostics";

interface PreviewApproximatedCalloutProps {
  nodes: ApproximatedPreviewNode[];
}

export function PreviewApproximatedCallout({ nodes }: PreviewApproximatedCalloutProps) {
  if (nodes.length === 0) return null;

  const visible = nodes.slice(0, 3);
  const remaining = nodes.length - visible.length;

  const openIssues = () => {
    const { sidebarExpanded, toggleSection } = useUIStore.getState();
    if (!sidebarExpanded.validation) toggleSection("validation");
  };

  return (
    <div className={`absolute bottom-3 left-3 right-3 z-20 max-w-md ${appNestedCardClass} px-3 py-2.5`}>
      <div className="flex items-start gap-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-tn-text">Approximated preview</p>
          <p className="text-[11px] text-tn-text-muted leading-relaxed mt-0.5">
            In-game results may differ for:
            {" "}
            {visible.map((n, i) => (
              <span key={n.id}>
                {i > 0 ? ", " : ""}
                <span className="text-tn-text">{n.label}</span>
                <span className="text-tn-text-muted/80"> ({n.type})</span>
              </span>
            ))}
            {remaining > 0 ? ` and ${remaining} more` : ""}.
          </p>
          <button
            type="button"
            onClick={openIssues}
            className="mt-1.5 text-[10px] font-medium text-tn-accent hover:underline"
          >
            Open Issues panel
          </button>
        </div>
      </div>
    </div>
  );
}
