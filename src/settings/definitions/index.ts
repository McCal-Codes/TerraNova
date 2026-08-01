import { registerSettings } from "../registry";
import { ASSETS_SETTINGS } from "./assets";
import { DEVELOPER_SETTINGS } from "./developer";
import { EDITOR_SETTINGS } from "./editor";
import { FILES_SETTINGS } from "./files";
import { GENERAL_SETTINGS } from "./general";
import { PERFORMANCE_SETTINGS } from "./performance";
import { SHORTCUTS_SETTINGS } from "./shortcuts";
import { UPDATES_SETTINGS } from "./updates";

/**
 * Single registration point. Import this module once (from the settings entry
 * point) so the registry is populated before any consumer reads it.
 */
export function registerAllSettings(): void {
  registerSettings([
    ...GENERAL_SETTINGS,
    ...EDITOR_SETTINGS,
    ...PERFORMANCE_SETTINGS,
    ...FILES_SETTINGS,
    ...ASSETS_SETTINGS,
    ...SHORTCUTS_SETTINGS,
    ...DEVELOPER_SETTINGS,
    ...UPDATES_SETTINGS,
  ]);
}

export {
  ASSETS_SETTINGS,
  GENERAL_SETTINGS,
  DEVELOPER_SETTINGS,
  EDITOR_SETTINGS,
  FILES_SETTINGS,
  PERFORMANCE_SETTINGS,
  SHORTCUTS_SETTINGS,
  UPDATES_SETTINGS,
};
