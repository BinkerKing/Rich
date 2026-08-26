import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildApp } from "../src/index.js";
import { openDb } from "../src/db/sqlite.js";
import { SqliteElementsRepo } from "../src/repos/SqliteElementsRepo.js";
import type { AIAdapter, StreamEvent, GenerateArgs } from "../src/ai/adapter.js";

class FakeAdapter implements AIAdapter {
  readonly name = "claude-code" as const;
  async available() { return true; }
  async *stream(_args: GenerateArgs): AsyncIterable<StreamEvent> {
    const tree = {
      rootId: "fake",
      elements: [{
        id: "fake", type: "topic", title: "Fake",
        content: { intro: "i", learningGoals: ["g"], coreModules: [{ id: "m", title: "M", description: "d" }], recommendedPaths: ["p"] },
        metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
      }],
      relations: [],
      paths: [],
    };
    const text = JSON.stringify(tree);
    yield { type: "delta", text };
    yield { type: "done", fullText: text };
  }
}

let dir: string;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "ke-routes-"));
  const db = openDb(join(dir, "ke.db"));
  await new SqliteElementsRepo(db).put({
    id: "seed", type: "concept", title: "Seed",
    content: { oneSentence: "x", coreExplain: "y", whyMatters: "z" },
    metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 },
  });
  db.close();
});

describe("Core API routes", () => {
  it("GET /api/elements returns array", async () => {
    const app = buildApp(dir);
    const res = await app.request("/api/elements");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].id).toBe("seed");
  });

  it("GET /api/elements/:id returns one", async () => {
    const app = buildApp(dir);
    const res = await app.request("/api/elements/seed");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("seed");
  });

  it("GET /api/elements/:id 404 on missing", async () => {
    const app = buildApp(dir);
    const res = await app.request("/api/elements/nope");
    expect(res.status).toBe(404);
  });

  it("mounts the project automation API with the configured storage backend", async () => {
    const app = buildApp(dir);
    const response = await app.request("/api/project-management/project-a/automation/plans");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
  });

  it("stores one project description and exposes it to search", async () => {
    const app = buildApp(dir);
    const empty = await app.request("/api/project-management/project-a/description");
    expect(empty.status).toBe(200);
    await expect(empty.json()).resolves.toMatchObject({ projectId: "project-a", html: "", text: "" });

    const saved = await app.request("/api/project-management/project-a/description", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ html: "<h3>Rich 项目</h3><p>统一数据治理平台</p>" }),
    });
    expect(saved.status).toBe(200);
    await expect(saved.json()).resolves.toMatchObject({
      projectId: "project-a",
      html: "<h3>Rich 项目</h3><p>统一数据治理平台</p>",
      text: "Rich 项目\n统一数据治理平台",
    });

    const search = await app.request("/api/project-management/project-a/search?q=数据治理");
    expect(search.status).toBe(200);
    expect((await search.json()).results[0]).toMatchObject({ moduleKey: "description", title: "项目说明" });
  });

  it("GET /api/health reports that health features require PostgreSQL", async () => {
    const app = buildApp(dir, [new FakeAdapter()]);
    const res = await app.request("/api/health");
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain("KE_STORAGE=postgres");
  });

  it("GET /api/ai/models lists adapters", async () => {
    const app = buildApp(dir, [new FakeAdapter()]);
    const res = await app.request("/api/ai/models");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ name: "claude-code", available: true }]);
  });

  it("POST /api/ai/generate-tree streams SSE with done event", async () => {
    const app = buildApp(dir, [new FakeAdapter()]);
    const res = await app.request("/api/ai/generate-tree", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic: "test" }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("event: done");
    expect(text).toContain('"rootId":"fake"');
  });

  it("POST /api/ai/generate-tree returns 400 on missing topic", async () => {
    const app = buildApp(dir, [new FakeAdapter()]);
    const res = await app.request("/api/ai/generate-tree", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
