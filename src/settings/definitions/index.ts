import { clearRegistry, registerSettings } from "../registry";
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
 *
 * Idempotent by design. Vite re-evaluates this module on every HMR update that
 * touches src/settings, so a non-idempotent version throws "Duplicate setting
 * id" during module evaluation — which stops React re-rendering and presents as
 * the whole app freezing mid-session. Clearing first keeps duplicate detection
 * meaningful (two definitions sharing an id in one pass still throw) while
 * surviving re-evaluation.
 */
export function registerAllSettings(): void {
  clearRegistry();
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
