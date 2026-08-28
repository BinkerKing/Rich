import { z } from "zod";

const nullableString = z.string().nullable().optional();
const flexibleRecord = z.record(z.string(), z.unknown());

export const multicaWorkbenchProjectSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: nullableString,
  status: nullableString,
}).passthrough();

export const multicaStatusSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: nullableString,
  color: nullableString,
  position: z.number().optional(),
}).passthrough();

export const multicaActorSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  type: z.string().optional(),
  avatar_url: nullableString,
}).passthrough();

export const multicaLabelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: nullableString,
}).passthrough();

export const multicaAttachmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  size: z.number().nullable().optional(),
  content_type: nullableString,
  url: nullableString,
  created_at: nullableString,
}).passthrough();

export const multicaWorkbenchIssueSchema = z.object({
  id: z.string().min(1),
  identifier: nullableString,
  title: z.string().min(1),
  description: nullableString,
  status: z.string().min(1),
  status_category: nullableString,
  priority: nullableString,
  position: z.number().optional(),
  project_id: nullableString,
  parent_id: nullableString,
  assignee_id: nullableString,
  assignee_type: nullableString,
  start_date: nullableString,
  due_date: nullableString,
  created_at: nullableString,
  updated_at: nullableString,
  labels: z.array(multicaLabelSchema).optional(),
  attachments: z.array(multicaAttachmentSchema).optional(),
}).passthrough();

export const multicaCommentSchema = z.object({
  id: z.string().min(1),
  body: z.string().optional(),
  content: z.string().optional(),
  parent_id: nullableString,
  resolved: z.boolean().optional(),
  author: multicaActorSchema.nullable().optional(),
  created_at: nullableString,
  updated_at: nullableString,
  attachments: z.array(multicaAttachmentSchema).optional(),
}).passthrough();

export const multicaTimelineEntrySchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  created_at: nullableString,
  actor: multicaActorSchema.nullable().optional(),
  data: flexibleRecord.optional(),
}).passthrough();

export const multicaRunSchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
  created_at: nullableString,
  updated_at: nullableString,
  started_at: nullableString,
  completed_at: nullableString,
  agent_id: nullableString,
}).passthrough();

export const multicaRunMessageSchema = z.object({
  id: z.string().min(1),
  run_id: z.string().min(1),
  sequence: z.number(),
  role: z.string().optional(),
  type: z.string().optional(),
  content: z.unknown().optional(),
  created_at: nullableString,
}).passthrough();

export const multicaPullRequestSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string().optional(),
  state: z.string().optional(),
  url: nullableString,
  number: z.number().optional(),
}).passthrough();

export const multicaUsageSchema = z.object({
  input_tokens: z.number().optional(),
  output_tokens: z.number().optional(),
  total_tokens: z.number().optional(),
  cost: z.number().optional(),
}).passthrough();

export const multicaAgentSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().optional(),
  model: nullableString,
  runtime_id: nullableString,
  runtime_name: nullableString,
  runtime_provider: nullableString,
  mcp_servers: z.array(z.object({ id: z.string().min(1), name: z.string().optional() }).passthrough()).optional(),
}).passthrough();

export const multicaTeamSnapshotSchema = z.object({
  project: multicaWorkbenchProjectSchema.optional(),
  squad: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    leader_id: nullableString,
    description: nullableString,
    instructions: nullableString,
  }).passthrough(),
  agents: z.array(multicaAgentSummarySchema),
  resources: z.array(z.object({
    id: z.string().min(1),
    type: z.string().optional(),
    local_path: nullableString,
    execution_mode: nullableString,
  }).passthrough()).default([]),
}).passthrough();

export const multicaBoardSnapshotSchema = z.object({
  project: multicaWorkbenchProjectSchema,
  team: multicaTeamSnapshotSchema.optional(),
  statuses: z.array(multicaStatusSchema),
  issues: z.array(multicaWorkbenchIssueSchema),
  syncedAt: z.string().min(1),
  connection: z.object({
    richProjectId: z.string().min(1),
    status: z.enum(["connected", "syncing", "disconnected"]),
    lastAttemptAt: z.string().optional(),
    lastSuccessAt: z.string().optional(),
    error: z.string().optional(),
  }).optional(),
});

export const multicaIssueDetailSnapshotSchema = z.object({
  issue: multicaWorkbenchIssueSchema,
  children: z.array(multicaWorkbenchIssueSchema).default([]),
  attachments: z.array(multicaAttachmentSchema).default([]),
  comments: z.array(multicaCommentSchema).default([]),
  timeline: z.array(multicaTimelineEntrySchema).default([]),
  runs: z.array(multicaRunSchema).default([]),
  runMessages: z.array(multicaRunMessageSchema).default([]),
  pullRequests: z.array(multicaPullRequestSchema).default([]),
  usage: multicaUsageSchema.default({}),
  metadata: flexibleRecord.default({}),
  properties: z.array(flexibleRecord).default([]),
  subscribers: z.array(multicaActorSchema).default([]),
  syncedAt: z.string().min(1),
});

export type MulticaWorkbenchProject = z.infer<typeof multicaWorkbenchProjectSchema>;
export type MulticaStatus = z.infer<typeof multicaStatusSchema>;
export type MulticaActor = z.infer<typeof multicaActorSchema>;
export type MulticaLabel = z.infer<typeof multicaLabelSchema>;
export type MulticaAttachment = z.infer<typeof multicaAttachmentSchema>;
export type MulticaWorkbenchIssue = z.infer<typeof multicaWorkbenchIssueSchema>;
export type MulticaComment = z.infer<typeof multicaCommentSchema>;
export type MulticaTimelineEntry = z.infer<typeof multicaTimelineEntrySchema>;
export type MulticaRun = z.infer<typeof multicaRunSchema>;
export type MulticaRunMessage = z.infer<typeof multicaRunMessageSchema>;
export type MulticaPullRequest = z.infer<typeof multicaPullRequestSchema>;
export type MulticaUsage = z.infer<typeof multicaUsageSchema>;
export type MulticaTeamSnapshot = z.infer<typeof multicaTeamSnapshotSchema>;
export type MulticaBoardSnapshot = z.infer<typeof multicaBoardSnapshotSchema>;
export type MulticaIssueDetailSnapshot = z.infer<typeof multicaIssueDetailSnapshotSchema>;
