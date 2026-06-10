import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/stores/editorStore";
import { useDiagnosticsStore } from "@/stores/diagnosticsStore";
import { useProjectStore } from "@/stores/projectStore";
import { analyzeGraph, analyzeBiome } from "@/utils/graphDiagnostics";
import {
  buildAssetValidationBadge,
  type AssetReferenceKind,
  resolveAssetValidationLookup,
} from "@/utils/environmentAssetLookup";

/**
 * Subscribes to editor nodes/edges (and biomeConfig) and runs
 * analyzeGraph() + analyzeBiome() on a 300ms debounce,
 * pushing merged results to the shared diagnosticsStore.
 */
export function useGraphDiagnostics() {
  const { nodes, edges, biomeConfig, editingContext } = useEditorStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      biomeConfig: s.biomeConfig,
      editingContext: s.editingContext,
    })),
  );
  const { currentFile, projectPath } = useProjectStore(
    useShallow((s) => ({
      currentFile: s.currentFile,
      projectPath: s.projectPath,
    })),
  );
  const {
    setDiagnostics,
    setAssetValidationBadge,
    setAssetNamesByKind,
    setAssetPathIndexByKind,
  } = useDiagnosticsStore(
    useShallow((s) => ({
      setDiagnostics: s.setDiagnostics,
      setAssetValidationBadge: s.setAssetValidationBadge,
      setAssetNamesByKind: s.setAssetNamesByKind,
      setAssetPathIndexByKind: s.setAssetPathIndexByKind,
    })),
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [knownAssetNames, setKnownAssetNames] = useState<Record<AssetReferenceKind, string[]> | null>(null);

  useEffect(() => {
    let disposed = false;
    void resolveAssetValidationLookup(currentFile, projectPath)
      .then((lookup) => {
        if (disposed) return;
        setKnownAssetNames(lookup.namesByKind);
        setAssetValidationBadge(lookup.badge);
        setAssetNamesByKind(lookup.namesByKind);
        setAssetPathIndexByKind(lookup.pathIndexByKind);
      })
      .catch(() => {
        if (disposed) return;
        setKnownAssetNames(null);
        setAssetValidationBadge(buildAssetValidationBadge({}));
        setAssetNamesByKind({});
        setAssetPathIndexByKind({});
      });

    return () => {
      disposed = true;
    };
  }, [currentFile, projectPath, setAssetNamesByKind, setAssetPathIndexByKind, setAssetValidationBadge]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const graphDiags = analyzeGraph(nodes, edges, knownAssetNames);
      const normalizedPath = currentFile?.replace(/\\/g, "/") ?? "";
      const isBiomeFile = /\/Biomes\//i.test(normalizedPath);
      const shouldAnalyzeBiome = editingContext === "Biome" || isBiomeFile;
      const biomeDiags = shouldAnalyzeBiome
        ? analyzeBiome(
          biomeConfig as unknown as Record<string, unknown> | null,
          knownAssetNames,
        )
        : [];
      setDiagnostics([...biomeDiags, ...graphDiags]);
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [nodes, edges, biomeConfig, editingContext, currentFile, knownAssetNames, setDiagnostics]);
}
