import { z } from "@/shared/zod";

import { itemSchema } from "./types";

const itemsArray = z.array(itemSchema);

const contentEventSchema = z.enum([
  "bc_download_clicked",
  "bc_select_all_clicked",
  "bc_format_opened",
]);

export type ContentEvent = z.infer<typeof contentEventSchema>;

const messageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("send-items-to-background"),
    items: itemsArray,
    source: z.string().optional(),
  }),
  z.object({ type: z.literal("send-items-to-tab"), items: itemsArray }),
  z.object({ type: z.literal("tab-opened") }),
  z.object({
    type: z.literal("register-filename"),
    url: z.string(),
    filename: z.string(),
  }),
  z.object({ type: z.literal("unregister-filename"), url: z.string() }),
  z.object({ type: z.literal("show-settings") }),
  z.object({ type: z.literal("items-delivered") }),
  z.object({
    type: z.literal("track-content-event"),
    event: contentEventSchema,
    properties: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
  }),
]);

export type Message = z.infer<typeof messageSchema>;

export const parseMessage = (msg: unknown): Message | null => {
  const result = messageSchema.safeParse(msg);
  return result.success ? result.data : null;
};
