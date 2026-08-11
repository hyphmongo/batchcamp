import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Downloads } from "@/tab/components/Downloads";
import { useStore } from "@/tab/store";
import type { Download, ResolvedItem } from "@/types";
import {
  makeQueue,
  onboardedConfig,
  setupJourneyHarness,
  teardownJourneyHarness,
} from "./journey-fixtures";
import type { TestHarness } from "./test-harness";

const ORDER_URL = "https://bandcamp.com/download?cart_id=99&sig=abc";

const TITLES = ["Hyph Mngo", "Sicko Cell", "Ellipsis"];
const ITEM_IDS = ["1000000001", "1000000002", "1000000003"];

const makeDownload = (index: number): Download => ({
  id: `${ITEM_IDS[index]}:mp3-320`,
  title: TITLES[index] ?? `Track ${index}`,
  artist: "Joy Orbison",
  progress: 0,
  url: `https://p4.bcbits.com/download/track/${ITEM_IDS[index]}`,
  format: "mp3-320",
});

vi.mock("@/tab/services/parser", () => ({
  parse: async ({ itemId }: { itemId?: string }) => {
    const ids = ["1000000001", "1000000002", "1000000003"];
    const all = ids.map((id, index) => ({
      id: `${id}:mp3-320`,
      title: ["Hyph Mngo", "Sicko Cell", "Ellipsis"][index],
      artist: "Joy Orbison",
      progress: 0,
      url: `https://p4.bcbits.com/download/track/${id}`,
      format: "mp3-320" as const,
    }));
    const downloads =
      itemId === undefined ? all : all.filter((d) => d.id.startsWith(itemId));
    return { kind: "downloads", downloads };
  },
}));

let harness: TestHarness;

beforeEach(() => {
  harness = setupJourneyHarness();
});

afterEach(() => {
  teardownJourneyHarness();
});

const seedOrder = () => {
  const items = new Map<string, ResolvedItem>();
  const downloadToItemId: Record<string, string> = {};

  for (const index of [0, 1, 2]) {
    const download = makeDownload(index);
    const id = `order-item-${index}`;
    items.set(id, {
      id,
      title: download.title,
      status: "resolved",
      format: "mp3-320",
      url: ORDER_URL,
      itemId: ITEM_IDS[index],
      download,
    });
    downloadToItemId[download.id] = id;
  }

  void act(() => {
    useStore.setState({ items, downloadToItemId });
  });
};

describe("journey: retrying one item from a shared multi-item purchase page", () => {
  it("re-resolves only that item, rather than fanning out the whole order", async () => {
    const user = userEvent.setup();
    seedOrder();

    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    await screen.findByText("Sicko Cell");

    await act(() => {
      useStore.getState().updateItemStatus("order-item-1", "failed");
    });

    const retryBtn = await screen.findByRole("button", { name: /^retry$/i });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(useStore.getState().items.get("order-item-1")?.status).not.toBe(
        "failed",
      );
    });

    const items = [...useStore.getState().items.values()];

    expect(items).toHaveLength(3);

    const downloadIds = items.flatMap((item) =>
      "download" in item ? [item.download.id] : [],
    );
    expect(new Set(downloadIds).size).toBe(downloadIds.length);

    const untouchedUrl = makeDownload(0).url;
    const timesDownloaded = harness.recorded.downloads.filter(
      (d) => d.url === untouchedUrl,
    ).length;
    expect(timesDownloaded).toBe(1);
  });
});
