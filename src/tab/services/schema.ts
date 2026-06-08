import { z } from "zod";

import { FORMAT_LABELS, type Format } from "@/types";

const downloadEntry = z.object({
  url: z.string(),
  size_mb: z.string().optional(),
});

const downloadsSchema = z.object(
  Object.fromEntries(
    (Object.keys(FORMAT_LABELS) as Format[]).map((key) => [
      key,
      downloadEntry.optional(),
    ]),
  ) as Record<Format, z.ZodOptional<typeof downloadEntry>>,
);

const digitalItemSchema = z
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
    killed: z.number().nullable(),
    downloads: downloadsSchema.optional(),
    art_id: z.number().optional(),
    purchased: z.string().optional(),
    package_release_date: z.string().optional(),
  })
  .refine(
    (x) => (x.downloads && !x.killed) || (!x.downloads && x.killed === 1),
    {
      message: "downloads is empty but item is not killed",
      path: ["downloads"],
    },
  );

export const bandcampSchema = z.object({
  digital_items: z.array(digitalItemSchema),
});

export type DigitalItem = z.infer<typeof digitalItemSchema>;
