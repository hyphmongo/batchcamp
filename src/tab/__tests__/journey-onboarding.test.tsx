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
    kind: "downloads",
    downloads: [
      {
        id: `${item.id}-dl`,
        url: `https://bandcamp.com/download/${item.id}?token=abc`,
        artist: item.title.split(" - ")[0] ?? "Artist",
        title: item.title,
        format: "mp3-320" as const,
        progress: 0,
      },
    ],
  }),
}));

const StoreDrivenDownloads = ({
  queue,
}: {
  queue: ReturnType<typeof makeQueue>;
}) => {
  const config = useStore((state) => state.config);
  return <Downloads config={config} queue={queue} />;
};

let harness: TestHarness;

beforeEach(() => {
  harness = setupJourneyHarness({ ...onboardedConfig, hasOnboarded: false });
});

afterEach(() => {
  teardownJourneyHarness();
});

describe("journey: first run onboarding", () => {
  it("starts downloading items that arrived before onboarding, without changing the format", async () => {
    const user = userEvent.setup();
    harness.resolveDownloadIds([7]);
    render(<StoreDrivenDownloads queue={makeQueue()} />);

    await waitFor(() => {
      expect(harness.subscriberCounts.onMessage()).toBeGreaterThan(0);
    });

    await act(() => {
      harness.emitMessage({
        type: "send-items-to-tab",
        items: [makePending("123", "Joy Orbison - Hyph Mngo")],
      });
    });

    await user.click(
      await screen.findByRole("button", { name: /start download/i }),
    );

    await waitFor(() => {
      expect(harness.recorded.downloads.length).toBeGreaterThan(0);
    });
  });
});
