import {
  PROJECT_MANAGEMENT_MODULES,
  type ProjectDictionaryFieldDetail,
  type ProjectDictionaryFieldHit,
  type ProjectDictionarySystem,
  type ProjectDictionaryTable,
  type ProjectManagementModuleKey,
  type ProjectManagementRepo,
  type ProjectManagementSearchHit,
  type ProjectManagementSummary,
  type ProjectModuleItemInput,
  type ProjectModuleItemPatch,
  type ProjectModuleItem,
} from "./ProjectManagementRepo.js";

export class EmptyProjectManagementRepo implements ProjectManagementRepo {
  async getSummary(projectId: string): Promise<ProjectManagementSummary> {
    return {
      projectId,
      modules: PROJECT_MANAGEMENT_MODULES.map(module => ({ ...module, count: 0 })),
      dictionary: { systems: 0, tables: 0, fields: 0 },
    };
  }

  async listDictionarySystems(): Promise<ProjectDictionarySystem[]> {
    return [];
  }

  async searchAll(): Promise<ProjectManagementSearchHit[]> {
    return [];
  }

  async listModuleItems(_projectId: string, _moduleKey: ProjectManagementModuleKey): Promise<ProjectModuleItem[]> {
    return [];
  }

  async createModuleItem(projectId: string, input: ProjectModuleItemInput): Promise<ProjectModuleItem> {
    const now = new Date().toISOString();
    return {
      id: "pm-item-empty",
      projectId,
      moduleKey: input.moduleKey,
      parentId: input.parentId ?? undefined,
      title: input.title,
      subtitle: input.subtitle ?? undefined,
      sortOrder: input.sortOrder ?? 0,
      content: input.content ?? {},
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateModuleItem(_projectId: string, _itemId: string, _patch: ProjectModuleItemPatch): Promise<ProjectModuleItem | null> {
    return null;
  }

  async deleteModuleItem(): Promise<boolean> {
    return false;
  }

  async reorderModuleItems(): Promise<void> {}

  async listDictionaryTables(): Promise<ProjectDictionaryTable[]> {
    return [];
  }

  async listDictionaryFields(): Promise<ProjectDictionaryFieldHit[]> {
    return [];
  }

  async resolveDictionaryFieldRefs(): Promise<ProjectDictionaryFieldHit[]> {
    return [];
  }

  async searchDictionaryFields(): Promise<ProjectDictionaryFieldHit[]> {
    return [];
  }

  async getDictionaryField(): Promise<ProjectDictionaryFieldDetail | null> {
    return null;
  }
}
