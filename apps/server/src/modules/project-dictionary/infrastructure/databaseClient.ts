import mssql, { type ConnectionPool } from "mssql";
import { Pool as PgPool } from "pg";
import type { ProjectDictionarySystem, ProjectDictionaryTable } from "../../../repos/ProjectManagementRepo.js";
import { dictionaryEntityDialect, type ImplementedDictionaryDialect } from "./policy.js";
import { dictionaryEntityObjectParts, type DictionaryEntityColumnMeta } from "../schema/schemaSql.js";

const stringValue = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

export function openPostgresPool(system: ProjectDictionarySystem): PgPool {
  const connection = system.connection;
  if (!connection?.host || !connection.database || !connection.username) throw new Error("PostgreSQL 连接信息不完整：host、database、username 必填");
  return new PgPool({ host: connection.host, port: connection.port || 5432, database: connection.database, user: connection.username, password: resolveDictionaryEntitySecret(connection.password || connection.secretRef), ssl: connection.ssl ? { rejectUnauthorized: false } : undefined });
}

export async function openSqlServerPool(system: ProjectDictionarySystem): Promise<ConnectionPool> {
  const connection = system.connection;
  if (!connection?.host || !connection.database || !connection.username) throw new Error("SQL Server 连接信息不完整：host、database、username 必填");
  return mssql.connect({ server: connection.host, port: connection.port || 1433, database: connection.database, user: connection.username, password: resolveDictionaryEntitySecret(connection.password || connection.secretRef), options: { encrypt: Boolean(connection.ssl), trustServerCertificate: !connection.ssl } });
}

function resolveDictionaryEntitySecret(secretRef?: string): string | undefined {
  if (!secretRef?.trim()) return undefined;
  const key = secretRef.trim().replace(/^env:\/\//, "").replace(/^env:/, "");
  return process.env[key] ?? secretRef;
}

export async function executeDictionaryEntitySql(system: ProjectDictionarySystem, sql: string): Promise<void> {
  if (!sql.trim()) return;
  if (dictionaryEntityDialect(system) === "sqlserver") {
    const pool = await openSqlServerPool(system);
    try { await pool.request().query(sql); } finally { await pool.close(); }
    return;
  }
  const pool = openPostgresPool(system);
  try { await pool.query(sql); } finally { await pool.end(); }
}

export async function inspectDictionaryEntityTableColumns(system: ProjectDictionarySystem, table: ProjectDictionaryTable, dialect: ImplementedDictionaryDialect): Promise<{ exists: boolean; columns: DictionaryEntityColumnMeta[] }> {
  if (dialect === "sqlserver") return inspectSqlServerEntityColumns(system, table);
  const parts = dictionaryEntityObjectParts(system, table, "postgresql");
  const pool = openPostgresPool(system);
  try {
    const found = await pool.query<{ exists: boolean }>("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2) AS exists", [parts.schema || "public", parts.tableName]);
    const exists = Boolean(found.rows[0]?.exists);
    if (!exists) return { exists, columns: [] };
    const result = await pool.query<{ column_name: string; data_type: string; is_nullable: string; character_maximum_length: number | null; numeric_precision: number | null; numeric_scale: number | null; datetime_precision: number | null }>(`SELECT column_name, data_type, is_nullable, character_maximum_length, numeric_precision, numeric_scale, datetime_precision FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`, [parts.schema || "public", parts.tableName]);
    return { exists, columns: result.rows.map(row => ({ columnName: row.column_name, dataType: row.data_type, nullable: row.is_nullable === "YES", length: row.character_maximum_length, numericPrecision: row.numeric_precision, numericScale: row.numeric_scale, datetimePrecision: row.datetime_precision })) };
  } finally { await pool.end(); }
}

async function inspectSqlServerEntityColumns(system: ProjectDictionarySystem, table: ProjectDictionaryTable): Promise<{ exists: boolean; columns: DictionaryEntityColumnMeta[] }> {
  const parts = dictionaryEntityObjectParts(system, table, "sqlserver");
  const pool = await openSqlServerPool(system);
  try {
    const found = await pool.request().input("schema", parts.schema || "dbo").input("table", parts.tableName).query("SELECT CASE WHEN OBJECT_ID(QUOTENAME(@schema) + '.' + QUOTENAME(@table), 'U') IS NULL THEN 0 ELSE 1 END AS existsFlag");
    const exists = Boolean(Number(found.recordset?.[0]?.existsFlag ?? 0));
    if (!exists) return { exists, columns: [] };
    const result = await pool.request().input("schema", parts.schema || "dbo").input("table", parts.tableName).query(`SELECT COLUMN_NAME AS columnName, DATA_TYPE AS dataType, IS_NULLABLE AS isNullable, CHARACTER_MAXIMUM_LENGTH AS length, NUMERIC_PRECISION AS numericPrecision, NUMERIC_SCALE AS numericScale, DATETIME_PRECISION AS datetimePrecision FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table ORDER BY ORDINAL_POSITION`);
    return { exists, columns: (result.recordset ?? []).map(row => ({ columnName: stringValue(row.columnName), dataType: stringValue(row.dataType), nullable: stringValue(row.isNullable).toUpperCase() === "YES", length: row.length == null ? null : Number(row.length), numericPrecision: row.numericPrecision == null ? null : Number(row.numericPrecision), numericScale: row.numericScale == null ? null : Number(row.numericScale), datetimePrecision: row.datetimePrecision == null ? null : Number(row.datetimePrecision) })) };
  } finally { await pool.close(); }
}
