import { lazy, Suspense, useEffect, useCallback } from "react";

import {

  BoxSelect,

  Focus,

  LayoutGrid,

  Map,

  Maximize2,

  Plus,

  Search,

  Sparkles,

  ZoomIn,

} from "lucide-react";

import { useReactFlow } from "@xyflow/react";

import { useTauriIO } from "@/hooks/useTauriIO";

import { useEditorStore } from "@/stores/editorStore";

import { useUIStore } from "@/stores/uiStore";

import { useBridgeStore } from "@/stores/bridgeStore";

const BridgeDialog = lazy(() =>
  import("@/components/dialogs/BridgeDialog").then((m) => ({ default: m.BridgeDialog })),
);

import { useBridgeDiscovery } from "@/hooks/useBridgeDiscovery";

import { saveRef } from "@/utils/saveRef";

import { handleAutoLayout, handleAutoLayoutSelected, handleTidyUp } from "@/utils/layoutActions";

import { ToolbarButton, ToolbarDivider, chromeIconClass } from "@/components/ui/editorChrome";

const iconProps = { className: chromeIconClass, strokeWidth: 2 as const };



export function Toolbar() {
  const bridgeDialogOpen = useBridgeStore((s) => s.dialogOpen);

  useBridgeDiscovery();

  const { saveFile } = useTauriIO();

  const reactFlow = useReactFlow();



  useEffect(() => {

    saveRef.current = saveFile;

    return () => {

      saveRef.current = null;

    };

  }, [saveFile]);



  const selectedCount = useEditorStore(

    useCallback(

      (s: { nodes: { selected?: boolean }[] }) =>

        s.nodes.reduce((count, n) => count + (n.selected ? 1 : 0), 0),

      [],

    ),

  );

  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);

  const graphNodeCount = useEditorStore(

    useCallback(

      (s: { nodes: { type?: string }[] }) =>

        s.nodes.reduce((count, n) => count + (n.type === "comment" || n.type === "frame" ? 0 : 1), 0),

      [],

    ),

  );

  const showMinimap = useUIStore((s) => s.showMinimap);
  const toggleMinimap = useUIStore((s) => s.toggleMinimap);

  function fitGraph() {

    const graphNodes = useEditorStore.getState().nodes.filter(

      (n) => n.type !== "comment" && n.type !== "frame",

    );

    reactFlow.fitView({ nodes: graphNodes, padding: 0.1, duration: 300 });

  }



  function fitSelection() {

    const { nodes, selectedNodeId: currentSelectedNodeId } = useEditorStore.getState();

    const selectedNodes = nodes.filter((n) => n.selected);

    if (selectedNodes.length === 0 && currentSelectedNodeId) {

      const selectedNode = nodes.find((n) => n.id === currentSelectedNodeId);

      if (selectedNode) selectedNodes.push(selectedNode);

    }

    if (selectedNodes.length === 0) return;

    reactFlow.fitView({

      nodes: selectedNodes.map((n) => ({ id: n.id })),

      padding: 0.2,

      duration: 300,

    });

  }



  return (

    <>

      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-tn-border bg-tn-surface/95 px-2">

        <div className="flex items-center gap-0.5">

          <ToolbarButton

            icon={<Plus {...iconProps} />}

            onClick={() => window.dispatchEvent(new Event("terranova:open-quick-add"))}

            title="Quick Add (Tab)"

          >

            Add

          </ToolbarButton>

          <ToolbarButton

            icon={<Search {...iconProps} />}

            onClick={() => window.dispatchEvent(new Event("terranova:open-node-search"))}

            title="Search Nodes (Ctrl+F)"

          >

            Find

          </ToolbarButton>



          <ToolbarDivider />



          <ToolbarButton

            icon={<LayoutGrid {...iconProps} />}

            onClick={() => handleAutoLayout(reactFlow)}

            title="Auto Layout All (L)"

          >

            Layout

          </ToolbarButton>

          <ToolbarButton

            icon={<BoxSelect {...iconProps} />}

            onClick={() => void handleAutoLayoutSelected()}

            disabled={selectedCount < 2}

            title="Auto Layout Selection (Shift+L)"

          >

            Select

          </ToolbarButton>

          <ToolbarButton

            icon={<Sparkles {...iconProps} />}

            onClick={handleTidyUp}

            title="Tidy Up (Ctrl+Shift+L)"

          >

            Tidy

          </ToolbarButton>



          <ToolbarDivider />



          <ToolbarButton

            icon={<Maximize2 {...iconProps} />}

            onClick={fitGraph}

            disabled={graphNodeCount === 0}

            title="Fit View (Ctrl+1)"

          >

            Fit

          </ToolbarButton>

          <ToolbarButton

            icon={<Focus {...iconProps} />}

            onClick={fitSelection}

            disabled={selectedCount === 0 && !selectedNodeId}

            title="Zoom to Selection (Ctrl+2)"

          >

            Focus

          </ToolbarButton>

          <ToolbarButton

            icon={<ZoomIn {...iconProps} />}

            onClick={() => reactFlow.zoomTo(1, { duration: 300 })}

            title="Reset Zoom (Ctrl+0)"

          >

            100%

          </ToolbarButton>

        </div>



        <div className="min-w-2 flex-1" />

        <ToolbarButton

          icon={<Map {...iconProps} />}

          active={showMinimap}

          onClick={toggleMinimap}

          aria-pressed={showMinimap}

          title="Toggle Minimap"

        >

          Minimap

        </ToolbarButton>

      </div>



      {bridgeDialogOpen && (
        <Suspense fallback={null}>
          <BridgeDialog />
        </Suspense>
      )}

    </>

  );

}


