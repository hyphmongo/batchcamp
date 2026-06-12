import type PQueue from "p-queue";
import { useEffect } from "react";

import { track } from "@/shared/analytics";
import type { Configuration } from "@/storage";
import { totalItemCountSelector } from "@/tab/selectors";
import {
  pauseActiveDownloads,
  resumeActiveDownloads,
} from "@/tab/services/download-control";
import { resetProgress } from "@/tab/services/download-progress";
import { useStore } from "@/tab/store";

export const useQueueController = (queue: PQueue, config: Configuration) => {
  const paused = useStore((state) => state.downloadsPaused);
  const setDownloadsPaused = useStore((state) => state.setDownloadsPaused);
  const accountUnverified = useStore((state) => state.accountUnverified);

  useEffect(() => {
    if (!config.hasOnboarded) {
      queue.pause();
      return;
    }
    queue.concurrency = config.concurrency;
    if (!paused) {
      queue.start();
    }
  }, [config.hasOnboarded, config.concurrency, queue, paused]);

  useEffect(() => {
    if (accountUnverified) {
      queue.pause();
    } else if (!paused && config.hasOnboarded) {
      queue.start();
    }
  }, [accountUnverified, paused, config.hasOnboarded, queue]);

  useEffect(
    () =>
      useStore.subscribe(totalItemCountSelector, (count, prevCount) => {
        if (count === 0 && prevCount > 0) {
          useStore.getState().setDownloadsPaused(false);
          queue.start();
          resetProgress();
        }
      }),
    [queue],
  );

  const togglePause = async () => {
    const isPaused = useStore.getState().downloadsPaused;
    track(isPaused ? "downloads_resumed" : "downloads_paused");
    if (isPaused) {
      await resumeActiveDownloads();
      queue.start();
      setDownloadsPaused(false);
    } else {
      queue.pause();
      await pauseActiveDownloads();
      setDownloadsPaused(true);
    }
  };

  return { paused, togglePause };
};
