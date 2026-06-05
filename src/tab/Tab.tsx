import "../styles.css";

import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";

import { initAnalytics } from "@/shared/analytics";
import { ErrorBoundary } from "@/shared/ErrorBoundary";
import { initSentry } from "@/shared/sentry";
import { Downloads } from "./components/Downloads";
import { useConfig } from "./hooks/useConfig";
import { useQueue } from "./hooks/useQueue";
import { useStore } from "./store";

void initSentry("tab");
void initAnalytics("tab");

const Tab = () => {
  const { config, isLoading } = useConfig();
  const queue = useQueue();
  const initializeDownloadHistory = useStore(
    (state) => state.initializeDownloadHistory,
  );

  useEffect(() => {
    document.body.classList.add("bc-tab-surface");
    return () => {
      document.body.classList.remove("bc-tab-surface");
    };
  }, []);

  useEffect(() => initializeDownloadHistory(), [initializeDownloadHistory]);

  if (isLoading) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        role="status"
        aria-label="Loading"
      >
        <span className="loading loading-lg"></span>
      </div>
    );
  }

  return <Downloads config={config} queue={queue} />;
};

const app = document.getElementById("root");
if (!app) {
  throw new Error("Root element not found");
}

if (!app.dataset.reactRoot) {
  app.dataset.reactRoot = "true";
  const root = createRoot(app);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <Tab />
      </ErrorBoundary>
    </React.StrictMode>,
  );
}
