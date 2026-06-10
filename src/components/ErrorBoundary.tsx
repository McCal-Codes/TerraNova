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
        <div className="flex flex-1 items-center justify-center bg-tn-bg text-tn-text">
          <div className="text-center space-y-4 max-w-md px-4">
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="text-sm text-tn-text-secondary break-words">
              {this.state.error?.message ?? "An unexpected error occurred."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded bg-tn-accent text-white text-sm hover:opacity-90"
                onClick={() => this.setState({ hasError: false, error: null, componentStack: null })}
              >
                Try Again
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

