import { useSettingsStore } from "@/stores/settingsStore";

/** True when explicit developer mode is on, or Vite dev auto-enable is active. */
export function isDeveloperModeActive(
  developerMode: boolean,
  autoEnableDeveloperModeInDev: boolean,
): boolean {
  return developerMode || (import.meta.env.DEV && autoEnableDeveloperModeInDev);
}

export function useDeveloperMode(): boolean {
  const developerMode = useSettingsStore((s) => s.developerMode);
  const autoEnableDeveloperModeInDev = useSettingsStore((s) => s.autoEnableDeveloperModeInDev);
  return isDeveloperModeActive(developerMode, autoEnableDeveloperModeInDev);
}
