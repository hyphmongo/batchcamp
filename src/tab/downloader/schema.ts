import { z } from "zod";

export const bandcampSchema = z.object({
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
