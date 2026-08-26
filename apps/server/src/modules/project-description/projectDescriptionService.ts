import type { ProjectManagementRepo, ProjectModuleItem } from "../../repos/ProjectManagementRepo.js";

export interface ProjectDescription {
  projectId: string;
  html: string;
  text: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function getProjectDescription(
  repo: ProjectManagementRepo,
  projectId: string,
): Promise<ProjectDescription> {
  const item = (await repo.listModuleItems(projectId, "description"))[0];
  return projectDescriptionFromItem(projectId, item);
}

export async function saveProjectDescription(
  repo: ProjectManagementRepo,
  projectId: string,
  html: string,
): Promise<ProjectDescription> {
  const current = (await repo.listModuleItems(projectId, "description"))[0];
  const item = current
    ? await repo.updateModuleItem(projectId, current.id, {
      title: "项目说明",
      content: { ...current.content, html },
    })
    : await repo.createModuleItem(projectId, {
      moduleKey: "description",
      title: "项目说明",
      sortOrder: 0,
      content: { html },
    });
  if (!item) throw new Error("项目说明保存失败");
  return projectDescriptionFromItem(projectId, item);
}

function projectDescriptionFromItem(
  projectId: string,
  item: ProjectModuleItem | undefined,
): ProjectDescription {
  const html = typeof item?.content.html === "string" ? item.content.html : "";
  return {
    projectId,
    html,
    text: projectDescriptionPlainText(html),
    ...(item ? { createdAt: item.createdAt, updatedAt: item.updatedAt } : {}),
  };
}

function projectDescriptionPlainText(html: string): string {
  return html
    .replace(/<(br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|pre|blockquote|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
