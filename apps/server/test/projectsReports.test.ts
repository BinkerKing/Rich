import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { projectsRoutes } from "../src/routes/projects.js";

let root = "";
const app = projectsRoutes({
  get: async () => ({ id: "project-1", type: "project", content: { localFolder: root } }),
} as never, {
  listAllModuleItems: async () => [],
} as never);

beforeAll(async () => { root = await mkdtemp(join(tmpdir(), "rich-reports-")); });
afterAll(async () => { await rm(root, { recursive: true, force: true }); });

describe("项目报告文件", () => {
  it("将日报写入项目管理目录的 Markdown 文件", async () => {
    const response = await app.request("http://localhost/project-1/folder/reports/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        report: {
          type: "daily",
          date: "2026-08-30",
          title: "项目日报 · 8月30日",
          projectProgress: 68,
          completedWork: ["完成登录功能开发"],
          tomorrowPlan: ["完善订单详情页"],
          risks: ["暂无阻塞"],
        },
      }),
    });

    expect(response.status).toBe(201);
    const result = await response.json() as { relativePath: string };
    expect(result.relativePath).toBe("01-管理/报告/日报/2026-08-30-项目日报.md");
    const markdown = await readFile(join(root, result.relativePath), "utf8");
    expect(markdown).toContain("# 项目日报 · 8月30日");
    expect(markdown).toContain("## 今日完成工作");
    expect(markdown).toContain("完成登录功能开发");
    expect(markdown).toContain("## 明日计划");
    expect(markdown).toContain("## 风险与阻碍");
    expect(markdown).toContain("整体项目进度：68%");
  });

  it("按报告类型写入对应的项目管理目录", async () => {
    const response = await app.request("http://localhost/project-1/folder/reports/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        report: {
          type: "weekly",
          date: "2026-08-30",
          title: "第35周项目周报",
          summary: "完成核心查控流程联调。",
        },
      }),
    });

    expect(response.status).toBe(201);
    const result = await response.json() as { relativePath: string };
    expect(result.relativePath).toBe("01-管理/报告/周报/2026-08-30-第35周项目周报.md");
    expect(await readFile(join(root, result.relativePath), "utf8")).toContain("完成核心查控流程联调");
  });
});
