import type { McpTaskStatus } from "../../repos/McpTaskRepo.js";
import type { RichResourceRef } from "../registry/types.js";

export interface WorkDelegationRequest {
  title: string;
  instructions: string;
  preferredAgent?: string;
  workingDirectory?: string;
  contextRefs: RichResourceRef[];
}

export interface WorkDelegationReceipt {
  externalTaskId: string;
  status?: McpTaskStatus;
  progressSummary?: string;
}

export interface WorkDelegationStatus {
  status: McpTaskStatus;
  progressSummary?: string;
  resultRefs?: RichResourceRef[];
  error?: string;
}

export interface WorkDelegationPort {
  readonly backend: string;
  delegate(request: WorkDelegationRequest): Promise<WorkDelegationReceipt>;
  getStatus(externalTaskId: string): Promise<WorkDelegationStatus>;
  cancel(externalTaskId: string): Promise<void>;
}
