import { z } from "zod";

export const richContextSchema = z.object({
  conversationId: z.string().min(1).optional(),
  requestId: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
}).optional();

export const richOptionsSchema = z.object({
  dryRun: z.boolean().optional(),
  confirmDestructive: z.boolean().optional(),
}).optional();
