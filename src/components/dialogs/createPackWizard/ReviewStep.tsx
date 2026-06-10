import {
  biomeTemplateIncludesStarterProps,
  buildProjectPath,
  isReferenceBiomeTemplate,
  slugifyHytaleModName,
  slugifyPackIdentifier,
  type PackWizardFormState,
} from "@/data/packWizardTemplates";
import { useMemo } from "react";
import { usePackWizardBundleTemplates } from "@/hooks/usePackWizardBundleTemplates";
import { usePrefabPreview } from "@/hooks/usePrefabPreview";
import { PrefabPreview3D } from "@/components/preview/PrefabPreview3D";

interface ReviewStepProps {
  state: PackWizardFormState;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm py-1 border-b border-tn-border/50 last:border-0">
      <span className="text-tn-text-muted shrink-0">{label}</span>
      <span className="text-tn-text text-right break-all">{value}</span>
    </div>
  );
}

export function ReviewStep({ state }: ReviewStepProps) {
  const { advancedBiomeTemplates, worldStructureTemplates } = usePackWizardBundleTemplates();
  const starterPath = state.starterPrefabPath.trim();
  const previewFields = useMemo(
    () => (starterPath ? { Path: starterPath } : {}),
    [starterPath],
  );
  const prefabPreview = usePrefabPreview(previewFields, null);
  const projectPath = state.targetDir
    ? buildProjectPath(state.targetDir, state.packName)
    : "—";
  const biomeFile = `Server/HytaleGenerator/Biomes/${slugifyPackIdentifier(state.biomeName)}.json`;
  const worldLabel =
    worldStructureTemplates.find((t) => t.id === state.worldStructureTemplate)?.displayName ??
    state.worldStructureTemplate;
  const biomeLabel =
    advancedBiomeTemplates.find((t) => t.id === state.biomeTemplate)?.displayName ??
    state.biomeTemplate;
  const atmosphereLabel =
    state.atmosphereMode === "default"
      ? "Built-in default"
      : state.atmosphereMode === "custom"
        ? "Custom Env + Weather"
        : `Import ${state.atmosphereImportId || "Env_Zone1_Forests"}`;
  const biomeSlug = slugifyPackIdentifier(state.biomeName);
  const instanceSlug = slugifyPackIdentifier(state.instanceName);
  const modNameSlug = slugifyHytaleModName(state.packName);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-tn-text-muted">
        Review your pack layout. Launch creates all files and opens the biome in the editor.
      </p>
      {(isReferenceBiomeTemplate(state.biomeTemplate)
        || (state.includeStarterProps && !biomeTemplateIncludesStarterProps(state.biomeTemplate))) && (
        <p className="text-[11px] text-amber-400/90 rounded border border-amber-500/30 bg-amber-500/5 px-2.5 py-2">
          {isReferenceBiomeTemplate(state.biomeTemplate)
            ? "Reference biome selected — validate legacy nodes and prop prefab paths after launch."
            : "This template has no bundled prop nodes; Props may stay empty unless you add a prefab path."}
        </p>
      )}
      <div className="rounded border border-tn-border bg-tn-bg px-3 py-2">
        <Row label="Pack" value={`${state.packGroup.trim()}.${state.packName.trim()}`} />
        <Row label="Export mod id" value={`${state.packGroup.trim()}.${modNameSlug}`} />
        <Row label="Project path" value={projectPath} />
        <Row label="World structure" value={worldLabel} />
        <Row label="Biome" value={`${state.biomeName} (${biomeLabel})`} />
        <Row label="Biome file" value={biomeFile} />
        <Row label="Biome slug" value={biomeSlug} />
        <Row
          label="Props"
          value={
            [
              state.includeStarterProps ? "Template props" : null,
              state.starterPrefabPath.trim() ? state.starterPrefabPath.trim() : null,
            ]
              .filter(Boolean)
              .join(" + ") || "None"
          }
        />
        {state.biomeTemplate === "basic" && (
          <Row label="Surface material" value={state.primaryMaterialBlockId || "Rock_Stone"} />
        )}
        <Row label="Atmosphere" value={atmosphereLabel} />
        <Row label="Instance" value={`Server/Instances/${instanceSlug}`} />
        <Row label="Game mode" value={state.gameMode} />
      </div>
      {starterPath && (
        <div className="rounded border border-tn-border bg-tn-bg px-3 py-2 space-y-2">
          <p className="text-xs text-tn-text-muted">Starter prefab preview</p>
          <p className="text-[11px] font-mono text-tn-text truncate" title={starterPath}>
            {starterPath}
          </p>
          <div className="h-[140px] rounded border border-tn-border/60 overflow-hidden relative">
            {prefabPreview.loading && (
              <p className="absolute inset-0 flex items-center justify-center text-[11px] text-tn-text-muted">
                Loading preview…
              </p>
            )}
            {prefabPreview.error && !prefabPreview.loading && (
              <p className="absolute inset-0 flex items-center justify-center text-[11px] text-amber-400/90 px-2 text-center">
                {prefabPreview.error}
              </p>
            )}
            {prefabPreview.mesh && !prefabPreview.loading && (
              <PrefabPreview3D mesh={prefabPreview.mesh} className="h-full w-full" compact />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
