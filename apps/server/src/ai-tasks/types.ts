import { z } from "zod";

export const aiTaskExecutors = ["hermes", "multica"] as const;
export type AiTaskExecutor = typeof aiTaskExecutors[number];
export const aiTaskProfiles = ["analysis", "deliverable", "rich_update"] as const;
export type AiTaskProfile = typeof aiTaskProfiles[number];

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
  history: z.array(z.object({
    id: z.string().min(1), title: z.string(), status: z.string(), reviewStatus: z.string().optional(), summary: z.string().optional(),
    resultRefs: z.array(z.object({ type: z.string(), id: z.string(), label: z.string().optional() })), createdAt: z.string().datetime(), finishedAt: z.string().datetime().optional(),
  })).default([]),
  sourceConversationId: z.string().min(1).optional(),
  conversationSummary: z.string().optional(),
  selectedMessages: z.array(z.object({
    id: z.string().min(1), role: z.enum(["user", "assistant", "system"]), content: z.string(), createdAt: z.string().datetime(),
  })).optional(),
  attachmentRefs: z.array(z.object({
    id: z.string().min(1), messageId: z.string(), kind: z.string(), mime: z.string(), sizeBytes: z.number().nonnegative(), caption: z.string().optional(), sha256: z.string(),
  })).optional(),
});

const requestSchema = z.object({
  scenario: z.string().min(1).default("deliverable_analysis"),
  projectId: z.string().min(1),
  deliverableId: z.string().min(1),
  executor: z.enum(aiTaskExecutors),
  profile: z.enum(aiTaskProfiles).default("analysis"),
  instructions: z.string().trim().min(1),
  acceptanceCriteria: z.array(z.string().trim().min(1)).default([]),
  contextSnapshot,
  promotion: z.object({
    sourceConversationId: z.string().min(1),
    selectedMessageIds: z.array(z.string().min(1)),
    selectedAttachmentIds: z.array(z.string().min(1)).default([]),
  }).optional(),
});

export type AiTaskContextSnapshot = z.infer<typeof contextSnapshot>;
export type AiTaskRequest = z.infer<typeof requestSchema>;

export function parseAiTaskRequest(value: unknown): AiTaskRequest {
  return requestSchema.parse(value);
}
