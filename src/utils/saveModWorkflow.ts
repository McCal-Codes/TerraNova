import { useBridgeStore } from "@/stores/bridgeStore";
import { useProjectStore } from "@/stores/projectStore";
import { useRecentProjectsStore } from "@/stores/recentProjectsStore";
import { usePreviewStore } from "@/stores/previewStore";
import { listDirectory } from "@/utils/ipc";
import mapDirEntry from "@/utils/mapDirEntry";

/** Set Bridge server mod path to a pack root (contains Server/). */
export function linkModPackToBridge(packRoot: string): string {
  useBridgeStore.getState().setServerModPath(packRoot);
  return packRoot;
}

/**
 * Open any save mod pack folder as the TerraNova project and link Bridge to the same path.
 */
export async function openSaveModPackByPath(
  packRoot: string,
  openFile?: (filePath: string) => Promise<void>,
  starterRelative?: string,
): Promise<string> {
  linkModPackToBridge(packRoot);
  useProjectStore.getState().setProjectPath(packRoot);
  const entries = await listDirectory(packRoot);
  useProjectStore.getState().setDirectoryTree(entries.map(mapDirEntry));
  useRecentProjectsStore.getState().addProject(packRoot);

  if (openFile && starterRelative) {
    const sep = packRoot.includes("\\") ? "\\" : "/";
    const biomePath = [packRoot.replace(/[/\\]+$/, ""), ...starterRelative.split(/[/\\]/)]
      .filter(Boolean)
      .join(sep);
    try {
      await openFile(biomePath);
    } catch {
      // Pack layout may differ; project tree still opens.
    }
  }

  if (useBridgeStore.getState().connected) {
    usePreviewStore.getState().setMode("world");
  }

  return packRoot;
}
