import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import { useTauriIO } from "@/hooks/useTauriIO";
import { useFieldChange } from "@/hooks/useFieldChange";
import { AtmosphereEditorModeToggle } from "@/components/editor/atmosphere/AtmosphereEditorModeToggle";
import { listProjectBiomes, type ProjectBiomeEntry } from "@/utils/propSources/listProjectBiomes";
import {
  applyDragDelta,
  closeLargestGap,
  splitRangesEqually,
  validateBiomeRanges,
  type BiomeDragMode,
} from "@/utils/biomeRangeDomain";
import { BiomeRangeCoverageStrip } from "./BiomeRangeCoverageStrip";
import { BiomeRangeRow } from "./BiomeRangeRow";
import { BiomeRangeToolbar } from "./BiomeRangeToolbar";
import { BiomeRangeValidationCallout } from "./BiomeRangeValidationCallout";
import {
  BiomeDefaultBiomeInput,
  BiomeRangeTransitionSettings,
} from "./BiomeRangeTransitionSettings";
import { BiomeMapperSectionCard } from "./BiomeMapperSectionCard";

type SortKey = "name" | "min" | "max" | "width";
type SortDir = "asc" | "desc";

export interface WorldBiomeMapperPanelProps {
  onImport?: () => void;
  onOpenSelectorGraph?: () => void;
  onOpenSplitView?: () => void;
  mapPanel?: React.ReactNode;
  worldSettingsPanel?: React.ReactNode;
}

export function WorldBiomeMapperPanel({
  onImport,
  onOpenSelectorGraph,
  onOpenSplitView,
  mapPanel,
  worldSettingsPanel,
}: WorldBiomeMapperPanelProps) {
  const biomeRanges = useEditorStore((s) => s.biomeRanges);
  const noiseRangeConfig = useEditorStore((s) => s.noiseRangeConfig);
  const updateBiomeRange = useEditorStore((s) => s.updateBiomeRange);
  const addBiomeRange = useEditorStore((s) => s.addBiomeRange);
  const removeBiomeRange = useEditorStore((s) => s.removeBiomeRange);
  const bulkUpdateBiomeRanges = useEditorStore((s) => s.bulkUpdateBiomeRanges);
  const commitState = useEditorStore((s) => s.commitState);
  const setDirty = useProjectStore((s) => s.setDirty);
  const selectedBiomeIndex = useEditorStore((s) => s.selectedBiomeIndex);
  const setSelectedBiomeIndex = useEditorStore((s) => s.setSelectedBiomeIndex);
  const renameBiomeRange = useEditorStore((s) => s.renameBiomeRange);
  const setNoiseRangeConfig = useEditorStore((s) => s.setNoiseRangeConfig);
  const projectPath = useProjectStore((s) => s.projectPath);
  const currentFile = useProjectStore((s) => s.currentFile);
  const uiMode = useUIStore((s) => s.biomeMapperUIMode);
  const setUiMode = useUIStore((s) => s.setBiomeMapperUIMode);
  const { openFile } = useTauriIO();

  const isAdvanced = uiMode === "advanced";
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("min");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [projectBiomes, setProjectBiomes] = useState<ProjectBiomeEntry[]>([]);

  const dragOrigRef = useRef<{ index: number; min: number; max: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listProjectBiomes(projectPath, currentFile)
      .then((entries) => {
        if (!cancelled) setProjectBiomes(entries);
      })
      .catch(() => {
        if (!cancelled) setProjectBiomes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectPath, currentFile]);

  const projectBiomeNames = useMemo(() => projectBiomes.map((b) => b.name), [projectBiomes]);
  const validation = useMemo(
    () => validateBiomeRanges(biomeRanges, noiseRangeConfig, { projectBiomeNames }),
    [biomeRanges, noiseRangeConfig, projectBiomeNames],
  );

  const sortedIndices = useMemo(() => {
    const indices = biomeRanges.map((_, i) => i);
    const filtered =
      isAdvanced && searchQuery.trim()
        ? indices.filter((i) => biomeRanges[i].Biome.toLowerCase().includes(searchQuery.toLowerCase()))
        : indices;

    if (!isAdvanced) {
      return filtered.sort((a, b) => biomeRanges[a].Min - biomeRanges[b].Min);
    }

    return filtered.sort((a, b) => {
      const ra = biomeRanges[a];
      const rb = biomeRanges[b];
      let cmp = 0;
      if (sortKey === "name") cmp = ra.Biome.localeCompare(rb.Biome);
      else if (sortKey === "min") cmp = ra.Min - rb.Min;
      else if (sortKey === "max") cmp = ra.Max - rb.Max;
      else cmp = ra.Max - ra.Min - (rb.Max - rb.Min);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [biomeRanges, searchQuery, sortKey, sortDir, isAdvanced]);

  const { debouncedChange: debouncedConfigChange, flush: flushConfig } = useFieldChange(
    commitState,
    setDirty,
    300,
  );

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const handleAddBiome = useCallback(() => {
    const unassigned = projectBiomes.find(
      (b) => !biomeRanges.some((r) => r.Biome.toLowerCase() === b.name.toLowerCase()),
    );
    addBiomeRange({
      Biome: unassigned?.name ?? "new_biome",
      Min: -0.25,
      Max: 0.25,
    });
  }, [addBiomeRange, biomeRanges, projectBiomes]);

  const handleSplitEqual = useCallback(() => {
    bulkUpdateBiomeRanges(splitRangesEqually(biomeRanges), "Split biome ranges equally");
  }, [biomeRanges, bulkUpdateBiomeRanges]);

  const handleCloseGap = useCallback(() => {
    bulkUpdateBiomeRanges(closeLargestGap(biomeRanges), "Close biome range gap");
  }, [biomeRanges, bulkUpdateBiomeRanges]);

  const handleSelect = useCallback(
    (index: number) => {
      setSelectedBiomeIndex(selectedBiomeIndex === index ? null : index);
    },
    [selectedBiomeIndex, setSelectedBiomeIndex],
  );

  const commitDrag = useCallback(() => {
    if (dragOrigRef.current) {
      dragOrigRef.current = null;
      commitState("Drag biome range");
      setDirty(true);
    }
  }, [commitState, setDirty]);

  const commitFieldEdit = useCallback(() => {
    commitState("Edit biome range");
    setDirty(true);
  }, [commitState, setDirty]);

  const makeDragHandler = useCallback(
    (index: number, mode: BiomeDragMode) => (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const range = biomeRanges[index];
      if (!dragOrigRef.current || dragOrigRef.current.index !== index) {
        dragOrigRef.current = { index, min: range.Min, max: range.Max };
      }
      const startX = e.clientX;
      const bar = (e.currentTarget as HTMLElement).closest("[data-range-bar]");
      if (!bar) return;

      const onMove = (ev: PointerEvent) => {
        const orig = dragOrigRef.current;
        if (!orig || orig.index !== index) return;
        const barWidth = bar.getBoundingClientRect().width;
        const dxPx = ev.clientX - startX;
        const dValue = (dxPx / barWidth) * 2;
        const next = applyDragDelta({ Min: orig.min, Max: orig.max }, mode, dValue);
        updateBiomeRange(index, next);
      };

      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        commitDrag();
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [biomeRanges, updateBiomeRange, commitDrag],
  );

  const handleConfigChange = useCallback(
    (field: keyof NonNullable<typeof noiseRangeConfig>, value: string | number) => {
      if (!noiseRangeConfig) return;
      debouncedConfigChange(`Edit ${field}`, () =>
        setNoiseRangeConfig({ ...noiseRangeConfig, [field]: value }),
      );
    },
    [noiseRangeConfig, setNoiseRangeConfig, debouncedConfigChange],
  );

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return <span className="ml-0.5 text-tn-accent">{sortDir === "asc" ? "\u25B4" : "\u25BE"}</span>;
  };

  return (
    <div className="h-full overflow-y-auto bg-tn-surface">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4">
        <div className="text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <h2 className="text-lg font-bold text-tn-text">Biome Placement</h2>
            <span className="text-xs text-tn-text-muted">({biomeRanges.length})</span>
          </div>
          <p className="mt-1 text-xs text-tn-text-muted">
            Map biomes to selector noise from −1 to +1
          </p>
          <div className="mt-3 flex justify-center">
            <AtmosphereEditorModeToggle mode={uiMode} onModeChange={setUiMode} />
          </div>
        </div>

        <BiomeMapperSectionCard
          title="Biome ranges"
          accent
          description={
            biomeRanges.length === 0
              ? "Add biomes and drag their bars across the noise axis (−1 to +1)."
              : "Drag each bar to set where a biome appears along the noise axis."
          }
          headerRight={
            biomeRanges.length > 0 ? (
              <button
                type="button"
                onClick={handleAddBiome}
                className="rounded bg-tn-accent/20 px-2 py-0.5 text-[10px] text-tn-accent transition-colors hover:bg-tn-accent/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
              >
                + Add
              </button>
            ) : undefined
          }
        >
          <div className="space-y-2">
            {biomeRanges.length > 0 && (
              <BiomeRangeCoverageStrip
                ranges={biomeRanges}
                selectedIndex={selectedBiomeIndex}
                onSelect={handleSelect}
              />
            )}
            <BiomeRangeValidationCallout
              validation={validation}
              rangeCount={biomeRanges.length}
              onCloseGap={handleCloseGap}
              onSplitEqual={handleSplitEqual}
              hideInfo={!isAdvanced}
              simpleMode={!isAdvanced}
            />

            {isAdvanced && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Search…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="min-w-0 flex-1 rounded border border-tn-border bg-tn-bg px-2 py-1 text-xs text-tn-text placeholder:text-tn-text-muted/50 outline-none focus:border-tn-accent"
                />
                <BiomeRangeToolbar
                  biomeCount={biomeRanges.length}
                  onAdd={handleAddBiome}
                  onSplitEqual={handleSplitEqual}
                  onImport={onImport}
                  hideAdd
                />
              </div>
            )}

            {isAdvanced && (
              <div className="flex items-center gap-1 border-b border-tn-border pb-1 text-[9px] uppercase tracking-wider text-tn-text-muted">
                <div className="w-3 shrink-0" />
                <button
                  type="button"
                  className="flex w-[120px] shrink-0 items-center text-left transition-colors hover:text-tn-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
                  onClick={() => handleSort("name")}
                >
                  Name{sortIndicator("name")}
                </button>
                <div className="flex-1 text-center">Range</div>
                <button
                  type="button"
                  className="flex w-12 shrink-0 items-center justify-end text-right transition-colors hover:text-tn-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
                  onClick={() => handleSort("min")}
                >
                  Min{sortIndicator("min")}
                </button>
                <button
                  type="button"
                  className="flex w-12 shrink-0 items-center justify-end text-right transition-colors hover:text-tn-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
                  onClick={() => handleSort("max")}
                >
                  Max{sortIndicator("max")}
                </button>
                <button
                  type="button"
                  className="flex w-10 shrink-0 items-center justify-end text-right transition-colors hover:text-tn-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
                  onClick={() => handleSort("width")}
                >
                  %{sortIndicator("width")}
                </button>
                <div className="w-5 shrink-0" />
              </div>
            )}

            <div className="overflow-hidden rounded border border-tn-border/60 bg-tn-surface">
              {sortedIndices.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-3 py-6 text-center">
                  <p className="text-xs text-tn-text-muted">
                    No biomes mapped yet.
                  </p>
                  <button
                    type="button"
                    onClick={handleAddBiome}
                    className="rounded bg-tn-accent/20 px-3 py-1.5 text-xs font-medium text-tn-accent transition-colors hover:bg-tn-accent/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
                  >
                    + Add first biome
                  </button>
                </div>
              ) : (
                sortedIndices.map((origIdx) => {
                  const range = biomeRanges[origIdx];
                  if (!range) return null;
                  return (
                    <BiomeRangeRow
                      key={origIdx}
                      range={range}
                      index={origIdx}
                      isSelected={selectedBiomeIndex === origIdx}
                      projectBiomes={projectBiomes}
                      compact={!isAdvanced}
                      onSelect={() => handleSelect(origIdx)}
                      onRename={(name) => renameBiomeRange(origIdx, name)}
                      onUpdateMin={(v) => updateBiomeRange(origIdx, { Min: v })}
                      onUpdateMax={(v) => updateBiomeRange(origIdx, { Max: v })}
                      onRemove={() => removeBiomeRange(origIdx)}
                      onOpenBiome={(path) => {
                        void openFile(path);
                      }}
                      onDragMin={makeDragHandler(origIdx, "min")}
                      onDragMax={makeDragHandler(origIdx, "max")}
                      onDragMove={makeDragHandler(origIdx, "move")}
                      onCommitEdit={commitFieldEdit}
                    />
                  );
                })
              )}
            </div>

            {!isAdvanced && noiseRangeConfig && (
              <div className="border-t border-tn-border/50 pt-3">
                <BiomeDefaultBiomeInput
                  value={noiseRangeConfig.DefaultBiome}
                  projectBiomes={projectBiomes}
                  onChange={(v) => handleConfigChange("DefaultBiome", v)}
                  onBlur={flushConfig}
                  compact
                />
              </div>
            )}
          </div>
        </BiomeMapperSectionCard>

        {isAdvanced && noiseRangeConfig && (
          <BiomeMapperSectionCard title="Fallback biome">
            <div className="flex flex-col gap-1">
              <BiomeDefaultBiomeInput
                value={noiseRangeConfig.DefaultBiome}
                projectBiomes={projectBiomes}
                onChange={(v) => handleConfigChange("DefaultBiome", v)}
                onBlur={flushConfig}
              />
            </div>
          </BiomeMapperSectionCard>
        )}

        {isAdvanced && noiseRangeConfig && (
          <BiomeMapperSectionCard
            title="Edge blending"
            description="Terrain density blend width at biome boundaries."
          >
            <BiomeRangeTransitionSettings
              config={noiseRangeConfig}
              onChange={handleConfigChange}
              onBlur={flushConfig}
            />
          </BiomeMapperSectionCard>
        )}

        {isAdvanced && mapPanel && (
          <BiomeMapperSectionCard
            title="Selector map"
            description="2D preview of biome selector noise — click a region to select its range row."
          >
            {mapPanel}
          </BiomeMapperSectionCard>
        )}

        {isAdvanced && worldSettingsPanel && (
          <BiomeMapperSectionCard
            title="World generation heights"
            description="Base, water, and bedrock Y levels for this world structure."
          >
            {worldSettingsPanel}
          </BiomeMapperSectionCard>
        )}

        {isAdvanced ? (
          <p className="text-center text-[10px] leading-relaxed text-tn-text-muted">
            Selector density on the canvas below chooses regions at each column. Changes save with Ctrl+S.
          </p>
        ) : (
          (onOpenSelectorGraph || onOpenSplitView) && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {onOpenSelectorGraph && (
                <button
                  type="button"
                  onClick={onOpenSelectorGraph}
                  className="rounded border border-tn-border bg-tn-bg px-2.5 py-1 text-[10px] text-tn-text-muted transition-colors hover:border-tn-accent/40 hover:text-tn-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
                >
                  Edit selector graph
                </button>
              )}
              {onOpenSplitView && (
                <button
                  type="button"
                  onClick={onOpenSplitView}
                  className="rounded border border-tn-border bg-tn-bg px-2.5 py-1 text-[10px] text-tn-text-muted transition-colors hover:border-tn-accent/40 hover:text-tn-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
                >
                  Placement + graph
                </button>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
