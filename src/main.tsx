import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
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

// Catch async errors that escape React's error boundary (workers, IPC, fire-and-forget promises).
window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  // Suppress intentional cancellations — they aren't errors.
  if (reason === "cancelled" || (reason instanceof Error && reason.message === "cancelled")) return;
  console.error("[TerraNova] Unhandled promise rejection:", reason);
  // Best-effort toast — store may not be mounted on very early errors, so swallow failures.
  import("./stores/toastStore")
    .then(({ useToastStore }) => {
      useToastStore.getState().addToast("An unexpected error occurred — check the console for details", "error");
    })
    .catch(() => {});
});
