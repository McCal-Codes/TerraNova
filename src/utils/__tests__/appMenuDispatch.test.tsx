import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

/**
 * The static test next door proves every menu id has a handler *somewhere in
 * the source*. It cannot prove an event actually reaches one. This exercises
 * the real path: listen → payload → handler.
 */

const listeners = new Map<string, (e: { payload: string }) => void>();
const unlisten = vi.fn();

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (name: string, cb: (e: { payload: string }) => void) => {
    listeners.set(name, cb);
    return unlisten;
  }),
}));
vi.mock("@/utils/platform", () => ({ isTauriRuntime: () => true }));

const { MENU_EVENT, useAppMenu } = await import("@/utils/appMenu");

function emit(action: string) {
  listeners.get(MENU_EVENT)?.({ payload: action });
}

/** renderHook + a tick, since listen() resolves asynchronously. */
async function mount(handlers: Record<string, () => void>) {
  const view = renderHook(() => useAppMenu(handlers));
  await vi.waitFor(() => expect(listeners.has(MENU_EVENT)).toBe(true));
  return view;
}

describe("useAppMenu dispatch", () => {
  beforeEach(() => {
    listeners.clear();
    unlisten.mockClear();
  });

  it("invokes the handler for the emitted action", async () => {
    const onSettings = vi.fn();
    await mount({ "app.settings": onSettings });

    emit("app.settings");
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it("routes each action to its own handler and no other", async () => {
    const settings = vi.fn();
    const newProject = vi.fn();
    await mount({ "app.settings": settings, "file.new-project": newProject });

    emit("file.new-project");
    expect(newProject).toHaveBeenCalledTimes(1);
    expect(settings).not.toHaveBeenCalled();
  });

  it("ignores an action with no handler in this context", async () => {
    // Home has no Save; the event still arrives and must not throw.
    const settings = vi.fn();
    await mount({ "app.settings": settings });

    expect(() => emit("file.save")).not.toThrow();
    expect(settings).not.toHaveBeenCalled();
  });

  it("ignores an unknown id, so a stale build cannot crash the app", async () => {
    const settings = vi.fn();
    await mount({ "app.settings": settings });

    expect(() => emit("file.removed-in-a-later-build")).not.toThrow();
    expect(settings).not.toHaveBeenCalled();
  });

  it("unsubscribes on unmount, so handlers do not leak between screens", async () => {
    const view = await mount({ "app.settings": vi.fn() });
    view.unmount();
    expect(unlisten).toHaveBeenCalled();
  });
});
