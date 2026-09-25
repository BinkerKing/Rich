import { describe, expect, it } from "vitest";
import { deepMindMapsRoutes } from "../src/routes/deepMindMaps.js";

const map = { root: { data: { uid: "root", text: "方案", details: "" }, children: [] } };

describe("deepMindMapsRoutes", () => {
  it("reports that Postgres is required when no repository is available", async () => {
    const response = await deepMindMapsRoutes(null).request("/");

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "DeepMindMap requires Postgres" });
  });

  it("rejects stale updates instead of overwriting a newer map", async () => {
    const repo = {
      list: async () => [],
      get: async () => null,
      create: async (input: { title: string; map: Record<string, unknown> }) => ({ id: "map-1", ...input, createdAt: "now", updatedAt: "new" }),
      update: async () => "conflict" as const,
      remove: async () => false,
    };
    const response = await deepMindMapsRoutes(repo).request("/map-1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "方案", map, expectedUpdatedAt: "old" }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "DeepMindMap changed on the server" });
  });
});
