import { useMemo } from "react";
import { GitCompareArrows } from "lucide-react";
import type { Edge, Node } from "@xyflow/react";
import { usePreviewStore } from "@/stores/previewStore";
import {
  buildDensityPreviewLens,
  lensSelectionFromPreviewTarget,
  previewNodeIdForLensSelection,
  supportsDensityPreviewLens,
  type DensityPreviewLensSelection,
  isUnaryDensityPreviewLens,
} from "@/utils/densityPreviewLens";
import {
  openCompareForDensityNode,
  openCompareLensInputs,
} from "@/utils/comparePreviewActions";
import { useToastStore } from "@/stores/toastStore";
import { getNodeType } from "@/utils/density/evalTypes";

interface DensityPreviewLensCardProps {
  nodeId: string;
  nodeType: string;
  nodes: Node[];
  edges: Edge[];
}

function lensButtonClass(active: boolean): string {
  return [
    "rounded border px-2 py-1 text-left text-[10px] leading-tight transition-colors",
    active
      ? "border-tn-accent bg-tn-accent/15 text-tn-accent"
      : "border-tn-border bg-tn-panel text-tn-text-muted hover:text-tn-text hover:bg-tn-surface",
  ].join(" ");
}

export function DensityPreviewLensCard({
  nodeId,
  nodeType,
  nodes,
  edges,
}: DensityPreviewLensCardProps) {
  const selectedPreviewNodeId = usePreviewStore((s) => s.selectedPreviewNodeId);
  const setSelectedPreviewNodeId = usePreviewStore((s) => s.setSelectedPreviewNodeId);

  const lens = useMemo(
    () => buildDensityPreviewLens(nodeId, nodes, edges),
    [nodeId, nodes, edges],
  );

  if (!lens || !supportsDensityPreviewLens(nodeType)) return null;

  const selection = lensSelectionFromPreviewTarget(lens, selectedPreviewNodeId);

  const applySelection = (next: DensityPreviewLensSelection) => {
    setSelectedPreviewNodeId(previewNodeIdForLensSelection(lens, next));
  };

  const handleCompareVsResult = () => {
    const result = openCompareForDensityNode(nodeId, nodes, edges);
    if (!result.ok) {
      useToastStore.getState().addToast(result.message ?? "Could not open compare view.", "warning");
    }
  };

  const handleCompareInputs = () => {
    const result = openCompareLensInputs(nodeId, nodes, edges, "inputs");
    if (!result.ok) {
      useToastStore.getState().addToast(result.message ?? "Could not open compare view.", "warning");
    }
  };

  const hasTwoInputs = lens.inputs.length >= 2;
  const unary = isUnaryDensityPreviewLens(lens.combinatorType);

  return (
    <div className="border-t border-tn-border pt-2 mt-1 space-y-2">
      <div>
        <p className="text-[10px] font-medium text-tn-text-muted uppercase tracking-wide mb-1.5">
          Preview density as
        </p>
        <p className="text-[10px] text-tn-text-muted mb-2">
          See the combined {lens.combinatorType} result or each wired input field on its own.
        </p>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => applySelection("result")}
            className={lensButtonClass(selection === "result")}
          >
            <span className="font-medium text-tn-text">Result</span>
            <span className="block text-tn-text-muted">{lens.combinatorType} output</span>
          </button>
          {lens.inputs.map((input) => {
            const key: DensityPreviewLensSelection = `input-${input.index}`;
            return (
              <button
                key={input.handle}
                type="button"
                onClick={() => applySelection(key)}
                className={lensButtonClass(selection === key)}
              >
                <span className="font-medium text-tn-text">
                  {unary ? "Input" : `Input ${input.index + 1}`}
                </span>
                <span className="block text-tn-text-muted truncate">{input.typeName}</span>
              </button>
            );
          })}
        </div>
        {lens.inputs.length === 0 && (
          <p className="text-[10px] text-tn-text-muted mt-1">Wire inputs to preview each branch.</p>
        )}
      </div>

      {lens.inputs.length > 0 && (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={handleCompareVsResult}
            className="flex w-full items-center justify-center gap-1.5 rounded border border-tn-border bg-tn-panel px-2 py-1.5 text-[10px] text-tn-text hover:bg-tn-surface"
          >
            <GitCompareArrows className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Compare input vs result (2D)
          </button>
          {hasTwoInputs && (
            <button
              type="button"
              onClick={handleCompareInputs}
              className="flex w-full items-center justify-center gap-1.5 rounded border border-tn-border bg-tn-panel px-2 py-1.5 text-[10px] text-tn-text hover:bg-tn-surface"
            >
              <GitCompareArrows className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Compare both inputs (2D)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** When a child input is selected, show link back to parent combinator lens. */
export function DensityPreviewLensBreadcrumb({
  previewTargetId,
  nodes,
  edges,
}: {
  previewTargetId: string;
  nodes: Node[];
  edges: Edge[];
}) {
  const setSelectedPreviewNodeId = usePreviewStore((s) => s.setSelectedPreviewNodeId);

  const parent = useMemo(() => {
    const edge = edges.find((e) => e.source === previewTargetId);
    if (!edge?.target) return null;
    const parentNode = nodes.find((n) => n.id === edge.target);
    if (!parentNode) return null;
    const parentType = getNodeType(parentNode);
    if (!supportsDensityPreviewLens(parentType)) return null;
    const lens = buildDensityPreviewLens(edge.target, nodes, edges);
    if (!lens) return null;
    return { lens, parentType };
  }, [previewTargetId, nodes, edges]);

  if (!parent) return null;

  return (
    <p className="text-[10px] text-tn-text-muted border-t border-tn-border pt-2 mt-1">
      Previewing an input of{" "}
      <button
        type="button"
        className="text-tn-accent hover:underline"
        onClick={() => setSelectedPreviewNodeId(parent.lens.result.nodeId)}
      >
        {parent.parentType} result
      </button>
      . Use <strong className="font-medium text-tn-text">Preview density as</strong> on that node to switch branches.
    </p>
  );
}
