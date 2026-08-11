import { useEffect } from "react";

import { track } from "@/shared/analytics";
import { downloadingItemsSelector } from "@/tab/selectors";
import { flushHistory } from "@/tab/services/download-history";
import { useStore } from "@/tab/store";
import type { ItemStatus } from "@/types";

const emitSessionSummary = () => {
  const state = useStore.getState();
  const items = [...state.items.values()];
  if (items.length === 0) {
    return;
  }
  const count = (status: ItemStatus) =>
    items.filter((item) => item.status === status).length;
  track("download_session", {
    total: items.length,
    completed: count("completed"),
    failed: count("failed"),
    rate_limited: count("rate_limited"),
    preparing: count("preparing"),
    concurrency: state.config.concurrency,
  });
};

export const useOnTabUnload = () => {
  useEffect(() => {
    const handleTabClose = (event: BeforeUnloadEvent) => {
      flushHistory();

      if (downloadingItemsSelector(useStore.getState()).length > 0) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const handleHidden = () => {
      if (document.hidden) {
        flushHistory();
      }
    };
    const handlePageHide = () => {
      flushHistory();
      emitSessionSummary();
    };

    window.addEventListener("beforeunload", handleTabClose);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleHidden);

    return () => {
      window.removeEventListener("beforeunload", handleTabClose);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleHidden);
    };
  }, []);
};
