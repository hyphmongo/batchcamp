import { Data, Effect } from "effect";
import { ZodError, z } from "zod";

import { track } from "@/shared/analytics";
import { addBreadcrumb, captureError } from "@/shared/error-handler";
import { makeItemId } from "@/shared/id";
import { toError } from "@/shared/to-error";
import { useStore } from "@/tab/store";
import type { Download, Format, PendingItem } from "@/types";
import { bandcampSchema, type DigitalItem } from "./schema";

export class ParseError extends Data.TaggedError("ParseError")<{
  readonly cause: Error;
}> {}

class FetchError extends Data.TaggedError("FetchError")<{
  readonly cause: Error;
  readonly status?: number;
}> {}

class HttpError extends Error {
  constructor(readonly status: number) {
    super(`bandcamp responded ${status}`);
  }
}

type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

const UNIT_TO_MB = {
  kb: 1 / 1024,
  mb: 1,
  gb: 1024,
  tb: 1024 * 1024,
};

export const parseSizeMb = (sizeStr?: string | null): number | undefined => {
  if (!sizeStr) {
    return;
  }
  const value = Number.parseFloat(sizeStr);
  if (Number.isNaN(value)) {
    return;
  }
  const unit = (sizeStr.toLowerCase().match(/([kmgt]b)\s*$/)?.[1] ??
    "mb") as keyof typeof UNIT_TO_MB;
  return value * UNIT_TO_MB[unit];
};

const extractDataBlob = (html: string) =>
  Effect.sync(() => {
    const parsed = new DOMParser().parseFromString(html, "text/html");
    return parsed.getElementById("pagedata")?.getAttribute("data-blob") ?? null;
  });

const parseBlob = (input: string | null) =>
  Effect.try({
    try: () => {
      if (input === null) {
        throw new Error("could not find pagedata blob");
      }
      return JSON.parse(input) as unknown;
    },
    catch: (cause) => new ParseError({ cause: toError(cause) }),
  });

export const getDownloads =
  (format: Format) =>
  (data: unknown): Effect.Effect<Download[], ParseError> =>
    Effect.try({
      try: () =>
        bandcampSchema
          .parse(data)
          .digital_items.filter(
            (x): x is RequiredFields<DigitalItem, "downloads"> =>
              x.downloads !== undefined && x.downloads[format] !== undefined,
          )
          .map((parsed): Download => {
            const bandcampId = parsed.item_id || parsed.sale_id;
            if (!bandcampId) {
              throw new Error("id is missing");
            }

            const formatDownload = parsed.downloads[format];
            if (!formatDownload) {
              throw new Error(`format ${format} not available`);
            }
            return {
              id: makeItemId(bandcampId, format),
              title: parsed.title,
              artist: parsed.artist,
              date: parsed.package_release_date ?? parsed.purchased,
              artUrl: parsed.art_id
                ? `https://f4.bcbits.com/img/a${parsed.art_id}_10.jpg`
                : undefined,
              sizeMb: parseSizeMb(formatDownload.size_mb),
              url: formatDownload.url,
              progress: 0,
              format,
            };
          }),
      catch: (error) => {
        if (error instanceof ZodError) {
          return new ParseError({
            cause: new Error(
              error.issues
                .map((issue) =>
                  issue.path.length > 0
                    ? `${issue.path.join(".")}: ${issue.message}`
                    : issue.message,
                )
                .join(", "),
            ),
          });
        }
        return new ParseError({ cause: toError(error) });
      },
    });

const fetchItemHtml = (url: string) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new HttpError(response.status);
      }
      return response.text();
    },
    catch: (cause) =>
      new FetchError({
        cause: toError(cause),
        status: cause instanceof HttpError ? cause.status : undefined,
      }),
  });

const gateSchema = z.object({
  identities: z
    .object({ fan: z.object({ verified: z.boolean().nullish() }).nullish() })
    .nullish(),
  digital_items: z.array(
    z.object({
      killed: z.number().nullish(),
      downloads: z.unknown(),
    }),
  ),
});

// Bandcamp serves the download page with no `downloads` links and an
// unverified fan identity until the account email is confirmed. The page
// labels this "Download expired", but the real cause is the unverified email.
export const isUnverifiedGate = (data: unknown): boolean => {
  const result = gateSchema.safeParse(data);
  if (!result.success || result.data.digital_items.length === 0) {
    return false;
  }
  const allWithoutDownloads = result.data.digital_items.every(
    (item) => item.killed == null && !item.downloads,
  );
  return allWithoutDownloads && result.data.identities?.fan?.verified === false;
};

const parseProgram = (
  item: PendingItem,
  format: Format,
): Effect.Effect<ParseResult, ParseError | FetchError> =>
  Effect.gen(function* () {
    const html = yield* fetchItemHtml(item.url);
    const blob = yield* extractDataBlob(html);
    const data = yield* parseBlob(blob);
    if (isUnverifiedGate(data)) {
      return { downloads: [], rateLimited: false, unverified: true };
    }
    const downloads = yield* getDownloads(format)(data);
    return { downloads, rateLimited: false, unverified: false };
  });

export type ParseResult = {
  downloads: Download[];
  rateLimited: boolean;
  unverified: boolean;
};

let forcedRateLimits = 0;

export const __forceRateLimit = (count: number): void => {
  forcedRateLimits = count;
};

export const parse = async (item: PendingItem): Promise<ParseResult> => {
  const format = item.format ?? useStore.getState().config?.format ?? "mp3-320";

  if (import.meta.env.DEV && forcedRateLimits > 0) {
    forcedRateLimits -= 1;
    track("rate_limited", { format });
    return { downloads: [], rateLimited: true, unverified: false };
  }

  return Effect.runPromise(
    parseProgram(item, format).pipe(
      Effect.catchAll((error) =>
        Effect.sync(() => {
          const rateLimited =
            error._tag === "FetchError" && error.status === 429;
          const notFound = error._tag === "FetchError" && error.status === 404;
          if (rateLimited) {
            track("rate_limited", { format });
            addBreadcrumb({
              message: "Bandcamp rate limited (429); retrying",
              data: { format },
              level: "warning",
            });
          } else if (notFound) {
            addBreadcrumb({
              message: "Bandcamp item page returned 404 (expired or removed)",
              data: { url: item.url, format },
              level: "warning",
            });
          } else {
            captureError(
              error.cause,
              { parser: { url: item.url, format } },
              { operation: "parse_bandcamp_data" },
            );
          }
          return {
            downloads: [] as Download[],
            rateLimited,
            unverified: false,
          };
        }),
      ),
    ),
  );
};
