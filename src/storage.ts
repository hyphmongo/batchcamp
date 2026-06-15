import {
  type StorageItemKey,
  storage,
  type Unwatch,
  type WatchCallback,
} from "@wxt-dev/storage";
import { z } from "zod";

import { type Format, formatSchema, type Item, itemSchema } from "./types";

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
} as const satisfies Configuration;

interface AnalyticsData {
  distinctId: string | null;
}

interface DataCollectionData {
  granted: boolean;
}

interface DownloadHistoryData {
  downloadedIds: string[];
}

const DEFAULT_BACKGROUND: BackgroundContext = { tabId: null, items: [] };
const DEFAULT_DOWNLOAD_HISTORY: DownloadHistoryData = { downloadedIds: [] };
const DEFAULT_ANALYTICS: AnalyticsData = { distinctId: null };
const DEFAULT_DATA_COLLECTION: DataCollectionData = { granted: true };

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

const toBucket = <T extends object>(
  item: StorageItemLike<T>,
  validate: (value: T) => T,
): Bucket<T> => {
  let lastWrite: Promise<void> = Promise.resolve();
  const read = async (): Promise<T> => validate(await item.getValue());
  return {
    get: read,
    set(value) {
      const write = lastWrite.then(async () => {
        const current = await read();
        await item.setValue({ ...current, ...value });
      });
      lastWrite = write.catch(() => {});
      return write;
    },
    watch: (callback) => item.watch((value) => callback(validate(value))),
  };
};

const lenientArray = <T>(schema: z.ZodType<T>) =>
  z.array(z.unknown()).transform((items) =>
    items.flatMap((item) => {
      const result = schema.safeParse(item);
      return result.success ? [result.data] : [];
    }),
  );

const concurrencySchema = z.number().int().min(1).max(8);

const configurationSchema = z
  .object({
    format: formatSchema.catch(DEFAULT_CONFIG.format),
    concurrency: concurrencySchema.catch(DEFAULT_CONFIG.concurrency),
    hasOnboarded: z.boolean().catch(DEFAULT_CONFIG.hasOnboarded),
    downloadArtwork: z.boolean().catch(DEFAULT_CONFIG.downloadArtwork),
    filenameTemplate: z.string().catch(DEFAULT_CONFIG.filenameTemplate),
    filenameTemplateEnabled: z
      .boolean()
      .catch(DEFAULT_CONFIG.filenameTemplateEnabled),
    analyticsEnabled: z.boolean().catch(DEFAULT_CONFIG.analyticsEnabled),
    crashReportsEnabled: z.boolean().catch(DEFAULT_CONFIG.crashReportsEnabled),
  })
  .catch(DEFAULT_CONFIG);

const downloadHistorySchema = z
  .object({ downloadedIds: lenientArray(z.string()).catch([]) })
  .catch(DEFAULT_DOWNLOAD_HISTORY);

const analyticsSchema = z
  .object({ distinctId: z.string().nullable().catch(null) })
  .catch(DEFAULT_ANALYTICS);

const dataCollectionSchema = z
  .object({ granted: z.boolean().catch(true) })
  .catch(DEFAULT_DATA_COLLECTION);

const backgroundSchema = z
  .object({
    tabId: z.number().nullable().catch(null),
    items: lenientArray(itemSchema).catch([]),
  })
  .catch(DEFAULT_BACKGROUND);

const configurationItem = storage.defineItem<Configuration>(
  "local:configuration",
  { fallback: DEFAULT_CONFIG },
);

const backgroundItem = storage.defineItem<BackgroundContext>(
  "local:background",
  { fallback: DEFAULT_BACKGROUND },
);

const downloadHistoryItem = storage.defineItem<DownloadHistoryData>(
  "local:downloadHistory",
  { fallback: DEFAULT_DOWNLOAD_HISTORY },
);

const analyticsItem = storage.defineItem<AnalyticsData>("local:analytics", {
  fallback: DEFAULT_ANALYTICS,
});

const dataCollectionItem = storage.defineItem<DataCollectionData>(
  "local:dataCollection",
  { fallback: DEFAULT_DATA_COLLECTION },
);

export const configurationStore = toBucket(configurationItem, (v) =>
  configurationSchema.parse(v),
);
export const backgroundStore = toBucket(backgroundItem, (v) =>
  backgroundSchema.parse(v),
);
export const downloadHistoryStore = toBucket(downloadHistoryItem, (v) =>
  downloadHistorySchema.parse(v),
);
export const analyticsStore = toBucket(analyticsItem, (v) =>
  analyticsSchema.parse(v),
);
export const dataCollectionStore = toBucket(dataCollectionItem, (v) =>
  dataCollectionSchema.parse(v),
);

const LEGACY_PREFIX = "extend-chrome/storage__";

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
      const format = formatSchema.safeParse(
        snapshot[`${LEGACY_PREFIX}configuration--format`],
      );
      const concurrency = concurrencySchema.safeParse(
        snapshot[`${LEGACY_PREFIX}configuration--concurrency`],
      );
      await configurationItem.setValue({
        ...current,
        ...(format.success ? { format: format.data } : {}),
        ...(concurrency.success ? { concurrency: concurrency.data } : {}),
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
