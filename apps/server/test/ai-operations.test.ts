import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildApp } from "../src/index.js";
import type { AIAdapter, StreamEvent, GenerateArgs } from "../src/ai/adapter.js";

class ScriptedAdapter implements AIAdapter {
  readonly name = "claude-code" as const;
  constructor(private payload: unknown) {}
  async available() { return true; }
  async *stream(_args: GenerateArgs): AsyncIterable<StreamEvent> {
    const text = JSON.stringify(this.payload);
    yield { type: "delta", text };
    yield { type: "done", fullText: text, sessionId: "session-xyz" };
  }
}

const TEST_EL_ID = "test.attention";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ke-ops-"));
  mkdirSync(join(dir, "elements"), { recursive: true });
  writeFileSync(
    join(dir, "elements", `${TEST_EL_ID}.json`),
    JSON.stringify({
      id: TEST_EL_ID,
      type: "concept",
      title: "注意力",
      content: { oneSentence: "原始定义", coreExplain: "...", whyMatters: "..." },
      metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
    }),
  );
});

describe("AI operation routes", () => {
  it("POST /api/ai/refine returns 404 for unknown element", async () => {
    const app = buildApp(dir, [new ScriptedAdapter({ content: {} })]);
    const res = await app.request("/api/ai/refine", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ elementId: "no.such.elem" }),
    });
    expect(res.status).toBe(404);
  });

  it("POST /api/ai/refine streams done with content payload", async () => {
    const payload = { content: { oneSentence: "更深定义", coreExplain: "...", whyMatters: "..." } };
    const app = buildApp(dir, [new ScriptedAdapter(payload)]);
    const res = await app.request("/api/ai/refine", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ elementId: TEST_EL_ID, targetRichness: 4 }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("event: done");
    expect(text).toContain("更深定义");
  });

  it("POST /api/ai/expand streams done with elements + relations", async () => {
    const childId = `${TEST_EL_ID}.test1`;
    const payload = {
      elements: [{
        id: childId, type: "concept", title: "Test1",
        content: { oneSentence: "t", coreExplain: "t", whyMatters: "t" },
        metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
      }],
      relations: [{ id: "r1", from: TEST_EL_ID, to: childId, kind: "child", createdAt: "" }],
    };
    const app = buildApp(dir, [new ScriptedAdapter(payload)]);
    const res = await app.request("/api/ai/expand", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ elementId: TEST_EL_ID }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("event: done");
    expect(text).toContain(childId);
  });

  it("POST /api/ai/extend returns 400 on missing direction", async () => {
    const app = buildApp(dir, [new ScriptedAdapter({ elements: [], relations: [] })]);
    const res = await app.request("/api/ai/extend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ elementId: TEST_EL_ID }),
    });
    expect(res.status).toBe(400);
  });

  it("POST /api/ai/path streams done with paths array", async () => {
    const payload = {
      paths: [{
        id: "p.test", centerElementId: TEST_EL_ID, kind: "quick", label: "Test",
        color: "gold", steps: [TEST_EL_ID], generatedBy: "ai", createdAt: "",
      }],
    };
    const app = buildApp(dir, [new ScriptedAdapter(payload)]);
    const res = await app.request("/api/ai/path", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ elementId: TEST_EL_ID, kinds: ["quick"] }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("event: done");
    expect(text).toContain('"id":"p.test"');
  });

  it("GET /api/relations returns array", async () => {
    const app = buildApp(dir, [new ScriptedAdapter({})]);
    const res = await app.request("/api/relations");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("serializes concurrent operations on the same element via per-element lock", async () => {
    // A SlowAdapter records start/end order; with a per-element lock, run #2
    // must wait until run #1 finishes (start1, end1, start2, end2).
    const order: string[] = [];
    let seq = 0;
    class SlowAdapter implements AIAdapter {
      readonly name = "claude-code" as const;
      async available() { return true; }
      async *stream(_args: GenerateArgs): AsyncIterable<StreamEvent> {
        const n = ++seq;
        order.push(`start${n}`);
        await new Promise(r => setTimeout(r, 30));
        order.push(`end${n}`);
        const payload = { content: { oneSentence: `r${n}`, coreExplain: "x", whyMatters: "y" } };
        yield { type: "done", fullText: JSON.stringify(payload) };
      }
    }
    const app = buildApp(dir, [new SlowAdapter()]);
    const req = () => app.request("/api/ai/refine", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ elementId: TEST_EL_ID, targetRichness: 3 }),
    });
    // fire concurrently; both target same element so they must serialize
    const [r1, r2] = await Promise.all([req(), req()]);
    await r1.text(); await r2.text();
    expect(order).toEqual(["start1", "end1", "start2", "end2"]);
  });

  it("POST /api/ai/expand emits error event on schema-invalid AI output", async () => {
    // AI returned elements with empty id (rejected by ElementSchema.id.min(1))
    const bad = {
      elements: [{ id: "", type: "concept", title: "x", content: {}, metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 } }],
      relations: [],
    };
    const app = buildApp(dir, [new ScriptedAdapter(bad)]);
    const res = await app.request("/api/ai/expand", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ elementId: TEST_EL_ID }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("event: error");
    expect(text).toContain("schema validation failed");
  });

  it("GET /api/paths returns empty array of centers when none stored", async () => {
    const app = buildApp(dir, [new ScriptedAdapter({})]);
    const res = await app.request("/api/paths");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});
