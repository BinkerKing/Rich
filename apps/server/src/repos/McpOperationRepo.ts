import type { RichToolResponse } from "../mcp-v2/registry/types.js";

export type McpOperationStatus = "pending" | "completed";

export interface McpOperationRecord {
  toolName: string;
  requestId: string;
  inputHash: string;
  status: McpOperationStatus;
  response?: RichToolResponse<unknown>;
  createdAt: string;
  completedAt?: string;
}

export type McpOperationClaim =
  | { claimed: true }
  | { claimed: false; record: McpOperationRecord };

type MaybePromise<T> = T | Promise<T>;

export interface McpOperationRepo {
  claim(toolName: string, requestId: string, inputHash: string): MaybePromise<McpOperationClaim>;
  complete(
    toolName: string,
    requestId: string,
    inputHash: string,
    response: RichToolResponse<unknown>,
  ): MaybePromise<void>;
  abandon(toolName: string, requestId: string, inputHash: string): MaybePromise<void>;
}
