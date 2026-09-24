import { describe, expect, it } from "vitest";

import { DictionaryCodexContextService } from "./DictionaryCodexContextService.js";

describe("DictionaryCodexContextService", () => {
  it("builds project-scoped dictionary context with only dictionary tools", async () => {
    const service = new DictionaryCodexContextService({
      async get(id: string) {
        return id === "project-1"
          ? {
              id,
              type: "project",
              title: "支付改造",
              metadata: { updatedAt: "2026-09-24T00:00:00.000Z" },
              content: {}
            }
          : null;
      }
    } as never);

    const context = await service.build("project-1");

    expect(context.scopeKey).toBe("dictionary:project-1");
    expect(context.allowedMcpTools).toEqual([
      "rich_dictionary_manage",
      "rich_project_files_get",
      "rich_project_file_read"
    ]);
    expect(context.systemInstruction).toMatch(/rich_dictionary_manage/);
    expect(context.initialContext).toMatch(/Project ID: project-1/);
    expect(context.initialContext).not.toMatch(/deliverable|flowchart/i);
  });
});
