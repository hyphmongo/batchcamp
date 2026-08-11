import type PQueue from "p-queue";
import { useEffect } from "react";

import { track } from "@/shared/analytics";
import { captureError } from "@/shared/error-handler";
import type { Configuration } from "@/storage";
import { totalItemCountSelector } from "@/tab/selectors";
import {
  pauseActiveDownloads,
  resumeActiveDownloads,
} from "@/tab/services/download-control";
import { resetProgress } from "@/tab/services/download-progress";
import { useStore } from "@/tab/store";

const settleFiles = async (
  apply: () => Promise<void>,
  operation: string,
): Promise<void> => {
  try {
    await apply();
  } catch (error) {
    captureError(error, {}, { operation });
  }
};

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
    if (!paused && !accountUnverified) {
      queue.start();
    }
  }, [
    config.hasOnboarded,
    config.concurrency,
    queue,
    paused,
    accountUnverified,
  ]);

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
      queue.start();
      setDownloadsPaused(false);
      await settleFiles(resumeActiveDownloads, "resume_active_downloads");
      return;
    }

    queue.pause();
    setDownloadsPaused(true);
    await settleFiles(pauseActiveDownloads, "pause_active_downloads");
  };

  return { paused, togglePause };
};
