import { lazy, Suspense, useState, useRef, useEffect, useCallback, useMemo, type ComponentType } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { ReactFlowProvider } from "@xyflow/react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
import { removeSplash } from "@/utils/splashProgress";
import { useProjectStore } from "@/stores/projectStore";
import { SimpleTitleBar } from "@/components/layout/TitleBar";
import { ProjectTitleBar } from "@/components/layout/ProjectTitleBar";
import { StatusBar } from "@/components/layout/StatusBar";
import { PanelLayout } from "@/components/layout/PanelLayout";
import { DragGhost } from "@/components/editor/DragGhost";
import { HomeScreen } from "@/components/home/HomeScreen";
import { Toast } from "@/components/ui/Toast";
import { LoadingDialog } from "@/components/ui/LoadingDialog";
import { GlobalLoader } from "@/components/ui/GlobalLoader";
import SyncProgressModal from "@/components/ui/SyncProgressModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConfirmDialog } from "@/components/dialogs/ConfirmDialog";
import { NewProjectDialog } from "@/components/dialogs/NewProjectDialog";
import { SettingsDialog, type SettingsTab } from "@/components/dialogs/SettingsDialog";
import { BugReportDialog } from "@/components/dialogs/BugReportDialog";
import { useBugReportStore } from "@/stores/bugReportStore";
import type { SystemTab } from "@/components/dialogs/ConfigurationDialog";
import { saveRef } from "@/utils/saveRef";
import { isMac, isTauriRuntime } from "@/utils/platform";
import { checkForUpdates } from "@/utils/updater";
import { useSettingsStore } from "@/stores/settingsStore";
import { useToastStore } from "@/stores/toastStore";
import type { SvgExportOptions } from "@/utils/exportSvg";
import { useReactFlow } from "@xyflow/react";
import { useTauriIO } from "@/hooks/useTauriIO";
import { useGlobalKeyboardShortcuts } from "@/hooks/useGlobalKeyboardShortcuts";
import { useInstantSave } from "@/hooks/useInstantSave";
import { useProjectLegacyScan } from "@/hooks/useProjectLegacyScan";
import { useSessionRestore } from "@/hooks/useSessionRestore";
type PendingAction = "window-close" | "close-project";

const DocsPanel = lazy(() =>
  import("@/components/docs/DocsPanel").then((m) => ({ default: m.DocsPanel })),
);
const CreatePackWizardDialog = lazy(() =>
  import("@/components/dialogs/CreatePackWizardDialog").then((m) => ({ default: m.CreatePackWizardDialog })),
);
const ExportSvgDialog = lazy(() =>
  import("@/components/dialogs/ExportSvgDialog").then((m) => ({ default: m.ExportSvgDialog })),
);

export default function App() {
  // Remove splash once React has mounted — the real wait is bundle loading,
  // which happens before this code runs. No fake progress needed.
  useEffect(() => {
    removeSplash();
  }, []);

  // Restore previous session (project path) on app mount
  useSessionRestore();

  const projectPath = useProjectStore((s) => s.projectPath);
  const { openFile } = useTauriIO();

  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const pendingRef = useRef<PendingAction>("close-project");

  const [showNewProject, setShowNewProject] = useState(false);
  const [showCreatePack, setShowCreatePack] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [settingsSystemTab, setSettingsSystemTab] = useState<SystemTab>("cpu");
  const [showExportSvg, setShowExportSvg] = useState(false);

  // Bypass flag: when true the onCloseRequested handler lets the close through.
  const forceCloseRef = useRef(false);
  const appWindow = useMemo(
    () => (isTauriRuntime() ? getCurrentWindow() : null),
    [],
  );

  // Tracks whether the dialog is visible. Updated SYNCHRONOUSLY (not via
  // useEffect) so the onCloseRequested handler always reads a fresh value —
  // Cmd+W fires both our keydown handler and Tauri's native close event in
  // the same tick, and a useEffect would still be false at that point.
  const dialogOpenRef = useRef(false);

  /** Show the confirmation dialog (updates both state and ref synchronously). */
  const openDialog = useCallback((action: PendingAction) => {
    pendingRef.current = action;
    dialogOpenRef.current = true;
    setShowDialog(true);
  }, []);

  /** Hide the confirmation dialog. */
  const closeDialog = useCallback(() => {
    dialogOpenRef.current = false;
    setShowDialog(false);
  }, []);

  // ---- Disable native decorations on non-macOS (macOS keeps native traffic lights) ----
  useEffect(() => {
    if (!isMac && appWindow) {
      void appWindow.setDecorations(false);
    }
  }, [appWindow]);

  // ---- Post-update verification + auto-check for updates ----
  useEffect(() => {
    const updateTarget = localStorage.getItem("tn-update-target");
    if (updateTarget) {
      localStorage.removeItem("tn-update-target");
      getVersion().then((currentVersion) => {
        if (currentVersion === updateTarget) {
          useToastStore.getState().addToast(`Updated to v${currentVersion}`, "success");
        } else {
          useToastStore.getState().addToast(
            `Update to v${updateTarget} may not have applied (running v${currentVersion})`,
            "error",
          );
        }
      });
      return; // Skip auto-update check this launch
    }

    if (!useSettingsStore.getState().autoCheckUpdates) return;
    const timer = setTimeout(checkForUpdates, 3000);
    return () => clearTimeout(timer);
  }, []);

  // ---- Intercept OS window close (X button / Cmd+W native) ----
  useEffect(() => {
    if (!appWindow) return;

    const unlisten = appWindow.onCloseRequested((event) => {
      // If we set the force-close flag, allow the window to close.
      if (forceCloseRef.current) return;

      // If the dialog is already showing (e.g. keyboard handler got there
      // first via Cmd+W), just prevent the close without touching pendingRef.
      if (dialogOpenRef.current) {
        event.preventDefault();
        return;
      }

      if (useProjectStore.getState().isDirty) {
        event.preventDefault();
        openDialog("window-close");
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [appWindow, openDialog]);

  // ---- Support opening files from the OS (drag/drop + Open With) ----
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    let disposed = false;

    // Drag/drop into window
    void (async () => {
      try {
        const stop = await listen<{ paths: string[] }>("tauri://drag-drop", (event) => {
          const paths = event.payload?.paths;
          if (paths && paths.length > 0) {
            openFile(paths[0]);
          }
        });
        if (disposed) {
          stop();
          return;
        }
        unlisten = stop;
      } catch {
        // Not running in a Tauri environment.
      }
    })();

    // Open via OS file association / "Open with" (launch arg)
    void (async () => {
      try {
        const filePath = await invoke<string | null>("get_launch_file");
        if (filePath) {
          openFile(filePath);
        }
      } catch {
        // Not running in a Tauri environment.
      }
    })();

    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, [openFile]);

  // ---- Toolbar: File > Close Project / Ctrl+W ----
  const requestCloseProject = useCallback(() => {
    if (useProjectStore.getState().isDirty) {
      openDialog("close-project");
    } else {
      useProjectStore.getState().closeProject();
    }
  }, [openDialog]);

  // ---- Dialog actions ----
  function executeClose() {
    closeDialog();
    setLoading(false);

    if (pendingRef.current === "window-close") {
      forceCloseRef.current = true;
      void appWindow?.close();
    } else {
      useProjectStore.getState().closeProject();
    }
  }

  async function handleSaveAndClose() {
    if (!saveRef.current) {
      executeClose();
      return;
    }
    setLoading(true);
    try {
      await saveRef.current();
      if (!useProjectStore.getState().isDirty) {
        executeClose();
      }
      // If still dirty, save failed — dialog stays open
    } finally {
      setLoading(false);
    }
  }

  function dismiss() {
    if (!loading) closeDialog();
  }

  // ---- Render ----
  const dialog = (
    <ConfirmDialog
      open={showDialog}
      onClose={dismiss}
      title="Unsaved Changes"
      message="You have unsaved changes. What would you like to do?"
      confirmLabel="Save & Close"
      onConfirm={handleSaveAndClose}
      secondaryLabel="Discard"
      onSecondary={executeClose}
      loading={loading}
    />
  );

  if (isDocsSmokeRoute()) {
    return <DocsSmokeHarness />;
  }

  if (isShapePreviewGalleryRoute()) {
    return <ShapePreviewGalleryHarnessLazy />;
  }

  if (projectPath === null) {
    return (
      <>
        <div className="flex flex-col h-screen bg-tn-bg text-tn-text">
          <SimpleTitleBar />
          <HomeScreen />
          {dialog}
          <LoadingDialog open={loading} message="Loading, please wait..." />
          <GlobalLoader />
          <SyncProgressModal />
          <Toast />
        </div>
        <BugReportHost />
      </>
    );
  }

  return (
    <ReactFlowProvider>
      <ProjectEditor
        requestCloseProject={requestCloseProject}
        showNewProject={showNewProject}
        setShowNewProject={setShowNewProject}
        showCreatePack={showCreatePack}
        setShowCreatePack={setShowCreatePack}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        settingsTab={settingsTab}
        setSettingsTab={setSettingsTab}
        settingsSystemTab={settingsSystemTab}
        setSettingsSystemTab={setSettingsSystemTab}
        showExportSvg={showExportSvg}
        setShowExportSvg={setShowExportSvg}
        dialog={dialog}
      />
      <LoadingDialog open={loading} message="Loading, please wait..." />
      <GlobalLoader />
      <SyncProgressModal />
      <BugReportHost />
    </ReactFlowProvider>
  );
}

function BugReportHost() {
  const open = useBugReportStore((s) => s.open);
  const errorContext = useBugReportStore((s) => s.errorContext);
  const close = useBugReportStore((s) => s.close);
  return (
    <BugReportDialog open={open} onClose={close} errorContext={errorContext} />
  );
}

function isDocsSmokeRoute(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return new URLSearchParams(window.location.search).get("docs-smoke") === "1";
  } catch {
    return false;
  }
}

function ShapePreviewGalleryHarnessLazy() {
  const [Harness, setHarness] = useState<ComponentType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    void import("@/dev/ShapePreviewGalleryHarness")
      .then((mod) => {
        setHarness(() => mod.ShapePreviewGalleryHarness);
        setLoadError(null);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : String(err));
      });
  }, []);
  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center bg-tn-bg p-6 text-sm text-red-400">
        Shape preview gallery failed to load: {loadError}
      </div>
    );
  }
  if (!Harness) {
    return (
      <div className="flex h-screen items-center justify-center bg-tn-bg text-sm text-tn-text-muted">
        Loading shape preview gallery…
      </div>
    );
  }
  return <Harness />;
}

function isShapePreviewGalleryRoute(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return new URLSearchParams(window.location.search).get("shape-preview-gallery") === "1";
  } catch {
    return false;
  }
}

function DocsSmokeHarness() {
  try {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("doc") ?? "walkthroughs/terrain-and-caves";
    localStorage.setItem("tn-docs-last-slug", slug);
  } catch {
    // Ignore storage issues in smoke runs.
  }

  return (
    <div className="h-screen bg-tn-bg text-tn-text">
      <div className="mx-auto flex h-full max-w-6xl flex-col border-x border-tn-border bg-tn-surface">
        <Suspense fallback={<div className="flex flex-1 items-center justify-center text-sm text-tn-text-muted">Loading docs…</div>}>
          <DocsPanel />
        </Suspense>
      </div>
    </div>
  );
}

function ProjectEditor({
  requestCloseProject,
  showNewProject,
  setShowNewProject,
  showCreatePack,
  setShowCreatePack,
  showSettings,
  setShowSettings,
  settingsTab,
  setSettingsTab,
  settingsSystemTab,
  setSettingsSystemTab,
  showExportSvg,
  setShowExportSvg,
  dialog,
}: {
  requestCloseProject: () => void;
  showNewProject: boolean;
  setShowNewProject: (show: boolean) => void;
  showCreatePack: boolean;
  setShowCreatePack: (show: boolean) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  settingsTab: SettingsTab;
  setSettingsTab: (tab: SettingsTab) => void;
  settingsSystemTab: SystemTab;
  setSettingsSystemTab: (tab: SystemTab) => void;
  showExportSvg: boolean;
  setShowExportSvg: (show: boolean) => void;
  dialog: React.ReactNode;
}) {
  const openSettings = useCallback((tab: SettingsTab = "general", systemTab: SystemTab = "cpu") => {
    setSettingsTab(tab);
    setSettingsSystemTab(systemTab);
    setShowSettings(true);
  }, [setSettingsSystemTab, setSettingsTab, setShowSettings]);

  // Wire up global keyboard shortcuts
  useGlobalKeyboardShortcuts({
    onCloseProject: requestCloseProject,
    onNewProject: () => setShowNewProject(true),
    onCreatePack: () => setShowCreatePack(true),
    onSettings: () => openSettings("general"),
    onExportSvg: () => setShowExportSvg(true),
  });

  // Auto-save on edit when instant save is enabled
  useInstantSave();
  useProjectLegacyScan();

  return (
    <>
      <div className="flex flex-col h-screen bg-tn-bg text-tn-text">
        <ProjectTitleBar
          onCloseProject={requestCloseProject}
          onNewProject={() => setShowNewProject(true)}
          onCreatePack={() => setShowCreatePack(true)}
          onSettings={() => openSettings("general")}
          onShortcuts={() => openSettings("shortcuts")}
          onExportSvg={() => setShowExportSvg(true)}
        />
        <ErrorBoundary>
          <PanelLayout />
        </ErrorBoundary>
        <StatusBar />
      </div>
      <DragGhost />
      <Toast />
      {dialog}
      <NewProjectDialog open={showNewProject} onClose={() => setShowNewProject(false)} />
      {showCreatePack && (
        <Suspense fallback={null}>
          <CreatePackWizardDialog open onClose={() => setShowCreatePack(false)} />
        </Suspense>
      )}
      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        initialTab={settingsTab}
        initialSystemTab={settingsSystemTab}
      />
      <ExportSvgDialogWrapper open={showExportSvg} onClose={() => setShowExportSvg(false)} />
    </>
  );
}

function ExportSvgDialogWrapper({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reactFlow = useReactFlow();

  async function handleExportSvg(options: SvgExportOptions) {
    const { exportGraphAsSvg } = await import("@/utils/exportSvg");
    return exportGraphAsSvg(reactFlow, options);
  }

  async function handleExportPng(options: SvgExportOptions) {
    const { exportGraphAsPng } = await import("@/utils/exportSvg");
    return exportGraphAsPng(reactFlow, options);
  }

  if (!open) return null;

  return (
    <Suspense fallback={null}>
      <ExportSvgDialog
        open
        onClose={onClose}
        onExportSvg={handleExportSvg}
        onExportPng={handleExportPng}
        reactFlow={reactFlow}
      />
    </Suspense>
  );
}
