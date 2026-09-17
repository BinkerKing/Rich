import { z } from "zod";

export const workbenchCardTypes = ["heading", "rich_text", "list", "module", "flowchart", "mindmap", "image", "file", "link"] as const;
export type WorkbenchCardType = typeof workbenchCardTypes[number];

export interface WorkbenchCard {
  id: string;
  type: WorkbenchCardType;
  parentId?: string;
  order: number;
  title?: string;
  content: unknown | null;
  properties: Record<string, unknown>;
}

export interface WorkbenchDocument {
  id: string;
  conversationId: string;
  title: string;
  version: number;
  cards: WorkbenchCard[];
  createdAt: string;
  updatedAt: string;
}

const id = z.string().trim().min(1).max(160);

export const workbenchCardSchema = z.object({
  id,
  type: z.enum(workbenchCardTypes),
  parentId: id.optional(),
  order: z.number().int().nonnegative(),
  title: z.string().trim().min(1).max(500).optional(),
  content: z.unknown().nullable(),
  properties: z.record(z.string(), z.unknown()),
}).strict();

export const workbenchDocumentSchema = z.object({
  id,
  conversationId: id,
  title: z.string().trim().min(1).max(500),
  version: z.number().int().positive(),
  cards: z.array(workbenchCardSchema).max(10_000),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).strict();
