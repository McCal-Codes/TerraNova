import { Home, LayoutGrid, Clock, Plus, FolderOpen, Package, Settings as SettingsIcon } from "lucide-react";
import { formatShortcut } from "@/utils/platform";

export type SidebarTab = "home" | "templates" | "recent";

interface HomeSidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onNewProject: () => void;
  onCreatePack: () => void;
  onOpenProject: () => void;
  onOpenSettings: () => void;
}

const TABS: { id: SidebarTab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "templates", label: "Templates", icon: LayoutGrid },
  { id: "recent", label: "Recent", icon: Clock },
];

export function HomeSidebar({
  activeTab,
  onTabChange,
  onNewProject,
  onCreatePack,
  onOpenProject,
  onOpenSettings,
}: HomeSidebarProps) {
  return (
    <div className="w-[200px] shrink-0 bg-tn-surface border-r border-tn-border flex flex-col">
      {/* Logo area */}
      <div className="px-4 py-5 border-b border-tn-border">
        <h1 className="text-sm font-bold text-tn-text tracking-wide">
          TerraNova
        </h1>
        <p className="text-[10px] text-tn-text-muted mt-0.5">
          World Generation Studio
        </p>
      </div>

      {/* Nav tabs */}
      <nav className="flex-1 py-3 px-2 flex flex-col gap-0.5" aria-label="Home sections">
        {TABS.map(({ id, label, icon: Icon }) => {
          const selected = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              aria-current={selected ? "page" : undefined}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                selected
                  ? "bg-tn-accent/15 text-tn-accent font-medium"
                  : "text-tn-text-muted hover:bg-tn-bg hover:text-tn-text"
              }`}
            >
              <Icon size={16} aria-hidden />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="p-3 border-t border-tn-border flex flex-col gap-2">
        <button
          type="button"
          onClick={onCreatePack}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-tn-accent text-tn-bg hover:opacity-90 transition-opacity"
        >
          <Package size={15} aria-hidden />
          Create Pack
        </button>
        <button
          type="button"
          onClick={onNewProject}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-tn-border text-tn-text-muted hover:bg-tn-bg hover:text-tn-text transition-colors"
        >
          <Plus size={15} aria-hidden />
          New Project
          <span className="ml-auto text-[10px] opacity-60">{formatShortcut("Ctrl+N")}</span>
        </button>
        <button
          type="button"
          onClick={onOpenProject}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-tn-border text-tn-text-muted hover:bg-tn-bg hover:text-tn-text transition-colors"
        >
          <FolderOpen size={15} aria-hidden />
          Open
          <span className="ml-auto text-[10px] opacity-60">{formatShortcut("Ctrl+O")}</span>
        </button>
        {/*
          Settings was previously unreachable from Home — only from the editor
          chrome or the first-run onboarding dialog, so anyone who had completed
          onboarding and had no project open could not get to it at all.
          Cmd+, is the macOS convention and matches the app menu.
        */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-tn-border text-tn-text-muted hover:bg-tn-bg hover:text-tn-text transition-colors"
        >
          <SettingsIcon size={15} aria-hidden />
          Settings
          <span className="ml-auto text-[10px] opacity-60">{formatShortcut("Ctrl+,")}</span>
        </button>
      </div>
    </div>
  );
}
