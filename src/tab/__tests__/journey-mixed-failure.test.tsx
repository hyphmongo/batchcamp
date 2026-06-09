import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Downloads } from "@/tab/components/Downloads";
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
        id: `${item.id}-track-1`,
        url: `https://bandcamp.com/download/${item.id}/1?token=abc`,
        artist: item.title.split(" - ")[0] ?? "Artist",
        title: "Hyph Mngo",
        format: "mp3-320" as const,
        progress: 0,
      },
      {
        id: `${item.id}-track-2`,
        url: `https://bandcamp.com/download/${item.id}/2?token=abc`,
        artist: item.title.split(" - ")[0] ?? "Artist",
        title: "Ellipsis",
        format: "mp3-320" as const,
        progress: 0,
      },
      {
        id: `${item.id}-track-3`,
        url: `https://bandcamp.com/download/${item.id}/3?token=abc`,
        artist: item.title.split(" - ")[0] ?? "Artist",
        title: "BB",
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

describe("journey: multi-download page with mixed completion + failure", () => {
  it("flattens releases into rows and offers retry when one fails", async () => {
    harness.resolveDownloadIds([21, 22]);
    const originalDownload = harness.adapter.downloads.download;
    harness.adapter.downloads.download = async (options) => {
      if (options.url.includes("/3?")) {
        throw new Error("disk full");
      }
      return originalDownload(options);
    };
    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    await waitFor(() => {
      expect(harness.subscriberCounts.onMessage()).toBeGreaterThan(0);
    });

    const watchersBefore = harness.subscriberCounts.onDownloadChanged();
    await act(() => {
      harness.emitMessage({
        type: "send-items-to-tab",
        items: [makePending("album-mx", "Joy Orbison - Album")],
      });
    });

    await screen.findByText("Hyph Mngo");

    expect(
      await screen.findByRole("button", { name: /^retry$/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        harness.subscriberCounts.onDownloadChanged(),
      ).toBeGreaterThanOrEqual(watchersBefore + 2);
    });

    for (const id of [21, 22]) {
      await act(() => {
        harness.emitDownloadChanged({
          id,
          state: { current: "complete", previous: "in_progress" },
        });
      });
    }

    await waitFor(() => {
      expect(screen.getAllByLabelText("Status: done")).toHaveLength(2);
    });
    expect(
      screen.getByRole("button", { name: /^retry$/i }),
    ).toBeInTheDocument();
  });
});
