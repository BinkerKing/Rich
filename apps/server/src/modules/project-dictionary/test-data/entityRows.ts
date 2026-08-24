import type { ProjectDictionaryFieldDetail, ProjectDictionarySystem, ProjectDictionaryTable } from "../../../repos/ProjectManagementRepo.js";
import { quoteDictionaryEntityIdentifier } from "../sql-engine/dialect.js";
import { dictionaryEntityQualifiedTableName, type DictionaryEntityColumnMeta } from "../schema/schemaSql.js";
import { executeDictionaryEntitySql, inspectDictionaryEntityTableColumns, openPostgresPool, openSqlServerPool } from "../infrastructure/databaseClient.js";

export type DictionaryEntityRow = Record<string, unknown>;

export async function insertDictionaryEntityRows(
  system: ProjectDictionarySystem,
  table: ProjectDictionaryTable,
  fields: ProjectDictionaryFieldDetail[],
  rows: DictionaryEntityRow[],
  dialect: "postgresql" | "sqlserver",
): Promise<{ sql: string; affectedRows: number }> {
  const maxParameters = dialect === "sqlserver" ? 1900 : 60000;
  const batchSize = Math.max(1, Math.floor(maxParameters / Math.max(fields.length, 1)));
  const sqlParts: string[] = [];
  let affectedRows = 0;
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    const result = dialect === "sqlserver"
      ? await insertSqlServerRows(system, table, fields, batch)
      : await insertPostgresRows(system, table, fields, batch);
    affectedRows += result.affectedRows;
    if (sqlParts.length < 3) sqlParts.push(result.sql);
  }
  const suffix = rows.length > batchSize ? `\n-- 已分 ${Math.ceil(rows.length / batchSize)} 批写入` : "";
  return { sql: `${sqlParts.join(";\n")}${suffix}`, affectedRows };
}

export async function clearDictionaryEntityRows(
  system: ProjectDictionarySystem,
  table: ProjectDictionaryTable,
  dialect: "postgresql" | "sqlserver",
): Promise<string> {
  const sql = `DELETE FROM ${dictionaryEntityQualifiedTableName(system, table, dialect)}`;
  await executeDictionaryEntitySql(system, sql);
  return sql;
}

async function insertPostgresRows(
  system: ProjectDictionarySystem,
  table: ProjectDictionaryTable,
  fields: ProjectDictionaryFieldDetail[],
  rows: DictionaryEntityRow[],
): Promise<{ sql: string; affectedRows: number }> {
  const columns = fields.map(field => quoteDictionaryEntityIdentifier(dictionaryEntityColumnName(field), "postgresql"));
  const values = rows.flatMap(row => fields.map(field => dictionaryEntityRowValue(row, field)));
  const rowSql = rows.map((_, rowIndex) => {
    const offset = rowIndex * fields.length;
    return `(${fields.map((_, fieldIndex) => `$${offset + fieldIndex + 1}`).join(", ")})`;
  });
  const sql = `INSERT INTO ${dictionaryEntityQualifiedTableName(system, table, "postgresql")} (${columns.join(", ")}) VALUES ${rowSql.join(", ")}`;
  const pool = openPostgresPool(system);
  try {
    const result = await pool.query(sql, values);
    return { sql, affectedRows: result.rowCount ?? rows.length };
  } finally {
    await pool.end();
  }
}

async function insertSqlServerRows(
  system: ProjectDictionarySystem,
  table: ProjectDictionaryTable,
  fields: ProjectDictionaryFieldDetail[],
  rows: DictionaryEntityRow[],
): Promise<{ sql: string; affectedRows: number }> {
  const columns = fields.map(field => quoteDictionaryEntityIdentifier(dictionaryEntityColumnName(field), "sqlserver"));
  const rowSql = rows.map((_, rowIndex) => `(${fields.map((_, fieldIndex) => `@p${rowIndex}_${fieldIndex}`).join(", ")})`);
  const sql = `INSERT INTO ${dictionaryEntityQualifiedTableName(system, table, "sqlserver")} (${columns.join(", ")}) VALUES ${rowSql.join(", ")}`;
  const pool = await openSqlServerPool(system);
  try {
    const request = pool.request();
    rows.forEach((row, rowIndex) => {
      fields.forEach((field, fieldIndex) => {
        request.input(`p${rowIndex}_${fieldIndex}`, dictionaryEntityRowValue(row, field));
      });
    });
    const result = await request.query(sql);
    return { sql, affectedRows: result.rowsAffected.reduce((sum: number, count: number) => sum + count, 0) || rows.length };
  } finally {
    await pool.close();
  }
}

export async function queryPostgresEntityRows(
  system: ProjectDictionarySystem,
  table: ProjectDictionaryTable,
  fields: ProjectDictionaryFieldDetail[],
  page: number,
  pageSize: number,
  searchField: ProjectDictionaryFieldDetail | undefined,
  searchText: string,
): Promise<{ total: number; rows: Array<{ lineNumber: number; values: Record<string, unknown> }> }> {
  const tableName = dictionaryEntityQualifiedTableName(system, table, "postgresql");
  const current = await inspectDictionaryEntityTableColumns(system, table, "postgresql");
  const selectColumns = fields.map(field => `${quoteDictionaryEntityIdentifier(resolveDictionaryEntityColumnName(field, current.columns), "postgresql")} AS ${quoteDictionaryEntityIdentifier(field.fieldName, "postgresql")}`);
  const orderBy = quoteDictionaryEntityIdentifier(resolveDictionaryEntityColumnName(fields.find(field => field.primaryKey) ?? fields[0], current.columns), "postgresql");
  const params: unknown[] = [];
  const where = searchField && searchText
    ? ` WHERE CAST(${quoteDictionaryEntityIdentifier(resolveDictionaryEntityColumnName(searchField, current.columns), "postgresql")} AS TEXT) ILIKE $1`
    : "";
  if (where) params.push(`%${searchText}%`);
  const countSql = `SELECT COUNT(*)::int AS total FROM ${tableName}${where}`;
  const dataSql = `SELECT ${selectColumns.join(", ")} FROM ${tableName}${where} ORDER BY ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const pool = openPostgresPool(system);
  try {
    const countResult = await pool.query<{ total: number }>(countSql, params);
    const dataResult = await pool.query<Record<string, unknown>>(dataSql, [...params, pageSize, (page - 1) * pageSize]);
    return {
      total: Number(countResult.rows[0]?.total ?? 0),
      rows: dataResult.rows.map((row, index) => ({ lineNumber: (page - 1) * pageSize + index + 1, values: row })),
    };
  } finally {
    await pool.end();
  }
}

export async function querySqlServerEntityRows(
  system: ProjectDictionarySystem,
  table: ProjectDictionaryTable,
  fields: ProjectDictionaryFieldDetail[],
  page: number,
  pageSize: number,
  searchField: ProjectDictionaryFieldDetail | undefined,
  searchText: string,
): Promise<{ total: number; rows: Array<{ lineNumber: number; values: Record<string, unknown> }> }> {
  const tableName = dictionaryEntityQualifiedTableName(system, table, "sqlserver");
  const current = await inspectDictionaryEntityTableColumns(system, table, "sqlserver");
  const selectColumns = fields.map(field => `${quoteDictionaryEntityIdentifier(resolveDictionaryEntityColumnName(field, current.columns), "sqlserver")} AS ${quoteDictionaryEntityIdentifier(field.fieldName, "sqlserver")}`);
  const orderBy = quoteDictionaryEntityIdentifier(resolveDictionaryEntityColumnName(fields.find(field => field.primaryKey) ?? fields[0], current.columns), "sqlserver");
  const where = searchField && searchText
    ? ` WHERE CAST(${quoteDictionaryEntityIdentifier(resolveDictionaryEntityColumnName(searchField, current.columns), "sqlserver")} AS NVARCHAR(MAX)) LIKE @search`
    : "";
  const countSql = `SELECT COUNT(*) AS total FROM ${tableName}${where}`;
  const dataSql = `SELECT ${selectColumns.join(", ")} FROM ${tableName}${where} ORDER BY ${orderBy} OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`;
  const pool = await openSqlServerPool(system);
  try {
    const countRequest = pool.request();
    const dataRequest = pool.request();
    if (where) {
      countRequest.input("search", `%${searchText}%`);
      dataRequest.input("search", `%${searchText}%`);
    }
    dataRequest.input("offset", (page - 1) * pageSize).input("pageSize", pageSize);
    const countResult = await countRequest.query(countSql);
    const dataResult = await dataRequest.query(dataSql);
    const total = Number(countResult.recordset?.[0]?.total ?? 0);
    return {
      total,
      rows: (dataResult.recordset ?? []).map((row, index) => ({ lineNumber: (page - 1) * pageSize + index + 1, values: row })),
    };
  } finally {
    await pool.close();
  }
}

function normalizeDictionaryEntityCell(value: unknown): unknown {
  if (value === undefined || value === null || value === "(NULL)") return null;
  if (typeof value === "string" && value.trim().toUpperCase() === "NULL") return null;
  return value;
}

export function dictionaryEntityColumnName(field: ProjectDictionaryFieldDetail): string {
  return dictionaryEntityString(field.extra?.entityColumnName) || field.fieldName;
}

export function resolveDictionaryEntityColumnName(field: ProjectDictionaryFieldDetail, columns: DictionaryEntityColumnMeta[]): string {
  const configured = dictionaryEntityColumnName(field);
  const candidates = [
    configured,
    field.fieldName,
    field.fieldCn,
    toDictionaryEntitySnakeName(field.fieldName),
  ].map(normalizeDictionaryExtractionKey).filter(Boolean);
  const matched = columns.find(column => candidates.includes(normalizeDictionaryExtractionKey(column.columnName)));
  return matched?.columnName || configured;
}

function toDictionaryEntitySnakeName(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/[\s.-]+/g, "_")
    .toLowerCase();
}

function normalizeDictionaryExtractionKey(value: unknown): string {
  return dictionaryEntityString(value).replace(/[\s_.'"`\[\]-]/g, "").toLowerCase();
}

function dictionaryEntityRowValue(row: DictionaryEntityRow, field: ProjectDictionaryFieldDetail): unknown {
  const entityColumnName = dictionaryEntityColumnName(field);
  return normalizeDictionaryEntityCell(row[field.fieldName] ?? row[entityColumnName]);
}

export function clampDictionaryEntityPage(value: unknown): number {
  const page = Number(value);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function clampDictionaryEntityPageSize(value: unknown): number {
  const pageSize = Number(value);
  if (!Number.isFinite(pageSize) || pageSize <= 0) return 50;
  return Math.min(Math.max(Math.floor(pageSize), 10), 500);
}

export function dictionaryEntityString(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}
