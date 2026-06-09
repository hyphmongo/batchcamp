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
    rateLimited: false,
  }),
}));

let harness: TestHarness;

beforeEach(() => {
  harness = setupJourneyHarness();
});

afterEach(() => {
  teardownJourneyHarness();
});

describe("journey: pause + resume a download in flight", () => {
  it("clicking pause calls browser.downloads.pause; clicking resume calls resume", async () => {
    const user = userEvent.setup();
    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    await waitFor(() => {
      expect(harness.subscriberCounts.onMessage()).toBeGreaterThan(0);
    });

    await act(() => {
      harness.emitMessage({
        type: "send-items-to-tab",
        items: [makePending("p1", "Joy Orbison - Hyph Mngo")],
      });
    });

    await screen.findByText("Hyph Mngo");
    await waitFor(() => {
      expect(Object.keys(useStore.getState().browserIdToItemId)).toHaveLength(
        1,
      );
    });
    const browserId = Number(
      Object.keys(useStore.getState().browserIdToItemId)[0],
    );

    await user.click(
      await screen.findByRole("button", { name: /pause downloads/i }),
    );
    await waitFor(() => {
      expect(harness.recorded.pause).toContain(browserId);
    });

    await user.click(
      await screen.findByRole("button", { name: /resume downloads/i }),
    );
    await waitFor(() => {
      expect(harness.recorded.resume).toContain(browserId);
    });
  });
});
