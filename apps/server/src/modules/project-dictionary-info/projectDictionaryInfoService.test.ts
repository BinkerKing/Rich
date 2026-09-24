import { describe, expect, it } from "vitest";

import { getProjectDictionaryInfo, saveProjectDictionaryInfo } from "./projectDictionaryInfoService.js";

describe("project dictionary information library", () => {
  it("creates once and then updates the project dictionary information library", async () => {
    const items: Array<{ id: string; title: string; content: Record<string, unknown>; createdAt: string; updatedAt: string }> = [];
    const created: unknown[] = [];
    const repo = {
      async listModuleItems() { return items; },
      async createModuleItem(_projectId: string, input: { title: string; content: Record<string, unknown> }) {
        created.push(input);
        const item = { id: "info-1", title: input.title, content: input.content, createdAt: "2026-09-24T00:00:00.000Z", updatedAt: "2026-09-24T00:00:00.000Z" };
        items.push(item);
        return item;
      },
      async updateModuleItem(_projectId: string, id: string, input: { title?: string; content?: Record<string, unknown> }) {
        const item = items.find(entry => entry.id === id)!;
        Object.assign(item, { title: input.title ?? item.title, content: input.content ?? item.content, updatedAt: "2026-09-24T00:01:00.000Z" });
        return item;
      },
    };

    expect(await getProjectDictionaryInfo(repo as never, "project-1")).toMatchObject({ projectId: "project-1", html: "", text: "" });
    await saveProjectDictionaryInfo(repo as never, "project-1", "<p>first</p>");
    const updated = await saveProjectDictionaryInfo(repo as never, "project-1", "<p>second</p>");

    expect(updated).toMatchObject({ html: "<p>second</p>", text: "second" });
    expect(created).toHaveLength(1);
  });
});
