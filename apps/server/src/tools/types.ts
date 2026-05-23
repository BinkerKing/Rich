import type { z } from "zod";

/**
 * A single Toolbox tool. Tools are static, defined in code, registered once
 * at server boot. Each tool gets:
 *   - Backend handler (does the actual work)
 *   - Zod input schema (validates args, also drives UI form generation)
 *   - Optional delaySeconds — if the args parse out a future-fire time, the
 *     framework defers invocation. Otherwise runs immediately.
 *
 * Add a new tool: drop a file in apps/server/src/tools/<name>.ts that exports
 * a `ToolDefinition`, then import it in tools/registry.ts.
 */

export interface ToolHandlerContext {
  invocationId: string;
  /** Append a progress line to be saved on finish. */
  log(message: string): void;
}

export interface ToolDefinition<Schema extends z.ZodTypeAny = z.ZodTypeAny> {
  /** Stable identifier — used in URLs, MCP names, DB rows. snake_case. */
  name: string;
  /** Human label shown in the toolbox UI. */
  label: string;
  /** One-line description — also goes into MCP tool description so Hermes
   *  knows when to pick this tool. */
  description: string;
  /** Optional icon name (from our Icon component). */
  icon?: string;
  /** Optional category — UI groups tools by this. */
  category?: string;
  /** Zod schema for input args. Used for: (a) runtime validation,
   *  (b) auto-generating UI form fields, (c) MCP tool input schema. */
  schema: Schema;
  /** If the schema includes a `delay_seconds` or `delay_minutes` field and
   *  the value is > 0, framework defers via setTimeout. Otherwise runs
   *  immediately. Override here for custom scheduling. Default: auto-detect. */
  computeDelaySeconds?: (args: z.infer<Schema>) => number;
  /** The actual handler. Return a short result string for the UI; throw on
   *  failure (message will be stored as `error`). */
  handler: (args: z.infer<Schema>, ctx: ToolHandlerContext) => Promise<string>;
}

export type AnyToolDefinition = ToolDefinition<z.ZodTypeAny>;

export type InvocationStatus =
  | "scheduled"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface ToolInvocation {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  status: InvocationStatus;
  createdBy: "hermes" | "user";
  scheduledFor?: string;
  startedAt?: string;
  finishedAt?: string;
  result?: string;
  error?: string;
  createdAt: string;
}
