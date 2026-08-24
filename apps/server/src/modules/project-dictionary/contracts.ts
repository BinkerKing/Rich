export type DictionaryEntityDialect = "postgresql" | "sqlserver";

export type DictionaryEntityExtractionValidationIssue = {
  kind: "invalid_rule" | "unsupported_op" | "missing_source" | "empty_required" | "evaluate_error";
  fieldId: string;
  fieldName: string;
  fieldCn?: string;
  message: string;
};

export type DictionaryEntitySyncResult = {
  ok: true;
  dialect: DictionaryEntityDialect;
  tableName: string;
  sql: string;
  affectedRows?: number;
  message: string;
  validationIssues?: DictionaryEntityExtractionValidationIssue[];
};

export type DictionaryEntityExtractionPrepareResult = {
  ok: true;
  dialect: DictionaryEntityDialect;
  tableName: string;
  ready: boolean;
  sql: string;
  message: string;
  runtimeParamNames?: string[];
  caliber: { status: "valid" | "invalid"; sql?: string; error?: string };
  validationIssues?: DictionaryEntityExtractionValidationIssue[];
  statementError?: string;
};

export type DictionaryMappingSqlValidationField = {
  fieldId: string;
  fieldName: string;
  fieldCn?: string;
  logicFingerprint?: string;
  status: "valid" | "invalid" | "skipped";
  sql?: string;
  error?: string;
};

export type DictionaryMappingSqlValidationResult = {
  ok: boolean;
  dialect: DictionaryEntityDialect;
  sourceKind?: "file" | "database";
  message: string;
  caliber: { status: "valid" | "invalid"; sql?: string; error?: string };
  fields: DictionaryMappingSqlValidationField[];
};

export type DictionaryEntityConnectionTestResult = {
  ok: true;
  dialect: DictionaryEntityDialect;
  database: string;
  schema?: string;
  schemaExists?: boolean;
  message: string;
};

export type DictionaryEntityTestDataQueryResult = {
  ok: true;
  dialect: DictionaryEntityDialect;
  tableName: string;
  page: number;
  pageSize: number;
  total: number;
  rows: Array<{ lineNumber: number; values: Record<string, unknown> }>;
  message: string;
};

export type DictionaryEntitySchemaIssue = {
  kind: "missing" | "extra" | "type_mismatch";
  columnName: string;
  fieldName?: string;
  expectedType?: string;
  actualType?: string;
  message: string;
};

export type DictionaryEntitySchemaStatusResult = {
  ok: true;
  dialect: DictionaryEntityDialect;
  tableName: string;
  connectionOk: true;
  tableExists: boolean;
  schemaSynced: boolean;
  issues: DictionaryEntitySchemaIssue[];
  message: string;
};
