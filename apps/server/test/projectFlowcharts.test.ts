import Database from "better-sqlite3";
import { describe, it, expect } from "vitest";
import { SQLITE_PROJECT_MANAGEMENT_SCHEMA } from "../src/db/projectManagementSchema.js";
import { SqliteProjectManagementRepo } from "../src/repos/SqliteProjectManagementRepo.js";
import { PROJECT_MANAGEMENT_MODULES } from "../src/repos/ProjectManagementRepo.js";

describe("project flowchart persistence", () => {
  it("registers the module and persists task graphs with project isolation", async () => {
    expect(PROJECT_MANAGEMENT_MODULES.some(module => module.key === "flowcharts")).toBe(true);
    const db = new Database(":memory:");
    try {
      db.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
      const repo = new SqliteProjectManagementRepo(db);
      const graph = { version: 1, objective: "解析代码", status: "draft", nodes: [{ id: "entry", data: { label: "入口" } }], edges: [] };
      const item = await repo.createModuleItem("project-a", { moduleKey: "flowcharts", title: "代码分析", content: { graph } });
      expect((await repo.listModuleItems("project-a", "flowcharts"))[0].content.graph).toEqual(graph);
      expect(await repo.listModuleItems("project-b", "flowcharts")).toEqual([]);
      expect(await repo.updateModuleItem("project-b", item.id, { title: "错误项目" })).toBeNull();
      const updated = { ...graph, status: "active", nodes: [...graph.nodes, { id: "step", data: { label: "处理" } }] };
      await repo.updateModuleItem("project-a", item.id, { content: { graph: updated } });
      expect((await repo.listModuleItems("project-a", "flowcharts"))[0].content.graph).toEqual(updated);
      await repo.deleteModuleItem("project-a", item.id);
      expect(await repo.listModuleItems("project-a", "flowcharts")).toEqual([]);
    } finally { db.close(); }
  });
});
