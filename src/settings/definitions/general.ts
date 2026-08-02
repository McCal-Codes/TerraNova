import { getWhatsNewSuppressed, setWhatsNewSuppressed } from "@/utils/whatsNewPrefs";
import { getRestoreLastProject, setRestoreLastProject } from "@/utils/startupPrefs";
import { defineSetting, type AnySettingDefinition } from "../types";

export const GENERAL_SETTINGS: AnySettingDefinition[] = [
  // Defaults to off: launching straight into the last pack means a large
  // project is evaluated before the user has asked for anything, which is slow
  // and gives no way back to Home if that project is what fails to load.
  defineSetting<boolean>({
    id: "general.restoreLastProject",
    category: "general",
    section: "startup",
    label: "Reopen the last project on launch",
    description: "When off, TerraNova opens to Home and you choose what to open.",
    defaultValue: false,
    scopes: ["user"],
    searchTerms: ["startup", "session", "restore", "reopen", "last project", "home", "launch"],
    control: { kind: "toggle" },
    read: () => getRestoreLastProject(),
    write: (value) => setRestoreLastProject(value),
  }),

  // Stored inverted (as "suppressed") by whatsNewPrefs. The registry exposes
  // the positive form because a setting phrased as a negative is a usability
  // trap — "Show … on startup: Off" reads correctly, "Suppress: On" does not.
  // No storeKey: this is backed by whatsNewPrefs, not the settings store.
  defineSetting<boolean>({
    id: "general.showWhatsNewOnStartup",
    category: "general",
    section: "startup",
    label: "Show What's New on startup",
    description: "Show the changelog dialog when a new version is first launched.",
    defaultValue: true,
    scopes: ["user"],
    searchTerms: ["whats new", "what's new", "changelog", "release notes", "startup"],
    control: { kind: "toggle" },
    read: () => !getWhatsNewSuppressed(),
    write: (value) => setWhatsNewSuppressed(!value),
  }),
];
