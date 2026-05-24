import { z } from "zod";

export const ChatVisualBlockTypeSchema = z.enum([
  "flowchart",
  "table",
  "sequence",
  "architecture",
  "tree",
  "concept",
  "chart",
  "sketch",
  "raw",
]);

export const ChatVisualBlockPayloadSchema = z.object({
  ascii: z.string().min(1).max(50_000),
  caption: z.string().max(280).optional(),
  parsed: z.record(z.string(), z.unknown()).optional(),
});

export const ChatVisualBlockSchema = z.object({
  id: z.string().min(1).max(120),
  messageId: z.string().max(120).default(""),
  blockType: ChatVisualBlockTypeSchema,
  payload: ChatVisualBlockPayloadSchema,
  orderInMessage: z.number().int().min(0).max(100).default(0),
  createdAt: z.string().min(1),
});
