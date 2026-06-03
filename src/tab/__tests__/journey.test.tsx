import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
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
      id: `${item.id}-dl`,
      url: `https://bandcamp.com/download/${item.id}?token=abc`,
      artist: item.title.split(" - ")[0] ?? "Artist",
      title: item.title,
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

describe("user journey: add → download → complete → action", () => {
  it("ingests items from the content script, downloads them, marks complete on onChanged, and supports clearing", async () => {
    const user = userEvent.setup();
    harness.resolveDownloadIds([7]);
    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    expect(
      await screen.findByRole("heading", { name: /awaiting downloads/i }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(harness.subscriberCounts.onMessage()).toBeGreaterThan(0);
    });

    const watchersBefore = harness.subscriberCounts.onDownloadChanged();
    act(() => {
      harness.emitMessage({
        type: "send-items-to-tab",
        items: [makePending("123", "Joy Orbison - Hyph Mngo")],
      });
    });

    expect(await screen.findByText("Hyph Mngo")).toBeInTheDocument();
    expect(screen.getByText("Joy Orbison")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /awaiting downloads/i }),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(harness.recorded.downloads.length).toBeGreaterThan(0);
    });

    const downloadCall = harness.recorded.downloads[0]!;
    expect(downloadCall.url).toContain("https://bandcamp.com/download/");

    await waitFor(() => {
      expect(harness.subscriberCounts.onDownloadChanged()).toBeGreaterThan(
        watchersBefore,
      );
    });

    act(() => {
      harness.emitDownloadChanged({
        id: 7,
        state: { current: "complete", previous: "in_progress" },
      });
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /actions for hyph mngo/i,
        }),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /actions for hyph mngo/i }),
    );

    expect(
      screen.getByRole("menuitem", { name: /show in folder/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /show in folder/i }));

    expect(harness.recorded.show).toEqual([7]);
  });
});
