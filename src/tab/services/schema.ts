import { z } from "zod";

import { FORMAT_LABELS, type Format } from "@/types";

const downloadEntry = z.object({
  url: z.string(),
  size_mb: z.string().nullish(),
});

const downloadsSchema = z.object(
  Object.fromEntries(
    (Object.keys(FORMAT_LABELS) as Format[]).map((key) => [
      key,
      downloadEntry.optional(),
    ]),
  ) as Record<Format, z.ZodOptional<typeof downloadEntry>>,
);

export const digitalItemSchema = z
  .object({
    artist: z
      .string()
      .nullable()
      .transform((x) => x ?? ""),
    title: z
      .string()
      .nullable()
      .transform((x) => x ?? ""),
    item_id: z
      .number()
      .optional()
      .transform((x) => x?.toString()),
    sale_id: z
      .number()
      .optional()
      .transform((x) => x?.toString()),
    downloads: downloadsSchema.optional(),
    art_id: z.number().optional(),
    purchased: z
      .string()
      .nullish()
      .transform((x) => x ?? undefined),
    package_release_date: z
      .string()
      .nullish()
      .transform((x) => x ?? undefined),
  })
  .transform((item, ctx) => {
    const bandcampId = item.item_id ?? item.sale_id;
    if (bandcampId === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "item has no id" });
      return z.NEVER;
    }
    return { ...item, bandcampId };
  });

export const bandcampPageSchema = z.object({
  identities: z
    .object({ fan: z.object({ verified: z.boolean().nullish() }).nullish() })
    .nullish(),
  digital_items: z.array(z.unknown()),
});

export type DigitalItem = z.infer<typeof digitalItemSchema>;
