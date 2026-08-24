import type { ProjectDictionaryFieldDetail, ProjectDictionarySystem, ProjectDictionaryTable } from "../../../repos/ProjectManagementRepo.js";
import type { DictionaryEntitySchemaIssue } from "../contracts.js";
import { quoteDictionaryEntityIdentifier } from "../sql-engine/dialect.js";
import type { ImplementedDictionaryDialect } from "../infrastructure/policy.js";

export type DictionaryEntityColumnMeta = {
  columnName: string;
  dataType: string;
  nullable?: boolean;
  length?: number | null;
  numericPrecision?: number | null;
  numericScale?: number | null;
  datetimePrecision?: number | null;
};

const text = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
const key = (value: unknown) => text(value).replace(/[\s_.'"`\[\]-]/g, "").toLowerCase();
const columnName = (field: ProjectDictionaryFieldDetail) => text(field.extra?.entityColumnName) || field.fieldName;
function logicText(field: ProjectDictionaryFieldDetail): string {
  const value = field.acquireLogic?.trim() || "";
  if (value.startsWith("{")) return value;
  const lines = value.replace(/\r/g, "\n").split("\n");
  const label = /^(逻辑|规则|逻辑\/规则|加工逻辑|取数逻辑|条件|结果)[：:]\s*(.*)$/;
  const stop = /^(场景\s*\d+|取数范围描述|业务口径|口径说明|数据表mapping|表别名|数据字段|mapping|备注|SQL转换)[：:]/i;
  const start = lines.findIndex(line => label.test(line.trim()));
  if (start < 0) return "";
  const first = lines[start].trim().replace(label, "$2").trim();
  const values = first ? [first] : [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() && stop.test(line.trim())) break;
    values.push(line.trimEnd());
  }
  return values.join("\n").trim();
}
const normalizedOp = (value: string) => ({ "数据库生成": "db_generated" }[value.trim().replace(/\s+/g, "").toLowerCase()] || value.trim().replace(/\s+/g, "").toLowerCase());

export function buildDictionaryEntityCreateTableSql(system: ProjectDictionarySystem, table: ProjectDictionaryTable, fields: ProjectDictionaryFieldDetail[], dialect: ImplementedDictionaryDialect): string {
  const usable = fields.filter(field => field.fieldName?.trim());
  if (!usable.length) throw new Error("当前表没有字段元，无法创建实体表");
  const lines = usable.map(field => {
    const required = field.primaryKey || field.required || /^(no|false|0)$/i.test(field.nullable ?? "");
    return `  ${quoteDictionaryEntityIdentifier(columnName(field), dialect)} ${mapDictionaryEntityColumnType(field, dialect)}${required ? " NOT NULL" : ""}`;
  });
  const primary = usable.filter(field => field.primaryKey).map(field => quoteDictionaryEntityIdentifier(columnName(field), dialect));
  if (primary.length) lines.push(`  PRIMARY KEY (${primary.join(", ")})`);
  const qualified = dictionaryEntityQualifiedTableName(system, table, dialect);
  if (dialect === "sqlserver") {
    const objectName = `${text(table.extra?.entitySchema) || system.connection?.schema || "dbo"}.${text(table.extra?.entityTableName) || table.tableName}`;
    return `IF OBJECT_ID(N'${objectName.replace(/'/g, "''")}', N'U') IS NULL\nBEGIN\n  CREATE TABLE ${qualified} (\n${lines.join(",\n")}\n  );\nEND;`;
  }
  return `CREATE TABLE IF NOT EXISTS ${qualified} (\n${lines.join(",\n")}\n);`;
}

export function buildDictionaryEntitySyncTableSql(system: ProjectDictionarySystem, table: ProjectDictionaryTable, fields: ProjectDictionaryFieldDetail[], dialect: ImplementedDictionaryDialect, current: DictionaryEntityColumnMeta[]): string {
  const issues = diffDictionaryEntitySchema(fields, current, dialect);
  const fieldsByColumn = new Map(fields.filter(field => field.fieldName?.trim()).map(field => [key(columnName(field)), field]));
  const qualified = dictionaryEntityQualifiedTableName(system, table, dialect);
  const statements: string[] = [];
  for (const issue of issues) {
    if (issue.kind !== "missing") statements.push(dropColumnSql(qualified, issue.columnName, dialect));
    if (issue.kind !== "extra") {
      const field = fieldsByColumn.get(key(issue.columnName));
      if (field) statements.push(addColumnSql(qualified, field, dialect));
    }
  }
  return statements.filter((statement, index, all) => all.indexOf(statement) === index).join("\n");
}

export function diffDictionaryEntitySchema(fields: ProjectDictionaryFieldDetail[], current: DictionaryEntityColumnMeta[], dialect: ImplementedDictionaryDialect): DictionaryEntitySchemaIssue[] {
  const usable = fields.filter(field => field.fieldName?.trim());
  const currentByKey = new Map(current.map(column => [key(column.columnName), column]));
  const expectedKeys = new Set(usable.map(field => key(columnName(field))));
  const issues: DictionaryEntitySchemaIssue[] = [];
  for (const field of usable) {
    const name = columnName(field);
    const actual = currentByKey.get(key(name));
    const expectedType = mapDictionaryEntityColumnType(field, dialect);
    if (!actual) issues.push({ kind: "missing", columnName: name, fieldName: field.fieldName, expectedType, message: `缺少字段：${name}，应为 ${expectedType}` });
    else {
      const actualType = dictionaryEntityColumnMetaType(actual, dialect);
      if (normalizeDictionaryEntityType(expectedType, dialect) !== normalizeDictionaryEntityType(actualType, dialect)) issues.push({ kind: "type_mismatch", columnName: name, fieldName: field.fieldName, expectedType, actualType, message: `字段类型不一致：${name}，当前 ${actualType}，应为 ${expectedType}` });
    }
  }
  for (const column of current) if (!expectedKeys.has(key(column.columnName))) issues.push({ kind: "extra", columnName: column.columnName, actualType: dictionaryEntityColumnMetaType(column, dialect), message: `实体表多余字段：${column.columnName}` });
  return issues;
}

function addColumnSql(tableName: string, field: ProjectDictionaryFieldDetail, dialect: ImplementedDictionaryDialect): string {
  const name = columnName(field);
  const column = quoteDictionaryEntityIdentifier(name, dialect);
  const type = mapDictionaryEntityColumnType(field, dialect);
  const required = field.primaryKey || field.required || /^(no|false|0)$/i.test(field.nullable ?? "");
  const backfill = backfillSql(tableName, column, field, dialect);
  if (dialect === "sqlserver") return [`IF COL_LENGTH(N'${sqlServerLookupName(tableName)}', N'${name.replace(/'/g, "''")}') IS NULL`, "BEGIN", `  ALTER TABLE ${tableName} ADD ${column} ${type} NULL;`, required ? backfill.split("\n").map(line => `  ${line}`).join("\n") : "", required ? `  ALTER TABLE ${tableName} ALTER COLUMN ${column} ${type} NOT NULL;` : "", "END;"].filter(Boolean).join("\n");
  return [`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${column} ${type};`, required ? backfill : "", required ? `ALTER TABLE ${tableName} ALTER COLUMN ${column} SET NOT NULL;` : ""].filter(Boolean).join("\n");
}

function backfillSql(tableName: string, column: string, field: ProjectDictionaryFieldDetail, dialect: ImplementedDictionaryDialect): string {
  const logic = normalizedOp(logicText(field));
  const type = `${field.fieldType ?? ""} ${field.fieldLength ?? ""}`.toLowerCase();
  if (field.primaryKey || logic.includes("db_generated") || logic.includes("数据库生成")) return dialect === "sqlserver"
    ? `WITH numbered AS (SELECT ${column}, ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS row_number FROM ${tableName} WHERE ${column} IS NULL)\nUPDATE numbered SET ${column} = row_number;`
    : `UPDATE ${tableName} AS target SET ${column} = numbered.row_number\nFROM (SELECT ctid, ROW_NUMBER() OVER () AS row_number FROM ${tableName} WHERE ${column} IS NULL) AS numbered\nWHERE target.ctid = numbered.ctid;`;
  const value = /int|decimal|numeric|number|float|double|金额|数量/.test(type) ? "0" : /date|time/.test(type) ? dialect === "sqlserver" ? "CAST(GETDATE() AS DATE)" : "CURRENT_DATE" : /bool|bit/.test(type) ? dialect === "sqlserver" ? "0" : "FALSE" : "''";
  return `UPDATE ${tableName} SET ${column} = ${value} WHERE ${column} IS NULL;`;
}

function dropColumnSql(tableName: string, name: string, dialect: ImplementedDictionaryDialect): string {
  const column = quoteDictionaryEntityIdentifier(name, dialect);
  return dialect === "sqlserver" ? `IF COL_LENGTH(N'${sqlServerLookupName(tableName)}', N'${name.replace(/'/g, "''")}') IS NOT NULL\n  ALTER TABLE ${tableName} DROP COLUMN ${column};` : `ALTER TABLE ${tableName} DROP COLUMN IF EXISTS ${column};`;
}

function sqlServerLookupName(tableName: string): string { return tableName.split(".").map(part => part.trim().replace(/^\[/, "").replace(/\]$/, "").replace(/\]\]/g, "]")).join(".").replace(/'/g, "''"); }

export function mapDictionaryEntityColumnType(field: ProjectDictionaryFieldDetail, dialect: ImplementedDictionaryDialect): string {
  const source = (field.fieldType || "").trim().toLowerCase();
  const length = Number(field.fieldLength?.match(/\d+/)?.[0]) || null;
  const precision = field.fieldLength?.match(/(\d+)\s*[,.]\s*(\d+)/);
  const decimal = precision ? `DECIMAL(${Number(precision[1])},${Number(precision[2])})` : null;
  if (dialect === "sqlserver") {
    if (/bigint/.test(source)) return "BIGINT"; if (/\b(int|integer)\b/.test(source)) return "INT"; if (/decimal|numeric|number/.test(source)) return decimal ?? "DECIMAL(18,2)"; if (/date/.test(source) && !/time/.test(source)) return "DATE"; if (/time|datetime|timestamp/.test(source)) return "DATETIME2"; if (/bool|bit/.test(source)) return "BIT"; if (/text|clob/.test(source)) return "NVARCHAR(MAX)"; return length ? `NVARCHAR(${Math.min(length, 4000)})` : "NVARCHAR(255)";
  }
  if (/bigint/.test(source)) return "BIGINT"; if (/\b(int|integer)\b/.test(source)) return "INTEGER"; if (/decimal|numeric|number/.test(source)) return decimal ?? "NUMERIC(18,2)"; if (/date/.test(source) && !/time/.test(source)) return "DATE"; if (/time|datetime|timestamp/.test(source)) return "TIMESTAMP"; if (/bool|bit/.test(source)) return "BOOLEAN"; if (/text|clob/.test(source)) return "TEXT"; return length ? `VARCHAR(${length})` : "TEXT";
}

export function dictionaryEntityQualifiedTableName(system: ProjectDictionarySystem | undefined, table: ProjectDictionaryTable, dialect: ImplementedDictionaryDialect): string {
  const parts = dictionaryEntityObjectParts(system, table, dialect);
  return [parts.schema, parts.tableName].filter(Boolean).map(part => quoteDictionaryEntityIdentifier(part, dialect)).join(".");
}
export function dictionaryEntityObjectParts(system: ProjectDictionarySystem | undefined, table: ProjectDictionaryTable, dialect: ImplementedDictionaryDialect): { schema: string; tableName: string } {
  return { schema: text(table.extra?.entitySchema) || system?.connection?.schema || (dialect === "sqlserver" ? "dbo" : ""), tableName: text(table.extra?.entityTableName) || table.tableName };
}

export function dictionaryEntityColumnMetaType(column: DictionaryEntityColumnMeta, dialect: ImplementedDictionaryDialect): string {
  const type = column.dataType.toLowerCase();
  if (dialect === "sqlserver") { if (["nvarchar", "varchar", "nchar", "char"].includes(type)) return `${type.toUpperCase()}(${column.length === -1 || column.length == null ? "MAX" : column.length})`; if (type === "decimal" || type === "numeric") return `${type.toUpperCase()}(${column.numericPrecision ?? 18},${column.numericScale ?? 0})`; if (type === "datetime2") return "DATETIME2"; return type.toUpperCase(); }
  if (type === "character varying" || type === "varchar") return column.length ? `VARCHAR(${column.length})` : "VARCHAR"; if (type === "character" || type === "char") return column.length ? `CHAR(${column.length})` : "CHAR"; if (type === "numeric" || type === "decimal") return `${type.toUpperCase()}(${column.numericPrecision ?? 18},${column.numericScale ?? 0})`; if (type === "integer") return "INTEGER"; if (type === "bigint") return "BIGINT"; if (type.startsWith("timestamp")) return "TIMESTAMP"; return type.toUpperCase();
}

export function normalizeDictionaryEntityType(value: string, dialect: ImplementedDictionaryDialect): string {
  const match = value.trim().toLowerCase().replace(/\s+/g, " ").match(/^([a-z ]+)(?:\(([^)]+)\))?$/);
  const base = (match?.[1] ?? value).trim(); const args = match?.[2]?.replace(/\s+/g, "") ?? "";
  if (dialect === "sqlserver") { if (["nvarchar", "varchar", "nchar", "char"].includes(base)) return `${base}(${args || "max"})`; if (base === "decimal" || base === "numeric") return `${base}(${args || "18,0"})`; if (base === "datetime" || base === "datetime2") return "datetime2"; if (base === "int" || base === "integer") return "int"; return base; }
  if (base === "character varying" || base === "varchar") return args ? `varchar(${args})` : "varchar"; if (base === "character" || base === "char") return args ? `char(${args})` : "char"; if (base === "numeric" || base === "decimal") return `numeric(${args || "18,0"})`; if (base === "integer" || base === "int") return "integer"; if (base.startsWith("timestamp")) return "timestamp"; return base;
}
