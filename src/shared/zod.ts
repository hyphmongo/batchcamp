import { z } from "zod";

z.config({ jitless: true });

export type { ZodError } from "zod";
export { z };
