import { useMemo, useState } from "react";
import {
  filterDevLabCases,
  getDevLabCases,
  validateDevLabRegistry,
} from "./devLabCaseRegistry";
import { DEV_LAB_CATEGORIES, type DevLabCase, type DevLabCaseCategory, type DevLabResult, type DevLabStatus } from "./devLabTypes";

/**
 * TerraNova Dev Lab — developer-only workspace for visual regression cases.
 *
 * Reached at `?dev-lab=1` in a development build, mirroring the existing shape
 * preview gallery route. Hidden entirely from normal users: the route guard is
 * `import.meta.env.DEV` gated, so it does not exist in a production bundle.
 *
 * Scope note: this is the Phase 2 shell. The case browser and inspector are live
 * and registry-backed; the preview workspace embeds the existing preview system
 * rather than introducing a second renderer, and the compatibility scanner
 * (Phase 3) is not wired yet.
 */

/** `?dev-lab=1`, or the launcher's `--lab` flag. Dev builds only. */
export function isDevLabRoute(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    if (import.meta.env.VITE_TERRANOVA_DEV_LAB === "1") return true;
    return new URLSearchParams(window.location.search).get("dev-lab") === "1";
  } catch {
    return false;
  }
}

const STATUS_STYLE: Record<DevLabStatus, string> = {
  "not-run": "bg-tn-surface text-tn-text-muted",
  running: "bg-blue-500/20 text-blue-300",
  passed: "bg-emerald-500/20 text-emerald-300",
  warning: "bg-amber-500/20 text-amber-300",
  failed: "bg-red-500/20 text-red-300",
  unsupported: "bg-purple-500/20 text-purple-300",
};

function StatusChip({ status }: { status: DevLabStatus }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS_STYLE[status]}`}>
      {status}
    </span>
  );
}

export default function DevLab() {
  const cases = useMemo(() => getDevLabCases(), []);
  const registryProblems = useMemo(() => validateDevLabRegistry(cases), [cases]);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<DevLabCaseCategory | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(cases[0]?.id ?? null);
  const [results] = useState<Record<string, DevLabResult>>({});

  const visible = useMemo(
    () => filterDevLabCases(cases, { search, category }),
    [cases, search, category],
  );
  const selected: DevLabCase | undefined = cases.find((c) => c.id === selectedId);
  const selectedResult = selectedId ? results[selectedId] : undefined;

  const byCategory = useMemo(() => {
    const map = new Map<DevLabCaseCategory, DevLabCase[]>();
    for (const c of visible) {
      const list = map.get(c.category) ?? [];
      list.push(c);
      map.set(c.category, list);
    }
    return map;
  }, [visible]);

  return (
    <div className="flex h-screen flex-col bg-tn-bg text-tn-text">
      {/* Toolbar */}
      <header className="flex items-center gap-3 border-b border-tn-border px-3 py-2 text-xs">
        <span className="font-semibold">TerraNova Dev Lab</span>
        <span className="rounded bg-tn-surface px-1.5 py-0.5 text-[10px] text-tn-text-muted">
          {cases.length} cases
        </span>
        {registryProblems.length > 0 && (
          <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">
            {registryProblems.length} registry problems
          </span>
        )}
        <span className="ml-auto text-[10px] text-tn-text-muted">
          Phase 2 shell — run/capture and the compatibility scanner are not wired yet
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Case browser */}
        <aside className="flex w-72 shrink-0 flex-col border-r border-tn-border">
          <div className="flex flex-col gap-1.5 border-b border-tn-border p-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cases…"
              aria-label="Search cases"
              className="rounded border border-tn-border bg-tn-surface px-2 py-1 text-xs"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DevLabCaseCategory | "all")}
              aria-label="Filter by category"
              className="rounded border border-tn-border bg-tn-surface px-2 py-1 text-xs"
            >
              <option value="all">All categories</option>
              {DEV_LAB_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-1">
            {visible.length === 0 && (
              <p className="p-2 text-xs text-tn-text-muted">No cases match.</p>
            )}
            {[...byCategory.entries()].map(([cat, list]) => (
              <section key={cat} className="mb-2">
                <h2 className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-tn-text-muted">
                  {cat} ({list.length})
                </h2>
                {list.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    aria-pressed={selectedId === c.id}
                    className={`flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left text-xs hover:bg-tn-surface ${
                      selectedId === c.id ? "bg-tn-surface ring-1 ring-tn-accent" : ""
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="truncate">{c.title}</span>
                      <StatusChip status={results[c.id]?.status ?? "not-run"} />
                    </span>
                    <span className="truncate text-[10px] text-tn-text-muted">
                      {c.expected.summary}
                    </span>
                  </button>
                ))}
              </section>
            ))}
          </div>
        </aside>

        {/* Preview workspace */}
        <main className="flex min-w-0 flex-1 items-center justify-center border-r border-tn-border p-4">
          {selected ? (
            <div className="max-w-md text-center text-xs text-tn-text-muted">
              <p className="mb-1 text-sm text-tn-text">{selected.title}</p>
              <p className="mb-3">{selected.expected.summary}</p>
              <p>
                Preview mode <code>{selected.preview.mode}</code>
                {selected.source.kind === "hytale-cache"
                  ? ` — from the managed asset cache (${selected.source.relativePath})`
                  : ` — synthetic setup "${selected.source.setupId}"`}
              </p>
              <p className="mt-3 text-[10px]">
                The preview workspace reuses TerraNova&rsquo;s existing preview system.
                Embedding it here is the next step; no second renderer will be added.
              </p>
            </div>
          ) : (
            <p className="text-xs text-tn-text-muted">Select a case.</p>
          )}
        </main>

        {/* Inspector */}
        <aside className="w-80 shrink-0 overflow-y-auto p-3 text-xs">
          {selected ? (
            <>
              <h2 className="mb-2 text-sm font-semibold">{selected.title}</h2>
              <dl className="space-y-1.5">
                <Row label="Id" value={<code className="text-[10px]">{selected.id}</code>} />
                <Row label="Category" value={selected.category} />
                <Row label="Tags" value={selected.tags.join(", ") || "—"} />
                <Row label="Source" value={selected.source.kind} />
                {selected.source.kind === "hytale-cache" && (
                  <Row label="Channel" value={selected.source.channel ?? "either"} />
                )}
                <Row label="Status" value={<StatusChip status={selectedResult?.status ?? "not-run"} />} />
                <Row
                  label="Approximation"
                  value={selected.expected.allowApproximation ? "allowed" : "not allowed"}
                />
              </dl>

              {selectedResult && (
                <>
                  <h3 className="mt-3 mb-1 text-[10px] font-semibold uppercase text-tn-text-muted">
                    Diagnostics
                  </h3>
                  <ul className="space-y-1">
                    {selectedResult.diagnostics.map((d, i) => (
                      <li key={i} className="text-[10px]">
                        <span className="font-medium">{d.severity}</span> — {d.message}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {registryProblems.some((p) => p.caseId === selected.id) && (
                <p className="mt-3 rounded bg-red-500/10 p-2 text-[10px] text-red-300">
                  {registryProblems.filter((p) => p.caseId === selected.id).map((p) => p.message).join("; ")}
                </p>
              )}
            </>
          ) : (
            <p className="text-tn-text-muted">No case selected.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-[10px] uppercase tracking-wide text-tn-text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 break-words">{value}</dd>
    </div>
  );
}
