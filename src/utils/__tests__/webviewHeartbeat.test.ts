import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The heartbeat's *absence* is what tells the Rust watchdog the webview is
 * dead, so a heartbeat that silently fails to start would arm an auto-reload
 * with nothing to keep it at bay.
 */

const invoke = vi.fn(async () => undefined);
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

let tauri = true;
vi.mock("@/utils/platform", () => ({ isTauriRuntime: () => tauri }));

const { startWebviewHeartbeat, stopWebviewHeartbeat } = await import("@/utils/webviewHeartbeat");

/**
 * The ping goes through a dynamic import, so each one resolves a few microtasks
 * after its timer fires. advanceTimersByTimeAsync drains those between ticks;
 * the synchronous advanceTimersByTime does not, and the test would race the
 * import rather than the interval.
 */
const flush = () => vi.advanceTimersByTimeAsync(0);

describe("webview heartbeat", () => {
  beforeEach(async () => {
    // Warm the module cache so later imports resolve in a single microtask.
    await import("@tauri-apps/api/core");
    vi.useFakeTimers();
    invoke.mockClear();
    tauri = true;
  });
  afterEach(() => {
    stopWebviewHeartbeat();
    vi.useRealTimers();
  });

  it("pings immediately, without waiting a full interval", async () => {
    startWebviewHeartbeat();
    await flush();
    expect(invoke).toHaveBeenCalledWith("ui_heartbeat");
  });

  it("keeps pinging on an interval below the watchdog's threshold", async () => {
    startWebviewHeartbeat();
    await flush();
    invoke.mockClear();
    await vi.advanceTimersByTimeAsync(9_000);
    // 3s interval — comfortably inside the watchdog's 20s window even if a
    // tick is missed.
    expect(invoke.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("does not start twice, which would double the ping rate", async () => {
    startWebviewHeartbeat();
    startWebviewHeartbeat();
    await flush();
    invoke.mockClear();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("stops when told to", async () => {
    startWebviewHeartbeat();
    await flush();
    stopWebviewHeartbeat();
    invoke.mockClear();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("does nothing in the browser build, where there is no watchdog", async () => {
    tauri = false;
    startWebviewHeartbeat();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(invoke).not.toHaveBeenCalled();
  });
});
