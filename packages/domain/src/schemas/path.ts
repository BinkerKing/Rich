import { z } from "zod";

export const PathKindSchema = z.enum(["quick", "academic", "practice", "custom"]);

export const LearningPathSchema = z.object({
  id: z.string().min(1),
  centerElementId: z.string().min(1),
  kind: PathKindSchema,
  label: z.string().min(1),
  color: z.string().min(1),
  steps: z.array(z.string()).min(1),
  estimatedTime: z.string().optional(),
  generatedBy: z.enum(["ai", "user"]),
  createdAt: z.string(),
});
