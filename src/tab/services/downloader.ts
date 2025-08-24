import * as Sentry from "@sentry/browser";
import contentDisposition from "content-disposition";
import { detect } from "detect-browser";
import { fromPromise, ok, ResultAsync } from "neverthrow";
import browser from "webextension-polyfill";

import { Download, ItemStatus } from "../../types";
import { useStore } from "../store";

const detectedBrowser = detect();

const sanitizeFilename = (filename: string): string => {
  const parts = filename.split(".");
  const extension = parts.pop();
  const name = parts.join(".");

  let cleaned = name
    .replace(/[<>:"/\\|?*]/g, "_")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .replace(/[^\x20-\x7E\u00A1-\u00FF]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim();

  if (!cleaned || cleaned === "") {
    cleaned = "download";
  }

  const reservedNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

  if (reservedNames.test(cleaned)) {
    cleaned = `_${cleaned}`;
  }

  const maxLength = 200;

  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength).replace(/_+$/, "");
  }

  return extension ? `${cleaned}.${extension}` : cleaned;
};

// Firefox doesn't automatically get the filename from the content disposition header
// Have to fake the download first, grab the header, then abort the request
const getFirefoxFilename = async (link: string): Promise<string> => {
  const controller = new AbortController();

  try {
    const response = await fetch(link, {
      signal: controller.signal,
      method: "GET",
    });

    controller.abort();

    const header = response.headers.get("content-disposition");

    if (!header) {
      throw new Error("missing content disposition header");
    }

    const parsedHeader = contentDisposition.parse(header);
    return sanitizeFilename(parsedHeader.parameters.filename);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      // AbortError is expected, continue
    }
    throw error;
  }
};

const getDownloadId = async (link: string): Promise<number> => {
  if (detectedBrowser?.name === "firefox") {
    const filename = await getFirefoxFilename(link);

    try {
      return await browser.downloads.download({
        url: link,
        filename,
        conflictAction: "uniquify",
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message?.includes("illegal characters")
      ) {
        const sanitized = sanitizeFilename(filename);
        console.warn(`Filename sanitized: ${filename} -> ${sanitized}`);
        Sentry.addBreadcrumb({
          message: 'Firefox filename sanitized',
          data: { original: filename, sanitized },
          level: 'warning'
        });

        return await browser.downloads.download({
          url: link,
          filename: sanitized,
          conflictAction: "uniquify",
        });
      }
      throw error;
    }
  }

  return await browser.downloads.download({ url: link });
};

const startDownload = (id: string, link: string): ResultAsync<number, Error> =>
  fromPromise(getDownloadId(link), (e) => e as Error).andThen((downloadId) => {
    useStore.getState().updateDownloadBrowserId(id, downloadId);
    return ok(downloadId);
  });

const waitForDownloadToComplete = (
  downloadId: number
): ResultAsync<browser.Downloads.StringDelta, Error> =>
  fromPromise(
    new Promise((resolve) => {
      browser.downloads.onChanged.addListener(async function onChanged({
        id,
        state,
      }) {
        if (id === downloadId && state && state.current !== "in_progress") {
          browser.downloads.onChanged.removeListener(onChanged);
          resolve(state);
        }
      });
    }),
    (e) => e as Error
  );

export const download = (download: Download): Promise<ItemStatus> =>
  startDownload(download.id, download.url)
    .andThen(waitForDownloadToComplete)
    .match<ItemStatus>(
      (v) => (v.current === "interrupted" ? "failed" : "completed"),
      (err) => {
        Sentry.withScope((scope) => {
          scope.setContext("download", { url: download.url });
          Sentry.captureException(err);
        });
        return "failed";
      }
    );
