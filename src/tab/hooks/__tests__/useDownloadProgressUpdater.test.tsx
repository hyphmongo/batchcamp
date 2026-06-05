import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  setupJourneyHarness,
  teardownJourneyHarness,
} from "@/tab/__tests__/journey-fixtures";
import type { TestHarness } from "@/tab/__tests__/test-harness";
import { useDownloadProgressUpdater } from "@/tab/hooks/useDownloadProgressUpdater";
import { useStore } from "@/tab/store";
import type { Download, ResolvedItem } from "@/types";

const makeDownload = (overrides: Partial<Download> = {}): Download => ({
  id: "dl-1",
  url: "https://bandcamp.com/dl",
  artist: "Test",
  title: "Test",
  format: "mp3-320",
  progress: 0,
  browserId: 42,
  ...overrides,
});

const makeDownloading = (
  overrides: Partial<ResolvedItem> = {},
): ResolvedItem => ({
  id: "item-1",
  status: "downloading",
  title: "Test",
  download: makeDownload(),
  ...overrides,
});

describe("useDownloadProgressUpdater interrupted handling", () => {
  let harness: TestHarness;

  beforeEach(() => {
    harness = setupJourneyHarness();
    act(() => {
      useStore.setState({
        items: new Map([["item-1", makeDownloading()]]),
        browserIdToItemId: { 42: "item-1" },
      });
    });
  });

  afterEach(() => {
    teardownJourneyHarness();
  });

  it("does NOT mark an item as 'failed' on interrupted events (the downloader's retry owns that lifecycle)", () => {
    renderHook(() => useDownloadProgressUpdater());

    act(() => {
      harness.emitDownloadChanged({
        id: 42,
        state: { current: "interrupted", previous: "in_progress" },
      });
    });

    expect(useStore.getState().items.get("item-1")?.status).toBe("downloading");
  });
});
