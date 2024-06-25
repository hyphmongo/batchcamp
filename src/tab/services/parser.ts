import * as Sentry from "@sentry/browser";
import { fromPromise, fromThrowable, ok } from "neverthrow";
import { ZodError } from "zod";

import { Format, PendingItem } from "../../types";
import { useStore } from "../store";
import { bandcampSchema, DigitalItem } from "./schema";

const getDataBlob = (html: string) =>
  ok(new DOMParser().parseFromString(html, "text/html")).map(
    (parsed) => parsed.getElementById("pagedata")?.getAttribute("data-blob")
  );

const parseBlob = fromThrowable(
  (input) => JSON.parse(input),
  () => new Error("could not parse JSON")
);

type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

const getDownloads = (format: Format) =>
  fromThrowable(
    (data) =>
      bandcampSchema
        .parse(data)
        .digital_items.filter(
          (x): x is RequiredFields<DigitalItem, "downloads"> =>
            x.downloads !== undefined
        )
        .map((parsed) => {
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
        return new Error(error.issues.map((issue) => issue.message).join(", "));
      }

      if (error instanceof Error) {
        return error;
      }

      return new Error("could not parse bandcamp data");
    }
  );

export const parse = async (item: PendingItem) => {
  const config = useStore.getState().config;

  const parsed = await fromPromise(fetch(item.url), (e) => e as Error)
    .andThen((response) => fromPromise(response.text(), (e) => e as Error))
    .andThen(getDataBlob)
    .andThen(parseBlob)
    .andThen(getDownloads(config?.format || "mp3-320"));

  if (parsed.isErr()) {
    Sentry.captureException(parsed.error);
    return [];
  }

  return parsed.value;
};
