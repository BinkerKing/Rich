export type DictionarySqlDialect = "postgresql" | "sqlserver";

export function formatDictionarySqlLiteral(value: string): string {
  const trimmed = value.trim();
  if (/^(null|空)$/i.test(trimmed)) return "NULL";
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return trimmed;
  if (/^'.*'$/.test(trimmed)) return trimmed;
  return `'${trimmed.replace(/'/g, "''")}'`;
}

export function buildDictionaryCoalesceCastSql(source: string, to: string, emptyAs: string, dialect: DictionarySqlDialect): string {
  return dialect === "sqlserver" ? `CAST(COALESCE(NULLIF(${source}, ''), ${emptyAs}) AS ${to})` : `COALESCE(NULLIF(${source}, ''), ${emptyAs})::${to}`;
}
export function buildDictionaryDateParseSql(source: string, format: string, dialect: DictionarySqlDialect): string {
  if (dialect === "sqlserver" && /^YYYYMMDD$/i.test(format)) return `CONVERT(date, ${source}, 112)`;
  if (dialect === "sqlserver" && /^YYYY-MM-DD$/i.test(format)) return `CONVERT(date, ${source}, 23)`;
  return `TO_DATE(${source}, '${format}')`;
}
export function buildDictionarySubstringMarkerSql(source: string, marker: string, length: number, dialect: DictionarySqlDialect): string {
  const literal = formatDictionarySqlLiteral(marker);
  return dialect === "sqlserver" ? `SUBSTRING(${source}, CHARINDEX(${literal}, ${source}), ${length})` : `SUBSTRING(${source} FROM POSITION(${literal} IN ${source}) FOR ${length})`;
}
export function buildDictionarySplitPartSql(source: string, delimiter: string, index: number, dialect: DictionarySqlDialect): string {
  return dialect === "sqlserver" ? `JSON_VALUE(CONCAT('["', REPLACE(${source}, ${formatDictionarySqlLiteral(delimiter)}, '","'), '"]'), '$[${Math.max(0, index - 1)}]')` : `SPLIT_PART(${source}, ${formatDictionarySqlLiteral(delimiter)}, ${index})`;
}
export function formatDictionaryLimitSql(limit: number | string, dialect: DictionarySqlDialect): string { return dialect === "sqlserver" ? `OFFSET 0 ROWS FETCH NEXT ${limit} ROWS ONLY` : `LIMIT ${limit}`; }
export function buildDictionaryRandomSqlExpression(kind: string, dialect: DictionarySqlDialect = "postgresql"): string {
  const normalized = kind.replace(/\s+/g, "");
  if (/uuid/i.test(normalized)) return dialect === "sqlserver" ? "NEWID()" : "gen_random_uuid()";
  return dialect === "sqlserver" ? "CAST(FLOOR(RAND(CHECKSUM(NEWID())) * 1000000000000000) AS BIGINT)" : "CAST(FLOOR(RANDOM() * 1000000000000000) AS BIGINT)";
}
export function stripDictionarySqlQuotes(value: string): string { return value.replace(/^['"]|['"]$/g, ""); }
