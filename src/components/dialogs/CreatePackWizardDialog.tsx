import { useState, useEffect, useCallback, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { ChevronLeft } from "lucide-react";
import {
  DEFAULT_PACK_WIZARD_STATE,
  buildProjectPath,
  type PackWizardFormState,
} from "@/data/packWizardTemplates";
import { isTauriRuntime } from "@/utils/platform";
import { useTauriIO } from "@/hooks/useTauriIO";
import { useProjectStore } from "@/stores/projectStore";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import {
  loadPackWizardPreferences,
  savePackWizardPreferences,
  suggestBiomeNameFromPack,
  type PackWizardUIMode,
} from "@/utils/packWizard/packWizardPreferences";
import { canLaunchPackWizard } from "@/utils/packWizard/canLaunchPackWizard";
import { resolveSimplePackLaunchConfig } from "@/utils/packWizard/resolveSimplePackLaunchConfig";
import { validatePackWizardTargetPath } from "@/utils/packWizard/validatePackWizardTargetPath";
import { PackWizardModeToggle } from "./createPackWizard/PackWizardModeToggle";
import { PackWizardHelpCard } from "./createPackWizard/PackWizardHelpCard";
import { PackStep } from "./createPackWizard/PackStep";
import { BiomeStep } from "./createPackWizard/BiomeStep";
import { AtmosphereStep } from "./createPackWizard/AtmosphereStep";
import { InstanceStep } from "./createPackWizard/InstanceStep";
import { ReviewStep } from "./createPackWizard/ReviewStep";
import { SimplePackWizardForm } from "./createPackWizard/SimplePackWizardForm";

const STEPS = ["Pack", "Biome", "Atmosphere", "Instance", "Review"] as const;
type StepId = (typeof STEPS)[number];

interface CreatePackWizardDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreatePackWizardDialog({ open: isOpen, onClose }: CreatePackWizardDialogProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<PackWizardFormState>(DEFAULT_PACK_WIZARD_STATE);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [savingBeforeLaunch, setSavingBeforeLaunch] = useState(false);
  const [uiMode, setUiMode] = useState<PackWizardUIMode>("simple");
  const biomeNameLockedRef = useRef(false);
  const { createPackWizard, saveFile } = useTauriIO();
  const canUseNativeFileSystem = isTauriRuntime();

  useEffect(() => {
    if (isOpen) {
      const prefs = loadPackWizardPreferences();
      setStepIndex(0);
      setState({
        ...DEFAULT_PACK_WIZARD_STATE,
        packGroup: prefs.packGroup ?? DEFAULT_PACK_WIZARD_STATE.packGroup,
        targetDir: prefs.targetDir ?? "",
        biomeName: suggestBiomeNameFromPack(DEFAULT_PACK_WIZARD_STATE.packName),
        atmosphereMode: prefs.atmosphereMode ?? DEFAULT_PACK_WIZARD_STATE.atmosphereMode,
        atmosphereImportId:
          prefs.atmosphereImportId ?? DEFAULT_PACK_WIZARD_STATE.atmosphereImportId,
      });
      setUiMode(prefs.uiMode ?? "simple");
      biomeNameLockedRef.current = false;
      setLaunching(false);
      setError(null);
      setShowUnsavedConfirm(false);
      setSavingBeforeLaunch(false);
    }
  }, [isOpen]);

  const patch = useCallback((partial: Partial<PackWizardFormState>) => {
    setState((prev) => {
      const next = { ...prev, ...partial };
      if (
        partial.packName !== undefined
        && !biomeNameLockedRef.current
        && partial.biomeName === undefined
      ) {
        next.biomeName = suggestBiomeNameFromPack(partial.packName);
      }
      if (partial.atmosphereMode !== undefined || partial.atmosphereImportId !== undefined) {
        savePackWizardPreferences({
          atmosphereMode: next.atmosphereMode,
          atmosphereImportId: next.atmosphereImportId,
        });
      }
      return next;
    });
    setError(null);
  }, []);

  const patchBiome = useCallback((partial: Partial<PackWizardFormState>) => {
    if (partial.biomeName !== undefined) {
      biomeNameLockedRef.current = true;
    }
    patch(partial);
  }, [patch]);

  async function handleBrowse() {
    if (!canUseNativeFileSystem) {
      setError("Pack creation requires the TerraNova desktop app.");
      return;
    }
    try {
      const selected = (await open({ directory: true, title: "Choose pack location" })) as string | null;
      if (selected) {
        const targetDir = typeof selected === "string" ? selected : selected;
        patch({ targetDir });
        savePackWizardPreferences({
          packGroup: state.packGroup,
          targetDir,
        });
      }
    } catch (err) {
      setError(`Failed to choose location: ${err}`);
    }
  }

  function canAdvance(): boolean {
    if (uiMode === "simple") {
      return canLaunchPackWizard(state, "simple");
    }
    if (stepIndex === 0) {
      return Boolean(state.packGroup.trim() && state.packName.trim() && state.targetDir);
    }
    if (stepIndex === 1) {
      return Boolean(state.biomeName.trim());
    }
    if (stepIndex === 3) {
      return Boolean(state.instanceName.trim());
    }
    return true;
  }

  function handleUiModeChange(next: PackWizardUIMode) {
    setUiMode(next);
    if (next === "advanced") {
      setStepIndex(0);
    }
    savePackWizardPreferences({
      packGroup: state.packGroup,
      targetDir: state.targetDir,
      uiMode: next,
    });
  }

  async function runLaunch() {
    setLaunching(true);
    setError(null);
    try {
      const targetPath = buildProjectPath(state.targetDir, state.packName);
      const targetError = await validatePackWizardTargetPath(targetPath);
      if (targetError) {
        setError(targetError);
        return;
      }

      savePackWizardPreferences({
        packGroup: state.packGroup.trim(),
        targetDir: state.targetDir,
        uiMode,
      });

      const launchState = uiMode === "simple"
        ? resolveSimplePackLaunchConfig(state)
        : state;

      await createPackWizard({
        targetPath,
        packGroup: launchState.packGroup,
        packName: launchState.packName,
        worldStructureTemplate: launchState.worldStructureTemplate,
        biomeName: launchState.biomeName,
        biomeTemplate: launchState.biomeTemplate,
        includeStarterProps: launchState.includeStarterProps,
        starterPrefabPath: launchState.starterPrefabPath.trim() || null,
        primaryMaterialBlockId:
          launchState.biomeTemplate === "basic"
            ? launchState.primaryMaterialBlockId.trim() || null
            : null,
        atmosphereMode: launchState.atmosphereMode,
        atmosphereImportId:
          launchState.atmosphereMode === "import"
            ? launchState.atmosphereImportId || "Env_Zone1_Forests"
            : null,
        instanceName: launchState.instanceName,
        gameMode: launchState.gameMode,
      });
      onClose();
    } catch (err) {
      setError(`Failed to create pack: ${err}`);
    } finally {
      setLaunching(false);
      setSavingBeforeLaunch(false);
    }
  }

  function handleLaunch() {
    if (!canUseNativeFileSystem) {
      setError("Pack creation requires the TerraNova desktop app.");
      return;
    }
    if (!canAdvance()) return;

    if (useProjectStore.getState().isDirty) {
      setShowUnsavedConfirm(true);
      return;
    }

    void runLaunch();
  }

  async function handleSaveAndLaunch() {
    setSavingBeforeLaunch(true);
    try {
      await saveFile();
      if (useProjectStore.getState().isDirty) return;
      setShowUnsavedConfirm(false);
      await runLaunch();
    } finally {
      setSavingBeforeLaunch(false);
    }
  }

  function handleDiscardAndLaunch() {
    useProjectStore.getState().setDirty(false);
    setShowUnsavedConfirm(false);
    void runLaunch();
  }

  function handleNext() {
    if (uiMode === "simple" || stepIndex >= STEPS.length - 1) {
      handleLaunch();
      return;
    }
    setStepIndex((i) => i + 1);
  }

  if (!isOpen) return null;

  const step: StepId = STEPS[stepIndex]!;
  const isLast = uiMode === "simple" || stepIndex === STEPS.length - 1;
  const wideBiomeStep = uiMode === "advanced" && step === "Biome";

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-pack-wizard-title"
    >
      <div
        className={`bg-tn-panel border border-tn-border rounded-lg shadow-xl max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden ${
          wideBiomeStep
            ? "w-[min(840px,calc(100vw-2rem))]"
            : "w-[min(520px,calc(100vw-2rem))]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-tn-border shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {uiMode === "advanced" && stepIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setStepIndex((i) => i - 1)}
                  className="p-1 rounded hover:bg-tn-surface text-tn-text-muted shrink-0"
                  aria-label="Back"
                >
                  <ChevronLeft size={18} />
                </button>
              )}
              <div className="min-w-0">
                <h2 id="create-pack-wizard-title" className="text-base font-semibold">
                  Create Pack
                </h2>
                <p className="text-xs text-tn-text-muted mt-0.5">
                  {uiMode === "simple"
                    ? "Essentials — pack, biome, and templates"
                    : `Step ${stepIndex + 1} of ${STEPS.length}: ${step}`}
                </p>
              </div>
            </div>
            <PackWizardModeToggle mode={uiMode} onModeChange={handleUiModeChange} />
          </div>
          {uiMode === "advanced" && (
            <div className="flex gap-1 mt-3">
              {STEPS.map((s, i) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full ${
                    i <= stepIndex ? "bg-tn-accent" : "bg-tn-border"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          {uiMode === "simple" ? (
            <SimplePackWizardForm
              state={state}
              onChange={patch}
              onBiomeChange={patchBiome}
              onBrowse={handleBrowse}
            />
          ) : (
            <>
              {step === "Pack" && (
                <PackStep state={state} onChange={patch} onBrowse={handleBrowse} />
              )}
              {step === "Biome" && <BiomeStep state={state} onChange={patchBiome} />}
              {step === "Atmosphere" && <AtmosphereStep state={state} onChange={patch} />}
              {step === "Instance" && <InstanceStep state={state} onChange={patch} />}
              {step === "Review" && <ReviewStep state={state} />}
            </>
          )}

          <div className="mt-4">
            <PackWizardHelpCard />
          </div>

          {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-tn-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded border border-tn-border hover:bg-tn-surface"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canAdvance() || launching}
            className="px-4 py-1.5 text-sm rounded bg-tn-accent text-tn-bg font-medium disabled:opacity-50 hover:opacity-90 min-w-[88px]"
          >
            {launching ? "Launching…" : isLast ? "Launch" : "Next"}
          </button>
        </div>
      </div>
    </div>

    <ConfirmDialog
      open={showUnsavedConfirm}
      onClose={() => {
        if (!savingBeforeLaunch) setShowUnsavedConfirm(false);
      }}
      title="Unsaved Changes"
      message="You have unsaved changes in the current project. Save before creating a new pack, or discard them to continue."
      confirmLabel="Save & Launch"
      onConfirm={() => void handleSaveAndLaunch()}
      secondaryLabel="Discard"
      onSecondary={handleDiscardAndLaunch}
      loading={savingBeforeLaunch}
    />
    </>
  );
}
