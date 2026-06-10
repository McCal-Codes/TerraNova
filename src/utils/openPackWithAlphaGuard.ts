import { useProjectStore } from "@/stores/projectStore";
import { usePackBackupStore } from "@/stores/packBackupStore";
import { shouldPromptPackBackup } from "@/utils/alphaPackBackup";

/**
 * Closed-alpha guard: optionally prompt to back up a pack before opening.
 * Returns true when the caller should proceed with opening the pack.
 */
export async function confirmOpenPackWithAlphaBackup(packPath: string): Promise<boolean> {
  const normalized = packPath.replace(/[/\\]+$/, "");
  if (!normalized) return false;

  const current = useProjectStore.getState().projectPath;
  if (current && current.replace(/[/\\]+$/, "") === normalized) {
    return true;
  }

  if (!(await shouldPromptPackBackup(normalized))) {
    return true;
  }

  const result = await usePackBackupStore.getState().request(normalized);
  return result.action === "open";
}
