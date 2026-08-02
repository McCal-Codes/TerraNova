/**
 * Restore navigation session on app mount.
 *
 * Phase 1 (useSessionRestore): Restores projectPath so ProjectEditor renders.
 * Phase 2 (useSessionRestoreFile): Once inside ReactFlowProvider, opens the
 * previously active file and biome section.
 */

import { useEffect, useRef } from "react";
import { loadSession, clearSession, updateSession } from "@/utils/sessionPersist";
import { useProjectStore } from "@/stores/projectStore";
import { useRecentProjectsStore } from "@/stores/recentProjectsStore";
import { useEditorStore } from "@/stores/editorStore";
import { useToastStore } from "@/stores/toastStore";
import { listDirectory } from "@/utils/ipc";
import mapDirEntry from "@/utils/mapDirEntry";
import { getRestoreLastProject } from "@/utils/startupPrefs";

interface UseSessionRestoreOptions {
  /** Called when phase-1 restore finishes (success or failure). */
  onBootComplete?: () => void;
}

function markSessionRestoreReady(onBootComplete?: () => void): void {
  useProjectStore.getState().setSessionRestoreReady(true);
  onBootComplete?.();
}

/**
 * Phase 1: Call in App component. Restores projectPath + directory tree
 * so the editor mounts instead of the home screen.
 */
export function useSessionRestore(options?: UseSessionRestoreOptions): void {
  const onBootCompleteRef = useRef(options?.onBootComplete);
  onBootCompleteRef.current = options?.onBootComplete;
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const finishBoot = () => markSessionRestoreReady(onBootCompleteRef.current);

    // Only attempt restore when starting fresh (no project already loaded)
    if (useProjectStore.getState().projectPath !== null) {
      finishBoot();
      return;
    }

    // Opt-in (general.restoreLastProject, off by default): otherwise land on
    // Home and let the user choose, rather than evaluating the previous pack
    // before they have asked for anything.
    if (!getRestoreLastProject()) {
      finishBoot();
      return;
    }

    const session = loadSession();
    if (!session.projectPath) {
      finishBoot();
      return;
    }

    (async () => {
      try {
        useProjectStore.getState().setProjectPath(session.projectPath);
        const entries = await listDirectory(session.projectPath!);
        useProjectStore.getState().setDirectoryTree(entries.map(mapDirEntry));
        useRecentProjectsStore.getState().addProject(session.projectPath!);
      } catch {
        clearSession();
        useProjectStore.getState().reset();
        useToastStore.getState().addToast(
          "Could not restore your last project. The folder may have moved or been removed.",
          "warning",
          undefined,
          "Session restore",
        );
      } finally {
        finishBoot();
      }
    })();
  }, []);
}

/**
 * Phase 2: Call inside ProjectEditor (within ReactFlowProvider).
 * Opens the previously active file using the provided openFile callback.
 */
export function useSessionRestoreFile(
  openFile: (filePath: string) => Promise<void>,
): void {
  const openFileRef = useRef(openFile);
  openFileRef.current = openFile;

  const ranRef = useRef(false);
  const sessionRestoreReady = useProjectStore((s) => s.sessionRestoreReady);

  useEffect(() => {
    if (ranRef.current) return;
    if (!sessionRestoreReady) return;

    ranRef.current = true;

    const session = loadSession();
    if (!session.currentFile) return;

    const timer = setTimeout(async () => {
      try {
        await openFileRef.current(session.currentFile!);

        if (session.activeBiomeSection) {
          const { biomeSections, switchBiomeSection } = useEditorStore.getState();
          if (biomeSections && session.activeBiomeSection in biomeSections) {
            switchBiomeSection(session.activeBiomeSection);
          }
        }
      } catch {
        updateSession({ currentFile: null });
        useToastStore.getState().addToast(
          "Could not reopen your last file. Pick a file from the project tree.",
          "warning",
          undefined,
          "Session restore",
        );
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [sessionRestoreReady]);
}
