import type { ProjectManagementRepo, ProjectModuleItem } from "../repos/ProjectManagementRepo.js";
import type { DeliverablesRepo } from "../repos/DeliverablesRepo.js";
import type { AiTaskContextSnapshot } from "./types.js";

type ListedFile = { fileName: string; relativePath: string; size: number };
type ListFiles = (projectId: string, folderPath: string) => Promise<ListedFile[]>;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export class DeliverableTaskContextService {
  constructor(
    private readonly projectManagement: Pick<ProjectManagementRepo, "listAllModuleItems">,
    private readonly listFiles: ListFiles,
    private readonly standaloneDeliverables?: Pick<DeliverablesRepo, "get">,
  ) {}

  async createSnapshot(projectId: string, deliverableId: string): Promise<AiTaskContextSnapshot> {
    const legacyDeliverable = (await this.projectManagement.listAllModuleItems(projectId, "deliverables"))
      .find(item => item.id === deliverableId);
    const deliverable = legacyDeliverable ?? await this.standaloneDeliverables?.get(deliverableId);
    if (!deliverable) throw new Error("Deliverable not found.");
    return this.snapshot(projectId, deliverable);
  }

  private async snapshot(projectId: string, item: Pick<ProjectModuleItem, "content">): Promise<AiTaskContextSnapshot> {
    const content = item.content;
    const normalizedFolderPath = text(content.folderPath).replaceAll("\\", "/");
    const folderPath = normalizedFolderPath.startsWith("/")
      ? normalizedFolderPath.replace(/\/+$/g, "")
      : normalizedFolderPath.replace(/^\/+|\/+$/g, "");
    if (content.recordType !== "deliverable" || !folderPath) throw new Error("Deliverable folder is required.");
    const records = Array.isArray(content.records) ? content.records.flatMap(record => {
      if (!isObject(record) || !text(record.id) || !text(record.kind) || !text(record.createdAt)) return [];
      return [{ id: text(record.id), kind: text(record.kind), text: text(record.text), createdAt: text(record.createdAt) }];
    }) : [];
    const metaByPath = new Map((Array.isArray(content.fileMeta) ? content.fileMeta : []).flatMap(meta => {
      if (!isObject(meta) || !text(meta.relativePath)) return [];
      const type = meta.type === "deliverable" || meta.type === "material" || meta.type === "intermediate" ? meta.type : "material";
      return [[text(meta.relativePath), { type, version: text(meta.version), note: text(meta.note) }] as const];
    }));
    const files = (await this.listFiles(projectId, folderPath)).flatMap(file => {
      if (!file.relativePath.startsWith(`${folderPath}/`)) return [];
      const meta = metaByPath.get(file.relativePath);
      return [{ relativePath: file.relativePath, fileName: file.fileName, size: file.size, type: meta?.type ?? "material", ...(meta?.version ? { version: meta.version } : {}), ...(meta?.note ? { note: meta.note } : {}) }];
    });
    return { version: 1, createdAt: new Date().toISOString(), deliverable: { folderPath, requirementHtml: text(content.descriptionHtml) }, records, files, history: [] };
  }
}
