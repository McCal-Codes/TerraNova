import { useEffect, useState } from "react";
import { computeProjectHealth, type ProjectHealthReport, type ProjectHealthDetail } from "@/utils/projectHealth";
import { useProjectStore } from "@/stores/projectStore";
import { ChromeIconButton } from "@/components/ui/editorChrome";
import { X } from "lucide-react";
import { showInFolder } from "@/utils/ipc";
import { useTauriIO } from "@/hooks/useTauriIO";

export function ProjectHealthPanel({ onClose }: { onClose: () => void }) {
  const projectPath = useProjectStore((s) => s.projectPath);
  const [report, setReport] = useState<ProjectHealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const { openFile } = useTauriIO();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      const r = await computeProjectHealth(projectPath);
      if (!mounted) return;
      setReport(r);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [projectPath]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="w-[820px] max-h-[80vh] overflow-auto bg-tn-panel border border-tn-border rounded shadow-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Project Health</div>
          <ChromeIconButton size="sm" label="Close" onClick={onClose} icon={<X className="h-4 w-4" />} />
        </div>
        {loading && <div className="text-sm text-tn-text-muted">Scanning project…</div>}
        {!loading && report && (
          <div>
            <div className="flex gap-4 mb-3">
              <div>Total issues: <strong>{report.totalErrors}</strong></div>
              <div className="text-amber-400">Errors: {report.errorsBySeverity?.Error ?? 0}</div>
              <div className="text-yellow-400">Warnings: {report.errorsBySeverity?.Warning ?? 0}</div>
              <div className="text-tn-text-muted">Info: {report.errorsBySeverity?.Info ?? 0}</div>
            </div>

            <div className="mb-2">
              <div className="text-sm font-medium">Details</div>
              <div className="mt-2 space-y-2">
                {report.details && report.details.length > 0 ? (
                  report.details.map((d: ProjectHealthDetail, i: number) => (
                    <div key={i} className="p-2 border border-tn-border rounded">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{d.file}</div>
                        <div className="text-xs text-tn-text-muted">{d.severity}</div>
                      </div>
                      <div className="text-xs text-tn-text-muted mt-1">{d.field}: {d.message}</div>
                      <div className="mt-2 flex gap-2">
                        <button
                          className="text-xs px-2 py-1 bg-tn-surface border border-tn-border rounded"
                          onClick={() => openFile(d.file)}
                        >Open</button>
                        <button
                          className="text-xs px-2 py-1 bg-tn-surface border border-tn-border rounded"
                          onClick={() => showInFolder(d.file)}
                        >Show in folder</button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-tn-text-muted">No issues found.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectHealthPanel;
