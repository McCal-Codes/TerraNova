import { useEffect } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectLegacyStore } from "@/stores/projectLegacyStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import { on, off } from "@/stores/storeEvents";
import {
  isHytaleGeneratorAssetPath,
  scanEditorNodesForLegacyHits,
} from "@/utils/projectLegacyScanner";

/**
 * Keeps project-wide legacy scanner results in sync with project open,
 * asset list changes, saves, validation panel visibility, and in-editor
 * legacy fixes on the open generator JSON (without waiting for save).
 */
export function useProjectLegacyScan() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const assetFiles = useProjectStore((s) => s.assetFiles);
  const currentFile = useProjectStore((s) => s.currentFile);
  const nodes = useEditorStore((s) => s.nodes);
  const validationExpanded = useUIStore((s) => s.sidebarExpanded.validation);
  const scan = useProjectLegacyStore((s) => s.scan);
  const applyOpenFileHits = useProjectLegacyStore((s) => s.applyOpenFileHits);

  useEffect(() => {
    void scan();
  }, [projectPath, assetFiles, scan]);

  useEffect(() => {
    if (!validationExpanded) return;
    void scan();
  }, [validationExpanded, scan]);

  useEffect(() => {
    const handleFileSaved = () => {
      void scan();
    };
    on("project:file-saved", handleFileSaved);
    return () => off("project:file-saved", handleFileSaved);
  }, [scan]);

  useEffect(() => {
    if (!currentFile || !isHytaleGeneratorAssetPath(currentFile)) return;

    const timer = setTimeout(() => {
      applyOpenFileHits(currentFile, scanEditorNodesForLegacyHits(currentFile, nodes));
    }, 300);

    return () => clearTimeout(timer);
  }, [currentFile, nodes, applyOpenFileHits]);
}
