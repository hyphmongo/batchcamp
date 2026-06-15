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
import {
  browserDownloadClient,
  type DownloadClient,
  FilenameRateLimitError,
} from "./download-client";
import { finalizeBytes } from "./download-progress";
import { sanitizePath } from "./downloader-utils";
import { parse } from "./parser";

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
    if (!first?.canResume) {
      return false;
    }
    if (isBrowserIdPausedByUser(browserId)) {
      return false;
    }
    yield* tryDownload(() => browserAdapter.downloads.resume(browserId));
    return true;
  }).pipe(Effect.orElseSucceed(() => false));

const MIN_PLAUSIBLE_BYTES = 64 * 1024;

export const savedBytesArePlausible = (
  item: browser.Downloads.DownloadItem | undefined,
  dl: Download,
): boolean => {
  if (!item) {
    return true;
  }
  const received = Math.max(
    item.fileSize ?? 0,
    item.totalBytes ?? 0,
    item.bytesReceived ?? 0,
  );
  if (received <= 0) {
    return false;
  }
  if (dl.sizeMb && dl.sizeMb > 0) {
    return received >= dl.sizeMb * 1024 * 1024 * 0.5;
  }
  return received >= MIN_PLAUSIBLE_BYTES;
};

const verifySavedFile = (
  downloadId: number,
  dl: Download,
): Effect.Effect<boolean> =>
  tryDownload(() => browserAdapter.downloads.search({ id: downloadId })).pipe(
    Effect.map((results) => savedBytesArePlausible(results[0], dl)),
    Effect.orElseSucceed(() => true),
  );

const verifiedCompletion = (
  downloadId: number,
  dl: Download,
  state: browser.Downloads.StringDelta,
): Effect.Effect<ItemStatus | null> =>
  Effect.gen(function* () {
    if (state.current === "interrupted") {
      return null;
    }
    return (yield* verifySavedFile(downloadId, dl)) ? "completed" : null;
  });

const readInterruptReason = (
  downloadId: number,
): Effect.Effect<string | undefined> =>
  tryDownload(() => browserAdapter.downloads.search({ id: downloadId })).pipe(
    Effect.map((results) => results[0]?.error ?? undefined),
    Effect.orElseSucceed(() => undefined),
  );

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
            const status = yield* verifiedCompletion(
              originalBrowserId,
              dl,
              state.value,
            );
            if (status) {
              return status;
            }
          }
          continue;
        }
      }

      const outcome = yield* Effect.gen(function* () {
        const newId = yield* tryDownload(() =>
          client.startDownload({ url: dl.url, filename: customFilename }),
        );
        useStore.getState().updateDownloadBrowserId(dl.id, newId);
        const state = yield* awaitCompletion(Promise.resolve(newId));
        return { newId, state };
      }).pipe(Effect.option);

      if (Option.isSome(outcome)) {
        const status = yield* verifiedCompletion(
          outcome.value.newId,
          dl,
          outcome.value.state,
        );
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

export type RegenerateUrl = (dl: Download) => Promise<string | null>;

const regenerateAndDownload = (
  client: DownloadClient,
  awaitCompletion: AwaitCompletion,
  regenerate: RegenerateUrl,
  dl: Download,
  customFilename?: string,
): Effect.Effect<ItemStatus> =>
  Effect.gen(function* () {
    const freshUrl = yield* tryDownload(() => regenerate(dl)).pipe(
      Effect.orElseSucceed(() => null),
    );
    if (!freshUrl || freshUrl === dl.url) {
      return "failed";
    }
    if (useStore.getState().downloadToItemId[dl.id] == null) {
      return "failed";
    }

    addBreadcrumb({
      message: "Regenerated download link after persistent failure",
      data: { id: dl.id },
      level: "info",
    });

    const freshDl: Download = { ...dl, url: freshUrl };
    const newId = yield* tryDownload(() =>
      client.startDownload({ url: freshUrl, filename: customFilename }),
    );
    useStore.getState().updateDownloadBrowserId(dl.id, newId);
    const state = yield* awaitCompletion(Promise.resolve(newId));
    return (yield* verifiedCompletion(newId, freshDl, state)) ?? "failed";
  }).pipe(Effect.orElseSucceed(() => "failed" as ItemStatus));

export const createDownloader =
  (
    client: DownloadClient,
    awaitCompletion: AwaitCompletion = defaultAwaitCompletion,
    regenerate?: RegenerateUrl,
  ) =>
  (dl: Download): Promise<ItemStatus> =>
    Effect.runPromise(downloadEffect(client, awaitCompletion, dl, regenerate));

const downloadEffect = (
  client: DownloadClient,
  awaitCompletion: AwaitCompletion,
  dl: Download,
  regenerate?: RegenerateUrl,
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
        ).pipe(
          Effect.catchAll((error) =>
            error.cause instanceof FilenameRateLimitError
              ? Effect.fail(error)
              : Effect.succeed(undefined),
          ),
        )
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

    let interruptReason: string | undefined;

    if (state.current !== "interrupted") {
      const status = yield* verifiedCompletion(downloadId, dl, state);
      if (status === "completed") {
        if (dl.sizeMb) {
          const progressKey =
            useStore.getState().downloadToItemId[dl.id] ?? dl.id;
          finalizeBytes(progressKey, dl.sizeMb * 1024 * 1024);
        }
        return "completed";
      }
      addBreadcrumb({
        message:
          "Download reported complete but the saved file is implausibly small; retrying",
        data: { url: dl.url, id: dl.id },
        level: "warning",
      });
    } else {
      interruptReason = yield* readInterruptReason(downloadId);
      addBreadcrumb({
        message: `Download interrupted: ${interruptReason ?? "unknown"}`,
        data: { url: dl.url, id: dl.id },
        level: "warning",
      });
    }

    if (useStore.getState().downloadToItemId[dl.id] == null) {
      return "failed";
    }

    const retried = yield* retryInterruptedDownload(
      client,
      awaitCompletion,
      downloadId,
      dl,
      customFilename,
    );

    const finalStatus =
      retried === "completed" || !regenerate
        ? retried
        : yield* regenerateAndDownload(
            client,
            awaitCompletion,
            regenerate,
            dl,
            customFilename,
          );

    if (finalStatus === "failed" && interruptReason) {
      captureError(
        new Error(`Download failed: ${interruptReason}`),
        { download: { id: dl.id, url: dl.url, reason: interruptReason } },
        {
          operation: "download_interrupted",
          interrupt_reason: interruptReason,
        },
        ["download-interrupted", interruptReason],
      );
    }

    return finalStatus;
  }).pipe(
    Effect.catchAll((error) =>
      Effect.sync(() => {
        if (error.cause instanceof FilenameRateLimitError) {
          return "rate_limited" as ItemStatus;
        }
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

const regenerateDownloadUrl: RegenerateUrl = async (dl) => {
  const state = useStore.getState();
  const itemId = state.downloadToItemId[dl.id];
  if (!itemId) {
    return null;
  }
  const item = state.items.get(itemId);
  if (!item?.url) {
    return null;
  }

  const result = await parse({ url: item.url, format: dl.format });
  if (result.kind !== "downloads") {
    return null;
  }

  const match = result.downloads.find((d) => d.id === dl.id);
  return match && match.url !== dl.url ? match.url : null;
};

export const download = (dl: Download): Promise<ItemStatus> =>
  createDownloader(
    browserDownloadClient,
    defaultAwaitCompletion,
    regenerateDownloadUrl,
  )(dl);
