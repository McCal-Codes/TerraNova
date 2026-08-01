import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { buildBugReportBundle, formatBugReportClipboard } from "@/utils/bugReport";
import { copyTextToClipboard } from "@/utils/devTools";
import { useBugReportStore } from "@/stores/bugReportStore";
import { useToastStore } from "@/stores/toastStore";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

/** Most recent crashes, newest first. Survives the reload that clears console. */
const CRASH_LOG_KEY = "tn-crash-log";
const CRASH_LOG_LIMIT = 5;

export interface PersistedCrash {
  at: string;
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
}

export function readCrashLog(): PersistedCrash[] {
  try {
    const raw = localStorage.getItem(CRASH_LOG_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PersistedCrash[]) : [];
  } catch {
    return [];
  }
}

export function clearCrashLog(): void {
  try {
    localStorage.removeItem(CRASH_LOG_KEY);
  } catch {
    // ignore
  }
}

/**
 * Writes the crash to localStorage before anything else can go wrong.
 *
 * A React crash blanks the window, and in the Tauri shell there is no easy
 * console to read afterwards — reloading to recover also throws away the only
 * record of what happened. Persisting first means the crash is still
 * recoverable after a restart, via readCrashLog() or the debug bundle.
 */
/**
 * Records a crash that React's error boundary cannot see — an uncaught sync
 * error or an unhandled promise rejection. Those escape boundaries entirely,
 * so without this they leave no trace once the console is cleared by a reload.
 */
export function recordExternalCrash(message: string, stack?: string): void {
  persistCrash(Object.assign(new Error(message), { stack }), null);
}

function persistCrash(error: Error, componentStack: string | null): void {
  try {
    const entry: PersistedCrash = {
      at: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      componentStack: componentStack ?? undefined,
      url: window.location.href,
    };
    const next = [entry, ...readCrashLog()].slice(0, CRASH_LOG_LIMIT);
    localStorage.setItem(CRASH_LOG_KEY, JSON.stringify(next));
    mirrorToDisk(next);
  } catch {
    // Storage full or unavailable — the on-screen report is still shown.
  }
}

/**
 * Also write to ~/Library/Logs/<app>/crash.log. localStorage alone is not
 * enough: a force quit can lose buffered writes, and reading it back means
 * devtools or spelunking WebKit's sqlite. Imported lazily so a crash during
 * startup is not made worse by pulling in the Tauri path/IPC modules, and
 * deliberately not awaited — the on-screen report must not wait on disk.
 */
function mirrorToDisk(history: PersistedCrash[]): void {
  void import("@/utils/crashLogFile")
    .then(({ writeCrashLogFile }) => writeCrashLogFile(history))
    .catch(() => {});
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
    persistCrash(error, info.componentStack ?? null);
  }

  private errorContext() {
    const { error, componentStack } = this.state;
    if (!error) return undefined;
    return {
      message: error.message,
      stack: error.stack,
      componentStack: componentStack ?? undefined,
    };
  }

  async handleCopyBundle() {
    try {
      const bundle = await buildBugReportBundle({ error: this.errorContext() });
      await copyTextToClipboard(formatBugReportClipboard(bundle));
      useToastStore.getState().addToast("Debug bundle copied to clipboard.", "success");
    } catch (err) {
      useToastStore.getState().addToast(`Could not copy debug bundle: ${err}`, "error");
    }
  }

  handleReportBug() {
    useBugReportStore.getState().requestOpen(this.errorContext() ?? null);
  }

  render() {
    if (this.state.hasError) {
      return (
        // min-h-screen, not flex-1: flex-1 only has height when the parent is a
        // sized flex container. When this boundary catches at the app root that
        // is not guaranteed, and the recovery UI collapses to zero height — the
        // crash then looks like a plain blank window with no way to report it.
        <div className="flex min-h-screen w-full items-center justify-center overflow-auto bg-tn-bg p-6 text-tn-text">
          <div className="w-full max-w-2xl space-y-4">
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="text-sm text-tn-text-secondary break-words">
              {this.state.error?.message ?? "An unexpected error occurred."}
            </p>

            {/*
              Shown inline because the Tauri shell has no easily reachable
              console — without this the stack is only visible to someone who
              knows to open devtools.
            */}
            {(this.state.error?.stack || this.state.componentStack) && (
              <details className="rounded border border-tn-border bg-tn-surface/40 text-left">
                <summary className="cursor-pointer px-3 py-2 text-xs text-tn-text-muted">
                  Technical details
                </summary>
                <div className="max-h-64 overflow-auto border-t border-tn-border px-3 py-2">
                  {this.state.componentStack ? (
                    <>
                      <p className="text-[11px] font-medium text-tn-text-muted">Component stack</p>
                      <pre className="mb-3 whitespace-pre-wrap break-all text-[11px] leading-relaxed text-tn-text-muted">
                        {this.state.componentStack.trim()}
                      </pre>
                    </>
                  ) : null}
                  {this.state.error?.stack ? (
                    <>
                      <p className="text-[11px] font-medium text-tn-text-muted">Stack</p>
                      <pre className="whitespace-pre-wrap break-all text-[11px] leading-relaxed text-tn-text-muted">
                        {this.state.error.stack}
                      </pre>
                    </>
                  ) : null}
                </div>
              </details>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded bg-tn-accent text-white text-sm hover:opacity-90"
                onClick={() => this.setState({ hasError: false, error: null, componentStack: null })}
              >
                Try Again
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded bg-tn-surface border border-tn-border text-sm hover:bg-tn-border"
                onClick={() => window.location.reload()}
              >
                Reload Page
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded border border-tn-border text-sm hover:bg-tn-surface"
                onClick={() => void this.handleCopyBundle()}
              >
                Copy debug bundle
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded border border-tn-border text-sm hover:bg-tn-surface"
                onClick={() => this.handleReportBug()}
              >
                Report bug
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

