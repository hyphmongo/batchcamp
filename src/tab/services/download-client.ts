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

export interface DownloadClient {
  startDownload(opts: StartDownloadOptions): Promise<number>;
  inferFilenameExtension(url: string): Promise<string>;
}

const probeHeaders = (link: string, signal: AbortSignal) =>
  fetch(link, {
    signal,
    method: "GET",
    headers: { Range: "bytes=0-0" },
  });

const fetchServerFilename = async (link: string): Promise<string> => {
  const controller = new AbortController();
  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await probeHeaders(link, controller.signal);
  } catch {
    response = await probeHeaders(link, controller.signal);
  }
  let header = response.headers.get("content-disposition");
  if (!header && response.status === 206) {
    response = await fetch(link, { signal: controller.signal, method: "GET" });
    header = response.headers.get("content-disposition");
  }
  controller.abort();

  if (!header) {
    addBreadcrumb({
      message: "Missing content-disposition header",
      data: { url: link, status: response.status },
      level: "error",
    });
    throw new Error("missing content disposition header");
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
