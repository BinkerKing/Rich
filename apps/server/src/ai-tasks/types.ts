import { z } from "zod";

export const aiTaskExecutors = ["hermes", "multica"] as const;
export type AiTaskExecutor = typeof aiTaskExecutors[number];

const snapshotFile = z.object({
  relativePath: z.string().min(1),
  fileName: z.string().min(1),
  size: z.number().nonnegative(),
  type: z.enum(["deliverable", "material", "intermediate"]),
  version: z.string().optional(),
  note: z.string().optional(),
});

const contextSnapshot = z.object({
  version: z.literal(1),
  createdAt: z.string().datetime(),
  deliverable: z.object({
    folderPath: z.string().min(1),
    requirementHtml: z.string(),
  }),
  records: z.array(z.object({
    id: z.string().min(1),
    kind: z.string().min(1),
    text: z.string(),
    createdAt: z.string().datetime(),
  })),
  files: z.array(snapshotFile),
});

const requestSchema = z.object({
  projectId: z.string().min(1),
  deliverableId: z.string().min(1),
  executor: z.enum(aiTaskExecutors),
  instructions: z.string().trim().min(1),
  acceptanceCriteria: z.array(z.string().trim().min(1)).default([]),
  contextSnapshot,
});

export type AiTaskContextSnapshot = z.infer<typeof contextSnapshot>;
export type AiTaskRequest = z.infer<typeof requestSchema>;

export function parseAiTaskRequest(value: unknown): AiTaskRequest {
  return requestSchema.parse(value);
}
