import { err, ok, Result, ResultAsync } from "neverthrow";
import { Configuration } from "../storage";
import { Download, DownloadStatus, Format, Item, UseCase } from "../types";
import { ConfigManager } from "./configManager";
import { State, useStore } from "./store";
import * as Sentry from "@sentry/browser";

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
        return err(new Error(pageData.error.message));
      }

      const url = (pageData.value as BandcampJSON).download_items[0].downloads[
        format
      ].url;

      if (!url) {
        return err(new Error("oh no"));
      }

      return ok(url);
    });

const startDownload = (
  itemId: string,
  link: string
): ResultAsync<number, Error> =>
  ResultAsync.fromPromise(
    chrome.downloads.download({ url: link }),
    (e) => e as Error
  ).andThen((downloadId) => {
    useStore.getState().updateDownloadId(itemId, downloadId);
    return ok(downloadId);
  });

const waitForDownloadToComplete = (
  downloadId: number
): ResultAsync<chrome.downloads.StringDelta, Error> =>
  ResultAsync.fromPromise(
    new Promise((resolve) => {
      chrome.downloads.onChanged.addListener(function onChanged({ id, state }) {
        if (id === downloadId && state && state.current !== "in_progress") {
          chrome.downloads.onChanged.removeListener(onChanged);
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
