import { ResultAsync, fromPromise, fromThrowable, ok } from "neverthrow";

import { Configuration } from "../../storage";
import { Download, Format, PendingItem } from "../../types";
import { bandcampSchema } from "./schema";

const getDataBlob = (html: string) =>
  ok(new DOMParser().parseFromString(html, "text/html")).map(
    (parsed) => parsed.getElementById("pagedata")?.getAttribute("data-blob")
  );

const parseBlob = fromThrowable(
  (input) => JSON.parse(input),
  () => new Error("could not parse JSON")
);

const getDownloads = (format: Format) =>
  fromThrowable(
    (data) =>
      bandcampSchema.parse(data).digital_items.map<Download>((parsed) => ({
        id: parsed.sale_id.toString(),
        title: `${parsed.artist} - ${parsed.title}`,
        url: parsed.downloads[format].url,
        progress: 0,
      })),
    () => new Error("could not find download links")
  );

export const parseDownloadLinks = (
  item: PendingItem,
  format: Configuration["format"]
): ResultAsync<Download[], Error> =>
  fromPromise(fetch(item.url), (e) => e as Error)
    .andThen((response) => fromPromise(response.text(), (e) => e as Error))
    .andThen(getDataBlob)
    .andThen(parseBlob)
    .andThen(getDownloads(format));
