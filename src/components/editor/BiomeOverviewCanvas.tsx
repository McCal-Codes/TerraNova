import { memo, useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
} from "@xyflow/react";
import { Map, MousePointerClick } from "lucide-react";
import "@xyflow/react/dist/style.css";
import { useEditorStore } from "@/stores/editorStore";
import { nodeTypes } from "@/nodes";
import { MIN_ZOOM, MAX_ZOOM } from "@/constants";
import {
  buildBiomeOverviewGraph,
  resolveOverviewNodeNavigation,
} from "@/utils/biomeUnifiedCanvas";
import { getBiomeSectionColor, getBiomeSectionLabel } from "@/utils/biomeSectionUtils";
import { biomeSectionSortOrder } from "@/utils/sectionAnnotationRouting";
import { parseNodeEditorMetadata } from "@/utils/hytaleToInternal";

function getOverviewNodeColor(node: Node): string {
  if (node.type === "sectionAnchor") return "#E8B84A";
  if (node.type === "overviewSection") {
    return (node.data as { color?: string }).color ?? "#5B8DBF";
  }
  if (node.type === "comment") return "#e8d44d";
  if (node.type === "frame") return "#4a7fa5";
  const section = (node.data as { _overviewSection?: string })._overviewSection;
  if (section) return getBiomeSectionColor(section);
  return "#5B8DBF";
}

function BiomeOverviewCanvasInner() {
  const biomeSections = useEditorStore((s) => s.biomeSections);
  const importLayoutMode = useEditorStore((s) => s.importLayoutMode);
  const hytaleLayoutOffsets = useEditorStore((s) => s.hytaleLayoutOffsets);
  const originalWrapper = useEditorStore((s) => s.originalWrapper);
  const switchBiomeSection = useEditorStore((s) => s.switchBiomeSection);
  const setBiomeCanvasMode = useEditorStore((s) => s.setBiomeCanvasMode);
  const setSelectedNodeId = useEditorStore((s) => s.setSelectedNodeId);
  const reactFlow = useReactFlow();

  const wrapperNodePositions = useMemo(() => {
    if (!originalWrapper) return null;
    const meta = originalWrapper.$NodeEditorMetadata as Record<string, unknown> | undefined;
    if (!meta) return null;
    return parseNodeEditorMetadata(meta).nodePositions;
  }, [originalWrapper]);

  const { nodes, edges } = useMemo(() => {
    if (!biomeSections) return { nodes: [], edges: [] };
    return buildBiomeOverviewGraph(biomeSections, importLayoutMode, hytaleLayoutOffsets, {
      originalWrapper,
      nodePositions: wrapperNodePositions,
    });
  }, [biomeSections, importLayoutMode, hytaleLayoutOffsets, originalWrapper, wrapperNodePositions]);

  const sectionLegend = useMemo(() => {
    if (!biomeSections) return [];
    return biomeSectionSortOrder(Object.keys(biomeSections)).map((key) => ({
      key,
      label: getBiomeSectionLabel(key),
      color: getBiomeSectionColor(key),
    }));
  }, [biomeSections]);

  const resolvedNodes = useMemo(
    () => nodes.map((node) => (node.type && node.type in nodeTypes ? node : { ...node, type: "default" })),
    [nodes],
  );

  const styledEdges = useMemo(
    (): Edge[] => edges.map((edge) => {
      const sourceNode = resolvedNodes.find((n) => n.id === edge.source);
      const section = (sourceNode?.data as { _overviewSection?: string } | undefined)?._overviewSection;
      const color = section ? `${getBiomeSectionColor(section)}88` : "#5a534788";
      return {
        ...edge,
        style: {
          stroke: color,
          strokeWidth: 1.25,
          opacity: 0.9,
        },
        animated: false,
      };
    }),
    [edges, resolvedNodes],
  );

  const defaultEdgeOptions = useMemo(
    () => ({ style: { stroke: "#5a5347", strokeWidth: 1.25, opacity: 0.85 } }),
    [],
  );

  useEffect(() => {
    if (resolvedNodes.length === 0) return;
    const timer = setTimeout(() => {
      reactFlow.fitView({
        padding: 0.12,
        duration: 280,
        nodes: resolvedNodes.filter((n) => n.type !== "overviewSection"),
      });
    }, 60);
    return () => clearTimeout(timer);
  }, [resolvedNodes, reactFlow]);

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === "overviewSection" || node.type === "sectionAnchor") return;
      const target = resolveOverviewNodeNavigation(node);
      if (!target) return;
      setBiomeCanvasMode("tabs");
      switchBiomeSection(target.sectionKey);
      if (target.originalNodeId) {
        setSelectedNodeId(target.originalNodeId);
      }
    },
    [setBiomeCanvasMode, setSelectedNodeId, switchBiomeSection],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type !== "sectionAnchor") return;
      const target = resolveOverviewNodeNavigation(node);
      if (!target) return;
      setBiomeCanvasMode("tabs");
      switchBiomeSection(target.sectionKey);
    },
    [setBiomeCanvasMode, switchBiomeSection],
  );

  if (!biomeSections || resolvedNodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-tn-text-muted">
        No biome graph sections to show in overview.
      </div>
    );
  }

  return (
    <div className="relative h-full w-full biome-overview-canvas">
      <div className="absolute left-3 top-3 z-10 flex max-w-sm items-start gap-2 rounded-lg border border-tn-border/80 bg-tn-panel/95 px-3 py-2 shadow-lg backdrop-blur-sm">
        <Map className="mt-0.5 h-3.5 w-3.5 shrink-0 text-tn-accent" aria-hidden />
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-tn-text">
            Biome overview
            {sectionLegend.length > 0 ? ` · ${sectionLegend.length} sections` : ""}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] leading-snug text-tn-text-muted">
            <MousePointerClick className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
            Click an anchor to open its section · double-click other nodes
          </p>
        </div>
      </div>

      {sectionLegend.length > 1 && (
        <div className="absolute bottom-3 right-3 z-10 flex flex-wrap justify-end gap-1.5 rounded-lg border border-tn-border/80 bg-tn-panel/92 px-2.5 py-2 shadow-lg backdrop-blur-sm">
          {sectionLegend.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setBiomeCanvasMode("tabs");
                switchBiomeSection(item.key);
              }}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium text-tn-text-muted transition-colors hover:bg-white/5 hover:text-tn-text"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: item.color, boxShadow: `0 0 6px ${item.color}66` }}
              />
              {item.label}
            </button>
          ))}
        </div>
      )}

      <ReactFlow
        className="biome-overview-flow"
        nodes={resolvedNodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        panOnScroll
        zoomOnScroll
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#342f2a" />
        <Controls showInteractive={false} className="biome-overview-controls" />
        <MiniMap
          nodeColor={getOverviewNodeColor}
          pannable
          zoomable
          className="biome-overview-minimap"
          maskColor="rgba(20, 18, 16, 0.72)"
        />
      </ReactFlow>
    </div>
  );
}

export const BiomeOverviewCanvas = memo(function BiomeOverviewCanvas() {
  return (
    <ReactFlowProvider>
      <BiomeOverviewCanvasInner />
    </ReactFlowProvider>
  );
});
