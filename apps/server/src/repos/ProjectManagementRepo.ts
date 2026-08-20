export type ProjectManagementModuleKey =
  | "dictionary"
  | "workflow"
  | "scenarios"
  | "environments"
  | "deploymentSteps"
  | "monitoring"
  | "codeVersions"
  | "todos"
  | "folder";

export interface ProjectManagementModuleSummary {
  key: ProjectManagementModuleKey;
  label: string;
  count: number;
}

export interface ProjectManagementSummary {
  projectId: string;
  modules: ProjectManagementModuleSummary[];
  dictionary: {
    systems: number;
    tables: number;
    fields: number;
  };
}

export interface ProjectDictionarySystem {
  id: string;
  code: string;
  name: string;
  type?: string;
  assetLayer?: string;
  fieldCount: number;
  tableCount: number;
}

export interface ProjectDictionaryTable {
  id: string;
  systemId?: string;
  tableName: string;
  tableCn?: string;
  tableGroup?: string;
  dataLayer?: string;
  sourceKind?: string;
  fileType?: string;
  usageStatus?: string;
  description?: string;
  caliber?: string;
  extra?: Record<string, unknown>;
  fieldCount: number;
}

export interface ProjectDictionaryCodeItem {
  id?: string;
  value: string;
  description: string;
  remark?: string;
  sortOrder?: number;
}

export interface ProjectDictionaryCodeSet {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  items: ProjectDictionaryCodeItem[];
}

export interface ProjectDictionaryFieldHit {
  id: string;
  systemId?: string;
  systemName?: string;
  systemCode?: string;
  tableId?: string;
  tableName?: string;
  tableCn?: string;
  fieldName: string;
  fieldCn?: string;
  fieldType?: string;
  fieldLength?: string;
  formatPattern?: string;
  carrierKind?: string;
  fieldOrder?: number;
  sourceFieldOrder?: number;
  description?: string;
  acquireLogic?: string;
  codeValue?: string;
  codeSetId?: string;
  codeSetName?: string;
  codeItems?: ProjectDictionaryCodeItem[];
  mappedTable?: string;
  mappedField?: string;
  mappedFieldCn?: string;
  remark?: string;
  extra?: Record<string, unknown>;
  score: number;
}

export interface ProjectDictionaryFieldDetail extends ProjectDictionaryFieldHit {
  fieldLength?: string;
  formatPattern?: string;
  nullable?: string;
  primaryKey: boolean;
  required: boolean;
  validationRule?: string;
  codeValue?: string;
  mappedFieldCn?: string;
  dataSource?: string;
  remark?: string;
  tableDescription?: string;
  tableCaliber?: string;
  tableDataLayer?: string;
  tableSourceKind?: string;
  systemType?: string;
  systemAssetLayer?: string;
  systemDescription?: string;
  extra?: Record<string, unknown>;
}

export type ProjectDictionaryRectificationStatus = "open" | "fixed" | "verified" | "cancelled";

export interface ProjectDictionaryRectification {
  id: string;
  projectId: string;
  entityType: "library" | "table" | "field" | "codeSet" | "mapping";
  entityId: string;
  propertyKey: string;
  requirement: string;
  status: ProjectDictionaryRectificationStatus;
  resolutionNote?: string;
  createdBy?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface ProjectDictionaryRectificationInput {
  entityType: ProjectDictionaryRectification["entityType"];
  entityId: string;
  propertyKey: string;
  requirement: string;
  createdBy?: string;
}

export interface ProjectDictionaryRectificationPatch {
  status?: ProjectDictionaryRectificationStatus;
  resolutionNote?: string | null;
  resolvedBy?: string | null;
}

export interface ProjectDictionaryMappingSourceField {
  id: string;
  projectId: string;
  mappingRuleId: string;
  fieldId?: string;
  refPath: string;
  alias?: string;
  role?: string;
  remark?: string;
  sortOrder: number;
  raw?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDictionaryMappingAction {
  id: string;
  projectId: string;
  mappingRuleId: string;
  actionType: string;
  conditionText?: string;
  expressionText?: string;
  resultText?: string;
  remark?: string;
  sortOrder: number;
  raw?: Record<string, unknown>;
  sourceFieldIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDictionaryMappingRule {
  id: string;
  projectId: string;
  scenarioId?: string;
  systemId?: string;
  tableId?: string;
  fieldId?: string;
  status: string;
  logicText?: string;
  convertedSql?: string;
  remark?: string;
  sortOrder: number;
  raw?: Record<string, unknown>;
  sourceFields: ProjectDictionaryMappingSourceField[];
  actions: ProjectDictionaryMappingAction[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDictionaryMappingRulePatch {
  scenarioId?: string | null;
  systemId?: string | null;
  tableId?: string | null;
  fieldId?: string | null;
  status?: string;
  logicText?: string | null;
  convertedSql?: string | null;
  remark?: string | null;
  sortOrder?: number;
  raw?: Record<string, unknown>;
}

export interface ProjectDictionaryMappingSourceFieldInput {
  id?: string;
  fieldId?: string | null;
  refPath: string;
  alias?: string | null;
  role?: string | null;
  remark?: string | null;
  sortOrder?: number;
  raw?: Record<string, unknown>;
}

export interface ProjectDictionaryMappingActionInput {
  id?: string;
  actionType: string;
  conditionText?: string | null;
  expressionText?: string | null;
  resultText?: string | null;
  remark?: string | null;
  sortOrder?: number;
  raw?: Record<string, unknown>;
  sourceFieldIds?: string[];
}

export interface ProjectDictionaryMappingActionPatch {
  actionType?: string;
  conditionText?: string | null;
  expressionText?: string | null;
  resultText?: string | null;
  remark?: string | null;
  sortOrder?: number;
  raw?: Record<string, unknown>;
  sourceFieldIds?: string[];
}

export interface ProjectDictionaryMappingValidationIssue {
  mappingRuleId: string;
  fieldId?: string;
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
}

export interface ProjectDictionaryMappingValidation {
  projectId: string;
  tableId: string;
  totalRules: number;
  completeRules: number;
  invalidRules: number;
  unableToConvertRules: number;
  missingSourceFieldRules: number;
  missingSqlRules: number;
  issues: ProjectDictionaryMappingValidationIssue[];
}

export interface ProjectManagementSearchHit {
  id: string;
  moduleKey: ProjectManagementModuleKey;
  entityType: string;
  entityId: string;
  title: string;
  subtitle?: string;
  excerpt?: string;
  score: number;
  updatedAt: string;
}

export interface ProjectModuleItem {
  id: string;
  projectId: string;
  moduleKey: ProjectManagementModuleKey;
  parentId?: string;
  title: string;
  subtitle?: string;
  sortOrder: number;
  content: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectModuleItemInput {
  moduleKey: ProjectManagementModuleKey;
  parentId?: string | null;
  title: string;
  subtitle?: string | null;
  sortOrder?: number;
  content?: Record<string, unknown>;
}

export interface ProjectModuleItemPatch {
  parentId?: string | null;
  title?: string;
  subtitle?: string | null;
  sortOrder?: number;
  content?: Record<string, unknown>;
}

export interface ProjectManagementRepo {
  getSummary(projectId: string): Promise<ProjectManagementSummary>;
  searchAll(projectId: string, query: string, limit: number): Promise<ProjectManagementSearchHit[]>;
  listModuleItems(projectId: string, moduleKey: ProjectManagementModuleKey, parentId?: string): Promise<ProjectModuleItem[]>;
  createModuleItem(projectId: string, input: ProjectModuleItemInput): Promise<ProjectModuleItem>;
  updateModuleItem(projectId: string, itemId: string, patch: ProjectModuleItemPatch): Promise<ProjectModuleItem | null>;
  deleteModuleItem(projectId: string, itemId: string): Promise<boolean>;
  reorderModuleItems(projectId: string, moduleKey: ProjectManagementModuleKey, itemIds: string[]): Promise<void>;
  listDictionarySystems(projectId: string): Promise<ProjectDictionarySystem[]>;
  listDictionaryTables(projectId: string, systemId?: string): Promise<ProjectDictionaryTable[]>;
  listDictionaryFields(projectId: string, tableId: string): Promise<ProjectDictionaryFieldHit[]>;
  resolveDictionaryFieldRefs(projectId: string, refs: string[]): Promise<ProjectDictionaryFieldHit[]>;
  searchDictionaryFields(projectId: string, query: string, limit: number): Promise<ProjectDictionaryFieldHit[]>;
  getDictionaryField(projectId: string, fieldId: string): Promise<ProjectDictionaryFieldDetail | null>;
  listDictionaryRectifications(projectId: string): Promise<ProjectDictionaryRectification[]>;
  createDictionaryRectification(projectId: string, input: ProjectDictionaryRectificationInput): Promise<ProjectDictionaryRectification>;
  updateDictionaryRectification(projectId: string, rectificationId: string, patch: ProjectDictionaryRectificationPatch): Promise<ProjectDictionaryRectification | null>;
  listDictionaryMappingRules(projectId: string, tableId: string): Promise<ProjectDictionaryMappingRule[]>;
  getDictionaryMappingRule(projectId: string, mappingRuleId: string): Promise<ProjectDictionaryMappingRule | null>;
  updateDictionaryMappingRule(projectId: string, mappingRuleId: string, patch: ProjectDictionaryMappingRulePatch): Promise<ProjectDictionaryMappingRule | null>;
  updateDictionaryMappingAction(projectId: string, actionId: string, patch: ProjectDictionaryMappingActionPatch): Promise<ProjectDictionaryMappingAction | null>;
  replaceDictionaryMappingActions(projectId: string, mappingRuleId: string, actions: ProjectDictionaryMappingActionInput[]): Promise<ProjectDictionaryMappingRule | null>;
  replaceDictionaryMappingSourceFields(projectId: string, mappingRuleId: string, sourceFields: ProjectDictionaryMappingSourceFieldInput[]): Promise<ProjectDictionaryMappingRule | null>;
  validateDictionaryMappingTable(projectId: string, tableId: string): Promise<ProjectDictionaryMappingValidation>;
}

export const PROJECT_MANAGEMENT_MODULES: Array<{ key: ProjectManagementModuleKey; label: string }> = [
  { key: "dictionary", label: "数据字典" },
  { key: "workflow", label: "作业流程" },
  { key: "scenarios", label: "场景手册" },
  { key: "environments", label: "环境配置" },
  { key: "deploymentSteps", label: "部署步骤" },
  { key: "monitoring", label: "监控预警" },
  { key: "codeVersions", label: "代码版本" },
  { key: "todos", label: "项目代办" },
  { key: "folder", label: "文件夹" },
];

export function parseDictionaryCodeItems(value?: string | null): ProjectDictionaryCodeItem[] {
  const source = value?.trim();
  if (!source) return [];
  const lines = source
    .replace(/\r/g, "\n")
    .replace(/[；;]/g, "\n")
    .replace(/(?<!\d)[,，](?=\s*(?:[A-Za-z]?\d{1,8}[A-Za-z]?|[YN是否])\s*(?:[:：=、.．）)、\-\s]|=>|->|→))/g, "\n")
    .replace(/(?:^|\s)(?=([A-Za-z]?\d{1,8}[A-Za-z]?|[YN是否])\s*(?:[:：=、.．）)、]|=>|->|→)\s*)/g, "\n")
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);

  const rows = lines
    .map<ProjectDictionaryCodeItem | null>((line, index) => {
      const compact = line.replace(/^[（(]\s*/, "").replace(/\s*[）)]$/, "").trim();
      const match = compact.match(/^([A-Za-z]?\d{1,8}[A-Za-z]?|[YN是否])\s*(?:[:：=、.．）)、]|=>|->|→|\s+|表示|代表|为)\s*(.+)$/);
      if (!match) return null;
      const description = match[2].replace(/^[-—:：=、.．）)、\s]+/, "").trim();
      if (!description) return null;
      return {
        value: match[1].trim(),
        description,
        sortOrder: index + 1,
      };
    })
    .filter((row): row is ProjectDictionaryCodeItem => row !== null);

  const seen = new Set<string>();
  return rows.filter(row => {
    const key = `${row.value}\u0000${row.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
