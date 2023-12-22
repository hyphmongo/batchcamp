import { ResultAsync, fromPromise, fromThrowable, ok } from "neverthrow";

import { Configuration } from "../../storage";
import { Download, Format, PendingItem } from "../../types";
import { bandcampSchema } from "./schema";
import { ZodError } from "zod";

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
      bandcampSchema.parse(data).digital_items.map<Download>((parsed) => {
        const id = parsed.item_id || parsed.sale_id;

        if (!id) {
          throw new Error("id is missing");
        }

        return {
          id,
          title: `${parsed.artist} - ${parsed.title}`,
          url: parsed.downloads[format].url,
          progress: 0,
        };
      }),
    (error: unknown) => {
      if (error instanceof ZodError) {
        console.log(error);
        return new Error(error.issues.map((issue) => issue.message).join(", "));
      }

      if (error instanceof Error) {
        return error;
      }

      return new Error("could not parse bandcamp data");
    }
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
