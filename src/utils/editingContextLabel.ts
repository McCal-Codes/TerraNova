import { getBiomeSectionLabel } from "@/utils/biomeSectionUtils";

export interface EditingContextDisplay {
  packName: string | null;
  primary: string;
  section: string | null;
  fileName: string | null;
  relativePath: string | null;
}

const CONTEXT_LABELS: Record<string, string> = {
  Biome: "Biome",
  Density: "Density",
  Curve: "Curve",
  MaterialProvider: "Material",
  Environment: "Environment",
  Weather: "Weather",
  Pattern: "Pattern",
  PositionProvider: "Positions",
  Prop: "Prop",
  Scanner: "Scanner",
  Settings: "Settings",
  Instance: "Instance",
  NoiseRange: "Noise ranges",
  RawJson: "JSON",
};

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? path;
}

function fileStem(fileName: string): string {
  return fileName.replace(/\.(json|bson)$/i, "");
}

function relativeToProject(projectPath: string | null, currentFile: string | null): string | null {
  if (!currentFile) return null;
  if (!projectPath) return currentFile.replace(/\\/g, "/");
  const normProject = projectPath.replace(/\\/g, "/").replace(/\/$/, "");
  const normFile = currentFile.replace(/\\/g, "/");
  if (normFile.toLowerCase().startsWith(normProject.toLowerCase() + "/")) {
    return normFile.slice(normProject.length + 1);
  }
  return normFile;
}

export function formatEditingContextDisplay(input: {
  projectPath: string | null;
  currentFile: string | null;
  editingContext: string | null;
  biomeConfig: { Name?: string } | null;
  activeBiomeSection: string | null;
}): EditingContextDisplay {
  const fileName = input.currentFile ? basename(input.currentFile) : null;
  const relativePath = relativeToProject(input.projectPath, input.currentFile);
  const packName = input.projectPath ? basename(input.projectPath) : null;
  const stem = fileName ? fileStem(fileName) : null;

  let primary = stem ?? "Untitled";
  let section: string | null = null;

  if (input.editingContext === "Biome") {
    primary = input.biomeConfig?.Name?.trim() || stem || "Biome";
    if (input.activeBiomeSection) {
      section = getBiomeSectionLabel(input.activeBiomeSection);
    }
  } else if (input.editingContext) {
    primary = CONTEXT_LABELS[input.editingContext] ?? input.editingContext;
    if (stem && primary !== stem) {
      section = stem;
    }
  }

  return {
    packName,
    primary,
    section,
    fileName,
    relativePath,
  };
}
