import { Data, Effect } from "effect";
import type { ZodError } from "zod";

import { track } from "@/shared/analytics";
import { addBreadcrumb, captureError } from "@/shared/error-handler";
import { makeItemId } from "@/shared/id";
import { toError } from "@/shared/to-error";
import { useStore } from "@/tab/store";
import type { Download, Format } from "@/types";
import {
  bandcampPageSchema,
  type DigitalItem,
  digitalItemSchema,
} from "./schema";

export type ParseInput = { url: string; format?: Format };

export class ParseError extends Data.TaggedError("ParseError")<{
  readonly cause: Error;
  readonly issues?: readonly string[];
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
  if (!Number.isFinite(value)) {
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

const issueStrings = (error: ZodError): string[] =>
  error.issues.map((issue) =>
    issue.path.length > 0
      ? `${issue.path.join(".")}: ${issue.message}`
      : issue.message,
  );

const formatZodIssues = (error: ZodError): string =>
  issueStrings(error).join(", ");

const buildDownload = (
  parsed: DigitalItem,
  format: Format,
): Download | null => {
  const formatDownload = parsed.downloads?.[format];
  if (!formatDownload) {
    return null;
  }
  return {
    id: makeItemId(parsed.bandcampId, format),
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
};

export type PageOutcome =
  | { readonly _tag: "Downloads"; readonly downloads: Download[] }
  | { readonly _tag: "Unverified" };

const parseItems = (
  items: readonly unknown[],
): { parsed: DigitalItem[]; invalidIssues: string[] } => {
  const parsed: DigitalItem[] = [];
  const invalidIssues: string[] = [];
  for (const [index, raw] of items.entries()) {
    const result = digitalItemSchema.safeParse(raw);
    if (!result.success) {
      const issues = formatZodIssues(result.error);
      invalidIssues.push(`item ${index}: ${issues}`);
      addBreadcrumb({
        message: "Skipped a digital item that failed validation",
        data: { index, issues },
        level: "warning",
      });
      continue;
    }
    parsed.push(result.data);
  }
  return { parsed, invalidIssues };
};

const driftError = (issues: string[]): ParseError =>
  new ParseError({
    cause: new Error(
      `no downloads produced; ${issues.length} item(s) failed validation: ${issues.join("; ")}`,
    ),
    issues,
  });

export const parsePage =
  (format: Format) =>
  (data: unknown): Effect.Effect<PageOutcome, ParseError> =>
    Effect.gen(function* () {
      const page = bandcampPageSchema.safeParse(data);
      if (!page.success) {
        return yield* Effect.fail(
          new ParseError({
            cause: new Error(formatZodIssues(page.error)),
            issues: issueStrings(page.error),
          }),
        );
      }

      const { parsed, invalidIssues } = parseItems(page.data.digital_items);
      const downloads = parsed.flatMap((item) => {
        const download = buildDownload(item, format);
        return download ? [download] : [];
      });
      if (downloads.length > 0) {
        return { _tag: "Downloads", downloads };
      }

      const unverified =
        page.data.identities?.fan?.verified === false &&
        parsed.every((item) => !item.downloads);
      if (unverified) {
        return { _tag: "Unverified" };
      }

      if (invalidIssues.length > 0) {
        return yield* Effect.fail(driftError(invalidIssues));
      }

      return { _tag: "Downloads", downloads: [] };
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

const parseProgram = (
  item: ParseInput,
  format: Format,
): Effect.Effect<PageOutcome, ParseError | FetchError> =>
  Effect.gen(function* () {
    const html = yield* fetchItemHtml(item.url);
    const blob = yield* extractDataBlob(html);
    const data = yield* parseBlob(blob);
    return yield* parsePage(format)(data);
  });

export type ParseResult =
  | { kind: "downloads"; downloads: Download[] }
  | { kind: "unverified" }
  | { kind: "rateLimited" }
  | { kind: "failed" };

let forcedRateLimits = 0;

export const __forceRateLimit = (count: number): void => {
  forcedRateLimits = count;
};

const isRateLimited = (error: ParseError | FetchError): boolean =>
  error._tag === "FetchError" && error.status === 429;

const reportParseFailure = (
  item: ParseInput,
  format: Format,
  error: ParseError | FetchError,
): void => {
  if (isRateLimited(error)) {
    track("rate_limited", { format });
    addBreadcrumb({
      message: "Bandcamp rate limited (429); retrying",
      data: { format },
      level: "warning",
    });
    return;
  }
  if (error._tag === "FetchError" && error.status === 404) {
    addBreadcrumb({
      message: "Bandcamp item page returned 404 (expired or removed)",
      data: { url: item.url, format },
      level: "warning",
    });
    return;
  }
  const isParseError = error._tag === "ParseError";
  captureError(
    error.cause,
    {
      parser: {
        url: item.url,
        format,
        issues: isParseError ? error.issues : undefined,
      },
    },
    { operation: "parse_bandcamp_data" },
    isParseError ? ["parse-bandcamp-data"] : undefined,
  );
};

export const parse = async (item: ParseInput): Promise<ParseResult> => {
  const format = item.format ?? useStore.getState().config?.format ?? "mp3-320";

  if (import.meta.env.DEV && forcedRateLimits > 0) {
    forcedRateLimits -= 1;
    track("rate_limited", { format });
    return { kind: "rateLimited" };
  }

  return Effect.runPromise(
    parseProgram(item, format).pipe(
      Effect.map((outcome): ParseResult => {
        if (outcome._tag === "Unverified") {
          return { kind: "unverified" };
        }
        return outcome.downloads.length > 0
          ? { kind: "downloads", downloads: outcome.downloads }
          : { kind: "failed" };
      }),
      Effect.catchAll((error) =>
        Effect.sync((): ParseResult => {
          reportParseFailure(item, format, error);
          return isRateLimited(error)
            ? { kind: "rateLimited" }
            : { kind: "failed" };
        }),
      ),
    ),
  );
};
