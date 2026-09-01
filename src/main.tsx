import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary, recordExternalCrash } from "./components/ErrorBoundary";
import { installBlankWindowWatchdog } from "./utils/blankWindowWatchdog";
import { startWebviewHeartbeat } from "./utils/webviewHeartbeat";
import { removeSplash } from "./utils/splashProgress";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

// Failsafe: never leave the HTML splash covering the window if React stalls.
window.setTimeout(() => removeSplash(), 15_000);

// If nothing rendered, say why instead of showing an empty window.
installBlankWindowWatchdog();

// Lets the Rust watchdog notice a dead WKWebView, which JS cannot detect itself.
startWebviewHeartbeat();

// Uncaught synchronous errors escape React's boundary too. Record them so a
// blank window still has a traceable cause after the reload that clears the
// console.
window.addEventListener("error", (event) => {
  const error = event.error as Error | undefined;
  recordExternalCrash(error?.message ?? event.message ?? "Unknown error", error?.stack);
});

// Catch async errors that escape React's error boundary (workers, IPC, fire-and-forget promises).
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  // Suppress intentional cancellations — they aren't errors.
  if (reason === "cancelled" || (reason instanceof Error && reason.message === "cancelled")) return;
  console.error("[TerraNova] Unhandled promise rejection:", reason);
  recordExternalCrash(
    reason instanceof Error ? reason.message : `Unhandled rejection: ${String(reason)}`,
    reason instanceof Error ? reason.stack : undefined,
  );
  // Best-effort toast — store may not be mounted on very early errors, so swallow failures.
  import("./stores/toastStore")
    .then(({ useToastStore }) => {
      useToastStore.getState().addToast("An unexpected error occurred — check the console for details", "error");
    })
    .catch(() => {});
});
