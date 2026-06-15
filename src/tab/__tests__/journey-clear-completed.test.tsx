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
  parse: async (item: PendingItem) => ({
    downloads: [
      {
        id: `${item.id}-dl`,
        url: `https://bandcamp.com/download/${item.id}?token=abc`,
        artist: item.title.split(" - ")[0] ?? "Artist",
        title: item.title.split(" - ").slice(1).join(" - ") || item.title,
        format: "mp3-320" as const,
        progress: 0,
      },
    ],
    kind: "downloads",
  }),
}));

let harness: TestHarness;

beforeEach(() => {
  harness = setupJourneyHarness();
});

afterEach(() => {
  teardownJourneyHarness();
});

describe("journey: clear completed downloads", () => {
  it("after two items complete, the clear button clears them and the EmptyState returns", async () => {
    const user = userEvent.setup();
    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    await waitFor(() => {
      expect(harness.subscriberCounts.onMessage()).toBeGreaterThan(0);
    });

    await act(() => {
      harness.emitMessage({
        type: "send-items-to-tab",
        items: [
          makePending("a", "Joy Orbison - Hyph Mngo"),
          makePending("b", "Pearson Sound - Wad"),
        ],
      });
    });

    await screen.findByText("Hyph Mngo");
    await screen.findByText("Wad");

    await waitFor(() => {
      expect(
        harness.subscriberCounts.onDownloadChanged(),
      ).toBeGreaterThanOrEqual(2);
    });
    const browserIds = Object.keys(useStore.getState().browserIdToItemId).map(
      Number,
    );
    expect(browserIds).toHaveLength(2);

    for (const id of browserIds) {
      await act(() => {
        harness.emitDownloadChanged({
          id,
          state: { current: "complete", previous: "in_progress" },
        });
      });
    }

    await waitFor(() => {
      const items = Array.from(useStore.getState().items.values());
      const completed = items.filter((i) => i.status === "completed");
      expect(completed).toHaveLength(2);
    });

    const clearBtn = await screen.findByRole("button", {
      name: /clear completed downloads/i,
    });
    await user.click(clearBtn);

    await waitFor(() => {
      expect(useStore.getState().items.size).toBe(0);
    });
    expect(
      await screen.findByRole("heading", { name: /awaiting downloads/i }),
    ).toBeInTheDocument();
  });
});
