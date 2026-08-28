import type { RichResourceRef } from "../mcp-v2/registry/types.js";

export type McpTaskStatus = "queued" | "running" | "waiting_input" | "succeeded" | "failed" | "cancelled";
export type McpTaskReviewStatus = "accepted" | "rejected" | "needs_human";

export interface McpTask {
  id: string;
  type: string;
  title: string;
  request: unknown;
  status: McpTaskStatus;
  backend?: string;
  externalTaskId?: string;
  progressSummary?: string;
  resultRefs: RichResourceRef[];
  error?: string;
  conversationId?: string;
  requestId?: string;
  reviewStatus?: McpTaskReviewStatus;
  reviewNotes?: string;
  createdAt: string;
  startedAt?: string;
  updatedAt: string;
  finishedAt?: string;
  lastSyncedAt?: string;
}

export interface McpTaskListOptions {
  status?: McpTaskStatus;
  limit?: number;
}

type MaybePromise<T> = T | Promise<T>;

export interface McpTaskRepo {
  create(task: McpTask): MaybePromise<void>;
  get(id: string): MaybePromise<McpTask | null>;
  list(options?: McpTaskListOptions): MaybePromise<McpTask[]>;
  save(task: McpTask): MaybePromise<void>;
}
