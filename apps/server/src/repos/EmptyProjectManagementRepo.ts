import {
  PROJECT_MANAGEMENT_MODULES,
  type ProjectDictionaryFieldDetail,
  type ProjectDictionaryFieldHit,
  type ProjectDictionaryFieldPatch,
  type ProjectDictionaryMappingAction,
  type ProjectDictionaryMappingActionInput,
  type ProjectDictionaryMappingActionPatch,
  type ProjectDictionaryMappingRule,
  type ProjectDictionaryMappingScenario,
  type ProjectDictionaryMappingScenarioInput,
  type ProjectDictionaryMappingScenarioPatch,
  type ProjectDictionaryMappingRulePatch,
  type ProjectDictionaryMappingSourceFieldInput,
  type ProjectDictionaryMappingTempTable,
  type ProjectDictionaryMappingTempTableInput,
  type ProjectDictionaryMappingValidation,
  type ProjectDictionaryRectification,
  type ProjectDictionaryRectificationInput,
  type ProjectDictionaryRectificationPatch,
  type ProjectDictionarySystem,
  type ProjectDictionarySystemPatch,
  type ProjectDictionaryTable,
  type ProjectDictionaryTablePatch,
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

  async updateDictionarySystem(_projectId: string, _systemId: string, _patch: ProjectDictionarySystemPatch): Promise<ProjectDictionarySystem | null> {
    return null;
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

  async updateDictionaryTable(_projectId: string, _tableId: string, _patch: ProjectDictionaryTablePatch): Promise<ProjectDictionaryTable | null> {
    return null;
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

  async updateDictionaryField(_projectId: string, _fieldId: string, _patch: ProjectDictionaryFieldPatch): Promise<ProjectDictionaryFieldDetail | null> {
    return null;
  }

  async listDictionaryRectifications(): Promise<ProjectDictionaryRectification[]> {
    return [];
  }

  async createDictionaryRectification(
    projectId: string,
    input: ProjectDictionaryRectificationInput,
  ): Promise<ProjectDictionaryRectification> {
    const now = new Date().toISOString();
    return {
      id: "pm-dict-rect-empty",
      projectId,
      entityType: input.entityType,
      entityId: input.entityId,
      propertyKey: input.propertyKey,
      requirement: input.requirement,
      status: "open",
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateDictionaryRectification(
    _projectId: string,
    _rectificationId: string,
    _patch: ProjectDictionaryRectificationPatch,
  ): Promise<ProjectDictionaryRectification | null> {
    return null;
  }

  async listDictionaryMappingRules(): Promise<ProjectDictionaryMappingRule[]> {
    return [];
  }

  async listDictionaryMappingScenarios(): Promise<ProjectDictionaryMappingScenario[]> {
    return [];
  }

  async createDictionaryMappingScenario(projectId: string, input: ProjectDictionaryMappingScenarioInput): Promise<ProjectDictionaryMappingScenario> {
    const now = new Date().toISOString();
    return { id: input.id ?? "pm-map-scenario-empty", projectId, tableId: input.tableId, title: input.title, caliber: input.caliber ?? undefined, remark: input.remark ?? undefined, sortOrder: input.sortOrder ?? 0, raw: input.raw, createdAt: now, updatedAt: now };
  }

  async updateDictionaryMappingScenario(): Promise<ProjectDictionaryMappingScenario | null> {
    return null;
  }

  async deleteDictionaryMappingScenario(): Promise<boolean> {
    return false;
  }

  async getDictionaryMappingRule(): Promise<ProjectDictionaryMappingRule | null> {
    return null;
  }

  async updateDictionaryMappingRule(
    _projectId: string,
    _mappingRuleId: string,
    _patch: ProjectDictionaryMappingRulePatch,
  ): Promise<ProjectDictionaryMappingRule | null> {
    return null;
  }

  async updateDictionaryMappingAction(
    _projectId: string,
    _actionId: string,
    _patch: ProjectDictionaryMappingActionPatch,
  ): Promise<ProjectDictionaryMappingAction | null> {
    return null;
  }

  async replaceDictionaryMappingActions(
    _projectId: string,
    _mappingRuleId: string,
    _actions: ProjectDictionaryMappingActionInput[],
  ): Promise<ProjectDictionaryMappingRule | null> {
    return null;
  }

  async replaceDictionaryMappingSourceFields(
    _projectId: string,
    _mappingRuleId: string,
    _sourceFields: ProjectDictionaryMappingSourceFieldInput[],
  ): Promise<ProjectDictionaryMappingRule | null> {
    return null;
  }

  async validateDictionaryMappingTable(projectId: string, tableId: string): Promise<ProjectDictionaryMappingValidation> {
    return {
      projectId,
      tableId,
      totalRules: 0,
      completeRules: 0,
      invalidRules: 0,
      unableToConvertRules: 0,
      missingSourceFieldRules: 0,
      missingSqlRules: 0,
      issues: [],
    };
  }

  async listDictionaryMappingTempTables(): Promise<ProjectDictionaryMappingTempTable[]> {
    return [];
  }

  async replaceDictionaryMappingTempTables(
    _projectId: string,
    _targetTableId: string,
    _tempTables: ProjectDictionaryMappingTempTableInput[],
  ): Promise<ProjectDictionaryMappingTempTable[]> {
    return [];
  }
}
