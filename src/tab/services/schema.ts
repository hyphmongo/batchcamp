import { z } from "zod";

const digitalItemSchema = z
  .object({
    artist: z.string(),
    title: z.string(),
    item_id: z
      .number()
      .optional()
      .transform((x) => x?.toString()),
    sale_id: z
      .number()
      .optional()
      .transform((x) => x?.toString()),
    killed: z.number().nullable(),
    downloads: z
      .object({
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
      })
      .optional(),
  })
  .refine(
    (x) => (x.downloads && !x.killed) || (!x.downloads && x.killed === 1),
    {
      message: "downloads is empty but item is not killed",
      path: ["downloads"],
    }
  );

export const bandcampSchema = z.object({
  digital_items: z.array(digitalItemSchema),
});

export type DigitalItem = z.infer<typeof digitalItemSchema>;
