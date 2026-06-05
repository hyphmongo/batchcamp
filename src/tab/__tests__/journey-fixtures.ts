import PQueue from "p-queue";
import { act } from "react";

import type { Configuration } from "@/storage";
import {
  resetBrowserAdapter,
  setBrowserAdapter,
} from "@/tab/services/browser-adapter";
import { useStore } from "@/tab/store";
import type { PendingItem } from "@/types";
import { createTestHarness, type TestHarness } from "./test-harness";

export const onboardedConfig: Configuration = {
  format: "mp3-320",
  concurrency: 3,
  hasOnboarded: true,
  downloadArtwork: false,
  filenameTemplate: "{artist} - {title}",
  filenameTemplateEnabled: false,
  analyticsEnabled: true,
  crashReportsEnabled: true,
};

export const makePending = (id: string, title: string): PendingItem => ({
  id,
  title,
  status: "pending",
  url: `https://bandcamp.com/track/${id}`,
  format: "mp3-320",
});

export const makeQueue = () => new PQueue({ concurrency: 3 });

export const setupJourneyHarness = (
  configOverrides?: Partial<Configuration>,
): TestHarness => {
  const harness = createTestHarness();
  setBrowserAdapter(harness.adapter);
  act(() => {
    useStore.setState({
      config: { ...onboardedConfig, ...configOverrides },
      items: new Map(),
      downloadToItemId: {},
      browserIdToItemId: {},
      pausedItemIds: new Set(),
      downloadsPaused: false,
      downloadHistoryCount: 0,
      historyCleared: false,
    });
  });
  return harness;
};

export const teardownJourneyHarness = () => {
  resetBrowserAdapter();
};
