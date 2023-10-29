import * as Sentry from "@sentry/browser";
import contentDisposition from "content-disposition";
import { detect } from "detect-browser";
import { err, ok, Result, ResultAsync } from "neverthrow";

import { Configuration } from "../storage";
import { Download, DownloadStatus, Format, Item, UseCase } from "../types";
import { ConfigManager } from "./configManager";
import { State, useStore } from "./store";

import browser from "webextension-polyfill";

const detectedBrowser = detect();

type BandcampDownload = {
  downloads: {
    [key in Format]: {
      url: string;
    };
  };
};

type BandcampJSON = {
  download_items: Array<BandcampDownload>;
};

type ParseError = { message: string };
const toParseError = (): ParseError => ({ message: "Parse Error" });

const safeJsonParse = Result.fromThrowable(
  (input) => JSON.parse(input),
  toParseError
);

const parseDownloadLink = (
  url: string,
  format: Configuration["format"]
): ResultAsync<string, Error> =>
  ResultAsync.fromPromise(fetch(url), (e) => e as Error)
    .andThen((response) =>
      ResultAsync.fromPromise(response.text(), (e) => e as Error)
    )
    .andThen((html) => {
      const parsed = new DOMParser().parseFromString(html, "text/html");
      const blob = parsed
        ?.getElementById("pagedata")
        ?.getAttribute("data-blob");

      if (!blob) {
        return err(new Error("could not find page data blob"));
      }

      const pageData = safeJsonParse(blob);

      if (pageData.isErr()) {
        Sentry.captureException(pageData.error);
        return err(new Error(pageData.error.message));
      }

      let url;

      try {
        url = (pageData.value as BandcampJSON).download_items[0]?.downloads[
          format
        ]?.url;
        return ok(url);
      } catch (error) {
        Sentry.captureException(error);
        return err(new Error("failed to get url"));
      }
    });

// Firefox doesn't automatically get the filename from the content disposition header
// Have to manually fetch the blob then pass it to the download API
const getDownloadId = async (link: string) => {
  if (detectedBrowser?.name === "firefox") {
    const response = await fetch(link);

    const filename = contentDisposition.parse(
      response.headers.get("content-disposition")!
    ).parameters.filename;

    const blob = await response.blob();

    const url = URL.createObjectURL(blob);

    return await browser.downloads.download({ url, filename });
  }

  return await browser.downloads.download({ url: link });
};

const startDownload = (
  itemId: string,
  link: string
): ResultAsync<number, Error> =>
  ResultAsync.fromPromise(getDownloadId(link), (e) => e as Error).andThen(
    (downloadId) => {
      useStore.getState().updateDownloadId(itemId, downloadId);
      return ok(downloadId);
    }
  );

const clearBlob = async (id: number) => {
  const results = await browser.downloads.search({ id });

  if (results.length > 0 && results[0].url.startsWith("blob")) {
    URL.revokeObjectURL(results[0].url);
  }
};

const waitForDownloadToComplete = (
  downloadId: number
): ResultAsync<browser.Downloads.StringDelta, Error> =>
  ResultAsync.fromPromise(
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

const download = async (
  item: Item,
  format: Configuration["format"]
): Promise<DownloadStatus> => {
  const result = parseDownloadLink(item.url, format)
    .andThen((link) => startDownload(item.id, link))
    .andThen(waitForDownloadToComplete);

  return await result.match<DownloadStatus>(
    (v) => (v.current === "interrupted" ? "failed" : "completed"),
    (err) => {
      Sentry.captureException(err);
      return "failed";
    }
  );
};

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
