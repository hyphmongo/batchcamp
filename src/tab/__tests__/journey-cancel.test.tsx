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
  parse: async (item: PendingItem) => {
    const downloads = item.id.startsWith("album")
      ? [
          {
            id: `${item.id}-track-1`,
            url: `https://bandcamp.com/download/${item.id}/1?token=abc`,
            artist: "Joy Orbison",
            title: "Hyph Mngo",
            format: "mp3-320" as const,
            progress: 0,
          },
          {
            id: `${item.id}-track-2`,
            url: `https://bandcamp.com/download/${item.id}/2?token=abc`,
            artist: "Joy Orbison",
            title: "Ellipsis",
            format: "mp3-320" as const,
            progress: 0,
          },
        ]
      : [
          {
            id: `${item.id}-dl`,
            url: `https://bandcamp.com/download/${item.id}?token=abc`,
            artist: item.title.split(" - ")[0] ?? "Artist",
            title: item.title.split(" - ").slice(1).join(" - ") || item.title,
            format: "mp3-320" as const,
            progress: 0,
          },
        ];
    return { downloads, rateLimited: false };
  },
}));

let harness: TestHarness;

beforeEach(() => {
  harness = setupJourneyHarness();
});

afterEach(() => {
  teardownJourneyHarness();
});

describe("journey: cancel an in-flight single item", () => {
  it("removes the item from the list and cancels its browser download", async () => {
    const user = userEvent.setup();
    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    await waitFor(() => {
      expect(harness.subscriberCounts.onMessage()).toBeGreaterThan(0);
    });

    await act(() => {
      harness.emitMessage({
        type: "send-items-to-tab",
        items: [makePending("single-1", "Joy Orbison - Hyph Mngo")],
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

    harness.setSearchResults([
      {
        id: browserId,
        state: "in_progress",
      } as never,
    ]);

    await user.click(
      await screen.findByRole("button", { name: /actions for hyph mngo/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /^cancel$/i }));

    await waitFor(() => {
      expect(harness.recorded.cancel).toContain(browserId);
    });
    await waitFor(() => {
      expect(screen.queryByText("Hyph Mngo")).not.toBeInTheDocument();
    });
  });
});

describe("journey: cancel one release from a multi-download page", () => {
  it("removes just that release and leaves the others, cancelling its download", async () => {
    const user = userEvent.setup();
    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    await waitFor(() => {
      expect(harness.subscriberCounts.onMessage()).toBeGreaterThan(0);
    });

    await act(() => {
      harness.emitMessage({
        type: "send-items-to-tab",
        items: [makePending("album-cancel", "Joy Orbison - Album")],
      });
    });

    await screen.findByText("Hyph Mngo");
    expect(screen.getByText("Ellipsis")).toBeInTheDocument();
    await waitFor(() => {
      expect(Object.keys(useStore.getState().browserIdToItemId)).toHaveLength(
        2,
      );
    });
    const browserIds = Object.keys(useStore.getState().browserIdToItemId).map(
      Number,
    );

    harness.setSearchResults(
      browserIds.map((id) => ({ id, state: "in_progress" }) as never),
    );

    await user.click(
      await screen.findByRole("button", { name: /actions for hyph mngo/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /^cancel$/i }));

    await waitFor(() => {
      expect(screen.queryByText("Hyph Mngo")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Ellipsis")).toBeInTheDocument();
    expect(harness.recorded.cancel.length).toBeGreaterThanOrEqual(1);
  });
});
