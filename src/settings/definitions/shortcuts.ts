import { useSettingsStore } from "@/stores/settingsStore";
import { defineSetting, type AnySettingDefinition } from "../types";

const s = () => useSettingsStore.getState();

export const SHORTCUTS_SETTINGS: AnySettingDefinition[] = [
  defineSetting<Record<string, string>>({
    id: "shortcuts.keybindingOverrides",
    storeKey: "keybindingOverrides",
    category: "shortcuts",
    section: "keybindings",
    label: "Keyboard shortcuts",
    description: "Custom key bindings that differ from the defaults.",
    defaultValue: {},
    scopes: ["user"],
    searchTerms: ["keybinding", "hotkey", "shortcut", "key", "remap"],
    control: { kind: "panel" },
    deepLink: { category: "shortcuts" },
    read: () => s().keybindingOverrides,
    // Reset semantics: writing `{}` clears every override, which is exactly
    // what the store's resetAllKeybindings does.
    write: (value) => {
      if (Object.keys(value).length === 0) {
        s().resetAllKeybindings();
        return;
      }
      for (const [id, key] of Object.entries(value)) s().setKeybindingOverride(id, key);
    },
  }),
];
