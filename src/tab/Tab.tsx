import "../styles.css";

import * as Sentry from "@sentry/browser";
import PQueue from "p-queue";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import Downloads from "./components/Downloads";
import { useStore } from "./store";

Sentry.init({
  dsn: "https://e745cbdff7424075b8bbb1bd27a480cf@o1332246.ingest.sentry.io/6596634",
  integrations: [new Sentry.BrowserTracing()],
});

const useConfig = () => {
  const { config, configInitialized, initializeConfig } = useStore((state) => ({
    config: state.config,
    configInitialized: state.configInitialized,
    initializeConfig: state.initializeConfig,
  }));

  useEffect(() => {
    const init = async () => {
      await initializeConfig();
    };

    init();
  }, [initializeConfig]);

  return { config, isLoading: !configInitialized };
};

const useQueue = () => {
  const [queue] = useState(() => new PQueue());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
    }

    return () => {
      queue.clear();
    };
  }, [queue]);

  return queue;
};

const Tab = () => {
  const { config, isLoading } = useConfig();
  const queue = useQueue();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return <Downloads config={config} queue={queue} />;
};

(async () => {
  const app = document.getElementById("root") as Element;
  const root = createRoot(app);

  root.render(
    <React.StrictMode>
      <Tab />
    </React.StrictMode>
  );
})();
