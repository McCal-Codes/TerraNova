import { useEffect } from "react";
import { useAccountStore, preferredPlayerUuid } from "@/stores/accountStore";
import { useBridgeStore } from "@/stores/bridgeStore";
import { usePreviewStore } from "@/stores/previewStore";
import { useProjectStore } from "@/stores/projectStore";
import { bridgeDiscover } from "@/utils/ipc";
import { isTauriRuntime } from "@/utils/platform";
import {
  modPackPathFromProject,
  resolveBridgeDiscoveryHints,
} from "@/utils/resolveBridgeSaveContext";
import { setLastBridgeSaveName } from "@/utils/hytaleSavePaths";
import { tryBridgeAutoConnect } from "@/utils/bridgeAutoConnect";
import {
  applyLivePlayerToPreview,
  livePlayerFromDiscovery,
} from "@/utils/livePlayerTracking";

const POLL_MS = 3000;

/**
 * Discovers Bridge from the configured mod pack path (or open project under Saves/.../mods).
 */
export function useBridgeDiscovery() {
  const connected = useBridgeStore((s) => s.connected);
  const host = useBridgeStore((s) => s.host);
  const port = useBridgeStore((s) => s.port);
  const serverModPath = useBridgeStore((s) => s.serverModPath);
  const projectPath = useProjectStore((s) => s.projectPath);

  // Open project that is a save mod pack → set Bridge server mod path automatically
  useEffect(() => {
    if (!isTauriRuntime() || !projectPath) return;
    const linked = modPackPathFromProject(projectPath);
    if (!linked) return;
    const current = useBridgeStore.getState().serverModPath;
    if (!current || current !== linked) {
      useBridgeStore.getState().setServerModPath(linked);
    }
  }, [projectPath]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let cancelled = false;

    async function runDiscovery() {
      const store = useBridgeStore.getState();
      const hints = resolveBridgeDiscoveryHints(
        store.serverModPath,
        useProjectStore.getState().projectPath,
      );

      store.setDiscovery(store.discovery, true);

      try {
        const modPackPath =
          hints.modPackPath ?? (store.serverModPath ? store.serverModPath : undefined);
        const result = await bridgeDiscover({
          saveName: hints.saveName,
          saveRoot: hints.saveRoot,
          modPackPath,
          host: store.host,
          port: store.port,
          preferredPlayerUuid: preferredPlayerUuid(useAccountStore.getState()),
        });
        if (cancelled) return;

        store.setDiscovery(result, false);
        if (result.saveName) {
          setLastBridgeSaveName(result.saveName);
        }

        const suggested =
          result.suggestedModPackPath ?? result.bridgeModPackPath;
        if (!store.serverModPath && suggested) {
          store.setServerModPath(suggested);
        }

        if (result.authTokenFromConfig && !store.authToken && result.portOpen && result.bridgeVersion) {
          store.setConnectionConfig(store.host, store.port, result.authTokenFromConfig);
        }

        const live = livePlayerFromDiscovery(result);
        if (live) {
          const preview = usePreviewStore.getState();
          applyLivePlayerToPreview(live, {
            follow: preview.worldFollowPlayer,
          });
        }

        if (!store.connected) {
          await tryBridgeAutoConnect(result);
        }
      } catch (err) {
        if (cancelled) return;
        store.setDiscovery(
          {
            portOpen: false,
            saveName: hints.saveName ?? "",
            modPackPath: hints.modPackPath,
            modPackFolder: hints.modPackPath?.split(/[/\\]/).pop(),
            error: String(err),
          },
          false,
        );
      }
    }

    void runDiscovery();
    const interval = setInterval(() => void runDiscovery(), POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [connected, host, port, serverModPath, projectPath]);
}
