import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import { executeIdempotently } from "./idempotency.js";
import { richFailure, richSuccess } from "./response.js";
import type {
  RichResourceRef,
  RichToolChange,
  RichToolContext,
  RichToolOptions,
  RichToolResponse,
  RichToolVerification,
} from "./types.js";

export interface SafeWriteSpec<T> {
  toolName: string;
  operationRepo?: McpOperationRepo;
  context?: RichToolContext;
  options?: RichToolOptions;
  inputForHash: unknown;
  destructive?: boolean;
  changes: RichToolChange[];
  execute: () => Promise<T>;
  verify: (result: T) => Promise<RichToolVerification>;
  refs?: (result: T) => RichResourceRef[];
}

export async function executeSafeWrite<T>(spec: SafeWriteSpec<T>): Promise<RichToolResponse<T | { dryRun: true }>> {
  if (spec.destructive && !spec.options?.confirmDestructive) {
    return richFailure(spec.toolName, {
      code: "CONFIRMATION_REQUIRED",
      message: "This destructive action requires options.confirmDestructive=true.",
      retryable: false,
    }, { changes: spec.changes, verification: { status: "skipped", details: "Waiting for confirmation." } });
  }
  if (spec.options?.dryRun) {
    return richSuccess(spec.toolName, { dryRun: true }, {
      changes: spec.changes,
      verification: { status: "skipped", details: "Dry-run; no write was executed." },
    });
  }
  if (!spec.operationRepo) {
    return richFailure(spec.toolName, {
      code: "DEPENDENCY_UNAVAILABLE",
      message: "Persistent MCP operation storage is not configured.",
      retryable: true,
    });
  }
  return executeIdempotently(spec.operationRepo, {
    toolName: spec.toolName,
    requestId: spec.context?.requestId ?? "",
    input: spec.inputForHash,
  }, async () => {
    const result = await spec.execute();
    const verification = await spec.verify(result);
    const refs = spec.refs?.(result) ?? [];
    if (verification.status === "failed") {
      return richFailure(spec.toolName, {
        code: "TASK_FAILED",
        message: "The write completed but verification failed.",
        retryable: true,
      }, { refs, changes: spec.changes, verification });
    }
    return richSuccess(spec.toolName, result, {
      refs,
      changes: spec.changes,
      verification,
    });
  });
}
