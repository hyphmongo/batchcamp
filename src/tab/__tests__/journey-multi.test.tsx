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
  parse: async (item: PendingItem) => [
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
}));

let harness: TestHarness;

const ALBUM_TITLE = "Joy Orbison - Album";

beforeEach(() => {
  harness = setupJourneyHarness();
});

afterEach(() => {
  teardownJourneyHarness();
});

describe("journey: a discography page flattens into individual rows", () => {
  it("shows each release as its own row — no wrapper, expand, or rollup count", async () => {
    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    await waitFor(() => {
      expect(harness.subscriberCounts.onMessage()).toBeGreaterThan(0);
    });

    act(() => {
      harness.emitMessage({
        type: "send-items-to-tab",
        items: [makePending("album-1", ALBUM_TITLE)],
      });
    });

    expect(await screen.findByText("Hyph Mngo")).toBeInTheDocument();
    expect(screen.getByText("Ellipsis")).toBeInTheDocument();
    expect(screen.getByText("BB")).toBeInTheDocument();

    expect(
      screen.queryByRole("button", { name: /toggle/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/tracks/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/releases/i)).not.toBeInTheDocument();
  });

  it("completes each release independently", async () => {
    harness.resolveDownloadIds([11, 12, 13]);
    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    await waitFor(() => {
      expect(harness.subscriberCounts.onMessage()).toBeGreaterThan(0);
    });

    const watchersBefore = harness.subscriberCounts.onDownloadChanged();
    act(() => {
      harness.emitMessage({
        type: "send-items-to-tab",
        items: [makePending("album-2", ALBUM_TITLE)],
      });
    });

    await screen.findByText("Hyph Mngo");
    await waitFor(() => {
      expect(harness.recorded.downloads.length).toBe(3);
    });
    await waitFor(() => {
      expect(
        harness.subscriberCounts.onDownloadChanged(),
      ).toBeGreaterThanOrEqual(watchersBefore + 3);
    });

    for (const id of [11, 12, 13]) {
      act(() => {
        harness.emitDownloadChanged({
          id,
          state: { current: "complete", previous: "in_progress" },
        });
      });
    }

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        /downloads complete/i,
      );
    });
    expect(screen.getAllByLabelText("Status: done")).toHaveLength(3);
  });
});
