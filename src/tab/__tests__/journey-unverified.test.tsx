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

const parseState = vi.hoisted(() => ({ verified: false }));

vi.mock("@/tab/services/parser", () => ({
  parse: async (item: PendingItem) => {
    if (!parseState.verified) {
      return { kind: "unverified" };
    }
    return {
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
    };
  },
}));

let harness: TestHarness;

beforeEach(() => {
  parseState.verified = false;
  harness = setupJourneyHarness();
});

afterEach(() => {
  teardownJourneyHarness();
});

describe("journey: unverified Bandcamp account", () => {
  it("blocks with a verify modal, then resumes downloads once the user confirms and continues", async () => {
    const user = userEvent.setup();
    harness.resolveDownloadIds([7]);
    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    await waitFor(() => {
      expect(harness.subscriberCounts.onMessage()).toBeGreaterThan(0);
    });

    await act(() => {
      harness.emitMessage({
        type: "send-items-to-tab",
        items: [makePending("123", "Joy Orbison - Hyph Mngo")],
      });
    });

    expect(
      await screen.findByRole("heading", {
        name: /verify your bandcamp email/i,
      }),
    ).toBeInTheDocument();

    expect(harness.recorded.downloads).toHaveLength(0);

    parseState.verified = true;
    await user.click(screen.getByRole("button", { name: /i've verified/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", { name: /verify your bandcamp email/i }),
      ).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(harness.recorded.downloads.length).toBeGreaterThan(0);
    });

    await act(() => {
      harness.emitDownloadChanged({
        id: 7,
        state: { current: "complete", previous: "in_progress" },
      });
    });

    expect(await screen.findByLabelText("Status: done")).toBeInTheDocument();
  });
});
