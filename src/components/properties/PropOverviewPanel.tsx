import { useState } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { SliderField } from "./SliderField";
import { ToggleField } from "./ToggleField";
import { PropPlacementGrid } from "./PropPlacementGrid";
import {
  NewPropSourceDialog,
  type PropSourceConfirmPayload,
} from "@/components/dialogs/NewPropSourceDialog";
import { summarizePropSectionFromGraph } from "@/utils/propSectionSummary";
import { PropHelpCard } from "./prop/PropHelpCard";

interface PropOverviewPanelProps {
  propIndex: number;
  onPropMetaChange: (index: number, field: string, value: unknown) => void;
  onBlur: () => void;
}

export function PropOverviewPanel({
  propIndex,
  onPropMetaChange,
  onBlur,
}: PropOverviewPanelProps) {
  const biomeConfig = useEditorStore((s) => s.biomeConfig);
  const biomeSections = useEditorStore((s) => s.biomeSections);
  const activeBiomeSection = useEditorStore((s) => s.activeBiomeSection);
  const liveNodes = useEditorStore((s) => s.nodes);
  const liveEdges = useEditorStore((s) => s.edges);
  const replacePropSectionGraph = useEditorStore((s) => s.replacePropSectionGraph);
  const duplicatePropSection = useEditorStore((s) => s.duplicatePropSection);

  const [showReplaceDialog, setShowReplaceDialog] = useState(false);

  if (!biomeConfig || !biomeSections) return null;

  const sectionKey = `Props[${propIndex}]`;
  const section = biomeSections[sectionKey];
  if (!section) return null;

  const propMeta = biomeConfig.propMeta[propIndex];
  if (!propMeta) return null;

  const isActive = activeBiomeSection === sectionKey;
  const nodes = isActive ? liveNodes : section.nodes;
  const edges = isActive ? liveEdges : section.edges;

  const summary = summarizePropSectionFromGraph(nodes, edges);
  const posType = summary.positionsType ?? "None";
  const asgnType = summary.assignmentsType ?? "None";

  function handleReplaceConfirm(payload: PropSourceConfirmPayload) {
    replacePropSectionGraph(propIndex, payload.nodes, payload.edges, payload.meta);
  }

  return (
    <div className="flex flex-col p-3 gap-3">
      <PropHelpCard />

      <div className="border-b border-tn-border pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Prop {propIndex}</h3>
            <p className="text-xs text-tn-text-muted">
              {summary.shortLabel} · {nodes.length} nodes, {edges.length} edges
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => duplicatePropSection(propIndex)}
              className="px-2 py-1 text-[10px] rounded border border-tn-border text-tn-text-muted hover:text-tn-text hover:bg-white/5"
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => setShowReplaceDialog(true)}
              className="px-2 py-1 text-[10px] rounded border border-tn-border text-tn-text-muted hover:text-tn-text hover:bg-white/5"
            >
              Replace from Hytale…
            </button>
          </div>
        </div>
      </div>

      {summary.distributionVariant && (
        <div
          className="p-2.5 rounded border border-tn-border"
          style={{ backgroundColor: "rgba(199, 107, 107, 0.08)" }}
        >
          <div className="text-xs font-medium text-[#C76B6B] mb-0.5">PropDistribution</div>
          <div className="text-xs text-tn-text">{summary.distributionVariant}</div>
        </div>
      )}

      <div
        className="p-2.5 rounded border border-tn-border"
        style={{ backgroundColor: "rgba(107, 158, 90, 0.08)" }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <svg className="w-3.5 h-3.5 shrink-0 text-[#6B9E5A]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="6" r="3" />
            <path d="M8 9v5" />
          </svg>
          <span className="text-xs font-medium text-[#6B9E5A]">Positions</span>
        </div>
        <div className="text-xs text-tn-text">{posType}</div>
        {summary.positionsParams && (
          <div className="text-[10px] text-tn-text-muted mt-0.5">{summary.positionsParams}</div>
        )}
      </div>

      <div
        className="p-2.5 rounded border border-tn-border"
        style={{ backgroundColor: "rgba(139, 115, 85, 0.08)" }}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <svg className="w-3.5 h-3.5 shrink-0 text-[#8B7355]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 8.5V2.5a1 1 0 011-1h6l7 7-6 6-7-7z" />
            <circle cx="5" cy="5.5" r="1" fill="currentColor" />
          </svg>
          <span className="text-xs font-medium text-[#8B7355]">Assignments</span>
        </div>
        <div className="text-xs text-tn-text">{asgnType}</div>
        {summary.assignmentsChain && summary.assignmentsChain !== asgnType && (
          <div className="text-[10px] text-tn-text-muted mt-0.5 truncate">{summary.assignmentsChain}</div>
        )}
      </div>

      <div className="border-t border-tn-border pt-2 mt-1">
        <h4 className="text-xs font-semibold text-tn-text-muted mb-2">Settings</h4>
        <div className="flex flex-col gap-3">
          <SliderField
            label="Runtime"
            value={propMeta.Runtime}
            min={0}
            max={3}
            step={1}
            onChange={(v) => onPropMetaChange(propIndex, "Runtime", v)}
            onBlur={onBlur}
          />
          <ToggleField
            label="Skip"
            value={propMeta.Skip}
            onChange={(v) => onPropMetaChange(propIndex, "Skip", v)}
          />
        </div>
      </div>

      <div className="border-t border-tn-border pt-2 mt-1">
        <PropPlacementGrid nodes={nodes} edges={edges} />
      </div>

      <NewPropSourceDialog
        open={showReplaceDialog}
        onClose={() => setShowReplaceDialog(false)}
        title={`Replace Prop ${propIndex}`}
        confirmLabel="Replace prop layer"
        onConfirm={handleReplaceConfirm}
      />
    </div>
  );
}
