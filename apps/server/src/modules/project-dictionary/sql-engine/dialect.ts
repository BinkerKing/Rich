import type { DictionaryDatabaseDialect } from "../index.js";

export type ImplementedDictionaryDialect = Extract<DictionaryDatabaseDialect, "postgresql" | "sqlserver">;

/**
 * Quotes a dictionary-derived identifier. Values originate in metadata, so the
 * escaping rule must be shared by all SQL-generation paths.
 */
export function quoteDictionaryEntityIdentifier(value: string, dialect: ImplementedDictionaryDialect): string {
  const safe = value.trim().replace(dialect === "sqlserver" ? /]/g : /"/g, dialect === "sqlserver" ? "]]" : "\"\"");
  return dialect === "sqlserver" ? `[${safe}]` : `"${safe}"`;
}
