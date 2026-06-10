import { bridgeConnect } from "@/utils/ipc";
import type { BridgeDiscovery } from "@/utils/ipc";
import { useBridgeStore } from "@/stores/bridgeStore";
import { safeLocalStorageGetItem, safeLocalStorageSetItem } from "@/utils/safeLocalStorage";
import {
  applyLivePlayerToPreview,
  livePlayerFromDiscovery,
} from "@/utils/livePlayerTracking";

const AUTO_CONNECT_KEY = "tn-bridge-autoConnect";
const FAIL_BACKOFF_MS = 15_000;

let lastAutoConnectFailAt = 0;

export function isBridgeAutoConnectEnabled(): boolean {
  const v = safeLocalStorageGetItem(AUTO_CONNECT_KEY);
  return v !== "0";
}

export function setBridgeAutoConnectEnabled(enabled: boolean): void {
  safeLocalStorageSetItem(AUTO_CONNECT_KEY, enabled ? "1" : "0");
}

/**
 * Connect to loopback Bridge when discovery finds a healthy sidecar and we have a token.
 * Backs off after failures so a bad token does not spam requests.
 */
export async function tryBridgeAutoConnect(
  discovery: BridgeDiscovery,
): Promise<boolean> {
  if (!isBridgeAutoConnectEnabled()) return false;

  const store = useBridgeStore.getState();
  if (store.connected || store.connecting) return store.connected;

  const token = (store.authToken || discovery.authTokenFromConfig || "").trim();
  if (!discovery.portOpen || !token || !discovery.bridgeVersion) {
    return false;
  }

  const now = Date.now();
  if (now - lastAutoConnectFailAt < FAIL_BACKOFF_MS) {
    return false;
  }

  if (!store.authToken && discovery.authTokenFromConfig) {
    store.setConnectionConfig(store.host, store.port, discovery.authTokenFromConfig);
  }

  store.setConnecting(true);
  store.setLastError(null);
  try {
    const status = await bridgeConnect(store.host, store.port, token);
    store.setConnected(true, status);
    const live = livePlayerFromDiscovery(discovery);
    if (live) {
      applyLivePlayerToPreview(live, { follow: true });
    }
    return true;
  } catch (err) {
    lastAutoConnectFailAt = now;
    store.setConnected(false, null);
    store.setLastError(
      `Connect failed: ${err}. Check the auth token matches save bridge/config.json.`,
    );
    return false;
  }
}
