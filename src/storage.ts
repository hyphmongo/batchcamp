import {
  type StorageItemKey,
  storage,
  type Unwatch,
  type WatchCallback,
} from "@wxt-dev/storage";

import { FORMAT_LABELS, type Format, type Item } from "./types";

interface BackgroundContext {
  tabId: number | null;
  items: Item[];
}

export interface Configuration {
  format: Format;
  concurrency: number;
  hasOnboarded: boolean;
  downloadArtwork: boolean;
  filenameTemplate: string;
  filenameTemplateEnabled: boolean;
  analyticsEnabled: boolean;
  crashReportsEnabled: boolean;
}

export const DEFAULT_FILENAME_TEMPLATE = "{artist} - {title}";

export const DEFAULT_CONFIG = {
  format: "mp3-320",
  concurrency: 3,
  hasOnboarded: false,
  downloadArtwork: false,
  filenameTemplate: DEFAULT_FILENAME_TEMPLATE,
  filenameTemplateEnabled: false,
  analyticsEnabled: true,
  crashReportsEnabled: true,
} satisfies Configuration;

interface AnalyticsData {
  distinctId: string | null;
}

interface DownloadHistoryData {
  downloadedIds: string[];
}

interface StorageItemLike<T> {
  getValue(): Promise<T>;
  setValue(value: T): Promise<void>;
  watch(callback: WatchCallback<T>): Unwatch;
}

interface Bucket<T> {
  get(): Promise<T>;
  set(value: Partial<T>): Promise<void>;
  watch(callback: (value: T) => void): () => void;
}

const toBucket = <T extends object>(item: StorageItemLike<T>): Bucket<T> => {
  let lastWrite: Promise<void> = Promise.resolve();
  return {
    get: () => item.getValue(),
    set(value) {
      const write = lastWrite.then(async () => {
        const current = await item.getValue();
        await item.setValue({ ...current, ...value });
      });
      lastWrite = write.catch(() => {});
      return write;
    },
    watch: (callback) => item.watch((value) => callback(value)),
  };
};

const configurationItem = storage.defineItem<Configuration>(
  "local:configuration",
  { fallback: DEFAULT_CONFIG },
);

const backgroundItem = storage.defineItem<BackgroundContext>(
  "local:background",
  { fallback: { tabId: null, items: [] } },
);

const downloadHistoryItem = storage.defineItem<DownloadHistoryData>(
  "local:downloadHistory",
  { fallback: { downloadedIds: [] } },
);

const analyticsItem = storage.defineItem<AnalyticsData>("local:analytics", {
  fallback: { distinctId: null },
});

export const configurationStore = toBucket(configurationItem);
export const backgroundStore = toBucket(backgroundItem);
export const downloadHistoryStore = toBucket(downloadHistoryItem);
export const analyticsStore = toBucket(analyticsItem);

const LEGACY_PREFIX = "extend-chrome/storage__";

const isFormat = (value: unknown): value is Format =>
  typeof value === "string" && Object.hasOwn(FORMAT_LABELS, value);

const isValidConcurrency = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= 8;

export const migrateLegacyStorage = async (): Promise<void> => {
  try {
    const snapshot = await storage.snapshot("local");
    const legacyKeys = Object.keys(snapshot).filter((key) =>
      key.startsWith(LEGACY_PREFIX),
    );
    if (legacyKeys.length === 0) {
      return;
    }

    const current = await configurationItem.getValue();
    if (!current.hasOnboarded) {
      const format = snapshot[`${LEGACY_PREFIX}configuration--format`];
      const concurrency =
        snapshot[`${LEGACY_PREFIX}configuration--concurrency`];
      await configurationItem.setValue({
        ...current,
        ...(isFormat(format) ? { format } : {}),
        ...(isValidConcurrency(concurrency) ? { concurrency } : {}),
        hasOnboarded: true,
      });
    }

    await storage.removeItems(
      legacyKeys.map((key): StorageItemKey => `local:${key}`),
    );
  } catch (error) {
    console.warn("[batchcamp] Legacy storage migration failed", error);
  }
};
