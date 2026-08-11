import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Downloads } from "@/tab/components/Downloads";
import type { Download, PendingItem } from "@/types";
import {
  makeQueue,
  onboardedConfig,
  setupJourneyHarness,
  teardownJourneyHarness,
} from "./journey-fixtures";

vi.mock("@/shared/analytics", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(),
}));

import { track } from "@/shared/analytics";

const SIZE_MB = 61.6;

vi.mock("@/tab/services/parser", () => ({
  parse: async (): Promise<{ kind: "downloads"; downloads: Download[] }> => ({
    kind: "downloads",
    downloads: [
      {
        id: "dl-1",
        title: "Hyph Mngo",
        artist: "Joy Orbison",
        progress: 0,
        url: "https://p4.bcbits.com/download/track/1",
        format: "flac",
        sizeMb: 61.6,
      },
    ],
  }),
}));

const pending = (): PendingItem => ({
  id: "item-1",
  title: "Joy Orbison - Hyph Mngo",
  status: "pending",
  url: "https://bandcamp.com/track/1",
  format: "flac",
});

let harness: ReturnType<typeof setupJourneyHarness>;

beforeEach(() => {
  harness = setupJourneyHarness();
  vi.mocked(track).mockClear();
});

afterEach(() => {
  teardownJourneyHarness();
});

describe("journey: reporting how much data was downloaded", () => {
  it("reports the size of a finished download, so it can be totalled up", async () => {
    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    await act(() => {
      harness.emitMessage({ type: "send-items-to-tab", items: [pending()] });
    });

    await screen.findByText("Hyph Mngo");

    await waitFor(() => {
      expect(harness.recorded.downloads.length).toBeGreaterThan(0);
    });

    await act(() => {
      harness.emitDownloadChanged({
        id: 1,
        state: { current: "complete", previous: "in_progress" },
      });
    });

    const completion = await vi.waitFor(() => {
      const call = vi
        .mocked(track)
        .mock.calls.find(([name]) => name === "download_completed");
      expect(call).toBeDefined();
      return call;
    });

    expect(completion?.[1]).toMatchObject({
      status: "completed",
      sizeMb: SIZE_MB,
    });
  });
});
