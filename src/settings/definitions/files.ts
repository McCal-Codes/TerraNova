import { CLOSED_ALPHA_PACK_BACKUP_ENABLED } from "@/utils/alphaPackBackup";
import { useSettingsStore } from "@/stores/settingsStore";
import { DEFAULT_SVG_EXPORT_SETTINGS, type SvgExportSettings } from "@/utils/exportSvg";
import { defineSetting, type AnySettingDefinition } from "../types";

const s = () => useSettingsStore.getState();

export const FILES_SETTINGS: AnySettingDefinition[] = [
  defineSetting<string | null>({
    id: "files.exportPath",
    storeKey: "exportPath",
    category: "files",
    section: "export",
    label: "Default export folder",
    description: "Where exported files are written unless you choose otherwise.",
    defaultValue: null,
    scopes: ["user", "project"],
    searchTerms: ["export", "output folder", "destination", "save location"],
    control: { kind: "path", mode: "directory", placeholder: "Ask every time" },
    read: () => s().exportPath,
    write: (value) => s().setExportPath(value),
  }),

  defineSetting<SvgExportSettings>({
    id: "files.svgExportSettings",
    storeKey: "svgExportSettings",
    category: "files",
    section: "export",
    label: "SVG export defaults",
    description: "Scope, background, padding and resolution used by the SVG exporter.",
    defaultValue: DEFAULT_SVG_EXPORT_SETTINGS,
    scopes: ["user"],
    searchTerms: ["svg", "vector", "image export", "padding", "resolution", "background"],
    control: { kind: "panel" },
    deepLink: { category: "files", subTab: "export" },
    read: () => s().svgExportSettings,
    write: (value) => s().setSvgExportSettings(value),
  }),

  defineSetting<boolean>({
    id: "files.packBackupPrompt",
    storeKey: "packBackupPromptEnabled",
    category: "files",
    section: "backups",
    label: "Prompt to back up packs",
    description: "Offer a full folder copy when opening an existing pack via Open or Recent.",
    defaultValue: true,
    scopes: ["user"],
    searchTerms: ["backup", "back up", "safety", "copy", "alpha"],
    available: () => CLOSED_ALPHA_PACK_BACKUP_ENABLED,
    control: { kind: "toggle" },
    read: () => s().packBackupPromptEnabled,
    write: (value) => s().setPackBackupPromptEnabled(value),
  }),

  defineSetting<string>({
    id: "files.packBackupParentFolder",
    storeKey: "packBackupParentFolder",
    category: "files",
    section: "backups",
    label: "Backup folder",
    description: "Leave empty to store backups in .terranova-backups next to each pack.",
    defaultValue: "",
    scopes: ["user", "project"],
    searchTerms: ["backup", "back up", "destination", "folder"],
    available: () => CLOSED_ALPHA_PACK_BACKUP_ENABLED,
    control: { kind: "path", mode: "directory", placeholder: "Beside pack (.terranova-backups)" },
    read: () => s().packBackupParentFolder,
    write: (value) => s().setPackBackupParentFolder(value),
  }),
];
