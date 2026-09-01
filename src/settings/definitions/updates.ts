import { useSettingsStore } from "@/stores/settingsStore";
import { defineSetting, type AnySettingDefinition } from "../types";

const s = () => useSettingsStore.getState();

export const UPDATES_SETTINGS: AnySettingDefinition[] = [
  defineSetting<boolean>({
    id: "updates.autoCheck",
    storeKey: "autoCheckUpdates",
    category: "updates",
    section: "checking",
    label: "Check for updates automatically",
    description: "Look for a newer version when the app starts.",
    defaultValue: true,
    scopes: ["user"],
    searchTerms: ["update", "auto update", "version check", "upgrade"],
    control: { kind: "toggle" },
    read: () => s().autoCheckUpdates,
    write: (value) => s().setAutoCheckUpdates(value),
  }),
];
