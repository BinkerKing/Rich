export type RichErrorCode =
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFIRMATION_REQUIRED"
  | "CONFLICT"
  | "PERMISSION_DENIED"
  | "DEPENDENCY_UNAVAILABLE"
  | "TASK_FAILED"
  | "INTERNAL_ERROR";

export type RichToolCategory =
  | "query"
  | "capture"
  | "manage"
  | "plan"
  | "delegate"
  | "review";

export interface RichToolContext {
  conversationId?: string;
  requestId?: string;
  reason?: string;
}

export interface RichToolOptions {
  dryRun?: boolean;
  confirmDestructive?: boolean;
}

export interface RichToolAnnotations {
  readOnly: boolean;
  destructive: boolean;
  idempotent: boolean;
}

export interface RichResourceRef {
  type: string;
  id: string;
  label?: string;
}

export interface RichToolChange {
  operation: string;
  resource: string;
  id?: string;
}

export interface RichToolVerification {
  status: "verified" | "skipped" | "failed";
  details?: string;
}

export interface RichToolError {
  code: RichErrorCode;
  message: string;
  retryable: boolean;
  details?: unknown;
}

export interface RichToolResponseMeta {
  refs?: RichResourceRef[];
  changes?: RichToolChange[];
  verification?: RichToolVerification;
  warnings?: string[];
}

export interface RichToolSuccess<T> extends RichToolResponseMeta {
  ok: true;
  action: string;
  data: T;
}

export interface RichToolFailure extends RichToolResponseMeta {
  ok: false;
  action: string;
  error: RichToolError;
}

export type RichToolResponse<T> = RichToolSuccess<T> | RichToolFailure;
