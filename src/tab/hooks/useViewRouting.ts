import { useEffect, useState } from "react";

import { track } from "@/shared/analytics";
import { totalItemCountSelector } from "@/tab/selectors";
import { browserAdapter } from "@/tab/services/browser-adapter";
import { useStore } from "@/tab/store";
import { isMessage } from "@/types";

export type View = "downloads" | "settings";

export const useViewRouting = () => {
  const [view, setView] = useState<View>(() =>
    window.location.hash === "#settings" ? "settings" : "downloads",
  );

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setView((current) => (current === "settings" ? "downloads" : current));
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(
    () =>
      useStore.subscribe(totalItemCountSelector, (count, prevCount) => {
        if (count > prevCount) {
          setView((current) =>
            current === "settings" ? "downloads" : current,
          );
        }
      }),
    [],
  );

  useEffect(() => {
    const handleMessage = (message: unknown) => {
      if (isMessage(message) && message.type === "show-settings") {
        setView("settings");
      }
    };
    return browserAdapter.events.onMessage.subscribe(handleMessage);
  }, []);

  const openSettings = () => {
    track("settings_opened");
    setView("settings");
  };

  const backToDownloads = () => {
    setView("downloads");
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  };

  return { view, openSettings, backToDownloads };
};
