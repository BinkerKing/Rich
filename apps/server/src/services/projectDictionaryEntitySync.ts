import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  dictionaryCaliberTableName,
  dictionaryJoinType,
  parseDictionaryCaliberRule,
  type DictionaryCaliberExpression,
  type DictionaryCaliberJoin,
  type DictionaryCaliberOrderExpression,
  type DictionaryCaliberRule,
  type DictionaryCaliberSelectLatest,
  type DictionaryMappingJsonCondition,
  type DictionaryMappingJsonRule,
  type DictionaryMappingJsonRuleValue,
} from "@ke/domain";
import { safeElementSlug, safeFilename } from "../lib/attachments.js";
import { dataDir } from "../lib/paths.js";
import { quoteDictionaryEntityIdentifier } from "../modules/project-dictionary/sql-engine/dialect.js";
import {
  collectDictionaryExtractionConditionRefs,
  collectDictionaryExtractionValueRefs,
  normalizeDictionaryExtractionOp,
  parseDictionaryExtractionJsonRule,
  validateDictionaryExtractionJsonRule,
} from "../modules/project-dictionary/sql-engine/mappingRules.js";
import {
  validateDictionaryCaliberSql,
  validateDictionarySqlExpression,
  validateDictionaryStatementSql,
} from "../modules/project-dictionary/sql-engine/sqlValidator.js";
import {
  buildDictionaryExtractionScenarioVariants,
  formatDictionaryExtractionScenarioSqlComment,
  type DictionaryExtractionScenarioVariant,
} from "../modules/project-dictionary/sql-engine/scenarioPlanner.js";
import {
  buildDictionaryExtractionFieldSqlExpression,
  buildDictionaryExtractionConditionSql,
  buildDictionaryExtractionFallbackSqlExpression,
  coerceDictionaryExtractionExpressionForTarget,
  dictionaryExtractionLogicText,
  dictionaryExtractionSourceSqlExpression,
  dictionaryExtractionTableRefKeys,
  dictionaryMappingRuleLogicFingerprint,
  findDictionaryExtractionPrimaryTableSource,
  formatDictionaryExtractionSqlLiteral,
  isDictionaryExtractionDbGeneratedField,
  isDictionaryExtractionRuntimeTable,
  isDictionaryExtractionTableRef,
  isSupportedDictionaryExtractionOp,
  normalizeDictionaryExtractionKey,
  normalizeDictionaryExtractionSqlExpression,
  type DictionaryExtractionSqlContext,
  type DictionaryExtractionSqlTableSource,
} from "../modules/project-dictionary/sql-engine/expressionCompiler.js";
import { dictionaryEntityDialect, ensureDictionaryEntityPolicy } from "../modules/project-dictionary/infrastructure/policy.js";
import {
  executeDictionaryEntitySql,
  inspectDictionaryEntityTableColumns,
  openPostgresPool,
  openSqlServerPool,
} from "../modules/project-dictionary/infrastructure/databaseClient.js";
import {
  buildDictionaryEntityCreateTableSql,
  buildDictionaryEntitySyncTableSql,
  dictionaryEntityObjectParts,
  dictionaryEntityColumnMetaType,
  dictionaryEntityQualifiedTableName,
  diffDictionaryEntitySchema,
  mapDictionaryEntityColumnType,
  normalizeDictionaryEntityType,
  type DictionaryEntityColumnMeta,
} from "../modules/project-dictionary/schema/schemaSql.js";
import {
  clampDictionaryEntityPage,
  clampDictionaryEntityPageSize,
  clearDictionaryEntityRows,
  dictionaryEntityColumnName,
  dictionaryEntityString,
  insertDictionaryEntityRows,
  queryPostgresEntityRows,
  querySqlServerEntityRows,
  resolveDictionaryEntityColumnName,
  type DictionaryEntityRow,
} from "../modules/project-dictionary/test-data/entityRows.js";
import type {
  DictionaryEntityConnectionTestResult,
  DictionaryEntityExtractionPrepareResult,
  DictionaryEntityExtractionValidationIssue,
  DictionaryEntitySchemaIssue,
  DictionaryEntitySchemaStatusResult,
  DictionaryEntitySyncResult,
  DictionaryEntityTestDataQueryResult,
  DictionaryMappingSqlValidationField,
  DictionaryMappingSqlValidationResult,
} from "../modules/project-dictionary/contracts.js";
import type {
  ProjectDictionaryFieldDetail,
  ProjectDictionarySystem,
  ProjectDictionaryTable,
  ProjectManagementRepo,
} from "../repos/ProjectManagementRepo.js";

export type {
  DictionaryEntityConnectionTestResult,
  DictionaryEntityExtractionPrepareResult,
  DictionaryEntityExtractionValidationIssue,
  DictionaryEntitySchemaIssue,
  DictionaryEntitySchemaStatusResult,
  DictionaryEntitySyncResult,
  DictionaryEntityTestDataQueryResult,
  DictionaryMappingSqlValidationField,
  DictionaryMappingSqlValidationResult,
} from "../modules/project-dictionary/contracts.js";

type DictionaryMappingRuleValue = DictionaryMappingJsonRuleValue;
type DictionaryExtractionCaliberExpression = DictionaryCaliberExpression;
type DictionaryExtractionCaliberOrderExpression = DictionaryCaliberOrderExpression;
type DictionaryExtractionCaliberSelectLatest = DictionaryCaliberSelectLatest;
type DictionaryExtractionCaliberJoin = DictionaryCaliberJoin;
type DictionaryExtractionCaliberRule = DictionaryCaliberRule;

type DictionaryExtractionProcedurePlan = {
  dialect: "postgresql" | "sqlserver";
  procedureName: string;
  procedureSql: string;
  callSql: string;
  insertSql: string;
  fromSql: string;
  sourceTable: ProjectDictionaryTable;
  runtimeParamNames: string[];
  validationIssues: DictionaryEntityExtractionValidationIssue[];
  statementError: string | null;
};


export async function createDictionaryEntityTable(input: {
  system: ProjectDictionarySystem;
  table: ProjectDictionaryTable;
  fields: ProjectDictionaryFieldDetail[];
}): Promise<DictionaryEntitySyncResult> {
  const dialect = dictionaryEntityDialect(input.system);
  ensureDictionaryEntityPolicy(input.system, "create_table_allowed");
  const current = await inspectDictionaryEntityTableColumns(input.system, input.table, dialect);
  const sql = current.exists
    ? buildDictionaryEntitySyncTableSql(input.system, input.table, input.fields, dialect, current.columns)
    : buildDictionaryEntityCreateTableSql(input.system, input.table, input.fields, dialect);
  if (!sql.trim()) {
    return {
      ok: true,
      dialect,
      tableName: dictionaryEntityQualifiedTableName(input.system, input.table, dialect),
      sql: "",
      message: "实体表结构已一致，无需更新",
    };
  }
  await executeDictionaryEntitySql(input.system, sql);
  return {
    ok: true,
    dialect,
    tableName: dictionaryEntityQualifiedTableName(input.system, input.table, dialect),
    sql,
    message: current.exists ? "实体表已更新" : "实体表已创建",
  };
}

export async function inspectDictionaryEntitySchema(input: {
  system: ProjectDictionarySystem;
  table: ProjectDictionaryTable;
  fields: ProjectDictionaryFieldDetail[];
}): Promise<DictionaryEntitySchemaStatusResult> {
  const dialect = dictionaryEntityDialect(input.system);
  const current = await inspectDictionaryEntityTableColumns(input.system, input.table, dialect);
  const issues = current.exists
    ? diffDictionaryEntitySchema(input.fields, current.columns, dialect)
    : [];
  const tableName = dictionaryEntityQualifiedTableName(input.system, input.table, dialect);
  const message = current.exists
    ? issues.length
      ? `连接正常，实体表已创建，但结构有 ${issues.length} 处不一致`
      : "连接正常，实体表已创建，结构一致"
    : "连接正常，实体表尚未创建";
  return {
    ok: true,
    dialect,
    tableName,
    connectionOk: true,
    tableExists: current.exists,
    schemaSynced: current.exists && issues.length === 0,
    issues,
    message,
  };
}

export async function writeDictionaryEntityTestData(input: {
  system: ProjectDictionarySystem;
  table: ProjectDictionaryTable;
  fields: ProjectDictionaryFieldDetail[];
  rows: DictionaryEntityRow[];
}): Promise<DictionaryEntitySyncResult> {
  const dialect = dictionaryEntityDialect(input.system);
  ensureDictionaryEntityPolicy(input.system, "insert_test_data_allowed");
  const rows = input.rows.filter(row => row && typeof row === "object");
  if (rows.length === 0) throw new Error("没有可写入的测试数据");
  const fields = input.fields.filter(field => field.fieldName?.trim());
  if (fields.length === 0) throw new Error("当前表没有可写入字段");
  const result = await insertDictionaryEntityRows(input.system, input.table, fields, rows, dialect);
  return {
    ok: true,
    dialect,
    tableName: dictionaryEntityQualifiedTableName(input.system, input.table, dialect),
    sql: result.sql,
    affectedRows: result.affectedRows,
    message: `已写入 ${result.affectedRows} 行测试数据`,
  };
}

export async function testDictionaryEntityConnection(system: ProjectDictionarySystem): Promise<DictionaryEntityConnectionTestResult> {
  const dialect = dictionaryEntityDialect(system);
  const connection = system.connection;
  if (!connection?.database) throw new Error("数据库连接信息不完整：database 必填");
  if (dialect === "sqlserver") {
    const pool = await openSqlServerPool(system);
    try {
      const schema = dictionaryEntityString(connection.schema) || "dbo";
      const result = await pool.request().input("schema", schema).query("SELECT DB_NAME() AS databaseName, SCHEMA_ID(@schema) AS schemaId");
      const row = result.recordset?.[0] ?? {};
      const schemaExists = row.schemaId !== null && row.schemaId !== undefined;
      return {
        ok: true,
        dialect,
        database: dictionaryEntityString(row.databaseName) || connection.database,
        schema,
        schemaExists,
        message: schemaExists ? "数据库连接成功，Schema 可用" : "数据库连接成功，但 Schema 不存在",
      };
    } finally {
      await pool.close();
    }
  }
  const pool = openPostgresPool(system);
  try {
    const schema = dictionaryEntityString(connection.schema);
    const result = await pool.query<{ database_name: string; schema_exists: boolean }>(
      "SELECT current_database() AS database_name, CASE WHEN $1::text = '' THEN true ELSE EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1) END AS schema_exists",
      [schema],
    );
    const row = result.rows[0];
    return {
      ok: true,
      dialect,
      database: row?.database_name || connection.database,
      schema: schema || undefined,
      schemaExists: row?.schema_exists ?? true,
      message: row?.schema_exists === false ? "数据库连接成功，但 Schema 不存在" : "数据库连接成功，Schema 可用",
    };
  } finally {
    await pool.end();
  }
}

export async function queryDictionaryEntityTestData(input: {
  system: ProjectDictionarySystem;
  table: ProjectDictionaryTable;
  fields: ProjectDictionaryFieldDetail[];
  page?: number;
  pageSize?: number;
  searchFieldId?: string;
  search?: string;
}): Promise<DictionaryEntityTestDataQueryResult> {
  const dialect = dictionaryEntityDialect(input.system);
  const fields = input.fields.filter(field => field.fieldName?.trim());
  if (fields.length === 0) throw new Error("当前表没有字段元，无法查询测试数据");
  const page = clampDictionaryEntityPage(input.page);
  const pageSize = clampDictionaryEntityPageSize(input.pageSize);
  const searchText = typeof input.search === "string" ? input.search.trim() : "";
  const searchField = searchText
    ? fields.find(field => field.id === input.searchFieldId || field.fieldName === input.searchFieldId)
    : undefined;
  if (searchText && !searchField) throw new Error("请选择要搜索的字段");
  const result = dialect === "sqlserver"
    ? await querySqlServerEntityRows(input.system, input.table, fields, page, pageSize, searchField, searchText)
    : await queryPostgresEntityRows(input.system, input.table, fields, page, pageSize, searchField, searchText);
  return {
    ok: true,
    dialect,
    tableName: dictionaryEntityQualifiedTableName(input.system, input.table, dialect),
    page,
    pageSize,
    total: result.total,
    rows: result.rows,
    message: `已读取 ${result.rows.length} / ${result.total} 行测试数据`,
  };
}

export async function extractDictionaryEntityTestData(input: {
  projectId: string;
  repo: ProjectManagementRepo;
  system: ProjectDictionarySystem;
  table: ProjectDictionaryTable;
  fields: ProjectDictionaryFieldDetail[];
  limit?: number;
  runtimeParams?: Record<string, unknown>;
}): Promise<DictionaryEntitySyncResult> {
  const dialect = dictionaryEntityDialect(input.system);
  ensureDictionaryEntityPolicy(input.system, "insert_test_data_allowed");
  const targetFields = input.fields.filter(field => field.fieldName?.trim());
  if (targetFields.length === 0) throw new Error("当前表没有可写入字段");

  const procedurePlan = await buildDictionaryExtractionProcedurePlan({
    projectId: input.projectId,
    repo: input.repo,
    system: input.system,
    table: input.table,
    fields: targetFields,
    limit: input.limit,
  });
  if (procedurePlan.statementError) throw new Error(`存储过程创建失败：${procedurePlan.statementError}`);
  const missingParams = procedurePlan.runtimeParamNames.filter(name => !dictionaryExtractionRuntimeParamHasValue(name, input.runtimeParams));
  if (missingParams.length) throw new Error(`请先填写运行参数：${missingParams.join("、")}`);
  try {
    await executeDictionaryEntitySql(input.system, procedurePlan.procedureSql);
  } catch (errorValue) {
    throw new Error(`抽取存储过程创建失败，说明拼装SQL仍有程序问题：${errorValue instanceof Error ? errorValue.message : String(errorValue)}`);
  }
  try {
    await executeDictionaryEntitySql(input.system, buildDictionaryExtractionProcedureCallSql({ ...procedurePlan, system: input.system, table: input.table }, input.runtimeParams));
  } catch (errorValue) {
    throw new Error(`抽取存储过程执行失败，说明拼装SQL仍有程序问题：${errorValue instanceof Error ? errorValue.message : String(errorValue)}`);
  }
  const affectedRows = await queryDictionaryEntityRowCount(input.system, input.table, dialect);
  return {
    ok: true,
    dialect,
    tableName: dictionaryEntityQualifiedTableName(input.system, input.table, dialect),
    sql: `${procedurePlan.procedureSql}\n\n-- 执行\n${buildDictionaryExtractionProcedureCallSql({ ...procedurePlan, system: input.system, table: input.table }, input.runtimeParams)}`,
    affectedRows,
    message: procedurePlan.validationIssues.length
      ? `已从 ${procedurePlan.sourceTable.tableName} 抽取 ${affectedRows} 行测试数据，发现 ${procedurePlan.validationIssues.length} 个字段抽取问题`
      : `已从 ${procedurePlan.sourceTable.tableName} 抽取 ${affectedRows} 行测试数据`,
    validationIssues: procedurePlan.validationIssues,
  };
}

export async function prepareDictionaryEntityExtractionSql(input: {
  projectId: string;
  repo: ProjectManagementRepo;
  system: ProjectDictionarySystem;
  table: ProjectDictionaryTable;
  fields: ProjectDictionaryFieldDetail[];
  limit?: number;
  runtimeParams?: Record<string, unknown>;
}): Promise<DictionaryEntityExtractionPrepareResult> {
  const dialect = dictionaryEntityDialect(input.system);
  ensureDictionaryEntityPolicy(input.system, "insert_test_data_allowed");
  const targetFields = input.fields.filter(field => field.fieldName?.trim());
  if (targetFields.length === 0) throw new Error("当前表没有可写入字段");

  let procedurePlan: DictionaryExtractionProcedurePlan;
  try {
    procedurePlan = await buildDictionaryExtractionProcedurePlan({
      projectId: input.projectId,
      repo: input.repo,
      system: input.system,
      table: input.table,
      fields: targetFields,
      limit: input.limit,
    });
    if (!procedurePlan.statementError) await executeDictionaryEntitySql(input.system, procedurePlan.procedureSql);
  } catch (errorValue) {
    const error = errorValue instanceof Error ? errorValue.message : String(errorValue);
    return {
      ok: true,
      dialect,
      tableName: dictionaryEntityQualifiedTableName(input.system, input.table, dialect),
      ready: false,
      sql: "",
      message: `抽取存储过程创建失败：${error}`,
      runtimeParamNames: [],
      caliber: { status: "invalid", error },
      validationIssues: [],
    };
  }

  const statementError = procedurePlan.statementError;
  return {
    ok: true,
    dialect,
    tableName: dictionaryEntityQualifiedTableName(input.system, input.table, dialect),
    ready: !statementError,
    sql: procedurePlan.procedureSql,
    message: statementError
      ? `存储过程创建失败：${statementError}`
      : procedurePlan.validationIssues.length
        ? `存储过程创建完成，发现 ${procedurePlan.validationIssues.length} 个字段抽取问题，问题字段将按 NULL 或默认值抽取`
        : "存储过程创建完成",
    runtimeParamNames: procedurePlan.runtimeParamNames,
    caliber: statementError
      ? { status: "invalid", sql: procedurePlan.fromSql, error: statementError }
      : { status: "valid", sql: procedurePlan.fromSql },
    validationIssues: procedurePlan.validationIssues,
    statementError: statementError || undefined,
  };
}

async function buildDictionaryExtractionProcedurePlan(input: {
  projectId: string;
  repo: ProjectManagementRepo;
  system: ProjectDictionarySystem;
  table: ProjectDictionaryTable;
  fields: ProjectDictionaryFieldDetail[];
  limit?: number;
}): Promise<DictionaryExtractionProcedurePlan> {
  const dialect = dictionaryEntityDialect(input.system);
  const systems = await input.repo.listDictionarySystems(input.projectId);
  const tables = await input.repo.listDictionaryTables(input.projectId);
  const sourceRef = pickDictionaryExtractionSourceRef(input.table, input.fields, tables);
  if (!sourceRef) throw new Error("当前表没有可抽取的 Mapping 来源字段");
  const sourceTable = findDictionaryExtractionSourceTable(tables, sourceRef.tableName);
  if (!sourceTable) throw new Error(`找不到上游表元：${sourceRef.tableName}`);
  const sourceSystem = systems.find(system => system.id === sourceTable.systemId);
  if (!sourceSystem) throw new Error(`上游表 ${sourceTable.tableName} 未绑定库元`);
  if (dictionaryEntityDialect(sourceSystem) !== dialect) {
    throw new Error(`上游表 ${sourceTable.tableName} 与当前表数据库类型不一致，暂不能直接 SQL 抽取`);
  }

  const sourceFieldHits = await input.repo.listDictionaryFields(input.projectId, sourceTable.id);
  const sourceFields = (await Promise.all(sourceFieldHits.map(field => input.repo.getDictionaryField(input.projectId, field.id))))
    .filter((field): field is ProjectDictionaryFieldDetail => Boolean(field));
  const sourceEntityStatus = await inspectDictionaryEntityTableColumns(sourceSystem, sourceTable, dialect);
  if (!sourceEntityStatus.exists) {
    throw new Error(`上游表 ${sourceTable.tableName} 还没有创建实体表，无法走 SQL 抽取`);
  }
  const targetEntityStatus = await inspectDictionaryEntityTableColumns(input.system, input.table, dialect);
  if (!targetEntityStatus.exists) {
    throw new Error(`当前表 ${input.table.tableName} 还没有创建实体表，无法写入抽取结果`);
  }

  const limit = normalizeDictionaryExtractionLimit(input.limit);
  const variants = buildDictionaryExtractionScenarioVariants(input.table, input.fields);
  const plans = await Promise.all(variants.map(async variant => {
    const plan = await buildDictionaryExtractionInsertSelectPlan({
      projectId: input.projectId,
      repo: input.repo,
      systems,
      tables,
      system: input.system,
      table: variant.table,
      fields: variant.fields,
      sourceSystem,
      sourceTable,
      sourceFields,
      sourceColumns: sourceEntityStatus.columns,
      targetColumns: targetEntityStatus.columns,
      dialect,
      limit,
      allowMissingRuntimeParams: true,
    });
    const error = await validateDictionaryStatementSql(input.system, plan.sql, dialect);
    return { ...plan, statementError: error };
  }));
  const statementErrors = plans
    .map((plan, index) => plan.statementError ? `${variants[index]?.title || `场景${index + 1}`}：${plan.statementError}` : "")
    .filter(Boolean);
  const insertSql = plans
    .map((plan, index) => `${formatDictionaryExtractionScenarioSqlComment(variants[index], index)}\n${plan.sql}`)
    .join(";\n\n");
  const fromSql = plans
    .map((plan, index) => `${formatDictionaryExtractionScenarioSqlComment(variants[index], index)}\n${plan.fromSql}`)
    .join("\n\n");
  const validationIssues = plans.flatMap((plan, index) => plan.validationIssues.map(issue => ({
    ...issue,
    message: `${variants[index]?.title || `场景${index + 1}`}：${issue.message}`,
  })));
  const procedureName = dictionaryExtractionProcedureName(input.table);
  const runtimeParamNames = extractDictionaryExtractionRuntimeParamNames(insertSql);
  const statementError = statementErrors.length ? statementErrors.join("\n") : null;
  const procedureSql = buildDictionaryExtractionProcedureSql({
    system: input.system,
    table: input.table,
    dialect,
    procedureName,
    bodySql: insertSql,
    runtimeParamNames,
  });
  return {
    dialect,
    procedureName,
    procedureSql,
    callSql: buildDictionaryExtractionProcedureCallSql({ dialect, procedureName, runtimeParamNames, system: input.system, table: input.table }, undefined),
    insertSql,
    fromSql,
    sourceTable,
    runtimeParamNames,
    validationIssues,
    statementError,
  };
}



















function dictionaryExtractionProcedureName(table: ProjectDictionaryTable): string {
  const base = sanitizeDictionaryExtractionSqlIdentifier(dictionaryEntityString(table.extra?.entityTableName) || table.tableName || table.id);
  return `${base || "dictionary_table"}_extract_test_data`;
}

function dictionaryExtractionQualifiedProcedureName(
  system: ProjectDictionarySystem,
  table: ProjectDictionaryTable,
  procedureName: string,
  dialect: "postgresql" | "sqlserver",
): string {
  const { schema } = dictionaryEntityObjectParts(system, table, dialect);
  return [schema, procedureName]
    .filter((part): part is string => Boolean(part))
    .map(part => quoteDictionaryEntityIdentifier(part, dialect))
    .join(".");
}

function extractDictionaryExtractionRuntimeParamNames(sql: string): string[] {
  const names = new Set<string>();
  sql.replace(/(^|[^:]):([A-Za-z_][\w$]*)/g, (_match, _prefix: string, name: string) => {
    names.add(name);
    return "";
  });
  return Array.from(names);
}

function dictionaryExtractionProcedureParamName(name: string, dialect: "postgresql" | "sqlserver"): string {
  const safe = sanitizeDictionaryExtractionSqlIdentifier(name) || "param";
  return dialect === "sqlserver" ? `@${safe}` : `p_${safe.toLowerCase()}`;
}

function dictionaryExtractionRuntimeParamHasValue(name: string, runtimeParams?: Record<string, unknown>): boolean {
  const key = normalizeDictionaryExtractionKey(name);
  const entry = Object.entries(runtimeParams ?? {})
    .find(([paramName]) => normalizeDictionaryExtractionKey(paramName) === key);
  return Boolean(entry && entry[1] !== undefined && entry[1] !== null && String(entry[1]).trim() !== "");
}

function dictionaryExtractionRuntimeParamValue(name: string, runtimeParams?: Record<string, unknown>): unknown {
  const key = normalizeDictionaryExtractionKey(name);
  const entry = Object.entries(runtimeParams ?? {})
    .find(([paramName]) => normalizeDictionaryExtractionKey(paramName) === key);
  return entry?.[1];
}

function replaceDictionaryExtractionRuntimePlaceholdersForProcedure(
  sql: string,
  runtimeParamNames: string[],
  dialect: "postgresql" | "sqlserver",
): string {
  const paramByKey = new Map(runtimeParamNames.map(name => [
    normalizeDictionaryExtractionKey(name),
    dictionaryExtractionProcedureParamName(name, dialect),
  ]));
  return sql.replace(/(^|[^:]):([A-Za-z_][\w$]*)/g, (match, prefix: string, name: string) => {
    const paramName = paramByKey.get(normalizeDictionaryExtractionKey(name));
    return paramName ? `${prefix}${paramName}` : match;
  });
}

function buildDictionaryExtractionProcedureSql(input: {
  system: ProjectDictionarySystem;
  table: ProjectDictionaryTable;
  dialect: "postgresql" | "sqlserver";
  procedureName: string;
  bodySql: string;
  runtimeParamNames: string[];
}): string {
  const procedureName = dictionaryExtractionQualifiedProcedureName(input.system, input.table, input.procedureName, input.dialect);
  const clearSql = `DELETE FROM ${dictionaryEntityQualifiedTableName(input.system, input.table, input.dialect)}`;
  const bodySql = replaceDictionaryExtractionRuntimePlaceholdersForProcedure(input.bodySql, input.runtimeParamNames, input.dialect);
  const statements = [clearSql, bodySql]
    .map(statement => statement.trim().replace(/;+$/g, ""))
    .filter(Boolean)
    .join(";\n\n");
  if (input.dialect === "sqlserver") {
    const params = input.runtimeParamNames
      .map(name => `${dictionaryExtractionProcedureParamName(name, input.dialect)} NVARCHAR(MAX)`)
      .join(",\n  ");
    return [
      `CREATE OR ALTER PROCEDURE ${procedureName}${params ? `\n  ${params}` : ""}`,
      "AS",
      "BEGIN",
      "  SET NOCOUNT ON;",
      indentDictionaryExtractionSql(statements, "  ") + ";",
      "END",
    ].join("\n");
  }
  const params = input.runtimeParamNames
    .map(name => `${dictionaryExtractionProcedureParamName(name, input.dialect)} text`)
    .join(", ");
  return [
    `CREATE OR REPLACE PROCEDURE ${procedureName}(${params})`,
    "LANGUAGE plpgsql",
    "AS $dictionary_extract$",
    "BEGIN",
    indentDictionaryExtractionSql(statements, "  ") + ";",
    "END;",
    "$dictionary_extract$;",
  ].join("\n");
}

function buildDictionaryExtractionProcedureCallSql(
  plan: Pick<DictionaryExtractionProcedurePlan, "dialect" | "procedureName" | "runtimeParamNames"> & {
    system: ProjectDictionarySystem;
    table: ProjectDictionaryTable;
  },
  runtimeParams?: Record<string, unknown>,
): string {
  const procedureName = dictionaryExtractionQualifiedProcedureName(plan.system, plan.table, plan.procedureName, plan.dialect);
  if (plan.dialect === "sqlserver") {
    const params = plan.runtimeParamNames
      .map(name => `${dictionaryExtractionProcedureParamName(name, plan.dialect)} = ${formatDictionaryExtractionSqlLiteral(dictionaryExtractionRuntimeParamValue(name, runtimeParams), plan.dialect)}`)
      .join(", ");
    return `EXEC ${procedureName}${params ? ` ${params}` : ""}`;
  }
  const params = plan.runtimeParamNames
    .map(name => formatDictionaryExtractionSqlLiteral(dictionaryExtractionRuntimeParamValue(name, runtimeParams), plan.dialect))
    .join(", ");
  return `CALL ${procedureName}(${params})`;
}

function indentDictionaryExtractionSql(sql: string, prefix: string): string {
  return sql.split(/\r?\n/).map(line => `${prefix}${line}`).join("\n");
}

async function buildDictionaryExtractionInsertSelectPlan(input: {
  projectId: string;
  repo: ProjectManagementRepo;
  systems: ProjectDictionarySystem[];
  tables: ProjectDictionaryTable[];
  system: ProjectDictionarySystem;
  table: ProjectDictionaryTable;
  fields: ProjectDictionaryFieldDetail[];
  sourceSystem: ProjectDictionarySystem;
  sourceTable: ProjectDictionaryTable;
  sourceFields: ProjectDictionaryFieldDetail[];
  sourceColumns: DictionaryEntityColumnMeta[];
  targetColumns: DictionaryEntityColumnMeta[];
  dialect: "postgresql" | "sqlserver";
  limit: number | undefined;
  runtimeParams?: Record<string, unknown>;
  allowMissingRuntimeParams?: boolean;
}): Promise<{ sql: string; fromSql: string; validationIssues: DictionaryEntityExtractionValidationIssue[] }> {
  const issues: DictionaryEntityExtractionValidationIssue[] = [];
  const sourceTableSources = new Map<string, DictionaryExtractionSqlTableSource>();
  const context: DictionaryExtractionSqlContext = {
    dialect: input.dialect,
    sourceSystem: input.sourceSystem,
    sourceTable: input.sourceTable,
    sourceFields: input.sourceFields,
    sourceColumns: input.sourceColumns,
    sourceTableSources,
    targetTable: input.table,
    targetFields: input.fields,
    targetColumns: input.targetColumns,
    targetExpressions: new Map(),
    usedAliases: new Set(),
    runtimeParams: input.runtimeParams,
    allowMissingRuntimeParams: input.allowMissingRuntimeParams,
    visiting: new Set(),
  };
  const sourceCaliber = parseDictionaryCaliberRule(input.table.caliber);
  const sourceAlias = allocateDictionaryExtractionTableAlias(
    context,
    dictionaryExtractionDefaultTableAlias(input.sourceTable) || dictionaryExtractionExplicitTableAlias(sourceCaliber?.from),
  );
  registerDictionaryExtractionTableSource(sourceTableSources, {
    table: input.sourceTable,
    fields: input.sourceFields,
    columns: input.sourceColumns,
    alias: sourceAlias,
    aliases: dictionaryExtractionLegacyAliases(dictionaryExtractionExplicitTableAlias(sourceCaliber?.from)),
    primary: true,
  });
  const sourceSqlPlan = await buildDictionaryExtractionSourceSqlPlan({
    ...input,
    sourceTable: { ...input.sourceTable, caliber: input.table.caliber },
  }, context);
  const addIssue = (field: ProjectDictionaryFieldDetail, kind: DictionaryEntityExtractionValidationIssue["kind"], message: string) => {
    if (issues.some(issue => issue.fieldId === field.id && issue.kind === kind && issue.message === message)) return;
    issues.push({ kind, fieldId: field.id, fieldName: field.fieldName, fieldCn: field.fieldCn || undefined, message });
  };
  const columns: string[] = [];
  const selectExpressions: string[] = [];
  for (const field of input.fields) {
    const fieldLogic = dictionaryExtractionLogicText(field);
    if (isDictionaryExtractionDbGeneratedField(field, fieldLogic)) {
      continue;
    }
    const targetColumnName = resolveDictionaryEntityColumnName(field, input.targetColumns);
    const targetColumn = input.targetColumns.find(column => normalizeDictionaryExtractionKey(column.columnName) === normalizeDictionaryExtractionKey(targetColumnName));
    columns.push(quoteDictionaryEntityIdentifier(targetColumnName, input.dialect));
    const fallbackExpression = buildDictionaryExtractionFallbackSqlExpression(field, targetColumn, input.dialect);
    const fallbackMessage = fallbackExpression === "NULL" ? "空值" : "必填默认值";
    try {
      const expression = coerceDictionaryExtractionExpressionForTarget(
        buildDictionaryExtractionFieldSqlExpression(field, context),
        field,
        targetColumn,
        input.dialect,
      );
      const validationError = await validateDictionarySqlExpression(input.system, expression, sourceSqlPlan.fromSql, input.dialect);
      if (validationError) {
        addIssue(field, "evaluate_error", `${field.fieldName} SQL预检失败，已按${fallbackMessage}抽取：${validationError}`);
        selectExpressions.push(`${fallbackExpression} AS ${quoteDictionaryEntityIdentifier(targetColumnName, input.dialect)}`);
        continue;
      }
      selectExpressions.push(`${expression} AS ${quoteDictionaryEntityIdentifier(targetColumnName, input.dialect)}`);
    } catch (errorValue) {
      addIssue(field, errorValue instanceof SyntaxError ? "invalid_rule" : "missing_source", `${field.fieldName} 无法转换，已按${fallbackMessage}抽取：${errorValue instanceof Error ? errorValue.message : String(errorValue)}`);
      selectExpressions.push(`${fallbackExpression} AS ${quoteDictionaryEntityIdentifier(targetColumnName, input.dialect)}`);
    }
  }
  const targetTableName = dictionaryEntityQualifiedTableName(input.system, input.table, input.dialect);
  const finalLimit = input.limit ?? sourceSqlPlan.limit;
  const limitSql = finalLimit
    ? input.dialect === "sqlserver"
      ? `\nOFFSET 0 ROWS FETCH NEXT ${finalLimit} ROWS ONLY`
      : `\nLIMIT ${finalLimit}`
    : "";
  const sql = `INSERT INTO ${targetTableName} (${columns.join(", ")})\nSELECT ${selectExpressions.join(",\n       ")}\n${sourceSqlPlan.fromSql}${limitSql}`;
  return { sql, fromSql: sourceSqlPlan.fromSql, validationIssues: issues };
}

async function buildDictionaryExtractionSourceSqlPlan(
  input: {
    projectId: string;
    repo: ProjectManagementRepo;
    systems: ProjectDictionarySystem[];
    tables: ProjectDictionaryTable[];
    sourceSystem: ProjectDictionarySystem;
    sourceTable: ProjectDictionaryTable;
    dialect: "postgresql" | "sqlserver";
  },
  context: DictionaryExtractionSqlContext,
): Promise<{ fromSql: string; limit?: number }> {
  const sourceTableName = dictionaryEntityQualifiedTableName(input.sourceSystem, input.sourceTable, input.dialect);
  const caliber = parseDictionaryCaliberRule(input.sourceTable.caliber);
  const primarySource = findDictionaryExtractionPrimaryTableSource(context);
  const sourceAlias = primarySource?.alias || allocateDictionaryExtractionTableAlias(
    context,
    dictionaryExtractionDefaultTableAlias(input.sourceTable) || dictionaryExtractionExplicitTableAlias(caliber?.from),
  );
  const fallback = { fromSql: `FROM ${sourceTableName} ${quoteDictionaryEntityIdentifier(sourceAlias, input.dialect)}` };
  if (!caliber) return fallback;

  const joins: string[] = [];
  for (const [index, join] of (caliber.joins ?? []).entries()) {
    const tableRef = dictionaryCaliberTableName(join.table);
    if (!tableRef) throw new Error(`口径 joins[${index}] 缺少 table`);
    const joinTable = findDictionaryExtractionSourceTable(input.tables, tableRef);
    if (!joinTable) throw new Error(`口径 joins[${index}] 找不到表元：${tableRef}`);
    const joinSystem = input.systems.find(system => system.id === joinTable.systemId);
    if (!joinSystem) throw new Error(`口径 joins[${index}] 表 ${joinTable.tableName} 未绑定库元`);
    if (dictionaryEntityDialect(joinSystem) !== input.dialect) throw new Error(`口径 joins[${index}] 表 ${joinTable.tableName} 与当前表数据库类型不一致`);
    const joinFields = (await Promise.all((await input.repo.listDictionaryFields(input.projectId, joinTable.id))
      .map(field => input.repo.getDictionaryField(input.projectId, field.id))))
      .filter((field): field is ProjectDictionaryFieldDetail => Boolean(field));
    const joinEntityStatus = await inspectDictionaryEntityTableColumns(joinSystem, joinTable, input.dialect);
    if (!joinEntityStatus.exists) throw new Error(`口径 joins[${index}] 表 ${joinTable.tableName} 还没有创建实体表`);
    const alias = dictionaryExtractionJoinAlias(context, join, joinTable, index);
    registerDictionaryExtractionTableSource(context.sourceTableSources, {
      table: joinTable,
      fields: joinFields,
      columns: joinEntityStatus.columns,
      alias,
      aliases: dictionaryExtractionLegacyAliases(join.alias, typeof join.table === "object" ? join.table.alias : undefined),
    });
    const on = join.on ? buildDictionaryExtractionConditionSql(join.on, context.targetFields[0] ?? joinFields[0], context) : "";
    if (!on) throw new Error(`口径 joins[${index}] 缺少可转换的 on 条件`);
    const joinTableName = dictionaryEntityQualifiedTableName(joinSystem, joinTable, input.dialect);
    if (join.select_latest) {
      joins.push(formatDictionaryExtractionSelectLatestJoinSql(join, joinTableName, alias, on, context, input.dialect));
    } else {
      joins.push(`${formatDictionaryExtractionJoinType(join.type)} JOIN ${joinTableName} ${quoteDictionaryEntityIdentifier(alias, input.dialect)} ON ${on}`);
    }
  }

  const where = caliber.where ? buildDictionaryExtractionConditionSql(caliber.where, context.targetFields[0], context) : "";
  const parts = [
    fallback.fromSql,
    ...joins,
    where ? `WHERE ${where}` : "",
    formatDictionaryExtractionGroupBySql(caliber.group_by, context),
    formatDictionaryExtractionOrderBySql(caliber.order_by, context),
  ].filter(Boolean);
  return { fromSql: parts.join("\n"), limit: caliber.limit };
}

function formatDictionaryExtractionSelectLatestJoinSql(
  join: DictionaryExtractionCaliberJoin,
  joinTableName: string,
  alias: string,
  on: string,
  context: DictionaryExtractionSqlContext,
  dialect: "postgresql" | "sqlserver",
): string {
  const orderBy = formatDictionaryExtractionOrderBySql(join.select_latest?.order_by, context).replace(/^ORDER BY\s+/i, "");
  const limit = join.select_latest?.limit && join.select_latest.limit > 0 ? Math.floor(join.select_latest.limit) : 1;
  if (!orderBy) throw new Error("口径 select_latest 缺少 order_by，无法稳定取最新一条");
  const quotedAlias = quoteDictionaryEntityIdentifier(alias, dialect);
  if (dialect === "sqlserver") {
    return [
      "OUTER APPLY (",
      `  SELECT TOP (${limit}) *`,
      `  FROM ${joinTableName} ${quotedAlias}`,
      `  WHERE ${on}`,
      `  ORDER BY ${orderBy}`,
      `) ${quotedAlias}`,
    ].join("\n");
  }
  return [
    "LEFT JOIN LATERAL (",
    "  SELECT *",
    `  FROM ${joinTableName} ${quotedAlias}`,
    `  WHERE ${on}`,
    `  ORDER BY ${orderBy}`,
    `  LIMIT ${limit}`,
    `) ${quotedAlias} ON TRUE`,
  ].join("\n");
}

function registerDictionaryExtractionTableSource(sources: Map<string, DictionaryExtractionSqlTableSource>, source: DictionaryExtractionSqlTableSource): void {
  const values = [
    source.alias,
    ...(source.aliases ?? []),
    source.table.id,
    source.table.tableName,
    source.table.tableCn,
    dictionaryEntityString(source.table.extra?.entityTableName),
    dictionaryEntityString(source.table.extra?.sourceFile),
  ];
  values.forEach(value => {
    const key = normalizeDictionaryExtractionKey(value);
    if (key) sources.set(key, source);
  });
  if (source.primary) sources.set("__primary__", source);
}

function dictionaryExtractionExplicitTableAlias(value?: string | { table?: string; alias?: string }): string {
  if (typeof value === "object" && value) return sanitizeDictionaryExtractionSqlIdentifier(dictionaryEntityString(value.alias));
  const parts = dictionaryEntityString(value).split(/\s+/).filter(Boolean);
  if (parts.length > 1) return sanitizeDictionaryExtractionSqlIdentifier(parts[parts.length - 1] ?? "");
  return "";
}

function dictionaryExtractionDefaultTableAlias(table: ProjectDictionaryTable): string {
  return sanitizeDictionaryExtractionSqlIdentifier(
    table.tableName || dictionaryEntityString(table.extra?.entityTableName),
  ) || "t";
}

function allocateDictionaryExtractionTableAlias(context: DictionaryExtractionSqlContext, preferredAlias: string): string {
  const base = sanitizeDictionaryExtractionSqlIdentifier(preferredAlias) || "t";
  const taken = (value: string) => context.usedAliases.has(normalizeDictionaryExtractionKey(value));
  if (!taken(base)) {
    context.usedAliases.add(normalizeDictionaryExtractionKey(base));
    return base;
  }
  const suffixes = "abcdefghijklmnopqrstuvwxyz".split("");
  for (const suffix of suffixes) {
    const candidate = `${base}_${suffix}`;
    if (!taken(candidate)) {
      context.usedAliases.add(normalizeDictionaryExtractionKey(candidate));
      return candidate;
    }
  }
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}_${index}`;
    if (!taken(candidate)) {
      context.usedAliases.add(normalizeDictionaryExtractionKey(candidate));
      return candidate;
    }
  }
  return `${base}_${Date.now()}`;
}

function dictionaryExtractionJoinAlias(
  context: DictionaryExtractionSqlContext,
  join: DictionaryExtractionCaliberJoin,
  table: ProjectDictionaryTable,
  index: number,
): string {
  const rawAlias = dictionaryExtractionDefaultTableAlias(table) || join.alias || (typeof join.table === "object" ? join.table.alias : "") || `j${index + 1}`;
  return allocateDictionaryExtractionTableAlias(context, rawAlias || `j${index + 1}`);
}

function dictionaryExtractionLegacyAliases(...values: Array<string | undefined>): string[] {
  return values
    .map(value => sanitizeDictionaryExtractionSqlIdentifier(dictionaryEntityString(value)))
    .filter((value, index, list) => value && list.indexOf(value) === index);
}

function sanitizeDictionaryExtractionSqlIdentifier(value: string): string {
  return dictionaryEntityString(value).replace(/[^\w$]/g, "_").replace(/^[^A-Za-z_]+/, "") || "";
}

function formatDictionaryExtractionJoinType(type?: string): string {
  return dictionaryJoinType(type);
}

function formatDictionaryExtractionGroupBySql(values: DictionaryExtractionCaliberExpression[] | undefined, context: DictionaryExtractionSqlContext): string {
  const expressions = (values ?? []).flatMap(value => formatDictionaryExtractionCaliberExpressionParts(value, context)).filter(Boolean);
  return expressions.length ? `GROUP BY ${expressions.join(", ")}` : "";
}

function formatDictionaryExtractionOrderBySql(values: DictionaryExtractionCaliberOrderExpression[] | undefined, context: DictionaryExtractionSqlContext): string {
  const expressions = (values ?? []).flatMap(value => {
    const valueExpressions = formatDictionaryExtractionCaliberExpressionParts(value, context);
    if (typeof value === "string") return valueExpressions;
    const direction = value.direction?.trim().toUpperCase();
    return valueExpressions.map(expression => [expression, direction === "ASC" || direction === "DESC" ? direction : ""].filter(Boolean).join(" "));
  }).filter(Boolean);
  return expressions.length ? `ORDER BY ${expressions.join(", ")}` : "";
}

function formatDictionaryExtractionCaliberExpression(value: DictionaryExtractionCaliberExpression, context: DictionaryExtractionSqlContext): string {
  return formatDictionaryExtractionCaliberExpressionParts(value, context)[0] ?? "";
}

function formatDictionaryExtractionCaliberExpressionParts(
  value: DictionaryExtractionCaliberExpression | DictionaryExtractionCaliberOrderExpression,
  context: DictionaryExtractionSqlContext,
): string[] {
  if (typeof value === "string") return [dictionaryExtractionSourceSqlExpression(value, context)].filter(Boolean);
  if (Array.isArray(value.source)) return value.source.map(source => dictionaryExtractionSourceSqlExpression(source, context)).filter(Boolean);
  if (typeof value.source === "string" && value.source.trim()) return [dictionaryExtractionSourceSqlExpression(value.source, context)].filter(Boolean);
  const expression = dictionaryEntityString(value.expr || value.sql);
  return expression ? [normalizeDictionaryExtractionSqlExpression(expression, context)] : [];
}


export async function validateDictionaryMappingSql(input: {
  projectId: string;
  repo: ProjectManagementRepo;
  system: ProjectDictionarySystem;
  table: ProjectDictionaryTable;
  fields: ProjectDictionaryFieldDetail[];
  caliber?: string;
  fieldRules?: Array<{ fieldId: string; logic: string }>;
  runtimeParams?: Record<string, unknown>;
}): Promise<DictionaryMappingSqlValidationResult> {
  const dialect = dictionaryEntityDialect(input.system);
  const table = input.caliber === undefined ? input.table : { ...input.table, caliber: input.caliber };
  const fieldLogicById = new Map((input.fieldRules ?? [])
    .filter(rule => rule.fieldId && typeof rule.logic === "string")
    .map(rule => [rule.fieldId, rule.logic]));
  const targetFields = input.fields
    .filter(field => field.fieldName?.trim())
    .map(field => fieldLogicById.has(field.id) ? { ...field, acquireLogic: fieldLogicById.get(field.id) } : field);
  const skippedFields = targetFields.map((field): DictionaryMappingSqlValidationField => ({
    fieldId: field.id,
    fieldName: field.fieldName,
    fieldCn: field.fieldCn || undefined,
    logicFingerprint: dictionaryMappingRuleLogicFingerprint(dictionaryExtractionLogicText(field)),
    status: "skipped",
  }));

  const systems = await input.repo.listDictionarySystems(input.projectId);
  const tables = await input.repo.listDictionaryTables(input.projectId);
  const sourceRef = pickDictionaryExtractionSourceRef(table, targetFields, tables);
  if (!sourceRef) {
    return {
      ok: false,
      dialect,
      message: "当前表没有可验证的 Mapping 来源字段",
      caliber: { status: "invalid", error: "当前表没有可验证的 Mapping 来源字段" },
      fields: skippedFields,
    };
  }

  const sourceTable = findDictionaryExtractionSourceTable(tables, sourceRef.tableName);
  if (!sourceTable) {
    return {
      ok: false,
      dialect,
      message: `找不到上游表元：${sourceRef.tableName}`,
      caliber: { status: "invalid", error: `找不到上游表元：${sourceRef.tableName}` },
      fields: skippedFields,
    };
  }
  const sourceFieldHits = await input.repo.listDictionaryFields(input.projectId, sourceTable.id);
  const sourceFields = (await Promise.all(sourceFieldHits.map(field => input.repo.getDictionaryField(input.projectId, field.id))))
    .filter((field): field is ProjectDictionaryFieldDetail => Boolean(field));
  if (getDictionaryExtractionSourceKind(sourceTable) === "file") {
    try {
      const sourceRows = await readDictionaryExtractionFileRows(input.projectId, sourceTable, sourceFields, 500);
      if (sourceRows.length === 0) throw new Error(`上游文件表 ${sourceTable.tableName} 的测试文件没有可解析的数据行`);
      const issues = validateDictionaryExtractionFields(targetFields, sourceFields, sourceTable, sourceRows);
      const issuesByFieldId = new Map<string, string[]>();
      for (const issue of issues) {
        const messages = issuesByFieldId.get(issue.fieldId) ?? [];
        messages.push(issue.message);
        issuesByFieldId.set(issue.fieldId, messages);
      }
      const config = getDictionaryExtractionFileParseConfig(sourceTable);
      const fields = targetFields.map((field): DictionaryMappingSqlValidationField => {
        const errors = issuesByFieldId.get(field.id) ?? [];
        return {
          fieldId: field.id,
          fieldName: field.fieldName,
          fieldCn: field.fieldCn || undefined,
          logicFingerprint: dictionaryMappingRuleLogicFingerprint(dictionaryExtractionLogicText(field)),
          status: errors.length ? "invalid" : "valid",
          error: errors.length ? errors.join("；") : undefined,
        };
      });
      const invalidCount = fields.filter(field => field.status === "invalid").length;
      return {
        ok: invalidCount === 0,
        dialect,
        sourceKind: "file",
        message: invalidCount
          ? `文件来源验证完成，发现 ${invalidCount} 个字段映射问题`
          : `文件来源验证通过：${sourceTable.tableName} 已解析 ${sourceRows.length} 行`,
        caliber: {
          status: invalidCount ? "invalid" : "valid",
          sql: `文件来源：${sourceTable.tableName}\n解析配置：${config.encoding} / 分隔符 ${config.delimiter || "无"}\n已解析：${sourceRows.length} 行`,
          error: invalidCount ? "存在字段映射问题，请查看对应字段。" : undefined,
        },
        fields,
      };
    } catch (errorValue) {
      const error = errorValue instanceof Error ? errorValue.message : String(errorValue);
      return {
        ok: false,
        dialect,
        sourceKind: "file",
        message: `文件来源验证失败：${error}`,
        caliber: { status: "invalid", error },
        fields: skippedFields,
      };
    }
  }
  const sourceSystem = systems.find(system => system.id === sourceTable.systemId);
  if (!sourceSystem) {
    return {
      ok: false,
      dialect,
      message: `上游表 ${sourceTable.tableName} 未绑定库元`,
      caliber: { status: "invalid", error: `上游表 ${sourceTable.tableName} 未绑定库元` },
      fields: skippedFields,
    };
  }
  if (dictionaryEntityDialect(sourceSystem) !== dialect) {
    const error = `上游表 ${sourceTable.tableName} 与当前表数据库类型不一致`;
    return { ok: false, dialect, message: error, caliber: { status: "invalid", error }, fields: skippedFields };
  }

  const sourceEntityStatus = await inspectDictionaryEntityTableColumns(sourceSystem, sourceTable, dialect);
  if (!sourceEntityStatus.exists) {
    const error = `上游表 ${sourceTable.tableName} 还没有创建实体表，无法验证 Mapping SQL`;
    return { ok: false, dialect, message: error, caliber: { status: "invalid", error }, fields: skippedFields };
  }
  const targetEntityStatus = await inspectDictionaryEntityTableColumns(input.system, input.table, dialect);
  const sourceTableSources = new Map<string, DictionaryExtractionSqlTableSource>();
  const context: DictionaryExtractionSqlContext = {
    dialect,
    sourceSystem,
    sourceTable,
    sourceFields,
    sourceColumns: sourceEntityStatus.columns,
    sourceTableSources,
    targetTable: input.table,
    targetFields,
    targetColumns: targetEntityStatus.columns,
    targetExpressions: new Map(),
    usedAliases: new Set(),
    runtimeParams: input.runtimeParams,
    allowMissingRuntimeParams: true,
    visiting: new Set(),
  };
  const sourceCaliber = parseDictionaryCaliberRule(table.caliber);
  const sourceAlias = allocateDictionaryExtractionTableAlias(
    context,
    dictionaryExtractionDefaultTableAlias(sourceTable) || dictionaryExtractionExplicitTableAlias(sourceCaliber?.from),
  );
  registerDictionaryExtractionTableSource(sourceTableSources, {
    table: sourceTable,
    fields: sourceFields,
    columns: sourceEntityStatus.columns,
    alias: sourceAlias,
    aliases: dictionaryExtractionLegacyAliases(dictionaryExtractionExplicitTableAlias(sourceCaliber?.from)),
    primary: true,
  });

  let sourceSqlPlan: { fromSql: string; limit?: number };
  try {
    sourceSqlPlan = await buildDictionaryExtractionSourceSqlPlan({
      projectId: input.projectId,
      repo: input.repo,
      systems,
      tables,
      sourceSystem,
      sourceTable: { ...sourceTable, caliber: table.caliber },
      dialect,
    }, context);
  } catch (errorValue) {
    const error = errorValue instanceof Error ? errorValue.message : String(errorValue);
    return { ok: false, dialect, message: `口径SQL验证失败：${error}`, caliber: { status: "invalid", error }, fields: skippedFields };
  }

  const caliberError = await validateDictionaryCaliberSql(input.system, sourceSqlPlan.fromSql, dialect);
  if (caliberError) {
    return {
      ok: false,
      dialect,
      message: `口径SQL验证失败：${caliberError}`,
      caliber: { status: "invalid", sql: sourceSqlPlan.fromSql, error: caliberError },
      fields: skippedFields,
    };
  }

  const fields: DictionaryMappingSqlValidationField[] = [];
  for (const field of targetFields) {
    const targetColumnName = resolveDictionaryEntityColumnName(field, targetEntityStatus.columns);
    const targetColumn = targetEntityStatus.columns.find(column => normalizeDictionaryExtractionKey(column.columnName) === normalizeDictionaryExtractionKey(targetColumnName));
    try {
      const expression = coerceDictionaryExtractionExpressionForTarget(
        buildDictionaryExtractionFieldSqlExpression(field, context),
        field,
        targetColumn,
        dialect,
      );
      const sql = `${expression} AS ${quoteDictionaryEntityIdentifier(targetColumnName, dialect)}`;
      const error = await validateDictionarySqlExpression(input.system, expression, sourceSqlPlan.fromSql, dialect);
      fields.push({
        fieldId: field.id,
        fieldName: field.fieldName,
        fieldCn: field.fieldCn || undefined,
        logicFingerprint: dictionaryMappingRuleLogicFingerprint(dictionaryExtractionLogicText(field)),
        status: error ? "invalid" : "valid",
        sql,
        error: error || undefined,
      });
    } catch (errorValue) {
      fields.push({
        fieldId: field.id,
        fieldName: field.fieldName,
        fieldCn: field.fieldCn || undefined,
        logicFingerprint: dictionaryMappingRuleLogicFingerprint(dictionaryExtractionLogicText(field)),
        status: "invalid",
        error: errorValue instanceof Error ? errorValue.message : String(errorValue),
      });
    }
  }
  const invalidCount = fields.filter(field => field.status === "invalid").length;
  return {
    ok: invalidCount === 0,
    dialect,
    message: invalidCount
      ? `口径SQL验证通过，发现 ${invalidCount} 个字段SQL问题`
      : "口径和字段SQL验证通过",
    caliber: { status: "valid", sql: sourceSqlPlan.fromSql },
    fields,
  };
}

async function executeDictionaryEntityInsertSelectSql(
  system: ProjectDictionarySystem,
  sql: string,
  dialect: "postgresql" | "sqlserver",
): Promise<{ affectedRows: number }> {
  if (dialect === "sqlserver") {
    const pool = await openSqlServerPool(system);
    try {
      const result = await pool.request().query(sql);
      return { affectedRows: result.rowsAffected.reduce((sum: number, count: number) => sum + count, 0) };
    } finally {
      await pool.close();
    }
  }
  const pool = openPostgresPool(system);
  try {
    const result = await pool.query(sql);
    return { affectedRows: result.rowCount ?? 0 };
  } finally {
    await pool.end();
  }
}

async function queryDictionaryEntityRowCount(
  system: ProjectDictionarySystem,
  table: ProjectDictionaryTable,
  dialect: "postgresql" | "sqlserver",
): Promise<number> {
  const sql = `SELECT COUNT(*) AS total FROM ${dictionaryEntityQualifiedTableName(system, table, dialect)}`;
  if (dialect === "sqlserver") {
    const pool = await openSqlServerPool(system);
    try {
      const result = await pool.request().query(sql);
      return Number(result.recordset?.[0]?.total ?? 0);
    } finally {
      await pool.close();
    }
  }
  const pool = openPostgresPool(system);
  try {
    const result = await pool.query(sql);
    return Number(result.rows?.[0]?.total ?? 0);
  } finally {
    await pool.end();
  }
}




function pickDictionaryExtractionSourceRef(
  table: ProjectDictionaryTable,
  fields: ProjectDictionaryFieldDetail[],
  tables?: ProjectDictionaryTable[],
): { tableName: string; fieldName: string } | null {
  const caliberRef = pickDictionaryExtractionCaliberSourceRef(table.caliber);
  if (caliberRef && (!tables || isDictionaryExtractionValidSourceRef(caliberRef, table, tables))) return caliberRef;
  const counts = new Map<string, number>();
  const refs = fields
    .flatMap(field => dictionaryExtractionFieldRefs(field))
    .filter(ref => !tables || isDictionaryExtractionValidSourceRef(ref, table, tables));
  refs.forEach(ref => counts.set(ref.tableName, (counts.get(ref.tableName) ?? 0) + 1));
  const tableName = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  const first = refs.find(ref => ref.tableName === tableName) ?? refs[0];
  return first ?? null;
}

function pickDictionaryExtractionCaliberSourceRef(caliber?: string): { tableName: string; fieldName: string } | null {
  const text = dictionaryEntityString(caliber);
  if (!text.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    const op = typeof record.op === "string" ? normalizeDictionaryExtractionOp(record.op) : "";
    if (op !== "full_extract" && op !== "dataset" && op !== "query_scope" && op !== "scope") return null;
    const from = record.from;
    const tableName = typeof from === "string"
      ? from.trim()
      : from && typeof from === "object" && !Array.isArray(from)
        ? dictionaryEntityString((from as Record<string, unknown>).table)
        : "";
    return tableName ? { tableName, fieldName: "*" } : null;
  } catch {
    return null;
  }
}

function dictionaryExtractionFieldRefs(field: ProjectDictionaryFieldDetail): Array<{ tableName: string; fieldName: string }> {
  const refs = new Map<string, { tableName: string; fieldName: string }>();
  const add = (tableName?: string, fieldName?: string) => {
    const table = dictionaryEntityString(tableName);
    const name = dictionaryEntityString(fieldName);
    if (!name) return;
    const normalized = name.includes(".") ? name.split(".") : [table, name];
    const ref = {
      tableName: normalized.length > 1 ? normalized.slice(0, -1).join(".") || table : table,
      fieldName: normalized.at(-1) || name,
    };
    if (!ref.tableName || !ref.fieldName) return;
    refs.set(`${ref.tableName.toLowerCase()}.${ref.fieldName.toLowerCase()}`, ref);
  };
  const rule = parseDictionaryExtractionJsonRule(dictionaryExtractionLogicText(field));
  if (rule?.source) add(undefined, rule.source);
  rule?.sources?.forEach(source => add(undefined, source));
  collectDictionaryExtractionValueRefs(rule?.value).forEach(source => add(undefined, source));
  collectDictionaryExtractionValueRefs(rule?.left).forEach(source => add(undefined, source));
  collectDictionaryExtractionValueRefs(rule?.right).forEach(source => add(undefined, source));
  rule?.when?.forEach(branch => collectDictionaryExtractionConditionRefs(branch.if).forEach(source => add(undefined, source)));
  if (field.mappedField) add(field.mappedTable || field.tableName, field.mappedField);
  return Array.from(refs.values());
}

function isDictionaryExtractionValidSourceRef(
  ref: { tableName: string; fieldName: string },
  targetTable: ProjectDictionaryTable,
  tables: ProjectDictionaryTable[],
): boolean {
  if (isDictionaryExtractionRuntimeTable(ref.tableName) || isDictionaryExtractionTableRef(ref.tableName, targetTable)) return false;
  return Boolean(findDictionaryExtractionSourceTable(tables, ref.tableName));
}

function findDictionaryExtractionSourceTable(tables: ProjectDictionaryTable[], tableName: string): ProjectDictionaryTable | undefined {
  const keys = dictionaryExtractionTableRefKeys(tableName);
  return tables.find(table => [
    table.id,
    table.tableName,
    table.tableCn,
    dictionaryEntityString(table.extra?.entityTableName),
    dictionaryEntityString(table.extra?.sourceFile),
  ].some(value => {
    const normalized = normalizeDictionaryExtractionKey(value);
    return normalized && keys.includes(normalized);
  }));
}

async function readDictionaryExtractionSourceRows(
  projectId: string,
  system: ProjectDictionarySystem,
  table: ProjectDictionaryTable,
  fields: ProjectDictionaryFieldDetail[],
  limit: number | undefined,
): Promise<DictionaryEntityRow[]> {
  if (getDictionaryExtractionSourceKind(table) === "file") {
    return readDictionaryExtractionFileRows(projectId, table, fields, limit);
  }
  const pageSize = 500;
  const rows: DictionaryEntityRow[] = [];
  let page = 1;
  while (true) {
    const result = await queryDictionaryEntityTestData({ system, table, fields, page, pageSize });
    rows.push(...result.rows.map(row => row.values));
    if (limit && rows.length >= limit) return rows.slice(0, limit);
    if (rows.length >= result.total || result.rows.length === 0) return rows;
    page += 1;
  }
}

async function readDictionaryExtractionFileRows(
  projectId: string,
  table: ProjectDictionaryTable,
  fields: ProjectDictionaryFieldDetail[],
  limit: number | undefined,
): Promise<DictionaryEntityRow[]> {
  const metaPath = join(dataDir(), "project-dictionary-test-files", safeElementSlug(projectId), safeElementSlug(table.id), "metadata.json");
  let meta: { storedName?: string; fileName?: string };
  try {
    meta = JSON.parse(await readFile(metaPath, "utf8")) as { storedName?: string; fileName?: string };
  } catch {
    throw new Error(`上游文件表 ${table.tableName} 还没有上传测试文件`);
  }
  const storedName = safeFilename(meta.storedName || meta.fileName || "");
  if (!storedName) throw new Error(`上游文件表 ${table.tableName} 的测试文件记录不完整`);
  const buffer = await readFile(join(dataDir(), "project-dictionary-test-files", safeElementSlug(projectId), safeElementSlug(table.id), storedName));
  const config = getDictionaryExtractionFileParseConfig(table);
  const text = decodeDictionaryExtractionText(buffer, config.encoding);
  const lines = text
    .split(/\r\n|\n|\r/)
    .filter(line => line.length > 0);
  return (limit ? lines.slice(0, limit) : lines)
    .map(line => splitDictionaryExtractionLine(line, config.delimiter))
    .map((columns, rowIndex) => {
      const entries: Array<[string, unknown]> = fields.map((field, fieldIndex) => [
        field.fieldName,
        columns[fieldIndex] ?? "",
      ]);
      entries.push(["__lineNumber", rowIndex + 1]);
      return Object.fromEntries(entries);
    });
}

function normalizeDictionaryExtractionLimit(value: unknown): number | undefined {
  const limit = Number(value);
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : undefined;
}

function validateDictionaryExtractionFields(
  targetFields: ProjectDictionaryFieldDetail[],
  sourceFields: ProjectDictionaryFieldDetail[],
  sourceTable: ProjectDictionaryTable,
  sourceRows: DictionaryEntityRow[],
): DictionaryEntityExtractionValidationIssue[] {
  const issues: DictionaryEntityExtractionValidationIssue[] = [];
  const sourceFieldKeys = new Set(sourceFields.flatMap(field => [
    field.fieldName,
    dictionaryEntityColumnName(field),
    `${sourceTable.tableName}.${field.fieldName}`,
    `${sourceTable.tableName}.${dictionaryEntityColumnName(field)}`,
  ].map(normalizeDictionaryExtractionKey).filter(Boolean)));
  const addIssue = (field: ProjectDictionaryFieldDetail, kind: DictionaryEntityExtractionValidationIssue["kind"], message: string) => {
    if (issues.some(issue => issue.fieldId === field.id && issue.kind === kind && issue.message === message)) return;
    issues.push({
      kind,
      fieldId: field.id,
      fieldName: field.fieldName,
      fieldCn: field.fieldCn || undefined,
      message,
    });
  };

  targetFields.forEach(field => {
    const logic = dictionaryExtractionLogicText(field);
    const rule = parseDictionaryExtractionJsonRule(logic);
    if (logic.startsWith("{") && !rule) {
      addIssue(field, "invalid_rule", `${field.fieldName} Mapping 逻辑不是标准 JSON，无法解析`);
      return;
    }
    if (rule && !isSupportedDictionaryExtractionOp(rule.op)) {
      const op = normalizeDictionaryExtractionOp(rule.op);
      addIssue(field, "unsupported_op", op === "sql" || op === "expr"
        ? `${field.fieldName} 使用了 SQL 兜底动作，不能直接参与测试数据抽取；请优先改为 direct/case/code_mapping/cast/split_part 等标准动作`
        : `${field.fieldName} 使用了暂不支持的动作：${rule.op}`);
    }
    const refs = dictionaryExtractionFieldRefs(field);
    refs.forEach(ref => {
      const candidates = [
        ref.fieldName,
        `${ref.tableName}.${ref.fieldName}`,
      ].map(normalizeDictionaryExtractionKey);
      if (!candidates.some(candidate => sourceFieldKeys.has(candidate))) {
        addIssue(field, "missing_source", `${field.fieldName} 关联的上游字段不存在：${ref.tableName}.${ref.fieldName}`);
      }
    });
    if (!rule && !field.mappedField && !isDictionaryExtractionNullable(field)) {
      addIssue(field, "missing_source", `${field.fieldName} 是必填字段，但没有配置可抽取来源`);
    }

    let emptyRequiredCount = 0;
    for (let index = 0; index < sourceRows.length; index += 1) {
      try {
        const value = evaluateDictionaryExtractionField(field, sourceRows[index], sourceTable, index);
        if (!isDictionaryExtractionNullable(field) && isDictionaryExtractionEmpty(value)) emptyRequiredCount += 1;
      } catch (errorValue) {
        addIssue(field, "evaluate_error", `${field.fieldName} 抽取逻辑执行失败：${errorValue instanceof Error ? errorValue.message : String(errorValue)}`);
        break;
      }
    }
    if (emptyRequiredCount > 0) {
      addIssue(field, "empty_required", `${field.fieldName} 是必填字段，但有 ${emptyRequiredCount} 行没有抽取到值`);
    }
  });

  return issues;
}


function isDictionaryExtractionNullable(field: ProjectDictionaryFieldDetail): boolean {
  if (field.primaryKey || field.required) return false;
  return !/^(no|false|0)$/i.test(field.nullable ?? "");
}

function isDictionaryExtractionEmpty(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}



function evaluateDictionaryExtractionField(
  field: ProjectDictionaryFieldDetail,
  sourceRow: DictionaryEntityRow,
  sourceTable: ProjectDictionaryTable,
  rowIndex: number,
): unknown {
  const rule = parseDictionaryExtractionJsonRule(dictionaryExtractionLogicText(field));
  if (!rule) {
    return field.mappedField ? dictionaryExtractionSourceValue(sourceRow, field.mappedField, sourceTable) : null;
  }
  return evaluateDictionaryExtractionRule(rule, sourceRow, sourceTable, field, rowIndex);
}

function evaluateDictionaryExtractionRule(
  rule: DictionaryMappingJsonRule,
  sourceRow: DictionaryEntityRow,
  sourceTable: ProjectDictionaryTable,
  targetField: ProjectDictionaryFieldDetail,
  rowIndex: number,
): unknown {
  const op = normalizeDictionaryExtractionOp(rule.op);
  if (op === "direct") return dictionaryExtractionSourceValue(sourceRow, rule.source, sourceTable);
  if (op === "literal" || op === "default" || op === "const") return rule.value ?? null;
  if (op === "null" || op === "empty") return null;
  if (op === "random") return randomDictionaryExtractionValue(targetField, rowIndex);
  if (op === "db_generated") return rowIndex + 1;
  if (op === "code_mapping") {
    const sourceValue = stringifyDictionaryExtractionValue(dictionaryExtractionSourceValue(sourceRow, rule.source, sourceTable));
    if (rule.map && Object.prototype.hasOwnProperty.call(rule.map, sourceValue)) return rule.map[sourceValue];
    return evaluateDictionaryExtractionValue(rule.else, sourceRow, sourceTable, targetField, rowIndex);
  }
  if (op === "case") {
    for (const branch of rule.when ?? []) {
      if (evaluateDictionaryExtractionCondition(branch.if, sourceRow, sourceTable, targetField, rowIndex)) {
        return evaluateDictionaryExtractionValue(branch.then, sourceRow, sourceTable, targetField, rowIndex);
      }
    }
    return evaluateDictionaryExtractionValue(rule.else, sourceRow, sourceTable, targetField, rowIndex);
  }
  if (op === "cast") return castDictionaryExtractionValue(evaluateDictionaryExtractionValue(rule.value as DictionaryMappingRuleValue | undefined ?? (rule.source ? { source: rule.source } : undefined), sourceRow, sourceTable, targetField, rowIndex), rule.to);
  if (op === "abs_cast") return Math.abs(Number(dictionaryExtractionSourceValue(sourceRow, rule.source, sourceTable)) || 0);
  if (op === "coalesce") {
    const value = dictionaryExtractionSourceValue(sourceRow, rule.source, sourceTable);
    return isDictionaryExtractionEmpty(value)
      ? evaluateDictionaryExtractionValue(rule.default, sourceRow, sourceTable, targetField, rowIndex)
      : value;
  }
  if (op === "split_part") {
    const value = stringifyDictionaryExtractionValue(dictionaryExtractionSourceValue(sourceRow, rule.source, sourceTable));
    return value.split(rule.delimiter ?? "|")[(rule.index ?? 1) - 1] ?? "";
  }
  return null;
}

function evaluateDictionaryExtractionValue(
  value: DictionaryMappingRuleValue | undefined,
  sourceRow: DictionaryEntityRow,
  sourceTable: ProjectDictionaryTable,
  targetField: ProjectDictionaryFieldDetail,
  rowIndex: number,
): unknown {
  if (value === undefined) return null;
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if ("source" in value && value.source) return dictionaryExtractionSourceValue(sourceRow, value.source, sourceTable);
  if ("value" in value) return value.value;
  if ("op" in value && typeof value.op === "string") return evaluateDictionaryExtractionRule(value, sourceRow, sourceTable, targetField, rowIndex);
  return null;
}

function evaluateDictionaryExtractionCondition(
  condition: DictionaryMappingJsonCondition | undefined,
  sourceRow: DictionaryEntityRow,
  sourceTable: ProjectDictionaryTable,
  targetField: ProjectDictionaryFieldDetail,
  rowIndex: number,
): boolean {
  if (!condition) return false;
  if (condition.and) return condition.and.every(item => evaluateDictionaryExtractionCondition(item, sourceRow, sourceTable, targetField, rowIndex));
  if (condition.or) return condition.or.some(item => evaluateDictionaryExtractionCondition(item, sourceRow, sourceTable, targetField, rowIndex));
  if (condition.not) return !evaluateDictionaryExtractionCondition(condition.not, sourceRow, sourceTable, targetField, rowIndex);
  const left = evaluateDictionaryExtractionValue(condition.left ?? (condition.source ? { source: condition.source } : undefined), sourceRow, sourceTable, targetField, rowIndex);
  const leftText = stringifyDictionaryExtractionValue(left);
  if (condition.eq !== undefined) return leftText === stringifyDictionaryExtractionValue(evaluateDictionaryExtractionValue(condition.eq, sourceRow, sourceTable, targetField, rowIndex));
  if (condition.ne !== undefined) return leftText !== stringifyDictionaryExtractionValue(evaluateDictionaryExtractionValue(condition.ne, sourceRow, sourceTable, targetField, rowIndex));
  if (condition.in) return condition.in.map(item => stringifyDictionaryExtractionValue(evaluateDictionaryExtractionValue(item, sourceRow, sourceTable, targetField, rowIndex))).includes(leftText);
  if (condition.not_in) return !condition.not_in.map(item => stringifyDictionaryExtractionValue(evaluateDictionaryExtractionValue(item, sourceRow, sourceTable, targetField, rowIndex))).includes(leftText);
  if (condition.like !== undefined) return leftText.includes(stringifyDictionaryExtractionValue(evaluateDictionaryExtractionValue(condition.like, sourceRow, sourceTable, targetField, rowIndex)).replaceAll("%", ""));
  const leftNumber = Number(left);
  const compareNumber = (value: DictionaryMappingRuleValue | undefined) => Number(evaluateDictionaryExtractionValue(value, sourceRow, sourceTable, targetField, rowIndex));
  if (condition.gt !== undefined) return leftNumber > compareNumber(condition.gt);
  if (condition.gte !== undefined) return leftNumber >= compareNumber(condition.gte);
  if (condition.lt !== undefined) return leftNumber < compareNumber(condition.lt);
  if (condition.lte !== undefined) return leftNumber <= compareNumber(condition.lte);
  return false;
}

function dictionaryExtractionSourceValue(sourceRow: DictionaryEntityRow, ref: string | undefined, sourceTable: ProjectDictionaryTable): unknown {
  const fieldName = dictionaryEntityString(ref).split(".").filter(Boolean).at(-1) || "";
  if (!fieldName) return null;
  const candidates = [
    fieldName,
    dictionaryEntityString(ref),
    `${sourceTable.tableName}.${fieldName}`,
  ];
  const rowEntries = Object.entries(sourceRow);
  for (const candidate of candidates) {
    if (candidate in sourceRow) return sourceRow[candidate];
    const found = rowEntries.find(([key]) => normalizeDictionaryExtractionKey(key) === normalizeDictionaryExtractionKey(candidate));
    if (found) return found[1];
  }
  return null;
}



function getDictionaryExtractionSourceKind(table: ProjectDictionaryTable): "file" | "database" {
  const sourceKind = `${table.sourceKind ?? ""}`.trim().toLowerCase();
  const fileType = `${table.fileType ?? ""}`.trim().toLowerCase();
  if (/文件|file/.test(sourceKind)) return "file";
  if (fileType && fileType !== "-" && fileType !== "database") return "file";
  return "database";
}

function getDictionaryExtractionFileParseConfig(table: ProjectDictionaryTable): { encoding: string; delimiter: string } {
  const testData = dictionaryEntityRecord(table.extra?.testData);
  const fileSource = dictionaryEntityRecord(table.extra?.fileSource);
  const onegenSourceFile = dictionaryEntityRecord(table.extra?.onegenSourceFile);
  return {
    encoding: normalizeDictionaryExtractionEncoding(dictionaryEntityString(testData.encoding || fileSource.encoding || onegenSourceFile.encoding || "utf-8")),
    delimiter: normalizeDictionaryExtractionDelimiter(dictionaryEntityString(testData.delimiter || fileSource.delimiter || onegenSourceFile.delimiter || defaultDictionaryExtractionDelimiter(table))),
  };
}

function decodeDictionaryExtractionText(buffer: Buffer, encoding: string): string {
  try {
    return new TextDecoder(encoding).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "");
  }
}

function splitDictionaryExtractionLine(line: string, delimiter: string): string[] {
  if (!delimiter) return [line];
  if (delimiter === ",") return splitDictionaryExtractionCsvLine(line);
  return line.split(delimiter);
}

function splitDictionaryExtractionCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"") {
      if (quoted && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function normalizeDictionaryExtractionEncoding(value: string): string {
  const raw = value.trim().toLowerCase();
  if (/utf[-_ ]?16le|unicode/.test(raw)) return "utf-16le";
  if (/utf[-_ ]?16be/.test(raw)) return "utf-16be";
  if (/gbk|gb2312|gb18030/.test(raw)) return "gb18030";
  return "utf-8";
}

function normalizeDictionaryExtractionDelimiter(value: string): string {
  if (value === "\\t" || value.toLowerCase() === "tab") return "\t";
  if (value === "\\|") return "|";
  return value;
}

function defaultDictionaryExtractionDelimiter(table: ProjectDictionaryTable): string {
  return table.fileType?.toLowerCase() === "csv" ? "," : "|";
}


function randomDictionaryExtractionValue(field: ProjectDictionaryFieldDetail, rowIndex: number): unknown {
  const type = `${field.fieldType ?? ""}${field.fieldLength ?? ""}`;
  if (/int|number|decimal|numeric|float|double|数值|金额|数量/i.test(type)) return rowIndex + 1;
  return `${Date.now()}${String(rowIndex + 1).padStart(6, "0")}`;
}

function castDictionaryExtractionValue(value: unknown, targetType?: string): unknown {
  const type = `${targetType ?? ""}`.toLowerCase();
  if (/int|number|decimal|numeric|float|double/.test(type)) return Number(value) || 0;
  return value;
}

function stringifyDictionaryExtractionValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}


function dictionaryEntityRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
