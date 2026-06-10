import { slugifyPackIdentifier, type AtmosphereMode } from "@/data/packWizardTemplates";

const STORAGE_KEY = "tn-pack-wizard-prefs";

export type PackWizardUIMode = "simple" | "advanced";

function normalizeUiMode(value: unknown): PackWizardUIMode | undefined {
  if (value === "simple") return "simple";
  // Legacy guided toggle → advanced
  if (value === "advanced" || value === "guided") return "advanced";
  return undefined;
}

export interface PackWizardPreferences {
  packGroup?: string;
  targetDir?: string;
  uiMode?: PackWizardUIMode;
  atmosphereMode?: AtmosphereMode;
  atmosphereImportId?: string;
}

function normalizeAtmosphereMode(value: unknown): AtmosphereMode | undefined {
  if (value === "default" || value === "custom" || value === "import") return value;
  return undefined;
}

export function suggestBiomeNameFromPack(packName: string): string {
  const base = slugifyPackIdentifier(packName);
  if (/biome$/i.test(base)) return base;
  if (/pack$/i.test(base)) {
    const stem = base.replace(/_?pack$/i, "");
    return stem ? `${stem}Biome` : "MyBiome";
  }
  return `${base}Biome`;
}

export function loadPackWizardPreferences(): Partial<PackWizardPreferences> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PackWizardPreferences>;
    return {
      packGroup: typeof parsed.packGroup === "string" ? parsed.packGroup : undefined,
      targetDir: typeof parsed.targetDir === "string" ? parsed.targetDir : undefined,
      uiMode: normalizeUiMode(parsed.uiMode),
      atmosphereMode: normalizeAtmosphereMode(parsed.atmosphereMode),
      atmosphereImportId:
        typeof parsed.atmosphereImportId === "string" ? parsed.atmosphereImportId : undefined,
    };
  } catch {
    return {};
  }
}

export function savePackWizardPreferences(prefs: Partial<PackWizardPreferences>): void {
  try {
    const merged: PackWizardPreferences = {
      ...loadPackWizardPreferences(),
      ...prefs,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // ignore quota errors
  }
}
