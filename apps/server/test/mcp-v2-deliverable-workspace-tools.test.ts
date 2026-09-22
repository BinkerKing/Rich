import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { registerDeliverableWorkspaceTools } from "../src/mcp-v2/tasks/deliverableWorkspaceTools.js";
import { RichToolRegistry } from "../src/mcp-v2/registry/toolRegistry.js";

describe("deliverable workspace MCP tools", () => {
  const temporaryRoots: string[] = [];

  afterEach(() => {
    temporaryRoots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true }));
  });

  it("writes a record to an independent deliverable bound to a project", async () => {
    let deliverable = {
      id: "deliverable-1", title: "Mapping 文档", content: { recordType: "deliverable", folderPath: "07-交付/Mapping", records: [] },
      createdAt: "2026-09-22T00:00:00.000Z", updatedAt: "2026-09-22T00:00:00.000Z",
    };
    const registry = new RichToolRegistry();
    registerDeliverableWorkspaceTools(
      registry,
      { async get() { return { type: "project", content: { localFolder: process.cwd() } }; } } as never,
      { async listAllModuleItems() { return []; }, async updateModuleItem() { return null; } } as never,
      {
        async claim() { return { claimed: true }; },
        async complete() {},
        async abandon() {},
      } as never,
      {
        async get(id) { return id === deliverable.id ? deliverable : null; },
        async update(id, patch) {
          if (id !== deliverable.id) return null;
          deliverable = { ...deliverable, ...patch, content: patch.content ?? deliverable.content };
          return deliverable;
        },
      } as never,
    );

    const response = await registry.invoke("rich_deliverable_record_create", {
      projectId: "project-1", deliverableId: "deliverable-1", kind: "requirement", text: "整理 Mapping 需求说明", context: { requestId: "write-1" },
    });

    expect(response).toMatchObject({ ok: true, data: { record: { kind: "requirement", text: "整理 Mapping 需求说明" } } });
  });

  it("writes a file inside the deliverable folder when given a file name", async () => {
    const root = mkdtempSync(join(tmpdir(), "rich-deliverable-"));
    temporaryRoots.push(root);
    mkdirSync(join(root, "07-交付", "Mapping"), { recursive: true });
    const deliverable = {
      id: "deliverable-1", title: "Mapping 文档", content: { recordType: "deliverable", folderPath: "07-交付/Mapping", records: [] },
      createdAt: "2026-09-22T00:00:00.000Z", updatedAt: "2026-09-22T00:00:00.000Z",
    };
    const registry = new RichToolRegistry();
    registerDeliverableWorkspaceTools(
      registry,
      { async get() { return { type: "project", content: { localFolder: root } }; } } as never,
      { async listAllModuleItems() { return []; }, async updateModuleItem() { return null; } } as never,
      { async claim() { return { claimed: true }; }, async complete() {}, async abandon() {} } as never,
      { async get(id) { return id === deliverable.id ? deliverable : null; }, async update() { return deliverable; } } as never,
    );

    const response = await registry.invoke("rich_deliverable_file_write", {
      projectId: "project-1", deliverableId: "deliverable-1", relativePath: "需求说明.md", content: "# Mapping", context: { requestId: "write-file" },
    });

    expect(response).toMatchObject({ ok: true, data: { relativePath: "07-交付/Mapping/需求说明.md" } });
    expect(readFileSync(join(root, "07-交付", "Mapping", "需求说明.md"), "utf8")).toBe("# Mapping");
  });
});
