import { useEffect, useState } from "react";

import { totalSizeMbSelector } from "@/tab/selectors";
import {
  getProgress,
  onProgressChange,
} from "@/tab/services/download-progress";
import { type State, useStore } from "@/tab/store";

const formatEta = (seconds: number): string => {
  if (seconds < 60) {
    return "< 1 min";
  }
  if (seconds < 3600) {
    const mins = Math.ceil(seconds / 60);
    return `~${mins} min`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.ceil((seconds % 3600) / 60);
  return mins > 0 ? `~${hours}h ${mins}m` : `~${hours}h`;
};

const formatSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond < 1024) {
    return `${Math.round(bytesPerSecond)} B/s`;
  }
  if (bytesPerSecond < 1024 * 1024) {
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  }
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
};

const MB_TO_BYTES = 1024 * 1024;
const ETA_MIN_WINDOW_MS = 3000;

const hasUnpausedDownloadingItem = (state: State): boolean => {
  for (const item of state.items.values()) {
    if (item.status === "downloading" && !state.pausedItemIds.has(item.id)) {
      return true;
    }
  }
  return false;
};

export const useOverallProgress = () => {
  const totalSizeMb = useStore(totalSizeMbSelector);
  const hasActiveDownload = useStore(hasUnpausedDownloadingItem);
  const [snapshot, setSnapshot] = useState(getProgress);

  useEffect(
    () =>
      onProgressChange(() =>
        setSnapshot((prev) => {
          const next = getProgress();
          return prev.bytesReceived === next.bytesReceived &&
            prev.bytesPerSecond === next.bytesPerSecond &&
            prev.sampleSpanMs === next.sampleSpanMs
            ? prev
            : next;
        }),
      ),
    [],
  );

  useEffect(() => {
    if (!hasActiveDownload) {
      return;
    }
    const timer = setInterval(() => {
      setSnapshot((prev) => {
        const next = getProgress();
        return prev.bytesReceived === next.bytesReceived &&
          prev.bytesPerSecond === next.bytesPerSecond
          ? prev
          : next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [hasActiveDownload]);

  const totalBytes = totalSizeMb * MB_TO_BYTES;
  const { bytesReceived, bytesPerSecond, sampleSpanMs } = snapshot;

  let eta: string | null = null;
  let speed: string | null = null;

  if (hasActiveDownload && bytesPerSecond && bytesPerSecond > 0) {
    speed = formatSpeed(bytesPerSecond);

    if (totalBytes > 0 && sampleSpanMs >= ETA_MIN_WINDOW_MS) {
      const remaining = (totalBytes - bytesReceived) / bytesPerSecond;
      eta = formatEta(remaining);
    }
  }

  return { eta, speed, bytesReceived };
};
