import { z } from "zod";

import { itemSchema } from "./types";

const itemsArray = z.array(itemSchema);

const messageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("send-items-to-background"), items: itemsArray }),
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
]);

export type Message = z.infer<typeof messageSchema>;

export const parseMessage = (msg: unknown): Message | null => {
  const result = messageSchema.safeParse(msg);
  return result.success ? result.data : null;
};
