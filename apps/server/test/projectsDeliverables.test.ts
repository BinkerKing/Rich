import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

beforeAll(async () => { root = await mkdtemp(join(tmpdir(), "rich-deliverables-")); });
afterAll(async () => { await rm(root, { recursive: true, force: true }); });

describe("交付物项目目录", () => {
it("只能在项目 07-交付 下创建", async () => {
  const created = await app.request("http://localhost/project-1/folder/deliverables/create-folder", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ relativePath: "07-交付/UAT-20260806" }),
  });
  expect(created.status).toBe(200);

  const escaped = await app.request("http://localhost/project-1/folder/deliverables/create-folder", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ relativePath: "../outside" }),
  });
  expect(escaped.status).toBe(400);
});

it("将文件上传到指定目录并拒绝越界目录", async () => {
  const form = new FormData();
  form.set("relativeDirectory", "07-交付/UAT-20260806");
  form.set("file", new File(["验收内容"], "验收报告.txt", { type: "text/plain" }));
  const uploaded = await app.request("http://localhost/project-1/folder/deliverables/upload", { method: "POST", body: form });
  expect(uploaded.status).toBe(201);
  const json = await uploaded.json() as { relativePath: string };
  expect(await readFile(join(root, json.relativePath), "utf8")).toBe("验收内容");

  const escaped = new FormData();
  escaped.set("relativeDirectory", "../outside");
  escaped.set("file", new File(["x"], "x.txt", { type: "text/plain" }));
  const rejected = await app.request("http://localhost/project-1/folder/deliverables/upload", { method: "POST", body: escaped });
  expect(rejected.status).toBe(400);
});

it("删除只允许删除交付物目录内的指定文件", async () => {
  const form = new FormData(); form.set("relativeDirectory", "07-交付/UAT-20260806"); form.set("file", new File(["删除测试"], "删除测试.txt"));
  const uploaded = await app.request("http://localhost/project-1/folder/deliverables/upload", { method: "POST", body: form });
  const file = await uploaded.json() as { relativePath: string };
  const deleted = await app.request("http://localhost/project-1/folder/deliverables/delete", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ relativePath: file.relativePath }) });
  expect(deleted.status).toBe(200);
  await expect(access(join(root, file.relativePath))).rejects.toThrow();
});

it("列出交付物目录的直接文件和子目录，不展开子目录内文件", async () => {
  const directory = join(root, "07-交付/UAT-20260806/过程材料");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "核对表.xlsx"), "material");
  await writeFile(join(root, "07-交付/UAT-20260806/验收报告.xlsx"), "deliverable");
  const listed = await app.request("http://localhost/project-1/folder/deliverables/list-files", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ relativePath: "07-交付/UAT-20260806" }),
  });
  expect(listed.status).toBe(200);
  const files = (await listed.json() as { files: Array<{ relativePath: string; isDirectory: boolean }> }).files;
  expect(files).toEqual(expect.arrayContaining([
    expect.objectContaining({ relativePath: "07-交付/UAT-20260806/过程材料", isDirectory: true }),
    expect.objectContaining({ relativePath: "07-交付/UAT-20260806/验收报告.xlsx", isDirectory: false }),
  ]));
  expect(files.map(file => file.relativePath)).not.toContain("07-交付/UAT-20260806/过程材料/核对表.xlsx");
});
});
