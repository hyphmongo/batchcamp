import { Data, Effect, Option } from "effect";
import type browser from "webextension-polyfill";

import { parseDate, parseYear } from "@/shared/date-utils";
import { addBreadcrumb, captureError } from "@/shared/error-handler";
import {
  applyTemplate,
  isFilenameTemplateEnabled,
  stripArtistPrefix,
} from "@/shared/filename-utils";
import { toError } from "@/shared/to-error";
import { DEFAULT_FILENAME_TEMPLATE } from "@/storage";
import { useStore } from "@/tab/store";
import type { Download, ItemStatus } from "@/types";
import { browserAdapter } from "./browser-adapter";
import { browserDownloadClient, type DownloadClient } from "./download-client";
import { finalizeBytes } from "./download-progress";
import { sanitizePath } from "./downloader-utils";

class DownloadError extends Data.TaggedError("DownloadError")<{
  readonly cause: Error;
}> {}

const tryDownload = <T>(thunk: () => Promise<T>) =>
  Effect.tryPromise({
    try: thunk,
    catch: (cause) => new DownloadError({ cause: toError(cause) }),
  });

const POLL_INTERVAL_MS = 30_000;

const waitForDeferredDownload = (
  idPromise: Promise<number>,
): Promise<browser.Downloads.StringDelta> =>
  new Promise((resolve, reject) => {
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let unsubscribe: (() => void) | null = null;
    let settled = false;

    const cleanup = () => {
      settled = true;
      if (pollTimer) {
        clearInterval(pollTimer);
      }
      if (unsubscribe) {
        unsubscribe();
      }
    };

    idPromise
      .then((id) => {
        if (settled) {
          return;
        }

        const checkState = async (treatMissingAsError: boolean) => {
          if (settled) {
            return;
          }
          try {
            const results = await browserAdapter.downloads.search({ id });
            const first = results[0];
            if (!first) {
              if (treatMissingAsError) {
                cleanup();
                reject(new Error(`Download ${id} no longer exists`));
              }
              return;
            }
            if (first.state !== "in_progress") {
              cleanup();
              resolve({ current: first.state, previous: "in_progress" });
            }
          } catch {
            if (treatMissingAsError) {
              cleanup();
              reject(new Error(`Download ${id} search failed`));
            }
          }
        };

        unsubscribe = browserAdapter.events.onDownloadChanged.subscribe(
          (delta) => {
            if (delta.id !== id || !delta.state) {
              return;
            }
            if (delta.state.current === "in_progress") {
              return;
            }
            cleanup();
            resolve(delta.state);
          },
        );

        pollTimer = setInterval(() => {
          void checkState(true);
        }, POLL_INTERVAL_MS);

        void checkState(false);
      })
      .catch((error) => {
        cleanup();
        reject(error);
      });
  });

export const downloadCoverArt = (
  client: DownloadClient,
  dl: Download,
  filenameBase: string,
): Effect.Effect<void> => {
  if (!dl.artUrl) {
    return Effect.void;
  }

  const artUrl = dl.artUrl;
  const artFilename = sanitizePath(`${filenameBase}.jpg`);

  return tryDownload(() =>
    client.startDownload({ url: artUrl, filename: artFilename }),
  ).pipe(
    Effect.asVoid,
    Effect.catchAll((error) =>
      Effect.sync(() => {
        captureError(
          error.cause,
          { art: { url: artUrl, filename: artFilename } },
          { operation: "download_cover_art" },
        );
      }),
    ),
  );
};

const buildTemplateData = (dl: Download, format: string) => ({
  artist: dl.artist,
  title: stripArtistPrefix(dl.title, dl.artist),
  year: parseYear(dl.date),
  date: parseDate(dl.date),
  format,
});

const buildCustomFilename = (
  client: DownloadClient,
  dl: Download,
  template: string,
  format: string,
) => {
  const base = applyTemplate(template, buildTemplateData(dl, format));
  return tryDownload(() => client.inferFilenameExtension(dl.url)).pipe(
    Effect.map((ext) => sanitizePath(`${base}${ext}`)),
  );
};

const MAX_AUTO_RETRIES = 3;
const BACKOFF_BASE_MS = 5000;

const isItemPausedByUser = (downloadId: string): boolean => {
  const itemId = useStore.getState().downloadToItemId[downloadId];
  if (!itemId) {
    return false;
  }
  return useStore.getState().pausedItemIds.has(itemId);
};

const isBrowserIdPausedByUser = (browserId: number): boolean => {
  const itemId = useStore.getState().browserIdToItemId[browserId];
  if (!itemId) {
    return false;
  }
  return useStore.getState().pausedItemIds.has(itemId);
};

const attemptResume = (browserId: number) =>
  Effect.gen(function* () {
    const results = yield* tryDownload(() =>
      browserAdapter.downloads.search({ id: browserId }),
    );
    const first = results[0];
    if (!first || !first.canResume) {
      return false;
    }
    if (isBrowserIdPausedByUser(browserId)) {
      return false;
    }
    yield* tryDownload(() => browserAdapter.downloads.resume(browserId));
    return true;
  }).pipe(Effect.orElseSucceed(() => false));

const completedIfNotInterrupted = (
  state: browser.Downloads.StringDelta,
): ItemStatus | null => (state.current === "interrupted" ? null : "completed");

const retryInterruptedDownload = (
  client: DownloadClient,
  awaitCompletion: AwaitCompletion,
  originalBrowserId: number,
  dl: Download,
  customFilename?: string,
): Effect.Effect<ItemStatus> =>
  Effect.gen(function* () {
    for (let attempt = 0; attempt < MAX_AUTO_RETRIES; attempt++) {
      const backoff = BACKOFF_BASE_MS * 2 ** attempt;

      addBreadcrumb({
        message: `Auto-retrying download (attempt ${attempt + 1}/${MAX_AUTO_RETRIES}, backoff ${backoff}ms)`,
        data: { originalBrowserId, url: dl.url },
        level: "info",
      });

      yield* Effect.sleep(`${backoff} millis`);

      if (useStore.getState().downloadToItemId[dl.id] == null) {
        return "failed";
      }

      if (attempt === 0) {
        const resumed = yield* attemptResume(originalBrowserId);
        if (resumed) {
          const state = yield* awaitCompletion(
            Promise.resolve(originalBrowserId),
          ).pipe(Effect.option);
          if (Option.isSome(state)) {
            const status = completedIfNotInterrupted(state.value);
            if (status) {
              return status;
            }
          }
          continue;
        }
      }

      const state = yield* Effect.gen(function* () {
        const newId = yield* tryDownload(() =>
          client.startDownload({ url: dl.url, filename: customFilename }),
        );
        useStore.getState().updateDownloadBrowserId(dl.id, newId);
        return yield* awaitCompletion(Promise.resolve(newId));
      }).pipe(Effect.option);

      if (Option.isSome(state)) {
        const status = completedIfNotInterrupted(state.value);
        if (status) {
          return status;
        }
      }
    }

    return "failed";
  });

export type AwaitCompletion = (
  idPromise: Promise<number>,
) => Effect.Effect<browser.Downloads.StringDelta, DownloadError>;

const defaultAwaitCompletion: AwaitCompletion = (idPromise) =>
  tryDownload(() => waitForDeferredDownload(idPromise));

export const createDownloader =
  (
    client: DownloadClient,
    awaitCompletion: AwaitCompletion = defaultAwaitCompletion,
  ) =>
  (dl: Download): Promise<ItemStatus> =>
    Effect.runPromise(downloadEffect(client, awaitCompletion, dl));

const downloadEffect = (
  client: DownloadClient,
  awaitCompletion: AwaitCompletion,
  dl: Download,
): Effect.Effect<ItemStatus> => {
  const config = useStore.getState().config;
  const templateEnabled = isFilenameTemplateEnabled(config);

  return Effect.gen(function* () {
    if (config.downloadArtwork) {
      const artTemplate = templateEnabled
        ? config.filenameTemplate
        : DEFAULT_FILENAME_TEMPLATE;
      const data = buildTemplateData(dl, config.format);
      const filenameBase = applyTemplate(artTemplate, data);
      yield* downloadCoverArt(client, dl, filenameBase);
    }

    const customFilename = templateEnabled
      ? yield* buildCustomFilename(
          client,
          dl,
          config.filenameTemplate,
          config.format,
        ).pipe(Effect.orElseSucceed(() => undefined))
      : undefined;

    const downloadId = yield* tryDownload(() =>
      client.startDownload({ url: dl.url, filename: customFilename }),
    );

    useStore.getState().updateDownloadBrowserId(dl.id, downloadId);

    let state = yield* awaitCompletion(Promise.resolve(downloadId));

    while (state.current === "interrupted" && isItemPausedByUser(dl.id)) {
      yield* Effect.sleep("1 second");
      state = yield* awaitCompletion(Promise.resolve(downloadId));
    }

    if (state.current !== "interrupted") {
      if (dl.sizeMb) {
        const progressKey =
          useStore.getState().downloadToItemId[dl.id] ?? dl.id;
        finalizeBytes(progressKey, dl.sizeMb * 1024 * 1024);
      }
      return "completed";
    }

    if (useStore.getState().downloadToItemId[dl.id] == null) {
      return "failed";
    }

    return yield* retryInterruptedDownload(
      client,
      awaitCompletion,
      downloadId,
      dl,
      customFilename,
    );
  }).pipe(
    Effect.catchAll((error) =>
      Effect.sync(() => {
        captureError(
          error.cause,
          { download: { id: dl.id, url: dl.url } },
          { operation: "download_file" },
        );
        return "failed" as ItemStatus;
      }),
    ),
  );
};

export const download = (dl: Download): Promise<ItemStatus> =>
  createDownloader(browserDownloadClient)(dl);
