import { mkdtemp, rm } from "node:fs/promises";
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

beforeAll(async () => { root = await mkdtemp(join(tmpdir(), "rich-folder-open-")); });
afterAll(async () => { await rm(root, { recursive: true, force: true }); });

describe("项目目录打开", () => {
  it("目录路径不存在时返回可读错误，而不是静默成功", async () => {
    const existing = root;
    root = join(existing, "missing-directory");
    const response = await app.request("http://localhost/project-1/folder/open-directory", { method: "POST" });
    root = existing;

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "project folder does not exist" });
  });
});
