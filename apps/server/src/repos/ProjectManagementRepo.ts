export type ProjectManagementModuleKey =
  | "dashboard"
  | "deliveryPlan"
  | "requirements"
  | "risks"
  | "deliverables"
  | "reports"
  | "description"
  | "dictionary"
  | "automation"
  | "workflow"
  | "flowcharts"
  | "scenarios"
  | "environments"
  | "deploymentSteps"
  | "monitoring"
  | "codeVersions"
  | "todos"
  | "healthChecks"
  | "testing"
  | "issues"
  | "folder";

export const TEST_CASE_STATUSES = ["draft", "ready", "testing", "passed", "failed", "blocked", "retest"] as const;
export type TestCaseStatus = typeof TEST_CASE_STATUSES[number];
export type TestCaseType = "data" | "functional";
export const TEST_RUN_STATUSES = ["testing", "passed", "failed", "blocked", "retest"] as const;
export type TestRunStatus = typeof TEST_RUN_STATUSES[number];

export interface TestCenterTask {
  id: string;
  projectId: string;
  title: string;
  objective: string;
  testData: string;
  testLinks: string;
  appVersion: string;
  status: "draft" | "active" | "completed" | "archived";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestCenterGroup {
  id: string;
  projectId: string;
  taskId: string;
  parentGroupId?: string;
  title: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestCenterCase {
  id: string;
  projectId: string;
  taskId?: string;
  groupId?: string;
  scenario: string;
  code: string;
  title: string;
  objective: string;
  type: TestCaseType;
  priority: "low" | "medium" | "high" | "critical";
  status: TestCaseStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestCenterRun {
  id: string;
  projectId: string;
  caseId: string;
  status: TestRunStatus;
  actualResult: string;
  startedAt: string;
  finishedAt?: string;
  createdAt: string;
}

export interface TestCenterCaseStep {
  id: string;
  projectId: string;
  caseId: string;
  stepOrder: number;
  instruction: string;
  expectedResult: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestCenterRunStep {
  id: string;
  projectId: string;
  runId: string;
  caseStepId?: string;
  stepOrder: number;
  instruction: string;
  expectedResult: string;
  status: "pending" | "passed" | "failed" | "blocked";
  actualResult: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestCenterEvidence {
  id: string;
  projectId: string;
  runId: string;
  runStepId?: string;
  title: string;
  kind: string;
  location: string;
  createdAt: string;
}

export interface TestCenterIssue {
  id: string;
  projectId: string;
  caseId: string;
  runId?: string;
  title: string;
  description: string;
  owner?: string;
  externalRef?: string;
  customFields: Record<string, string>;
  status: "open" | "fixed" | "retest" | "closed";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TestCenterIssueDiscussion {
  id: string;
  projectId: string;
  issueId: string;
  content: string;
  createdAt: string;
}

export interface TestCenterCaseComment {
  id: string;
  projectId: string;
  caseId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestCenterReport {
  totalCases: number;
  draftCases: number;
  readyCases: number;
  testingCases: number;
  passedCases: number;
  failedCases: number;
  blockedCases: number;
  retestCases: number;
  openIssues: number;
  fixedIssues: number;
  retestIssues: number;
  passRate: number;
}

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
  extra?: Record<string, unknown>;
  dbType?: "postgresql" | "sqlserver" | "unknown";
  sqlDialect?: "postgresql" | "sqlserver";
  connection?: ProjectDictionaryConnectionConfig;
  entitySyncPolicy?: "metadata_only" | "create_schema_allowed" | "create_table_allowed" | "insert_test_data_allowed" | "readonly";
  fieldCount: number;
  tableCount: number;
}

export interface ProjectDictionaryConnectionConfig {
  host?: string;
  port?: number;
  database?: string;
  schema?: string;
  username?: string;
  password?: string;
  secretRef?: string;
  ssl?: boolean;
}

export interface ProjectDictionarySystemPatch {
  type?: string | null;
  assetLayer?: string | null;
  extra?: Record<string, unknown>;
}

export function projectDictionarySystemFromRow(row: {
  id: string;
  code: string | null;
  name: string;
  type: string | null;
  asset_layer: string | null;
  extra?: Record<string, unknown> | string | null;
  table_count: string | number;
  field_count: string | number;
}): ProjectDictionarySystem {
  const extra = normalizeDictionarySystemExtra(row.extra);
  const dbConfig = normalizeDictionaryDatabaseConfig(extra);
  return {
    id: row.id,
    code: row.code ?? "",
    name: row.name,
    type: row.type ?? undefined,
    assetLayer: row.asset_layer ?? undefined,
    extra,
    dbType: dbConfig.dbType,
    sqlDialect: dbConfig.sqlDialect,
    connection: dbConfig.connection,
    entitySyncPolicy: dbConfig.entitySyncPolicy,
    tableCount: Number(row.table_count),
    fieldCount: Number(row.field_count),
  };
}

function normalizeDictionarySystemExtra(value: Record<string, unknown> | string | null | undefined): Record<string, unknown> | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
    } catch {
      return undefined;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

export function normalizeDictionaryDatabaseConfig(extra?: Record<string, unknown>): Pick<ProjectDictionarySystem, "dbType" | "sqlDialect" | "connection" | "entitySyncPolicy"> {
  const rawDbType = typeof extra?.dbType === "string" ? extra.dbType.toLowerCase() : "";
  const dbType = rawDbType === "postgres" || rawDbType === "postgresql"
    ? "postgresql"
    : rawDbType === "sqlserver" || rawDbType === "mssql"
      ? "sqlserver"
      : rawDbType
        ? "unknown"
        : undefined;
  const rawDialect = typeof extra?.sqlDialect === "string" ? extra.sqlDialect.toLowerCase() : "";
  const sqlDialect = rawDialect === "postgres" || rawDialect === "postgresql"
    ? "postgresql"
    : rawDialect === "sqlserver" || rawDialect === "mssql"
      ? "sqlserver"
      : dbType === "postgresql" || dbType === "sqlserver"
        ? dbType
        : undefined;
  const rawConnection = extra?.connection;
  const connection = rawConnection && typeof rawConnection === "object" && !Array.isArray(rawConnection)
    ? rawConnection as ProjectDictionaryConnectionConfig
    : undefined;
  const rawPolicy = typeof extra?.entitySyncPolicy === "string" ? extra.entitySyncPolicy : "";
  const entitySyncPolicy = rawPolicy === "create_schema_allowed" || rawPolicy === "create_table_allowed" || rawPolicy === "insert_test_data_allowed" || rawPolicy === "readonly"
    ? rawPolicy
    : rawPolicy === "metadata_only"
      ? "metadata_only"
      : undefined;
  return { dbType, sqlDialect, connection, entitySyncPolicy };
}

export interface ProjectDictionaryTable {
  id: string;
  systemId?: string;
  tableName: string;
  tableCn?: string;
  tableGroup?: string;
  dataLayer?: string;
  tableType?: string;
  sourceKind?: string;
  fileType?: string;
  hasMapping?: boolean;
  mappingStatus?: "是" | "待补充" | "否";
  usageStatus?: string;
  verificationStatus?: "未验证" | "已验证" | "待整改";
  verificationRemark?: string;
  description?: string;
  caliber?: string;
  externalSql?: string;
  extra?: Record<string, unknown>;
  fieldCount: number;
}

/** The affirmative display state is reserved for tables with real Mapping logic. */
export function dictionaryTableMappingStatus(hasMapping: boolean | undefined, effectiveRuleCount: number): "是" | "待补充" | "否" {
  if (effectiveRuleCount > 0) return "是";
  return hasMapping === false ? "否" : "待补充";
}

export interface ProjectDictionaryTablePatch {
  systemId?: string | null;
  tableName?: string;
  tableCn?: string | null;
  tableGroup?: string | null;
  dataLayer?: string | null;
  tableType?: string | null;
  sourceKind?: "文件" | "数据库" | null;
  fileType?: "txt" | "xml" | "csv" | "excel" | null;
  hasMapping?: boolean;
  usageStatus?: string | null;
  verificationStatus?: "未验证" | "已验证" | "待整改" | null;
  verificationRemark?: string | null;
  description?: string | null;
  caliber?: string | null;
  externalSql?: string | null;
  /** Merged with existing metadata so callers can patch individual flags safely. */
  extra?: Record<string, unknown>;
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
  verificationStatus?: "未验证" | "已验证" | "待整改";
  verificationRemark?: string;
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

export interface ProjectDictionaryFieldPatch {
  fieldCn?: string | null;
  fieldType?: string | null;
  fieldLength?: string | null;
  formatPattern?: string | null;
  nullable?: string | null;
  primaryKey?: boolean;
  required?: boolean;
  description?: string | null;
  acquireLogic?: string | null;
  validationRule?: string | null;
  codeValue?: string | null;
  mappedTable?: string | null;
  mappedField?: string | null;
  mappedFieldCn?: string | null;
  dataSource?: string | null;
  remark?: string | null;
  verificationStatus?: "未验证" | "已验证" | "待整改" | null;
  verificationRemark?: string | null;
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

export interface ProjectDictionaryMappingScenario {
  id: string;
  projectId: string;
  tableId: string;
  title: string;
  caliber?: string;
  caliberExternalSql?: string;
  externalSql?: string;
  remark?: string;
  sortOrder: number;
  raw?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDictionaryMappingScenarioInput {
  id?: string;
  tableId: string;
  title: string;
  caliber?: string | null;
  remark?: string | null;
  sortOrder?: number;
  raw?: Record<string, unknown>;
}

export interface ProjectDictionaryMappingScenarioPatch {
  title?: string;
  caliber?: string | null;
  caliberExternalSql?: string | null;
  externalSql?: string | null;
  remark?: string | null;
  sortOrder?: number;
  raw?: Record<string, unknown>;
}

export type ProjectDictionaryBusinessScenarioValidationStatus = "pending" | "passed" | "failed" | "unsupported";
export interface ProjectDictionaryBusinessScenarioLibrary {
  id: string; projectId: string; name: string; dbType?: "postgresql" | "sqlserver" | "mysql" | "oracle"; sqlDialect?: "postgresql" | "sqlserver" | "mysql" | "oracle";
  connection?: ProjectDictionaryConnectionConfig; createdAt: string; updatedAt: string;
}
export interface ProjectDictionaryBusinessScenarioLibraryInput { id?: string; name: string; dbType?: ProjectDictionaryBusinessScenarioLibrary["dbType"]; sqlDialect?: ProjectDictionaryBusinessScenarioLibrary["sqlDialect"]; connection?: ProjectDictionaryConnectionConfig; }

export interface ProjectDictionaryBusinessScenario {
  id: string; projectId: string; libraryId: string; title: string; procedureName: string; externalLocation?: string;
  sqlText: string; remark?: string; sortOrder: number; tableIds: string[];
  validationStatus: ProjectDictionaryBusinessScenarioValidationStatus; validationSqlFingerprint?: string; validationMessage?: string; validatedAt?: string;
  createdAt: string; updatedAt: string;
}
export interface ProjectDictionaryBusinessScenarioInput {
  id?: string; libraryId: string; title: string; procedureName: string; externalLocation?: string | null; sqlText: string; remark?: string | null; sortOrder?: number; tableIds: string[];
}
export interface ProjectDictionaryBusinessScenarioPatch extends Partial<Omit<ProjectDictionaryBusinessScenarioInput, "id" | "systemId">> {
  validationStatus?: ProjectDictionaryBusinessScenarioValidationStatus; validationSqlFingerprint?: string | null; validationMessage?: string | null; validatedAt?: string | null;
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
  externalSql?: string;
  remark?: string;
  verificationStatus?: "未验证" | "已验证" | "待整改";
  verificationRemark?: string;
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
  externalSql?: string | null;
  remark?: string | null;
  verificationStatus?: "未验证" | "已验证" | "待整改" | null;
  verificationRemark?: string | null;
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

export interface ProjectDictionaryMappingTempField {
  id: string;
  projectId: string;
  tempTableId: string;
  fieldName: string;
  fieldCn?: string;
  fieldType?: string;
  fieldLength?: string;
  logicText?: string;
  convertedSql?: string;
  externalSql?: string;
  remark?: string;
  sortOrder: number;
  raw?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDictionaryMappingTempTable {
  id: string;
  projectId: string;
  targetTableId: string;
  tableName: string;
  tableCn?: string;
  logicText?: string;
  convertedSql?: string;
  externalSql?: string;
  remark?: string;
  sortOrder: number;
  raw?: Record<string, unknown>;
  fields: ProjectDictionaryMappingTempField[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDictionaryMappingTempFieldInput {
  id?: string;
  fieldName: string;
  fieldCn?: string | null;
  fieldType?: string | null;
  fieldLength?: string | null;
  logicText?: string | null;
  convertedSql?: string | null;
  externalSql?: string | null;
  remark?: string | null;
  sortOrder?: number;
  raw?: Record<string, unknown>;
}

export interface ProjectDictionaryMappingTempTableInput {
  id?: string;
  tableName: string;
  tableCn?: string | null;
  logicText?: string | null;
  convertedSql?: string | null;
  externalSql?: string | null;
  remark?: string | null;
  sortOrder?: number;
  raw?: Record<string, unknown>;
  fields?: ProjectDictionaryMappingTempFieldInput[];
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
  destination: ProjectManagementSearchDestination;
}

/** UI-independent instruction for opening and focusing a search result. */
export interface ProjectManagementSearchDestination {
  section: ProjectManagementModuleKey;
  entityType: string;
  entityId: string;
  systemId?: string;
  tableId?: string;
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
  /** List every item in a module, including nested items. */
  listAllModuleItems(projectId: string, moduleKey: ProjectManagementModuleKey): Promise<ProjectModuleItem[]>;
  createModuleItem(projectId: string, input: ProjectModuleItemInput): Promise<ProjectModuleItem>;
  updateModuleItem(projectId: string, itemId: string, patch: ProjectModuleItemPatch): Promise<ProjectModuleItem | null>;
  deleteModuleItem(projectId: string, itemId: string): Promise<boolean>;
  reorderModuleItems(projectId: string, moduleKey: ProjectManagementModuleKey, itemIds: string[]): Promise<void>;
  listDictionarySystems(projectId: string): Promise<ProjectDictionarySystem[]>;
  updateDictionarySystem(projectId: string, systemId: string, patch: ProjectDictionarySystemPatch): Promise<ProjectDictionarySystem | null>;
  listDictionaryTables(projectId: string, systemId?: string): Promise<ProjectDictionaryTable[]>;
  updateDictionaryTable(projectId: string, tableId: string, patch: ProjectDictionaryTablePatch): Promise<ProjectDictionaryTable | null>;
  listDictionaryFields(projectId: string, tableId: string): Promise<ProjectDictionaryFieldHit[]>;
  resolveDictionaryFieldRefs(projectId: string, refs: string[]): Promise<ProjectDictionaryFieldHit[]>;
  searchDictionaryFields(projectId: string, query: string, limit: number): Promise<ProjectDictionaryFieldHit[]>;
  getDictionaryField(projectId: string, fieldId: string): Promise<ProjectDictionaryFieldDetail | null>;
  updateDictionaryField(projectId: string, fieldId: string, patch: ProjectDictionaryFieldPatch): Promise<ProjectDictionaryFieldDetail | null>;
  listDictionaryRectifications(projectId: string): Promise<ProjectDictionaryRectification[]>;
  createDictionaryRectification(projectId: string, input: ProjectDictionaryRectificationInput): Promise<ProjectDictionaryRectification>;
  updateDictionaryRectification(projectId: string, rectificationId: string, patch: ProjectDictionaryRectificationPatch): Promise<ProjectDictionaryRectification | null>;
  listDictionaryMappingRules(projectId: string, tableId: string): Promise<ProjectDictionaryMappingRule[]>;
  listDictionaryMappingScenarios(projectId: string, tableId: string): Promise<ProjectDictionaryMappingScenario[]>;
  createDictionaryMappingScenario(projectId: string, input: ProjectDictionaryMappingScenarioInput): Promise<ProjectDictionaryMappingScenario>;
  updateDictionaryMappingScenario(projectId: string, scenarioId: string, patch: ProjectDictionaryMappingScenarioPatch): Promise<ProjectDictionaryMappingScenario | null>;
  deleteDictionaryMappingScenario(projectId: string, scenarioId: string): Promise<boolean>;
  listDictionaryBusinessScenarios(projectId: string, libraryId?: string): Promise<ProjectDictionaryBusinessScenario[]>;
  listDictionaryBusinessScenarioLibraries(projectId: string): Promise<ProjectDictionaryBusinessScenarioLibrary[]>;
  createDictionaryBusinessScenarioLibrary(projectId: string, input: ProjectDictionaryBusinessScenarioLibraryInput): Promise<ProjectDictionaryBusinessScenarioLibrary>;
  updateDictionaryBusinessScenarioLibrary(projectId: string, libraryId: string, patch: Partial<ProjectDictionaryBusinessScenarioLibraryInput>): Promise<ProjectDictionaryBusinessScenarioLibrary | null>;
  listDictionaryBusinessScenariosForTable(projectId: string, tableId: string): Promise<ProjectDictionaryBusinessScenario[]>;
  createDictionaryBusinessScenario(projectId: string, input: ProjectDictionaryBusinessScenarioInput): Promise<ProjectDictionaryBusinessScenario>;
  updateDictionaryBusinessScenario(projectId: string, scenarioId: string, patch: ProjectDictionaryBusinessScenarioPatch): Promise<ProjectDictionaryBusinessScenario | null>;
  deleteDictionaryBusinessScenario(projectId: string, scenarioId: string): Promise<boolean>;
  getDictionaryMappingRule(projectId: string, mappingRuleId: string): Promise<ProjectDictionaryMappingRule | null>;
  updateDictionaryMappingRule(projectId: string, mappingRuleId: string, patch: ProjectDictionaryMappingRulePatch): Promise<ProjectDictionaryMappingRule | null>;
  updateDictionaryMappingAction(projectId: string, actionId: string, patch: ProjectDictionaryMappingActionPatch): Promise<ProjectDictionaryMappingAction | null>;
  replaceDictionaryMappingActions(projectId: string, mappingRuleId: string, actions: ProjectDictionaryMappingActionInput[]): Promise<ProjectDictionaryMappingRule | null>;
  replaceDictionaryMappingSourceFields(projectId: string, mappingRuleId: string, sourceFields: ProjectDictionaryMappingSourceFieldInput[]): Promise<ProjectDictionaryMappingRule | null>;
  validateDictionaryMappingTable(projectId: string, tableId: string): Promise<ProjectDictionaryMappingValidation>;
  listDictionaryMappingTempTables(projectId: string, targetTableId: string): Promise<ProjectDictionaryMappingTempTable[]>;
  replaceDictionaryMappingTempTables(projectId: string, targetTableId: string, tempTables: ProjectDictionaryMappingTempTableInput[]): Promise<ProjectDictionaryMappingTempTable[]>;
}

export const PROJECT_MANAGEMENT_MODULES: Array<{ key: ProjectManagementModuleKey; label: string }> = [
  { key: "dashboard", label: "项目驾驶舱" },
  { key: "deliveryPlan", label: "交付计划" },
  { key: "requirements", label: "需求与范围" },
  { key: "risks", label: "风险与问题" },
  { key: "deliverables", label: "交付物与验收" },
  { key: "reports", label: "报告" },
  { key: "description", label: "项目说明" },
  { key: "dictionary", label: "数据字典" },
  { key: "automation", label: "数据自动化" },
  { key: "workflow", label: "作业流程" },
  { key: "flowcharts", label: "项目流程图" },
  { key: "scenarios", label: "场景手册" },
  { key: "environments", label: "环境配置" },
  { key: "deploymentSteps", label: "部署步骤" },
  { key: "monitoring", label: "监控预警" },
  { key: "codeVersions", label: "版本控制" },
  { key: "todos", label: "项目代办" },
  { key: "healthChecks", label: "项目健康检查" },
  { key: "testing", label: "测试中心" },
  { key: "issues", label: "问题清单" },
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
