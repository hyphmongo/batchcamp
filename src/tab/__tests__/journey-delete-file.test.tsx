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

describe("journey: delete file from disk", () => {
  it("opens a confirm dialog and, on confirm, removes the file via adapter and clears the row", async () => {
    const user = userEvent.setup();
    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    await waitFor(() => {
      expect(harness.subscriberCounts.onMessage()).toBeGreaterThan(0);
    });

    await act(() => {
      harness.emitMessage({
        type: "send-items-to-tab",
        items: [makePending("done-1", "Joy Orbison - Hyph Mngo")],
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

    await act(() => {
      harness.emitDownloadChanged({
        id: browserId,
        state: { current: "complete", previous: "in_progress" },
      });
    });

    await user.click(
      await screen.findByRole("button", { name: /actions for hyph mngo/i }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: /delete file from disk/i }),
    );

    expect(
      await screen.findByRole("heading", {
        name: /^delete from disk$/i,
      }),
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(harness.recorded.removeFile).toContain(browserId);
    });
    expect(harness.recorded.erase).toContain(browserId);

    await waitFor(() => {
      expect(screen.queryByText("Hyph Mngo")).not.toBeInTheDocument();
    });
  });

  it("closing the dialog via the cancel button keeps the file and the row", async () => {
    const user = userEvent.setup();
    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    await waitFor(() => {
      expect(harness.subscriberCounts.onMessage()).toBeGreaterThan(0);
    });

    await act(() => {
      harness.emitMessage({
        type: "send-items-to-tab",
        items: [makePending("done-2", "Joy Orbison - Hyph Mngo")],
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

    await act(() => {
      harness.emitDownloadChanged({
        id: browserId,
        state: { current: "complete", previous: "in_progress" },
      });
    });

    await user.click(
      await screen.findByRole("button", { name: /actions for hyph mngo/i }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: /delete file from disk/i }),
    );

    await screen.findByRole("heading", { name: /^delete from disk$/i });

    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(harness.recorded.removeFile).not.toContain(browserId);
    expect(harness.recorded.erase).not.toContain(browserId);
    expect(screen.getByText("Hyph Mngo")).toBeInTheDocument();
  });
});
