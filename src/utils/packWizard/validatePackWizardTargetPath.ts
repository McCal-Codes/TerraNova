import { listDirectory, pathExists } from "@/utils/ipc";

/** Returns a user-facing error when the pack target folder cannot be used. */
export async function validatePackWizardTargetPath(targetPath: string): Promise<string | null> {
  try {
    if (!(await pathExists(targetPath))) {
      return null;
    }
    const entries = await listDirectory(targetPath);
    if (entries.length > 0) {
      return "That folder already has files. Choose a different pack name or location.";
    }
  } catch {
    return "Could not verify the target folder. Check the location and try again.";
  }
  return null;
}
