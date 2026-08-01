import { useCallback, useSyncExternalStore } from "react";
import { useConfigStore } from "@/stores/configStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { isModified, resetSetting, type AnySettingDefinition, type SettingDefinition } from "./registry";

/**
 * Definitions reach values imperatively through `read()`/`write()`, which is
 * what keeps them decoupled from React. This hook is the bridge: it subscribes
 * to the stores a definition might read from and re-renders on change.
 *
 * Subscribing to both stores rather than tracking ownership per definition is
 * deliberate — a settings panel re-rendering on an unrelated settings change is
 * free, and it removes a field that would otherwise need to stay in sync.
 */
function subscribeToStores(onChange: () => void): () => void {
  const unsubSettings = useSettingsStore.subscribe(onChange);
  const unsubConfig = useConfigStore.subscribe(onChange);
  return () => {
    unsubSettings();
    unsubConfig();
  };
}

/**
 * `read()` returns the store's own value, so object-valued settings keep a
 * stable reference between writes and `useSyncExternalStore` stays happy.
 */
export function useSettingValue<T>(def: SettingDefinition<T>): T {
  const getSnapshot = useCallback(() => def.read(), [def]);
  return useSyncExternalStore(subscribeToStores, getSnapshot, getSnapshot);
}

export interface BoundSetting<T> {
  value: T;
  setValue: (value: T) => void;
  modified: boolean;
  reset: () => void;
  /** Validation message for the current value, or null. */
  error: string | null;
}

export function useSetting<T>(def: SettingDefinition<T>): BoundSetting<T> {
  const value = useSettingValue(def);
  const setValue = useCallback((next: T) => def.write(next), [def]);
  const reset = useCallback(() => resetSetting(def as AnySettingDefinition), [def]);
  return {
    value,
    setValue,
    modified: isModified(def as AnySettingDefinition),
    reset,
    error: def.validate?.(value) ?? null,
  };
}

/** Number of settings currently differing from their default, for the rail badge. */
export function useModifiedCount(defs: readonly AnySettingDefinition[]): number {
  const getSnapshot = useCallback(() => defs.filter(isModified).length, [defs]);
  return useSyncExternalStore(subscribeToStores, getSnapshot, getSnapshot);
}
