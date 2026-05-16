import { z } from "zod";

export const RelationKindSchema = z.enum([
  "parent", "child", "sibling", "related",
  "prerequisite", "extension", "practice",
]);

export const RelationSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  kind: RelationKindSchema,
  strength: z.number().min(0).max(100).optional(),
  reason: z.string().optional(),
  createdAt: z.string(),
});
