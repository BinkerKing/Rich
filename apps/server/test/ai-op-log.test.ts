import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  configureOpLog,
  readAllOpLogSnapshot,
  readAllOpRecords,
  readOpTrace,
  reduceToFinal,
  startOpRecord,
} from "../src/ai/aiOpLog.js";

describe("AI operation log traces", () => {
  it("reads operations and trace events together from one log snapshot", async () => {
    configureOpLog(mkdtempSync(join(tmpdir(), "rich-ai-op-log-")));
    const first = await startOpRecord({ op: "chat", model: "codex", prompt: "one" });
    await first.recordEvent({ type: "turn.plan" });
    await first.recordDone("done");
    const second = await startOpRecord({ op: "refine", model: "codex", prompt: "two" });
    await second.recordEvent({ type: "output" });

    const snapshot = await readAllOpLogSnapshot();

    expect(snapshot.records).toHaveLength(3);
    expect(snapshot.tracesByOp.get(first.id)?.map(event => event.type)).toEqual(["turn.plan"]);
    expect(snapshot.tracesByOp.get(second.id)?.map(event => event.type)).toEqual(["output"]);
  });

  it("retains ordered planner and MCP-tool trace events after completion", async () => {
    configureOpLog(mkdtempSync(join(tmpdir(), "rich-ai-op-log-")));
    const op = await startOpRecord({
      op: "chat-stream",
      model: "hermes",
      scenario: "agent-task",
      prompt: "user: update plan",
    });

    await op.recordEvent({ type: "turn.plan" });
    await op.recordEvent({
      type: "mcp.tool",
      data: { tool: "rich_project_manage", status: "completed" },
    });
    await op.recordDone("Plan updated");

    expect(await readOpTrace(op.id)).toEqual([
      expect.objectContaining({ type: "turn.plan", summary: "Turn plan recorded" }),
      expect.objectContaining({
        type: "mcp.tool",
        data: { tool: "rich_project_manage", status: "completed" },
      }),
    ]);
  });

  it("omits prompt and tool input fields from trace data", async () => {
    configureOpLog(mkdtempSync(join(tmpdir(), "rich-ai-op-log-")));
    const op = await startOpRecord({
      op: "chat-stream",
      model: "hermes",
      prompt: "user: private request",
    });

    await op.recordEvent({
      type: "mcp.tool",
      data: {
        tool: "rich_project_manage",
        status: "completed",
        prompt: "user: private request",
        input: "{\"private\":true}",
      },
    });

    expect(await readOpTrace(op.id)).toEqual([
      expect.objectContaining({
        data: { tool: "rich_project_manage", status: "completed" },
      }),
    ]);
  });

  it("records fixed event phrases without caller summaries", async () => {
    configureOpLog(mkdtempSync(join(tmpdir(), "rich-ai-op-log-")));
    const op = await startOpRecord({
      op: "chat-stream",
      model: "hermes",
      prompt: "user: private request",
    });

    await op.recordEvent({
      type: "mcp.tool",
    });

    expect(await readOpTrace(op.id)).toEqual([
      expect.objectContaining({ summary: "MCP tool event" }),
    ]);
  });

  it("reads only valid legacy operation rows", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rich-ai-op-log-"));
    configureOpLog(dir);
    const legacyOperation = {
      id: "op-legacy",
      ts: "2026-01-01T00:00:00.000Z",
      op: "chat-stream",
      model: "hermes",
      prompt: "user: update plan",
      status: "done",
    };
    writeFileSync(join(dir, "ai-ops.jsonl"), [
      JSON.stringify(legacyOperation),
      JSON.stringify({ kind: "trace", opId: "op-legacy", ts: "2026-01-01T00:00:01.000Z", type: "output", summary: "completed" }),
      JSON.stringify({ kind: "operation", id: "op-malformed", ts: "2026-01-01T00:00:02.000Z", status: "done" }),
    ].join("\n") + "\n");

    expect(await readAllOpRecords()).toEqual([legacyOperation]);
  });

  it("skips malformed trace rows", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rich-ai-op-log-"));
    configureOpLog(dir);
    writeFileSync(join(dir, "ai-ops.jsonl"), [
      JSON.stringify({ kind: "trace", opId: "op-1", ts: "2026-01-01T00:00:00.000Z", type: "mcp.tool", summary: "MCP tool event" }),
      JSON.stringify({ kind: "trace", opId: "op-1", ts: "2026-01-01T00:00:01.000Z", type: "unknown", summary: 42 }),
    ].join("\n") + "\n");

    expect(await readOpTrace("op-1")).toEqual([
      { opId: "op-1", ts: "2026-01-01T00:00:00.000Z", type: "mcp.tool", summary: "MCP tool event" },
    ]);
  });

  it("ignores trace rows passed to reduction at runtime", () => {
    const operation = {
      id: "op-1",
      ts: "2026-01-01T00:00:00.000Z",
      op: "chat-stream",
      model: "hermes",
      prompt: "user: update plan",
      status: "done" as const,
    };
    const traceRow = {
      kind: "trace",
      opId: "op-1",
      ts: "2026-01-01T00:00:01.000Z",
      type: "mcp.tool",
      summary: "completed",
    };

    expect(reduceToFinal([operation, traceRow] as unknown as typeof operation[])).toEqual([operation]);
  });
});
