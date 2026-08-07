import { useEffect } from "react";
import { isTauriRuntime } from "@/utils/platform";

/**
 * Bridge between the native menu and the app.
 *
 * The Rust side (`src-tauri/src/menu.rs`) knows only ids; everything an item
 * *does* lives here, so adding a menu entry never means touching command
 * wiring. Ids are duplicated in both files deliberately — a test asserts every
 * id below has a handler, which is what stops the two drifting apart.
 */

export const MENU_EVENT = "menu://action";

/** Must match `menu::ids` in src-tauri/src/menu.rs. */
export const MENU_ACTIONS = [
  "app.settings",
  "file.new-project",
  "file.create-pack",
  "file.open",
  "file.save",
  "file.save-as",
  "file.export-svg",
  "file.close-project",
  "view.toggle-left-panel",
  "view.toggle-right-panel",
  "view.toggle-grid",
  "view.toggle-minimap",
  "help.documentation",
  "help.getting-started",
  "help.report-bug",
  "help.changelog",
] as const;

export type MenuAction = (typeof MENU_ACTIONS)[number];

export function isMenuAction(value: unknown): value is MenuAction {
  return typeof value === "string" && (MENU_ACTIONS as readonly string[]).includes(value);
}

/**
 * Handlers for the actions available in the current context.
 *
 * Partial by design: Home has no Save, the editor has no Create Pack. An action
 * with no handler is ignored rather than throwing — the corresponding item is
 * also disabled natively via `set_menu_project_open`, so this is only a guard
 * against the two falling briefly out of step.
 */
export type MenuHandlers = Partial<Record<MenuAction, () => void>>;

/**
 * Subscribes to native menu events for as long as the component is mounted.
 *
 * Tauri's `listen` resolves asynchronously, so the unlisten function can arrive
 * after unmount; the `cancelled` flag makes sure a late subscription is torn
 * down rather than leaking.
 */
export function useAppMenu(handlers: MenuHandlers): void {
  useEffect(() => {
    if (!isTauriRuntime()) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void (async () => {
      try {
        const ev = await import("@tauri-apps/api/event");
        const off = await ev.listen<string>(MENU_EVENT, (event) => {
          const action = event.payload;
          if (!isMenuAction(action)) return;
          handlers[action]?.();
        });
        if (cancelled) off();
        else unlisten = off;
      } catch {
        // A missing menu must not take the app down.
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [handlers]);
}

/** Greys out File items that need an open project. */
export async function setMenuProjectOpen(open: boolean): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_menu_project_open", { open });
  } catch {
    // Menu state is cosmetic; never surface a failure here.
  }
}
