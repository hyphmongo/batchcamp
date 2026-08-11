import { Data, Duration, Effect, Schedule } from "effect";

import { isFirefox } from "@/shared/browser-info";
import { addBreadcrumb } from "@/shared/error-handler";
import { browserAdapter } from "./browser-adapter";
import {
  parseContentDispositionFilename,
  sanitizeFilename,
} from "./downloader-utils";

type StartDownloadOptions = {
  url: string;
  filename?: string;
};

export class FilenameRateLimitError extends Error {
  constructor() {
    super("rate limited while resolving filename");
    this.name = "FilenameRateLimitError";
  }
}

export class EncodingIncompleteError extends Error {
  constructor() {
    super("bandcamp is still encoding this format");
    this.name = "EncodingIncompleteError";
  }
}

export interface DownloadClient {
  startDownload(opts: StartDownloadOptions): Promise<number>;
  inferFilenameExtension(url: string): Promise<string>;
}

const ENCODING_STATUS = 503;
export const ENCODING_DEADLINE_MS = 60_000;

const encodingSchedule = Schedule.exponential(Duration.seconds(1)).pipe(
  Schedule.union(Schedule.spaced(Duration.seconds(8))),
  Schedule.upTo(Duration.millis(ENCODING_DEADLINE_MS)),
);

const requestFirstByte = (link: string, signal: AbortSignal) =>
  fetch(link, {
    signal,
    method: "GET",
    headers: { Range: "bytes=0-0" },
  });

const probe = (link: string, signal: AbortSignal) =>
  Effect.tryPromise(() => requestFirstByte(link, signal)).pipe(
    Effect.retry({ times: 1 }),
  );

type Probe = Awaited<ReturnType<typeof fetch>>;

const isEncoding = (response: Probe) => response.status === ENCODING_STATUS;

class StillEncoding extends Data.TaggedError("StillEncoding")<{
  readonly response: Probe;
}> {}

const probeUntilReady = (link: string, signal: AbortSignal) =>
  probe(link, signal).pipe(
    Effect.filterOrFail(
      (response) => !isEncoding(response),
      (response) => new StillEncoding({ response }),
    ),
    Effect.retry({
      schedule: encodingSchedule,
      while: (error) => error._tag === "StillEncoding",
    }),
    Effect.catchTag("StillEncoding", ({ response }) =>
      Effect.succeed(response),
    ),
  );

const withFullResponseFallback = (
  link: string,
  signal: AbortSignal,
  response: Probe,
) =>
  !response.headers.get("content-disposition") && response.status === 206
    ? Effect.promise(() => fetch(link, { signal, method: "GET" }))
    : Effect.succeed(response);

const resolveFilenameResponse = (link: string, signal: AbortSignal) =>
  probeUntilReady(link, signal).pipe(
    Effect.flatMap((response) =>
      withFullResponseFallback(link, signal, response),
    ),
  );

const fetchServerFilename = async (link: string): Promise<string> => {
  const controller = new AbortController();
  const response = await Effect.runPromise(
    resolveFilenameResponse(link, controller.signal),
  );
  controller.abort();

  const header = response.headers.get("content-disposition");
  if (!header) {
    const encoding = isEncoding(response);
    addBreadcrumb({
      message: encoding
        ? "Still encoding when we stopped polling; will retry later"
        : "Filename probe missing content-disposition (rate limited); will retry",
      data: {
        url: link,
        status: response.status,
        contentType: response.headers.get("content-type"),
      },
      level: "warning",
    });
    throw encoding
      ? new EncodingIncompleteError()
      : new FilenameRateLimitError();
  }

  const filename = parseContentDispositionFilename(header);
  if (!filename) {
    addBreadcrumb({
      message: "Could not parse filename from content-disposition",
      data: { header },
      level: "error",
    });
    throw new Error("could not parse filename from content disposition header");
  }

  return sanitizeFilename(filename);
};

const inferExtensionFromServer = async (url: string): Promise<string> => {
  const filename = await fetchServerFilename(url);
  const parts = filename.split(".");
  return parts.length > 1 ? `.${parts.pop()}` : ".zip";
};

const reSanitizeIllegalChars = (filename: string): string =>
  filename
    .split("/")
    .map((segment) => segment.replace(/[^a-zA-Z0-9._\- ]/g, "_"))
    .join("/");

export const chromeDownloadClient: DownloadClient = {
  async startDownload({ url, filename }) {
    if (filename) {
      await browserAdapter.runtime.sendMessage({
        type: "register-filename",
        url,
        filename,
      });
    }
    try {
      return await browserAdapter.downloads.download({ url });
    } catch (error) {
      if (filename) {
        await browserAdapter.runtime.sendMessage({
          type: "unregister-filename",
          url,
        });
      }
      throw error;
    }
  },
  inferFilenameExtension: inferExtensionFromServer,
};

export const firefoxDownloadClient: DownloadClient = {
  async startDownload({ url, filename }) {
    const resolved = filename ?? (await fetchServerFilename(url));

    try {
      return await browserAdapter.downloads.download({
        url,
        filename: resolved,
        conflictAction: "uniquify",
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message?.includes("illegal characters")
      ) {
        const fallback = reSanitizeIllegalChars(resolved);
        addBreadcrumb({
          message: "Firefox filename re-sanitized due to illegal characters",
          data: { original: resolved, fallback },
          level: "warning",
        });
        return browserAdapter.downloads.download({
          url,
          filename: fallback,
          conflictAction: "uniquify",
        });
      }
      throw error;
    }
  },
  inferFilenameExtension: inferExtensionFromServer,
};

export const browserDownloadClient: DownloadClient = isFirefox
  ? firefoxDownloadClient
  : chromeDownloadClient;
