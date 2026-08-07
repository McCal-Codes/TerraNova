import { getAutoRecoverWebview, setAutoRecoverWebview } from "@/utils/startupPrefs";
import { useSettingsStore } from "@/stores/settingsStore";
import { defineSetting, type AnySettingDefinition } from "../types";

const s = () => useSettingsStore.getState();

export const DEVELOPER_SETTINGS: AnySettingDefinition[] = [
  // Not devOnly — this is the gate itself, so it must stay reachable when
  // developer mode is off.
  defineSetting<boolean>({
    id: "developer.mode",
    storeKey: "developerMode",
    category: "developer",
    section: "mode",
    label: "Developer mode",
    description: "Show developer tools, diagnostics and experimental features.",
    defaultValue: false,
    scopes: ["user"],
    searchTerms: ["dev mode", "debug", "advanced", "diagnostics"],
    control: { kind: "toggle" },
    read: () => s().developerMode,
    write: (value) => s().setDeveloperMode(value),
  }),

  defineSetting<boolean>({
    id: "developer.autoEnableInDev",
    storeKey: "autoEnableDeveloperModeInDev",
    category: "developer",
    section: "mode",
    label: "Enable automatically in dev builds",
    description: "Turn developer mode on when running a development build.",
    defaultValue: true,
    scopes: ["user"],
    searchTerms: ["dev mode", "automatic", "development build"],
    devOnly: true,
    control: { kind: "toggle" },
    read: () => s().autoEnableDeveloperModeInDev,
    write: (value) => s().setAutoEnableDeveloperModeInDev(value),
  }),

  defineSetting<boolean>({
    id: "developer.showDevToolsDock",
    storeKey: "showDevToolsDock",
    category: "developer",
    section: "tools",
    label: "Show dev tools dock",
    defaultValue: false,
    scopes: ["user"],
    searchTerms: ["dock", "panel", "dev tools", "overlay"],
    devOnly: true,
    control: { kind: "toggle" },
    read: () => s().showDevToolsDock,
    write: (value) => s().setShowDevToolsDock(value),
  }),

  // Not devOnly: this is the escape hatch if the watchdog ever reloads during
  // legitimate long-running work, so it must be reachable without dev mode.
  defineSetting<boolean>({
    id: "developer.autoRecoverWebview",
    category: "developer",
    section: "diagnostics",
    label: "Recover automatically from a blank window",
    description:
      "Reload the view if the interface stops responding for 20 seconds. Reloads at most twice per session and always writes to the crash log.",
    defaultValue: true,
    scopes: ["user"],
    searchTerms: ["blank", "white screen", "hang", "freeze", "recover", "reload", "watchdog"],
    control: { kind: "toggle" },
    read: () => getAutoRecoverWebview(),
    write: (value) => setAutoRecoverWebview(value),
  }),

  defineSetting<boolean>({
    id: "developer.debugWorkerLogging",
    storeKey: "debugWorkerLogging",
    category: "developer",
    section: "diagnostics",
    label: "Verbose worker logging",
    description: "Log worker messages to the console. Noisy; slows evaluation.",
    defaultValue: false,
    scopes: ["user"],
    searchTerms: ["worker logging", "verbose", "console", "debug", "diagnostics"],
    devOnly: true,
    control: { kind: "toggle" },
    read: () => s().debugWorkerLogging,
    write: (value) => s().setDebugWorkerLogging(value),
  }),
];
