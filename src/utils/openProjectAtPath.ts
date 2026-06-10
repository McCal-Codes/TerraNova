import { useProjectStore } from "@/stores/projectStore";
import { useRecentProjectsStore } from "@/stores/recentProjectsStore";
import { listDirectory } from "@/utils/ipc";
import mapDirEntry from "@/utils/mapDirEntry";

/** Load project path + file tree without alpha backup prompt (caller runs guard first). */
export async function openProjectAtPath(path: string, template?: string): Promise<void> {
  useProjectStore.getState().setProjectPath(path);
  const entries = await listDirectory(path);
  useProjectStore.getState().setDirectoryTree(entries.map(mapDirEntry));
  useRecentProjectsStore.getState().addProject(path, template);
}
