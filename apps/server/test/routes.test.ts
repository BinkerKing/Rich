import { describe, it, expect } from "vitest";
import { buildApp } from "../src/index.js";
import { dataDir } from "../src/lib/paths.js";

const app = buildApp(dataDir());

describe("API routes", () => {
  it("GET /api/elements returns array", async () => {
    const res = await app.request("/api/elements");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("GET /api/elements/:id returns one", async () => {
    const res = await app.request("/api/elements/cog-psy");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("cog-psy");
  });

  it("GET /api/elements/:id 404 on missing", async () => {
    const res = await app.request("/api/elements/nope");
    expect(res.status).toBe(404);
  });

  it("POST /api/ai/generate-tree returns seed tree", async () => {
    const res = await app.request("/api/ai/generate-tree", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic: "认知心理学" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rootId).toBe("cog-psy");
    expect(body.elements.length).toBeGreaterThanOrEqual(7);
    expect(body.paths.length).toBe(3);
  });
});
