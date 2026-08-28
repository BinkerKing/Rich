import type { RichErrorCode } from "./types.js";

export interface RichMcpErrorOptions {
  retryable?: boolean;
  details?: unknown;
}

export class RichMcpError extends Error {
  readonly code: RichErrorCode;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(code: RichErrorCode, message: string, options: RichMcpErrorOptions = {}) {
    super(message);
    this.name = "RichMcpError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
  }
}
