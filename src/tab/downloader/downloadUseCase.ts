import * as Sentry from "@sentry/browser";
import contentDisposition from "content-disposition";
import { detect } from "detect-browser";
import { fromPromise, ok, ResultAsync } from "neverthrow";

import { Configuration } from "../../storage";
import { Download, DownloadStatus, Item, UseCase } from "../../types";
import { ConfigManager } from "../configManager";
import { State, useStore } from "../store";

import browser from "webextension-polyfill";
import { parseDownloadLink } from "./parser";

const detectedBrowser = detect();

const getFirefoxFilename = async (link: string) => {
  const response = await fetch(link);

  const header = response.headers.get("content-disposition");

  if (!header) {
    throw new Error("missing content disposition header");
  }

  const filename = contentDisposition.parse(header).parameters.filename;

  const extension = filename.split(".").pop();

  const cleaned = filename
    .substring(0, filename.lastIndexOf("."))
    .replace(/[:\\<>/!@?"*|]/g, "_");

  const blob = await response.blob();

  const url = URL.createObjectURL(blob);

  return { url, filename: `${cleaned}.${extension}` };
};

// Firefox doesn't automatically get the filename from the content disposition header
// Have to manually fetch the blob then pass it to the download API
const getDownloadId = async (link: string) => {
  if (detectedBrowser?.name === "firefox") {
    const { url, filename } = await getFirefoxFilename(link);
    return await browser.downloads.download({ url, filename });
  }

  return await browser.downloads.download({ url: link });
};

const startDownload = (
  itemId: string,
  link: string
): ResultAsync<number, Error> =>
  fromPromise(getDownloadId(link), (e) => e as Error).andThen((downloadId) => {
    useStore.getState().updateDownloadId(itemId, downloadId);
    return ok(downloadId);
  });

const clearBlob = async (id: number) => {
  const results = await browser.downloads.search({ id });

  if (results.length > 0 && results[0].url.startsWith("blob")) {
    URL.revokeObjectURL(results[0].url);
  }
};

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
          await clearBlob(id);
          browser.downloads.onChanged.removeListener(onChanged);
          resolve(state);
        }
      });
    }),
    (e) => e as Error
  );

const download = (
  item: Item,
  format: Configuration["format"]
): Promise<DownloadStatus> =>
  parseDownloadLink(item.url, format)
    .andThen((link) => startDownload(item.id, link))
    .andThen(waitForDownloadToComplete)
    .match<DownloadStatus>(
      (v) => (v.current === "interrupted" ? "failed" : "completed"),
      (err) => {
        Sentry.captureException(err);
        return "failed";
      }
    );

export class DownloadUseCase implements UseCase<Download, void> {
  constructor(
    private updateDownloadStatus: State["updateDownloadStatus"],
    private config: ConfigManager
  ) {}

  public async execute(request: Download): Promise<void> {
    const item = request.item;

    this.updateDownloadStatus(item.id, "downloading");
    const status = await download(item, this.config.format);
    this.updateDownloadStatus(item.id, status);
  }
}
