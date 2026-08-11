import { renderHook } from "@testing-library/react";
import PQueue from "p-queue";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { onboardedConfig } from "@/tab/__tests__/journey-fixtures";
import { useQueueController } from "@/tab/hooks/useQueueController";
import {
  pauseActiveDownloads,
  resumeActiveDownloads,
} from "@/tab/services/download-control";
import { useStore } from "@/tab/store";

vi.mock("@/tab/services/download-control", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  pauseActiveDownloads: vi.fn().mockResolvedValue(undefined),
  resumeActiveDownloads: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  vi.mocked(pauseActiveDownloads).mockResolvedValue(undefined);
  vi.mocked(resumeActiveDownloads).mockResolvedValue(undefined);
  useStore.getState().setDownloadsPaused(false);
});

describe("pausing when the browser refuses to co-operate", () => {
  it("still records the pause, so the button can undo it", async () => {
    vi.mocked(pauseActiveDownloads).mockRejectedValue(
      new Error("downloads API unavailable"),
    );
    const queue = new PQueue();
    const { result } = renderHook(() =>
      useQueueController(queue, onboardedConfig),
    );

    await act(async () => {
      await result.current.togglePause();
    });

    expect(queue.isPaused).toBe(true);
    expect(useStore.getState().downloadsPaused).toBe(true);
  });

  it("lets the queue run again even if resuming the files fails", async () => {
    vi.mocked(resumeActiveDownloads).mockRejectedValue(
      new Error("downloads API unavailable"),
    );
    const queue = new PQueue();
    useStore.getState().setDownloadsPaused(true);
    queue.pause();

    const { result } = renderHook(() =>
      useQueueController(queue, onboardedConfig),
    );

    await act(async () => {
      await result.current.togglePause();
    });

    expect(queue.isPaused).toBe(false);
    expect(useStore.getState().downloadsPaused).toBe(false);
  });
});

describe("useQueueController", () => {
  it("keeps the queue paused while the account is unverified", async () => {
    const queue = new PQueue({ autoStart: false });
    const { rerender } = renderHook(
      ({ concurrency }) =>
        useQueueController(queue, { ...onboardedConfig, concurrency }),
      { initialProps: { concurrency: 3 } },
    );

    await act(async () => {
      useStore.getState().setAccountUnverified(true);
    });
    expect(queue.isPaused).toBe(true);

    await act(async () => {
      rerender({ concurrency: 5 });
    });

    expect(queue.isPaused).toBe(true);
  });
});
