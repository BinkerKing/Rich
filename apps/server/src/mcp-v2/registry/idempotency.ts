import { createHash } from "node:crypto";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import { richFailure } from "./response.js";
import type { RichToolResponse } from "./types.js";

export interface IdempotentRequest {
  toolName: string;
  requestId: string;
  input: unknown;
}

export interface IdempotencyOptions {
  cacheFailures?: boolean;
}

export async function executeIdempotently<T>(
  repo: McpOperationRepo,
  request: IdempotentRequest,
  execute: () => Promise<RichToolResponse<T>>,
  options: IdempotencyOptions = {},
): Promise<RichToolResponse<T>> {
  if (!request.requestId?.trim()) {
    return richFailure(request.toolName, {
      code: "VALIDATION_ERROR",
      message: "context.requestId is required for this write operation.",
      retryable: false,
      details: { field: "context.requestId" },
    });
  }
  const inputHash = hashCanonicalInput(request.input);
  const claim = await repo.claim(request.toolName, request.requestId, inputHash);
  if (!claim.claimed) {
    if (claim.record.inputHash !== inputHash) {
      return richFailure(request.toolName, {
        code: "CONFLICT",
        message: "This requestId was already used with different input.",
        retryable: false,
      });
    }
    if (claim.record.status === "completed" && claim.record.response) {
      return claim.record.response as RichToolResponse<T>;
    }
    return richFailure(request.toolName, {
      code: "CONFLICT",
      message: "An identical request is already in progress.",
      retryable: true,
    });
  }

  try {
    const response = await execute();
    if (response.ok || options.cacheFailures) {
      await repo.complete(request.toolName, request.requestId, inputHash, response);
    } else {
      await repo.abandon(request.toolName, request.requestId, inputHash);
    }
    return response;
  } catch (error) {
    await repo.abandon(request.toolName, request.requestId, inputHash);
    throw error;
  }
}

export function hashCanonicalInput(input: unknown): string {
  return createHash("sha256").update(canonicalJson(input)).digest("hex");
}

function canonicalJson(input: unknown): string {
  return JSON.stringify(canonicalize(input)) ?? "null";
}

function canonicalize(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(canonicalize);
  if (!input || typeof input !== "object") return input;
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, canonicalize(value)]),
  );
}
