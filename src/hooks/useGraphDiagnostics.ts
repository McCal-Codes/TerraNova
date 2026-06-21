import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/stores/editorStore";
import { useDiagnosticsStore } from "@/stores/diagnosticsStore";
import { useProjectStore } from "@/stores/projectStore";
import { analyzeGraph, analyzeBiome } from "@/utils/graphDiagnostics";
import { analyzeNoiseRange } from "@/utils/biomeRangeDiagnostics";
import { listProjectBiomes } from "@/utils/propSources/listProjectBiomes";
import { useSettingsStore } from "@/stores/settingsStore";
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
  const channel = useSettingsStore((s) => s.hytaleAssetSourceChannel);
  const { nodes, edges, biomeConfig, editingContext, biomeRanges, noiseRangeConfig } = useEditorStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      biomeConfig: s.biomeConfig,
      editingContext: s.editingContext,
      biomeRanges: s.biomeRanges,
      noiseRangeConfig: s.noiseRangeConfig,
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
  const [projectBiomeNames, setProjectBiomeNames] = useState<string[]>([]);

  useEffect(() => {
    if (editingContext !== "NoiseRange") {
      setProjectBiomeNames([]);
      return;
    }
    let cancelled = false;
    void listProjectBiomes(projectPath, currentFile)
      .then((entries) => {
        if (!cancelled) setProjectBiomeNames(entries.map((e) => e.name));
      })
      .catch(() => {
        if (!cancelled) setProjectBiomeNames([]);
      });
    return () => {
      cancelled = true;
    };
  }, [editingContext, projectPath, currentFile]);

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
      .catch((err: unknown) => {
        if (disposed) return;
        console.warn("[TerraNova] Asset validation lookup failed:", err);
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
      const graphDiags = analyzeGraph(nodes, edges, knownAssetNames, channel);
      const normalizedPath = currentFile?.replace(/\\/g, "/") ?? "";
      const isBiomeFile = /\/Biomes\//i.test(normalizedPath);
      const shouldAnalyzeBiome = editingContext === "Biome" || isBiomeFile;
      const biomeDiags = shouldAnalyzeBiome
        ? analyzeBiome(
          biomeConfig as unknown as Record<string, unknown> | null,
          knownAssetNames,
        )
        : [];
      const noiseRangeDiags =
        editingContext === "NoiseRange"
          ? analyzeNoiseRange({
            biomeRanges,
            noiseRangeConfig,
            projectBiomeNames,
          })
          : [];
      setDiagnostics([...noiseRangeDiags, ...biomeDiags, ...graphDiags]);
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [nodes, edges, biomeConfig, editingContext, biomeRanges, noiseRangeConfig, projectBiomeNames, currentFile, knownAssetNames, channel, setDiagnostics]);
}
