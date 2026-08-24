import type { ProjectDictionarySystem } from "../../../repos/ProjectManagementRepo.js";
import { openPostgresPool, openSqlServerPool } from "../infrastructure/databaseClient.js";

export type DictionarySqlDialect = "postgresql" | "sqlserver";

export function replaceDictionaryRuntimePlaceholdersForValidation(
  sql: string,
  dialect: DictionarySqlDialect,
): string {
  const placeholder = dialect === "sqlserver" ? "CAST(N'' AS NVARCHAR(MAX))" : "''::text";
  let result = "";
  for (let index = 0; index < sql.length;) {
    const char = sql[index];
    if (char === "'" || char === '"') {
      const quote = char;
      result += char;
      index += 1;
      while (index < sql.length) {
        result += sql[index];
        if (sql[index] !== quote) {
          index += 1;
          continue;
        }
        if (sql[index + 1] === quote) {
          result += sql[index + 1];
          index += 2;
          continue;
        }
        index += 1;
        break;
      }
      continue;
    }
    const parameterMatch = sql.slice(index).match(/^:([A-Za-z_][\w$]*)/);
    if (parameterMatch && sql[index - 1] !== ":") {
      result += placeholder;
      index += parameterMatch[0].length;
      continue;
    }
    result += char;
    index += 1;
  }
  return result;
}

async function queryDictionaryValidationSql(
  system: ProjectDictionarySystem,
  sql: string,
  dialect: DictionarySqlDialect,
): Promise<string | null> {
  try {
    if (dialect === "sqlserver") {
      const pool = await openSqlServerPool(system);
      try {
        await pool.request().query(sql);
      } finally {
        await pool.close();
      }
    } else {
      const pool = openPostgresPool(system);
      try {
        await pool.query(sql);
      } finally {
        await pool.end();
      }
    }
    return null;
  } catch (errorValue) {
    return errorValue instanceof Error ? errorValue.message : String(errorValue);
  }
}

export function validateDictionarySqlExpression(
  system: ProjectDictionarySystem,
  expression: string,
  fromSql: string,
  dialect: DictionarySqlDialect,
): Promise<string | null> {
  const sql = dialect === "sqlserver"
    ? `SELECT TOP (1) ${expression} AS value ${fromSql}`
    : `SELECT ${expression} AS value ${fromSql} LIMIT 1`;
  return queryDictionaryValidationSql(
    system,
    replaceDictionaryRuntimePlaceholdersForValidation(sql, dialect),
    dialect,
  );
}

export function validateDictionaryCaliberSql(
  system: ProjectDictionarySystem,
  fromSql: string,
  dialect: DictionarySqlDialect,
): Promise<string | null> {
  const sql = dialect === "sqlserver"
    ? `SELECT TOP (1) 1 AS value ${fromSql}`
    : `SELECT 1 AS value ${fromSql} LIMIT 1`;
  return queryDictionaryValidationSql(
    system,
    replaceDictionaryRuntimePlaceholdersForValidation(sql, dialect),
    dialect,
  );
}

export function validateDictionaryStatementSql(
  system: ProjectDictionarySystem,
  sql: string,
  dialect: DictionarySqlDialect,
): Promise<string | null> {
  const validationSql = replaceDictionaryRuntimePlaceholdersForValidation(sql, dialect);
  return queryDictionaryValidationSql(
    system,
    dialect === "sqlserver"
      ? `SET PARSEONLY ON;\n${validationSql};\nSET PARSEONLY OFF;`
      : `EXPLAIN ${validationSql}`,
    dialect,
  );
}
