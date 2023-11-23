import { ResultAsync, fromPromise, fromThrowable, ok } from "neverthrow";
import { Configuration } from "../../storage";
import { Format } from "../../types";

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

const getDataBlob = (html: string) =>
  ok(new DOMParser().parseFromString(html, "text/html")).map(
    (parsed) => parsed.getElementById("pagedata")?.getAttribute("data-blob")
  );

const parseBlob = fromThrowable(
  (input) => JSON.parse(input),
  () => new Error("could not parse JSON")
);

const getUrl = (format: Format) =>
  fromThrowable(
    (data) => (data as BandcampJSON).download_items[0]?.downloads[format]?.url,
    () => new Error("could not find download link")
  );

export const parseDownloadLink = (
  url: string,
  format: Configuration["format"]
): ResultAsync<string, Error> =>
  fromPromise(fetch(url), (e) => e as Error)
    .andThen((response) => fromPromise(response.text(), (e) => e as Error))
    .andThen(getDataBlob)
    .andThen(parseBlob)
    .andThen(getUrl(format));
