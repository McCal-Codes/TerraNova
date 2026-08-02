import { lazy, Suspense, useState, useEffect, useCallback } from "react";
import { matchesKeybinding } from "@/config/keybindings";
import { useTauriIO } from "@/hooks/useTauriIO";
import { useRecentProjectsStore } from "@/stores/recentProjectsStore";
import { confirmOpenPackWithAlphaBackup } from "@/utils/openPackWithAlphaGuard";
import { openProjectAtPath } from "@/utils/openProjectAtPath";
import { NewProjectDialog } from "@/components/dialogs/NewProjectDialog";
const CreatePackWizardDialog = lazy(() =>
  import("@/components/dialogs/CreatePackWizardDialog").then((m) => ({ default: m.CreatePackWizardDialog })),
);
import { WhatsNewDialog, useWhatsNew } from "@/components/dialogs/WhatsNewDialog";
import { OnboardingDialog, isOnboardingComplete } from "@/components/dialogs/OnboardingDialog";
import { AlphaWhatToTestDialog } from "@/components/dialogs/AlphaWhatToTestDialog";
import { isAlphaWhatToTestDismissed } from "@/constants/alphaTestFocus";
import { SettingsDialog } from "@/components/dialogs/SettingsDialog";
import type { HomeLearnSlug } from "@/components/home/HomeLearnDialog";

const HomeLearnDialog = lazy(() =>
  import("@/components/home/HomeLearnDialog").then((m) => ({ default: m.HomeLearnDialog })),
);
import { HomeSidebar, type SidebarTab } from "./HomeSidebar";
import { HomeTab } from "./HomeTab";
import { TemplatesTab } from "./TemplatesTab";
import { RecentTab } from "./RecentTab";

export function HomeScreen() {
  const [activeTab, setActiveTab] = useState<SidebarTab>("home");
  const [showNewProject, setShowNewProject] = useState(false);
  const [showCreatePack, setShowCreatePack] = useState(false);
  const [defaultTemplate, setDefaultTemplate] = useState<string | undefined>();
  const { openAssetPack } = useTauriIO();
  const removeProject = useRecentProjectsStore((s) => s.removeProject);
  const { shouldShow: showWhatsNew, dismiss: dismissWhatsNew } = useWhatsNew();
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(() => !isOnboardingComplete());
  const [alphaTestOpen, setAlphaTestOpen] = useState(
    () => isOnboardingComplete() && !isAlphaWhatToTestDismissed(),
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showLearn, setShowLearn] = useState(false);
  const [learnSlug, setLearnSlug] = useState<HomeLearnSlug>("walkthroughs/quickstart");

  const openLearn = useCallback((slug: HomeLearnSlug) => {
    setLearnSlug(slug);
    setShowLearn(true);
  }, []);

  useEffect(() => {
    if (onboardingOpen || alphaTestOpen) return;
    if (showWhatsNew) setWhatsNewOpen(true);
  }, [showWhatsNew, onboardingOpen, alphaTestOpen]);

  function handleOnboardingClose() {
    setOnboardingOpen(false);
    if (!isAlphaWhatToTestDismissed()) {
      setAlphaTestOpen(true);
    }
  }

  function handleCloseWhatsNew(suppress: boolean) {
    dismissWhatsNew(suppress);
    setWhatsNewOpen(false);
  }

  async function handleOpenRecentProject(path: string) {
    try {
      const ok = await confirmOpenPackWithAlphaBackup(path);
      if (!ok) return;
      await openProjectAtPath(path);
    } catch {
      removeProject(path);
    }
  }

  function handleSelectTemplate(templateName: string) {
    setDefaultTemplate(templateName);
    setShowNewProject(true);
  }

  function handleNewProject() {
    setDefaultTemplate(undefined);
    setShowNewProject(true);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (matchesKeybinding("newProject", e)) {
        e.preventDefault();
        handleNewProject();
      } else if (matchesKeybinding("createPack", e)) {
        e.preventDefault();
        setShowCreatePack(true);
      } else if (e.key === "o") {
        e.preventDefault();
        openAssetPack();
      } else if (e.key === ",") {
        // macOS convention for preferences; harmless on other platforms.
        e.preventDefault();
        setShowSettings(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openAssetPack]);

  return (
    <div className="flex flex-1 bg-tn-bg text-tn-text">
      <HomeSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onNewProject={handleNewProject}
        onCreatePack={() => setShowCreatePack(true)}
        onOpenProject={openAssetPack}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {activeTab === "home" && (
          <HomeTab
            onOpenProject={handleOpenRecentProject}
            onRemoveProject={removeProject}
            onSelectTemplate={handleSelectTemplate}
            onSwitchTab={(tab) => setActiveTab(tab as SidebarTab)}
            onOpenLearn={() => openLearn("walkthroughs/quickstart")}
          />
        )}
        {activeTab === "templates" && (
          <TemplatesTab onSelectTemplate={handleSelectTemplate} />
        )}
        {activeTab === "recent" && (
          <RecentTab onOpenProject={handleOpenRecentProject} />
        )}
      </div>

      <NewProjectDialog
        open={showNewProject}
        onClose={() => setShowNewProject(false)}
        defaultTemplate={defaultTemplate}
      />
      {showCreatePack && (
        <Suspense fallback={null}>
          <CreatePackWizardDialog open onClose={() => setShowCreatePack(false)} />
        </Suspense>
      )}
      <OnboardingDialog
        open={onboardingOpen}
        onClose={handleOnboardingClose}
        onOpenCreatePack={() => {
          handleOnboardingClose();
          setShowCreatePack(true);
        }}
        onOpenSettings={() => setShowSettings(true)}
        onOpenLearn={openLearn}
      />
      <AlphaWhatToTestDialog
        open={alphaTestOpen}
        onClose={() => setAlphaTestOpen(false)}
        onOpenOnboarding={() => {
          setAlphaTestOpen(false);
          setOnboardingOpen(true);
        }}
      />
      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
      {showLearn && (
        <Suspense fallback={null}>
          <HomeLearnDialog
            open
            onClose={() => setShowLearn(false)}
            initialSlug={learnSlug}
          />
        </Suspense>
      )}
      <WhatsNewDialog
        open={whatsNewOpen && !onboardingOpen && !alphaTestOpen}
        onClose={handleCloseWhatsNew}
      />
    </div>
  );
}
