import { describe, it, expect, afterEach } from "vitest";
import { rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { buildApp } from "../src/index.js";
import { dataDir } from "../src/lib/paths.js";
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

const TEST_EL_ID = "cog-psy.attention";

describe("AI operation routes", () => {
  afterEach(() => {
    // Clean up any test artifacts written outside the original seed
    const paths = join(dataDir(), "paths", `${TEST_EL_ID}.json`);
    if (existsSync(paths)) rmSync(paths);
  });

  it("POST /api/ai/refine returns 404 for unknown element", async () => {
    const app = buildApp(dataDir(), [new ScriptedAdapter({ content: {} })]);
    const res = await app.request("/api/ai/refine", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ elementId: "no.such.elem" }),
    });
    expect(res.status).toBe(404);
  });

  it("POST /api/ai/refine streams done with content payload", async () => {
    const payload = { content: { oneSentence: "新的更深定义", coreExplain: "...", whyMatters: "..." } };
    const app = buildApp(dataDir(), [new ScriptedAdapter(payload)]);
    const res = await app.request("/api/ai/refine", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ elementId: TEST_EL_ID, targetRichness: 4 }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("event: done");
    expect(text).toContain("新的更深定义");
  });

  it("POST /api/ai/expand streams done with elements + relations", async () => {
    const payload = {
      elements: [{
        id: "cog-psy.attention.test1", type: "concept", title: "Test1",
        content: { oneSentence: "t", coreExplain: "t", whyMatters: "t" },
        metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
      }],
      relations: [{ id: "r1", from: TEST_EL_ID, to: "cog-psy.attention.test1", kind: "child", createdAt: "" }],
    };
    const app = buildApp(dataDir(), [new ScriptedAdapter(payload)]);
    const res = await app.request("/api/ai/expand", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ elementId: TEST_EL_ID }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("event: done");
    expect(text).toContain("cog-psy.attention.test1");
    // Cleanup artifact written by repo.put
    const p = join(dataDir(), "elements", "cog-psy.attention.test1.json");
    if (existsSync(p)) rmSync(p);
  });

  it("POST /api/ai/extend returns 400 on missing direction", async () => {
    const app = buildApp(dataDir(), [new ScriptedAdapter({ elements: [], relations: [] })]);
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
    const app = buildApp(dataDir(), [new ScriptedAdapter(payload)]);
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
    const app = buildApp(dataDir(), [new ScriptedAdapter({})]);
    const res = await app.request("/api/relations");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("GET /api/paths returns array of center ids when no center query", async () => {
    const app = buildApp(dataDir(), [new ScriptedAdapter({})]);
    const res = await app.request("/api/paths");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});
