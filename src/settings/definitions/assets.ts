import { useSettingsStore, type HytaleAssetSourceChannel } from "@/stores/settingsStore";
import { defineSetting, type AnySettingDefinition } from "../types";

const s = () => useSettingsStore.getState();

export const ASSETS_SETTINGS: AnySettingDefinition[] = [
  defineSetting<HytaleAssetSourceChannel>({
    id: "assets.sourceChannel",
    storeKey: "hytaleAssetSourceChannel",
    category: "assets",
    section: "source",
    label: "Asset channel",
    description: "Which Hytale build the asset cache is populated from.",
    defaultValue: "release",
    scopes: ["user"],
    searchTerms: ["channel", "prerelease", "pre-release", "release", "branch"],
    control: {
      kind: "radio",
      options: [
        { value: "release", label: "Release", description: "Stable published assets", badge: "Default" },
        { value: "pre-release", label: "Pre-release", description: "Early builds; may change without notice" },
      ],
    },
    read: () => s().hytaleAssetSourceChannel,
    write: (value) => s().setHytaleAssetSourceChannel(value),
  }),

  defineSetting<string>({
    id: "assets.releasePath",
    storeKey: "hytaleReleaseAssetsPath",
    category: "assets",
    section: "source",
    label: "Release assets folder",
    defaultValue: "",
    scopes: ["user"],
    searchTerms: ["asset path", "source folder", "release"],
    control: { kind: "path", mode: "directory", placeholder: "Detected automatically" },
    read: () => s().hytaleReleaseAssetsPath,
    write: (value) => s().setHytaleReleaseAssetsPath(value),
  }),

  defineSetting<string>({
    id: "assets.preReleasePath",
    storeKey: "hytalePreReleaseAssetsPath",
    category: "assets",
    section: "source",
    label: "Pre-release assets folder",
    defaultValue: "",
    scopes: ["user"],
    searchTerms: ["asset path", "source folder", "prerelease", "pre-release"],
    control: { kind: "path", mode: "directory", placeholder: "Detected automatically" },
    read: () => s().hytalePreReleaseAssetsPath,
    write: (value) => s().setHytalePreReleaseAssetsPath(value),
  }),

  defineSetting<boolean>({
    id: "assets.commonEnabled",
    storeKey: "hytaleCommonAssetsEnabled",
    category: "assets",
    section: "overlay",
    label: "Use common assets overlay",
    description: "Layer shared assets on top of the selected channel.",
    defaultValue: true,
    scopes: ["user"],
    searchTerms: ["common", "overlay", "shared assets"],
    control: { kind: "toggle" },
    read: () => s().hytaleCommonAssetsEnabled,
    write: (value) => s().setHytaleCommonAssetsEnabled(value),
  }),

  defineSetting<string>({
    id: "assets.commonPath",
    storeKey: "hytaleCommonAssetsPath",
    category: "assets",
    section: "overlay",
    label: "Common assets folder",
    defaultValue: "",
    scopes: ["user"],
    searchTerms: ["common", "overlay", "shared assets", "path"],
    control: { kind: "path", mode: "directory", placeholder: "Detected automatically" },
    read: () => s().hytaleCommonAssetsPath,
    write: (value) => s().setHytaleCommonAssetsPath(value),
  }),

  defineSetting<boolean>({
    id: "assets.autoStalenessCheck",
    storeKey: "hytaleAssetSyncEnabled",
    category: "assets",
    section: "sync",
    label: "Check for stale assets automatically",
    description: "Compare the cache against its source when the app starts.",
    defaultValue: false,
    scopes: ["user"],
    searchTerms: ["asset cache", "sync", "stale", "out of date", "refresh"],
    control: { kind: "toggle" },
    read: () => s().hytaleAssetSyncEnabled,
    write: (value) => s().setHytaleAssetSyncEnabled(value),
  }),
];
