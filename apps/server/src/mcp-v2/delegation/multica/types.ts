import { z } from "zod";

const optionalText = z.string().nullable().optional();

export const multicaProjectSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: optionalText,
  status: optionalText,
}).passthrough();
export const multicaProjectListSchema = z.array(multicaProjectSchema);

export const multicaAgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: optionalText,
  instructions: optionalText,
  runtime_id: optionalText,
  model: optionalText,
  status: optionalText,
  archived_at: optionalText,
}).passthrough();
export const multicaAgentListSchema = z.array(multicaAgentSchema);

export const multicaRuntimeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: z.string().min(1),
  status: z.string().min(1),
}).passthrough();
export const multicaRuntimeListSchema = z.array(multicaRuntimeSchema);

export const multicaSquadSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: optionalText,
  leader_id: optionalText,
  instructions: optionalText,
}).passthrough();
export const multicaSquadListSchema = z.array(multicaSquadSchema);

export const multicaIssueSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: z.string().min(1),
  status_category: optionalText,
  identifier: optionalText,
  project_id: optionalText,
  assignee_id: optionalText,
  assignee_type: optionalText,
  description: optionalText,
}).passthrough();

export const multicaRunSchema = z.object({
  id: z.string().min(1),
  issue_id: z.string().min(1),
  status: z.string().min(1),
  agent_id: optionalText,
  attempt: z.number().int().optional(),
  max_attempts: z.number().int().optional(),
  error: optionalText,
  result: z.object({
    output: optionalText,
    pr_url: optionalText,
  }).passthrough().nullable().optional(),
}).passthrough();
export const multicaRunListSchema = z.array(multicaRunSchema);

export type MulticaProject = z.infer<typeof multicaProjectSchema>;
export type MulticaAgent = z.infer<typeof multicaAgentSchema>;
export type MulticaRuntime = z.infer<typeof multicaRuntimeSchema>;
export type MulticaSquad = z.infer<typeof multicaSquadSchema>;
export type MulticaIssue = z.infer<typeof multicaIssueSchema>;
export type MulticaRun = z.infer<typeof multicaRunSchema>;

export interface MulticaCommandPort {
  runJson<T = unknown>(args: string[], options?: { stdin?: string; includeWorkspace?: boolean }): Promise<T>;
  runText?(args: string[], options?: { stdin?: string; includeWorkspace?: boolean }): Promise<string>;
}
