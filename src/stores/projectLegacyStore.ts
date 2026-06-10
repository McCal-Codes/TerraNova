import { create } from "zustand";
import { readAssetFile } from "@/utils/ipc";
import { normalizePath } from "@/utils/pathUtils";
import {
  isHytaleGeneratorAssetPath,
  overlayEditorHitsForFile,
  scanEditorNodesForLegacyHits,
  scanProjectForLegacyNodes,
  type ProjectLegacyHit,
} from "@/utils/projectLegacyScanner";
import { useEditorStore } from "./editorStore";
import { useProjectStore } from "./projectStore";
import { on } from "./storeEvents";

interface ProjectLegacyState {
  hits: ProjectLegacyHit[];
  hitCountByFile: Map<string, number>;
  busy: boolean;
  scan: () => Promise<void>;
  applyOpenFileHits: (filePath: string, hits: ProjectLegacyHit[]) => void;
  clear: () => void;
  fileHasLegacyHits: (path: string) => boolean;
  getFileHitCount: (path: string) => number;
}

function overlayOpenFileEditorHits(hits: ProjectLegacyHit[]): ProjectLegacyHit[] {
  const { currentFile } = useProjectStore.getState();
  if (!currentFile || !isHytaleGeneratorAssetPath(currentFile)) return hits;
  const editorHits = scanEditorNodesForLegacyHits(currentFile, useEditorStore.getState().nodes);
  return overlayEditorHitsForFile(hits, currentFile, editorHits);
}

function buildHitCountByFile(hits: ProjectLegacyHit[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const hit of hits) {
    const key = normalizePath(hit.file).toLowerCase();
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

let pendingRescan = false;

export const useProjectLegacyStore = create<ProjectLegacyState>((set, get) => ({
  hits: [],
  hitCountByFile: new Map(),
  busy: false,

  clear: () => set({ hits: [], hitCountByFile: new Map(), busy: false }),

  fileHasLegacyHits: (path) => (get().hitCountByFile.get(normalizePath(path).toLowerCase()) ?? 0) > 0,

  getFileHitCount: (path) => get().hitCountByFile.get(normalizePath(path).toLowerCase()) ?? 0,

  applyOpenFileHits: (filePath, editorHits) => {
    const merged = overlayEditorHitsForFile(get().hits, filePath, editorHits);
    set({ hits: merged, hitCountByFile: buildHitCountByFile(merged) });
  },

  scan: async () => {
    const { projectPath, assetFiles } = useProjectStore.getState();
    if (!projectPath || assetFiles.length === 0) {
      get().clear();
      return;
    }

    if (get().busy) {
      pendingRescan = true;
      return;
    }

    set({ busy: true });
    try {
      const diskHits = await scanProjectForLegacyNodes(assetFiles, readAssetFile);
      const hits = overlayOpenFileEditorHits(diskHits);
      set({ hits, hitCountByFile: buildHitCountByFile(hits), busy: false });
    } catch {
      set({ busy: false });
    } finally {
      if (pendingRescan) {
        pendingRescan = false;
        void get().scan();
      }
    }
  },
}));

on("project:close", () => {
  pendingRescan = false;
  useProjectLegacyStore.getState().clear();
});
