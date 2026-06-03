import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Downloads } from "@/tab/components/Downloads";
import { useStore } from "@/tab/store";
import type { PendingItem } from "@/types";
import {
  makePending,
  makeQueue,
  onboardedConfig,
  setupJourneyHarness,
  teardownJourneyHarness,
} from "./journey-fixtures";
import type { TestHarness } from "./test-harness";

vi.mock("@/tab/services/parser", () => ({
  parse: async (item: PendingItem) => [
    {
      id: `${item.id}-dl`,
      url: `https://bandcamp.com/download/${item.id}?token=abc`,
      artist: item.title.split(" - ")[0] ?? "Artist",
      title: item.title.split(" - ").slice(1).join(" - ") || item.title,
      format: "mp3-320" as const,
      progress: 0,
    },
  ],
}));

let harness: TestHarness;

beforeEach(() => {
  harness = setupJourneyHarness();
});

afterEach(() => {
  teardownJourneyHarness();
});

describe("journey: inline retry on a failed top-level item", () => {
  it("re-queues the item, downloads again, and completes successfully", async () => {
    const user = userEvent.setup();
    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    await waitFor(() => {
      expect(harness.subscriberCounts.onMessage()).toBeGreaterThan(0);
    });

    act(() => {
      harness.emitMessage({
        type: "send-items-to-tab",
        items: [makePending("retry-1", "Joy Orbison - Hyph Mngo")],
      });
    });

    await screen.findByText("Hyph Mngo");
    await waitFor(() => {
      expect(Object.keys(useStore.getState().browserIdToItemId)).toHaveLength(
        1,
      );
    });
    const initialBrowserId = Number(
      Object.keys(useStore.getState().browserIdToItemId)[0],
    );

    const itemId = useStore.getState().browserIdToItemId[initialBrowserId]!;
    act(() => {
      useStore.getState().updateItemStatus(itemId, "failed");
    });

    const retryBtn = await screen.findByRole("button", { name: /^retry$/i });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(harness.recorded.downloads.length).toBeGreaterThanOrEqual(2);
    });

    await waitFor(() => {
      expect(Object.keys(useStore.getState().browserIdToItemId)).toHaveLength(
        1,
      );
    });
    const retryBrowserId = Number(
      Object.keys(useStore.getState().browserIdToItemId)[0],
    );
    expect(retryBrowserId).not.toBe(initialBrowserId);

    act(() => {
      harness.emitDownloadChanged({
        id: retryBrowserId,
        state: { current: "complete", previous: "in_progress" },
      });
    });

    await user.click(
      await screen.findByRole("button", { name: /actions for hyph mngo/i }),
    );
    expect(
      screen.getByRole("menuitem", { name: /show in folder/i }),
    ).toBeInTheDocument();
  });
});
