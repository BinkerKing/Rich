import type { ProjectManagementRepo, ProjectModuleItem } from "../../repos/ProjectManagementRepo.js";

const title = "数据字典信息库";

export interface ProjectDictionaryInfo {
  projectId: string;
  html: string;
  text: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function getProjectDictionaryInfo(repo: Pick<ProjectManagementRepo, "listModuleItems">, projectId: string): Promise<ProjectDictionaryInfo> {
  return projectDictionaryInfoFromItem(projectId, findProjectDictionaryInfo(await repo.listModuleItems(projectId, "dictionary")));
}

export async function saveProjectDictionaryInfo(
  repo: Pick<ProjectManagementRepo, "listModuleItems" | "createModuleItem" | "updateModuleItem">,
  projectId: string,
  html: string,
): Promise<ProjectDictionaryInfo> {
  const current = findProjectDictionaryInfo(await repo.listModuleItems(projectId, "dictionary"));
  const item = current
    ? await repo.updateModuleItem(projectId, current.id, { title, content: { ...current.content, html } })
    : await repo.createModuleItem(projectId, { moduleKey: "dictionary", title, sortOrder: 0, content: { html } });
  if (!item) throw new Error("数据字典信息库保存失败");
  return projectDictionaryInfoFromItem(projectId, item);
}

function findProjectDictionaryInfo(items: ProjectModuleItem[]): ProjectModuleItem | undefined {
  return items.find(item => item.title === title);
}

function projectDictionaryInfoFromItem(projectId: string, item: ProjectModuleItem | undefined): ProjectDictionaryInfo {
  const html = typeof item?.content.html === "string" ? item.content.html : "";
  return { projectId, html, text: projectDictionaryInfoPlainText(html), ...(item ? { createdAt: item.createdAt, updatedAt: item.updatedAt } : {}) };
}

function projectDictionaryInfoPlainText(html: string): string {
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
