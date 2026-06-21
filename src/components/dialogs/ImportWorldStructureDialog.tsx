import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { ModalShell } from "@/components/ui/ModalShell";
import { SettingsOptionCard } from "@/components/ui/settingsPrimitives";
import { useToastStore } from "@/stores/toastStore";
import { readAssetFile } from "@/utils/ipc";
import {
  listReferenceWorldStructureCatalog,
  type ReferenceWorldStructureEntry,
} from "@/utils/propSources/listReferenceWorldStructures";
import {
  applyWorldStructureImport,
  type WorldStructureImportMode,
} from "@/utils/applyWorldStructureImport";
import { listProjectBiomes } from "@/utils/propSources/listProjectBiomes";
import { useProjectStore } from "@/stores/projectStore";

const IMPORT_MODES: { id: WorldStructureImportMode; title: string; description: string }[] = [
  {
    id: "ranges",
    title: "Ranges only",
    description: "Replace Biomes[] and transition settings; keep your selector Density graph.",
  },
  {
    id: "selector",
    title: "Selector only",
    description: "Replace the Density subgraph; keep current biome ranges.",
  },
  {
    id: "full",
    title: "Full layout",
    description: "Import ranges, selector, and world-level fields (ContentFields, spawns).",
  },
];

interface ImportWorldStructureDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ImportWorldStructureDialog({ open, onClose }: ImportWorldStructureDialogProps) {
  const addToast = useToastStore((s) => s.addToast);
  const projectPath = useProjectStore((s) => s.projectPath);
  const currentFile = useProjectStore((s) => s.currentFile);

  const [catalog, setCatalog] = useState<ReferenceWorldStructureEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedPath, setSelectedPath] = useState("");
  const [mode, setMode] = useState<WorldStructureImportMode>("ranges");
  const [remapBiome, setRemapBiome] = useState("");
  const [importing, setImporting] = useState(false);
  const [projectBiomes, setProjectBiomes] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelectedPath("");
    setMode("ranges");
    setRemapBiome("");
    let cancelled = false;
    setLoading(true);
    void listReferenceWorldStructureCatalog()
      .then((entries) => {
        if (!cancelled) setCatalog(entries);
      })
      .catch(() => {
        if (!cancelled) addToast("Could not load reference world structures.", "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    void listProjectBiomes(projectPath, currentFile)
      .then((entries) => {
        if (!cancelled) setProjectBiomes(entries.map((e) => e.name));
      })
      .catch(() => {
        if (!cancelled) setProjectBiomes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectPath, currentFile, addToast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (e) =>
        e.displayName.toLowerCase().includes(q) ||
        e.group.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q),
    );
  }, [catalog, search]);

  const selected = catalog.find((e) => e.path === selectedPath);

  const handleImport = useCallback(async () => {
    if (!selectedPath) return;
    setImporting(true);
    try {
      const json = (await readAssetFile(selectedPath)) as Record<string, unknown>;
      if (json.Type !== "NoiseRange") {
        addToast("Selected file is not a NoiseRange world structure.", "error");
        return;
      }
      await applyWorldStructureImport(json, mode, {
        remapToBiome: mode === "full" && remapBiome.trim() ? remapBiome.trim() : undefined,
      });
      addToast(`Imported ${selected?.displayName ?? "world structure"} (${mode}).`, "success");
      onClose();
    } catch (err) {
      addToast(`Import failed: ${String(err)}`, "error");
    } finally {
      setImporting(false);
    }
  }, [selectedPath, mode, remapBiome, selected, addToast, onClose]);

  return (
    <ModalShell
      open={open}
      title="Import world structure"
      onClose={onClose}
      widthClass="w-[640px]"
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded border border-tn-border text-tn-text-muted hover:text-tn-text"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedPath || importing}
            onClick={() => void handleImport()}
            className="px-3 py-1.5 text-sm rounded bg-tn-accent text-white disabled:opacity-40"
          >
            {importing ? "Importing…" : "Import"}
          </button>
        </div>
      }
    >
      <p className="text-[11px] text-tn-text-muted leading-relaxed">
        Reference layouts from bundled templates and synced Hytale release assets. DFS-style packs use
        variant matrix world structures; Skyreach uses instance-first single-biome layouts.
      </p>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-tn-text-muted uppercase tracking-wider">Import mode</p>
        {IMPORT_MODES.map((m) => (
          <SettingsOptionCard
            key={m.id}
            selected={mode === m.id}
            onClick={() => setMode(m.id)}
            title={m.title}
            description={m.description}
          />
        ))}
      </div>

      {mode === "full" && projectBiomes.length > 0 && (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-tn-text-muted">Remap all biome refs to (optional)</span>
          <input
            list="import-remap-biomes"
            value={remapBiome}
            onChange={(e) => setRemapBiome(e.target.value)}
            placeholder="Leave empty to keep imported names"
            className="h-8 px-2 text-sm rounded border border-tn-border bg-tn-bg text-tn-text"
          />
          <datalist id="import-remap-biomes">
            {projectBiomes.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
      )}

      <input
        type="search"
        placeholder="Search references…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-8 px-2 text-sm rounded border border-tn-border bg-tn-bg text-tn-text"
      />

      <div className="max-h-48 overflow-y-auto rounded border border-tn-border divide-y divide-tn-border/50">
        {loading && (
          <div className="flex items-center gap-2 p-3 text-sm text-tn-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading catalog…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="flex items-center gap-2 p-3 text-sm text-tn-text-muted">
            <AlertCircle className="h-4 w-4 shrink-0" />
            No world structures found. Run sync:hytale or use bundled templates.
          </div>
        )}
        {filtered.map((entry) => (
          <button
            key={entry.path}
            type="button"
            onClick={() => setSelectedPath(entry.path)}
            className={`w-full text-left px-3 py-2 hover:bg-tn-surface transition-colors ${
              selectedPath === entry.path ? "bg-tn-accent/10" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              {selectedPath === entry.path ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-tn-accent shrink-0" />
              ) : (
                <span className="w-3.5 shrink-0" />
              )}
              <span className="text-sm text-tn-text">{entry.displayName}</span>
              <span className="text-[10px] text-tn-text-muted ml-auto">{entry.group}</span>
            </div>
            <p className="text-[10px] text-tn-text-muted pl-5 mt-0.5">{entry.description}</p>
          </button>
        ))}
      </div>
    </ModalShell>
  );
}
