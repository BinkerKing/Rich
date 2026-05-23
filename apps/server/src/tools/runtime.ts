import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { InvocationsStore } from "../repos/InvocationsRepo.js";
import type {
  AnyToolDefinition, ToolDefinition, ToolHandlerContext, ToolInvocation,
} from "./types.js";
import { eventBus } from "../lib/eventBus.js";

/**
 * Tool runtime — owns the registry, dispatch, scheduling, and lifecycle of
 * Toolbox tools. Single instance, created at server boot.
 *
 * Flow:
 *   invoke(toolName, args, createdBy)
 *     ↓ validate args via tool.schema
 *     ↓ compute delaySeconds (auto from args.delay_seconds/delay_minutes,
 *       or via tool.computeDelaySeconds)
 *     ↓ insert row (status=scheduled if delay > 0, else running)
 *     ↓ schedule setTimeout or run immediately
 *     ↓ on resolve: markCompleted; on throw: markFailed
 *
 * Restart safety: at boot, we re-schedule all status=scheduled rows. If the
 * scheduled_for is already past, we drop them as cancelled (better than
 * firing a stale lock-screen at 3am after a restart).
 */
export class ToolRuntime {
  private tools = new Map<string, AnyToolDefinition>();
  /** Active setTimeout handles, keyed by invocation id, for cancellation. */
  private timers = new Map<string, NodeJS.Timeout>();

  constructor(private repo: InvocationsStore) {}

  register(tool: AnyToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  listTools(): Array<{
    name: string; label: string; description: string;
    icon?: string; category?: string;
    /** zod schema serialised to plain JSON for the UI to render a form. */
    schemaShape: Record<string, unknown>;
  }> {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      label: t.label,
      description: t.description,
      icon: t.icon,
      category: t.category,
      schemaShape: serializeSchema(t.schema),
    }));
  }

  getTool(name: string): AnyToolDefinition | undefined {
    return this.tools.get(name);
  }

  /** Re-schedule everything in 'scheduled' status that hasn't fired yet.
   *  Drop overdue ones as cancelled (don't fire stale destructive actions). */
  async rehydrate(): Promise<{ rescheduled: number; cancelled: number }> {
    const pending = await this.repo.listScheduled();
    const now = Date.now();
    let rescheduled = 0;
    let cancelled = 0;
    for (const inv of pending) {
      const fireAt = inv.scheduledFor ? new Date(inv.scheduledFor).getTime() : now;
      if (fireAt <= now) {
        // Two interpretations: fire-immediately or skip. Skip is safer.
        await this.repo.markCancelled(inv.id);
        cancelled += 1;
        continue;
      }
      this.scheduleTimer(inv, fireAt - now);
      rescheduled += 1;
    }
    return { rescheduled, cancelled };
  }

  async invoke(opts: {
    toolName: string;
    args: unknown;
    createdBy: "hermes" | "user";
  }): Promise<ToolInvocation> {
    const tool = this.tools.get(opts.toolName);
    if (!tool) throw new Error(`Tool not found: ${opts.toolName}`);
    const parsed = tool.schema.safeParse(opts.args ?? {});
    if (!parsed.success) {
      throw new Error(`Invalid args for ${opts.toolName}: ${parsed.error.issues.map(i => i.message).join("; ")}`);
    }
    const delaySeconds = this.computeDelay(tool, parsed.data);
    const id = `inv-${randomUUID().slice(0, 10)}`;
    if (delaySeconds <= 0) {
      const inv = await this.repo.create({
        id,
        toolName: opts.toolName,
        args: parsed.data as Record<string, unknown>,
        status: "running",
        createdBy: opts.createdBy,
      });
      eventBus.publish("tool_invocation.changed", { source: opts.createdBy === "hermes" ? "mcp" : "route" });
      await this.repo.markRunning(id);
      // Run async — return immediately so the caller doesn't block.
      void this.runHandler(tool, parsed.data, id);
      return inv;
    }
    const scheduledFor = new Date(Date.now() + delaySeconds * 1000).toISOString();
    const inv = await this.repo.create({
      id,
      toolName: opts.toolName,
      args: parsed.data as Record<string, unknown>,
      status: "scheduled",
      createdBy: opts.createdBy,
      scheduledFor,
    });
    eventBus.publish("tool_invocation.changed", { source: opts.createdBy === "hermes" ? "mcp" : "route" });
    this.scheduleTimer(inv, delaySeconds * 1000);
    return inv;
  }

  async cancel(id: string): Promise<boolean> {
    const inv = await this.repo.get(id);
    if (!inv) return false;
    if (inv.status !== "scheduled") return false;
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    const ok = await this.repo.markCancelled(id);
    if (ok) eventBus.publish("tool_invocation.changed", { source: "route", detail: { op: "cancel", id } });
    return ok;
  }

  private computeDelay(tool: AnyToolDefinition, args: unknown): number {
    if (tool.computeDelaySeconds) return Math.max(0, tool.computeDelaySeconds(args));
    // Convention: schema fields `delay_seconds` or `delay_minutes` are
    // automatically interpreted as fire-after-N.
    const obj = (args ?? {}) as Record<string, unknown>;
    if (typeof obj.delay_seconds === "number") return Math.max(0, obj.delay_seconds);
    if (typeof obj.delay_minutes === "number") return Math.max(0, obj.delay_minutes * 60);
    return 0;
  }

  private scheduleTimer(inv: ToolInvocation, ms: number): void {
    const timer = setTimeout(() => {
      this.timers.delete(inv.id);
      const tool = this.tools.get(inv.toolName);
      if (!tool) {
        void this.repo.markFailed(inv.id, `Tool no longer registered: ${inv.toolName}`);
        eventBus.publish("tool_invocation.changed", { source: "route", detail: { op: "fired", id: inv.id } });
        return;
      }
      void this.repo.markRunning(inv.id);
      eventBus.publish("tool_invocation.changed", { source: "route", detail: { op: "started", id: inv.id } });
      void this.runHandler(tool, inv.args, inv.id);
    }, ms);
    this.timers.set(inv.id, timer);
  }

  private async runHandler(tool: AnyToolDefinition, args: unknown, id: string): Promise<void> {
    const logLines: string[] = [];
    const ctx: ToolHandlerContext = {
      invocationId: id,
      log: (m) => { logLines.push(m); },
    };
    try {
      const result = await tool.handler(args, ctx);
      const combined = [...logLines, result].filter(Boolean).join("\n");
      await this.repo.markCompleted(id, combined || "ok");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.repo.markFailed(id, msg);
    } finally {
      eventBus.publish("tool_invocation.changed", { source: "route", detail: { op: "finished", id } });
    }
  }
}

/**
 * Cheap zod → JSON serialisation for the UI form generator. Covers the field
 * shapes we currently use (string / number / enum / optional / default).
 * Anything fancier shows up as `{ kind: "unknown" }` and the UI falls back
 * to a free-text input.
 */
function serializeSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  // Unwrap optional/default to look at the inner type.
  const fields: Record<string, unknown> = {};
  if (!(schema instanceof z.ZodObject)) return fields;
  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  for (const [key, raw] of Object.entries(shape)) {
    fields[key] = describe(raw);
  }
  return fields;
}

function describe(node: z.ZodTypeAny): Record<string, unknown> {
  // We hold each decorator-stripped layer as `unknown` and re-narrow via
  // `instanceof` checks; zod's TypeScript types make true unwrap() chains
  // hard to satisfy without `any`, so the local `unknown` is the cleanest
  // boundary.
  let cur: unknown = node;
  let optional = false;
  let defaultValue: unknown = undefined;
  let description: string | undefined = undefined;
  // Peel decorators (optional / default / nullable / describe).
  while (true) {
    description = description ?? (cur as { description?: string }).description;
    if (cur instanceof z.ZodOptional) {
      optional = true;
      cur = (cur as z.ZodOptional<z.ZodTypeAny>).unwrap();
      continue;
    }
    if (cur instanceof z.ZodDefault) {
      // Zod v3 stores defaultValue as `() => T`; zod v4 stores it as the
      // value itself. Handle both shapes so this works regardless of which
      // zod the project pulls in.
      const dv = (cur._def as { defaultValue: unknown }).defaultValue;
      defaultValue = typeof dv === "function" ? (dv as () => unknown)() : dv;
      cur = (cur as z.ZodDefault<z.ZodTypeAny>).removeDefault();
      continue;
    }
    if (cur instanceof z.ZodNullable) {
      optional = true;
      cur = (cur as z.ZodNullable<z.ZodTypeAny>).unwrap();
      continue;
    }
    break;
  }
  let kind = "unknown";
  let extra: Record<string, unknown> = {};
  if (cur instanceof z.ZodString) {
    kind = "string";
  } else if (cur instanceof z.ZodNumber) {
    kind = "number";
  } else if (cur instanceof z.ZodBoolean) {
    kind = "boolean";
  } else if (cur instanceof z.ZodEnum) {
    kind = "enum";
    // Zod v4 stores `options` as a readonly array of strings (or as a
    // record in some shapes). Either is iterable; `Array.from` normalises.
    const opts = (cur as unknown as { options: ArrayLike<string> | Record<string, string> }).options;
    extra = { options: Array.isArray(opts) ? opts : Object.values(opts) };
  }
  return { kind, optional, default: defaultValue, description, ...extra };
}

// Re-export for callers that want a strongly-typed reference.
export type { AnyToolDefinition, ToolDefinition };
