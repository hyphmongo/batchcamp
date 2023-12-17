import { ResultAsync, fromPromise, fromThrowable, ok } from "neverthrow";
import { z } from "zod";
import { Configuration } from "../../storage";
import { Download, Format, Item } from "../../types";

const bandcampSchema = z.object({
  digital_items: z.array(
    z.object({
      sale_id: z.number(),
      artist: z.string(),
      title: z.string(),
      downloads: z.object({
        "mp3-v0": z.object({
          url: z.string(),
        }),
        "mp3-320": z.object({
          url: z.string(),
        }),
        flac: z.object({
          url: z.string(),
        }),
        "aac-hi": z.object({
          url: z.string(),
        }),
        vorbis: z.object({
          url: z.string(),
        }),
        alac: z.object({
          url: z.string(),
        }),
        wav: z.object({
          url: z.string(),
        }),
        "aiff-lossless": z.object({
          url: z.string(),
        }),
      }),
    })
  ),
});

const getDataBlob = (html: string) =>
  ok(new DOMParser().parseFromString(html, "text/html")).map(
    (parsed) => parsed.getElementById("pagedata")?.getAttribute("data-blob")
  );

const parseBlob = fromThrowable(
  (input) => JSON.parse(input),
  () => new Error("could not parse JSON")
);

const getDownloads = (item: Item, format: Format) =>
  fromThrowable(
    (data) =>
      bandcampSchema.parse(data).digital_items.map<Download>((parsed) => ({
        id: parsed.sale_id.toString(),
        itemId: item.id,
        title: `${parsed.artist} - ${parsed.title}`,
        status: "pending",
        progress: 0,
        downloadUrl: parsed.downloads[format].url,
      })),
    () => new Error("could not find download links")
  );

export const parseDownloadLinks = (
  item: Item,
  format: Configuration["format"]
): ResultAsync<Download[], Error> =>
  fromPromise(fetch(item.pageUrl), (e) => e as Error)
    .andThen((response) => fromPromise(response.text(), (e) => e as Error))
    .andThen(getDataBlob)
    .andThen(parseBlob)
    .andThen(getDownloads(item, format));
