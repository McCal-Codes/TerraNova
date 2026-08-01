import { getWhatsNewSuppressed, setWhatsNewSuppressed } from "@/utils/whatsNewPrefs";
import { defineSetting, type AnySettingDefinition } from "../types";

export const GENERAL_SETTINGS: AnySettingDefinition[] = [
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
