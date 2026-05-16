import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildApp } from "../src/index.js";
import type { AIAdapter, GenerateArgs, StreamEvent } from "../src/ai/adapter.js";

class ScriptedAdapter implements AIAdapter {
  readonly name = "claude-code" as const;
  constructor(private payload: unknown) {}
  async available() { return true; }
  async *stream(_args: GenerateArgs): AsyncIterable<StreamEvent> {
    const text = JSON.stringify(this.payload);
    yield { type: "delta", text };
    yield { type: "done", fullText: text, sessionId: "review-session" };
  }
}

const MANUAL_SAMPLE = `# Knowledge AI

## Role
do things.

## Default Style
- 中文

## Pitfalls
- 不要发明 ID

## Learned Rules
（占位）
`;

let dataDir: string;
let aiDir: string;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "ke-review-data-"));
  aiDir = mkdtempSync(join(tmpdir(), "ke-review-ai-"));
  writeFileSync(join(aiDir, "knowledge.md"), MANUAL_SAMPLE);
  // seed some signals
  mkdirSync(dataDir, { recursive: true });
  const signalsFile = join(dataDir, "signals.jsonl");
  const events = [
    { ts: new Date().toISOString(), type: "op.completed", manual: "knowledge", op: "refine", elementId: "x" },
    { ts: new Date().toISOString(), type: "user.reverted", manual: "knowledge", elementId: "x", data: { fromTimestamp: "t1" } },
    { ts: new Date().toISOString(), type: "user.reverted", manual: "knowledge", elementId: "y", data: { fromTimestamp: "t2" } },
  ];
  writeFileSync(signalsFile, events.map(e => JSON.stringify(e)).join("\n") + "\n");
});

describe("POST /api/ai/review", () => {
  it("returns 404 when manual not found", async () => {
    const app = buildApp(dataDir, [new ScriptedAdapter({ rules: [] })], undefined, { aiDir });
    const res = await app.request("/api/ai/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manual: "nope" }),
    });
    expect(res.status).toBe(404);
  });

  it("dry-run does not write to manual", async () => {
    const payload = { rules: [{ text: "always cite sources", rationale: "based on 3 reverts", date: "2026-05-16" }] };
    const app = buildApp(dataDir, [new ScriptedAdapter(payload)], undefined, { aiDir });
    const res = await app.request("/api/ai/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manual: "knowledge", dryRun: true }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dryRun).toBe(true);
    expect(body.proposedRules).toHaveLength(1);
    expect(body.added).toBe(0);
    const manualAfter = readFileSync(join(aiDir, "knowledge.md"), "utf8");
    expect(manualAfter).not.toContain("always cite sources");
  });

  it("non-dry-run appends rules to manual", async () => {
    const payload = { rules: [
      { text: "always cite sources", rationale: "based on 3 reverts", date: "2026-05-16" },
      { text: "limit quick path to 3 steps", rationale: "user reverted long paths", date: "2026-05-16" },
    ]};
    const app = buildApp(dataDir, [new ScriptedAdapter(payload)], undefined, { aiDir });
    const res = await app.request("/api/ai/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manual: "knowledge" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.added).toBe(2);
    expect(body.signalsReviewed).toBe(3);
    const manualAfter = readFileSync(join(aiDir, "knowledge.md"), "utf8");
    expect(manualAfter).toContain("always cite sources");
    expect(manualAfter).toContain("limit quick path to 3 steps");
    expect(manualAfter).toContain("(2026-05-16)");
    expect(manualAfter).not.toContain("（占位）");
  });

  it("dedupes rules already in manual", async () => {
    // first review writes
    const payload1 = { rules: [{ text: "rule one", date: "2026-05-16" }] };
    const app1 = buildApp(dataDir, [new ScriptedAdapter(payload1)], undefined, { aiDir });
    await app1.request("/api/ai/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manual: "knowledge" }),
    });
    // second review proposes same + new
    const payload2 = { rules: [{ text: "rule one", date: "2026-05-17" }, { text: "rule two", date: "2026-05-17" }] };
    const app2 = buildApp(dataDir, [new ScriptedAdapter(payload2)], undefined, { aiDir });
    const res = await app2.request("/api/ai/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manual: "knowledge" }),
    });
    const body = await res.json();
    expect(body.added).toBe(1);
    expect(body.skipped).toBe(1);
  });

  it("returns early when no signals in window", async () => {
    // Use a since that excludes our seeded signals.
    const app = buildApp(dataDir, [new ScriptedAdapter({ rules: [] })], undefined, { aiDir });
    const res = await app.request("/api/ai/review", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ manual: "knowledge", since: "2099-01-01T00:00:00Z" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signalsReviewed).toBe(0);
    expect(body.rules).toEqual([]);
  });
});
