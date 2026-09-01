import { describe, expect, it, vi } from "vitest";
import {
  getProjectDescription,
  saveProjectDescription,
} from "../src/modules/project-description/projectDescriptionService.js";
import type { ProjectManagementRepo, ProjectModuleItem } from "../src/repos/ProjectManagementRepo.js";

function descriptionItem(html: string): ProjectModuleItem {
  return {
    id: "description-item",
    projectId: "project-a",
    moduleKey: "description",
    title: "项目说明",
    sortOrder: 0,
    content: { html },
    createdAt: "2026-08-26T01:00:00.000Z",
    updatedAt: "2026-08-26T02:00:00.000Z",
  };
}

describe("project description service", () => {
  it("returns an empty document when the project has no description", async () => {
    const repo = { listModuleItems: vi.fn(async () => []) } as unknown as ProjectManagementRepo;

    await expect(getProjectDescription(repo, "project-a")).resolves.toEqual({
      projectId: "project-a",
      html: "",
      text: "",
    });
  });

  it("ignores non-rich-text records when selecting the canonical description", async () => {
    const canonical = descriptionItem("<p>完整说明</p>");
    const baseline: ProjectModuleItem = {
      ...descriptionItem(""),
      id: "baseline-item",
      title: "首轮项目认知基线",
      content: { summary: "结构化基线" },
      updatedAt: "2026-08-28T02:00:00.000Z",
    };
    const repo = { listModuleItems: vi.fn(async () => [baseline, canonical]) } as unknown as ProjectManagementRepo;

    await expect(getProjectDescription(repo, "project-a")).resolves.toMatchObject({
      html: "<p>完整说明</p>",
      text: "完整说明",
    });
  });

  it("creates the singleton description and exposes plain text for AI", async () => {
    const created = descriptionItem("<h3>Rich</h3><p>数据治理项目</p>");
    const repo = {
      listModuleItems: vi.fn(async () => []),
      createModuleItem: vi.fn(async () => created),
    } as unknown as ProjectManagementRepo;

    const result = await saveProjectDescription(repo, "project-a", created.content.html as string);

    expect(repo.createModuleItem).toHaveBeenCalledWith("project-a", {
      moduleKey: "description",
      title: "项目说明",
      sortOrder: 0,
      content: { html: created.content.html },
    });
    expect(result.text).toBe("Rich\n数据治理项目");
  });

  it("updates the existing singleton instead of creating another item", async () => {
    const current = descriptionItem("<p>旧说明</p>");
    const updated = descriptionItem("<p>新说明</p>");
    const repo = {
      listModuleItems: vi.fn(async () => [current]),
      updateModuleItem: vi.fn(async () => updated),
      createModuleItem: vi.fn(),
    } as unknown as ProjectManagementRepo;

    const result = await saveProjectDescription(repo, "project-a", "<p>新说明</p>");

    expect(repo.updateModuleItem).toHaveBeenCalledWith("project-a", current.id, {
      title: "项目说明",
      content: { ...current.content, html: "<p>新说明</p>" },
    });
    expect(repo.createModuleItem).not.toHaveBeenCalled();
    expect(result.html).toBe("<p>新说明</p>");
  });
});
