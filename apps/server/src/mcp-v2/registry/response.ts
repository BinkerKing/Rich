import { RichMcpError } from "./errors.js";
import type {
  RichToolError,
  RichToolFailure,
  RichToolResponseMeta,
  RichToolSuccess,
} from "./types.js";

export function richSuccess<T>(
  action: string,
  data: T,
  meta: RichToolResponseMeta = {},
): RichToolSuccess<T> {
  return { ok: true, action, data, ...meta };
}

export function richFailure(
  action: string,
  error: RichToolError,
  meta: RichToolResponseMeta = {},
): RichToolFailure {
  return { ok: false, action, error, ...meta };
}

export function toRichToolFailure(action: string, error: unknown): RichToolFailure {
  if (error instanceof RichMcpError) {
    return richFailure(action, {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      ...(error.details === undefined ? {} : { details: error.details }),
    });
  }
  return richFailure(action, {
    code: "INTERNAL_ERROR",
    message: "An internal error occurred.",
    retryable: false,
  });
}
