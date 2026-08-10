import { renderHook } from "@testing-library/react";
import PQueue from "p-queue";
import { act } from "react";
import { describe, expect, it } from "vitest";

import { onboardedConfig } from "@/tab/__tests__/journey-fixtures";
import { useQueueController } from "@/tab/hooks/useQueueController";
import { useStore } from "@/tab/store";

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
