import { renderHook, waitFor } from "@testing-library/react";
import PQueue from "p-queue";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Configuration } from "@/storage";
import { onboardedConfig } from "@/tab/__tests__/journey-fixtures";
import { createTestHarness } from "@/tab/__tests__/test-harness";
import {
  resetBrowserAdapter,
  setBrowserAdapter,
} from "@/tab/services/browser-adapter";
import type { Download, PendingItem } from "@/types";

let parseImpl: (item: PendingItem) => Promise<Download[]> = async () => [];

vi.mock("@/tab/services/parser", () => ({
  parse: async (item: PendingItem) => ({
    downloads: await parseImpl(item),
    rateLimited: false,
  }),
}));

vi.mock("@/tab/services/downloader", async () => {
  const actual = await vi.importActual<
    typeof import("@/tab/services/downloader")
  >("@/tab/services/downloader");
  return {
    ...actual,
    download: vi.fn(async () => "completed" as const),
  };
});

const { useDownloadMessageListener } = await import(
  "@/tab/hooks/useDownloadMessageListener"
);
const { useStore } = await import("@/tab/store");

const baseConfig: Configuration = onboardedConfig;

const makePending = (id: string, title = `Item ${id}`): PendingItem => ({
  id,
  title,
  status: "pending",
  url: `https://bandcamp.com/track/${id}`,
  format: "mp3-320",
});

const makeDownload = (id: string, title = `Download ${id}`): Download => ({
  id,
  url: `https://bandcamp.com/download/${id}?token=x`,
  artist: "Artist",
  title,
  format: "mp3-320",
  progress: 0,
});

const renderListener = () => {
  const queue = new PQueue({ concurrency: 3 });
  return renderHook(() => useDownloadMessageListener({ queue }));
};

beforeEach(() => {
  parseImpl = async () => [];
  act(() => {
    useStore.setState({
      config: baseConfig,
      items: new Map(),
      downloadToItemId: {},
      browserIdToItemId: {},
    });
  });
});

afterEach(() => {
  resetBrowserAdapter();
});

describe("useDownloadMessageListener fan-out", () => {
  it("acks delivery to the background after adding received items", async () => {
    const harness = createTestHarness();
    setBrowserAdapter(harness.adapter);
    renderListener();

    act(() => {
      harness.emitMessage({
        type: "send-items-to-tab",
        items: [makePending("p9")],
      });
    });

    await waitFor(() => {
      expect(harness.recorded.runtime.sendMessage).toContainEqual({
        type: "items-delivered",
      });
    });
    expect(useStore.getState().items.size).toBeGreaterThan(0);
  });

  it("pre-seeds the onboarding format from the first batch's explicit format", async () => {
    act(() => {
      useStore.setState({
        config: { ...baseConfig, hasOnboarded: false, format: "mp3-320" },
      });
    });
    const harness = createTestHarness();
    setBrowserAdapter(harness.adapter);
    renderListener();

    act(() => {
      harness.emitMessage({
        type: "send-items-to-tab",
        items: [{ ...makePending("p1"), format: "flac" }],
      });
    });

    await waitFor(() => {
      expect(useStore.getState().config.format).toBe("flac");
    });
  });

  it("leaves a saved format preference alone once onboarded", async () => {
    act(() => {
      useStore.setState({
        config: { ...baseConfig, hasOnboarded: true, format: "mp3-320" },
      });
    });
    const harness = createTestHarness();
    setBrowserAdapter(harness.adapter);
    renderListener();

    act(() => {
      harness.emitMessage({
        type: "send-items-to-tab",
        items: [{ ...makePending("p2"), format: "flac" }],
      });
    });
    await waitFor(() => {
      expect(useStore.getState().items.size).toBeGreaterThan(0);
    });

    expect(useStore.getState().config.format).toBe("mp3-320");
  });

  it("marks an item as failed when the parser returns zero downloads", async () => {
    parseImpl = async () => [];
    renderListener();

    const pending = makePending("p1");
    act(() => {
      useStore.getState().addPendingItems([pending]);
    });

    const compositeId = `${pending.id}:${baseConfig.format}`;
    await waitFor(() => {
      expect(useStore.getState().items.get(compositeId)?.status).toBe("failed");
    });
  });

  it("attaches a single download (item becomes ResolvedItem) when parser returns one", async () => {
    parseImpl = async (item) => [makeDownload(`${item.id}-dl`, item.title)];
    renderListener();

    const pending = makePending("p2", "Joy Orbison - Hyph Mngo");
    act(() => {
      useStore.getState().addPendingItems([pending]);
    });

    const compositeId = `${pending.id}:${baseConfig.format}`;
    await waitFor(() => {
      const stored = useStore.getState().items.get(compositeId);
      expect(stored).toHaveProperty("download");
    });
  });

  it("flattens many downloads into one resolved item per release", async () => {
    parseImpl = async (item) => [
      makeDownload(`${item.id}-1`, "Track 1"),
      makeDownload(`${item.id}-2`, "Track 2"),
      makeDownload(`${item.id}-3`, "Track 3"),
    ];
    renderListener();

    const pending = makePending("p3", "Joy Orbison - Album");
    act(() => {
      useStore.getState().addPendingItems([pending]);
    });

    const compositeId = `${pending.id}:${baseConfig.format}`;
    await waitFor(() => {
      const items = useStore.getState().items;
      expect(items.has(compositeId)).toBe(false);
      const resolved = [...items.values()].filter((i) => "download" in i);
      expect(resolved).toHaveLength(3);
    });
  });

  it("transitions a freshly-added pending item through 'resolving' before final status", async () => {
    let resolveParse: (downloads: Download[]) => void = () => {};
    parseImpl = () =>
      new Promise<Download[]>((resolve) => {
        resolveParse = resolve;
      });
    renderListener();

    const pending = makePending("p4");
    act(() => {
      useStore.getState().addPendingItems([pending]);
    });

    const compositeId = `${pending.id}:${baseConfig.format}`;
    await waitFor(() => {
      expect(useStore.getState().items.get(compositeId)?.status).toBe(
        "resolving",
      );
    });

    act(() => {
      resolveParse([makeDownload(`${pending.id}-dl`)]);
    });

    await waitFor(() => {
      const stored = useStore.getState().items.get(compositeId);
      expect(stored).toHaveProperty("download");
    });
  });
});

describe("useDownloadMessageListener onboarding gate", () => {
  it("does not parse pending items until onboarding is complete", async () => {
    act(() => {
      useStore.setState({ config: { ...baseConfig, hasOnboarded: false } });
    });
    let parseCalls = 0;
    parseImpl = async () => {
      parseCalls += 1;
      return [];
    };
    renderListener();

    act(() => {
      useStore.getState().addPendingItems([makePending("g1")]);
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(parseCalls).toBe(0);
    expect(useStore.getState().items.get("g1:mp3-320")?.status).toBe("pending");
  });

  it("parses pending items once onboarded", async () => {
    renderListener();

    act(() => {
      useStore.getState().addPendingItems([makePending("g2")]);
    });

    await waitFor(() => {
      expect(useStore.getState().items.get("g2:mp3-320")?.status).toBe(
        "failed",
      );
    });
  });
});
