import { z } from "zod";

const ITEM_STATUSES = [
  "pending",
  "queued",
  "resolving",
  "resolved",
  "downloading",
  "completed",
  "failed",
  "rate_limited",
] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

const itemStatusSchema = z.enum(ITEM_STATUSES);

export const FORMAT_LABELS = {
  "mp3-v0": "MP3 v0",
  "mp3-320": "MP3 320",
  flac: "FLAC",
  "aac-hi": "AAC",
  vorbis: "Ogg Vorbis",
  alac: "ALAC",
  wav: "WAV",
  "aiff-lossless": "AIFF",
} as const;

export type Format = keyof typeof FORMAT_LABELS;

export const formatSchema = z.enum(
  Object.keys(FORMAT_LABELS) as [Format, ...Format[]],
);

const downloadSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),
  date: z.string().optional(),
  artUrl: z.string().optional(),
  sizeMb: z.number().optional(),
  progress: z.number(),
  url: z.string(),
  browserId: z.number().optional(),
  format: formatSchema,
});

export type Download = z.infer<typeof downloadSchema>;

const pendingItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.literal("pending"),
  format: formatSchema.optional(),
  url: z.string(),
  artUrl: z.string().optional(),
});

const resolvedItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: itemStatusSchema,
  format: formatSchema.optional(),
  url: z.string().optional(),
  download: downloadSchema,
});

export const itemSchema = z.union([resolvedItemSchema, pendingItemSchema]);

export type PendingItem = z.infer<typeof pendingItemSchema>;
export type ResolvedItem = z.infer<typeof resolvedItemSchema>;
export type Item = z.infer<typeof itemSchema>;

export const isResolvedItem = (item: Item): item is ResolvedItem =>
  "download" in item;
