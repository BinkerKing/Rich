import { describe, expect, it } from "vitest";
import { registerDeepMindMapTools } from "../src/mcp-v2/resources/deepMindMapTools.js";
import { RichToolRegistry } from "../src/mcp-v2/registry/toolRegistry.js";

describe("rich_deep_mindmap_manage", () => {
  it("reads and verifies updates to the persisted root-node details", async () => {
    let map = { id: "deep-1", title: "SAFE 分析", map: { root: { data: { uid: "root", text: "SAFE 分析", details: "原始资料" }, children: [] } }, createdAt: "2026-09-25T00:00:00.000Z", updatedAt: "2026-09-25T00:01:00.000Z" };
    const repo = {
      list: async () => [map],
      get: async (id: string) => id === map.id ? map : null,
      create: async () => map,
      update: async (_id: string, input: { title: string; map: Record<string, unknown>; expectedUpdatedAt: string }) => {
        map = { ...map, title: input.title, map: input.map as typeof map.map, updatedAt: "2026-09-25T00:02:00.000Z" };
        return map;
      },
      remove: async () => false,
    };
    const registry = new RichToolRegistry();
    registerDeepMindMapTools(registry, repo);

    await expect(registry.invoke("rich_deep_mindmap_manage", { action: "get", mapId: map.id })).resolves.toMatchObject({ ok: true, data: { mindmap: { id: map.id } } });
    await expect(registry.invoke("rich_deep_mindmap_manage", { action: "update_root_details", mapId: map.id, details: "<h2>需求</h2><p>已完成梳理</p>", context: { requestId: "deep-map-1" } })).resolves.toMatchObject({
      ok: true,
      data: { mindmap: { map: { root: { data: { details: "<h2>需求</h2><p>已完成梳理</p>" } } } } },
    });
  });
});
