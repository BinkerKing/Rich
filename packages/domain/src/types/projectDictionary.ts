export type DictionarySqlDialect = "postgresql" | "sqlserver" | "mysql" | "oracle";

export type DictionaryMappingJsonRuleValue = string | number | boolean | null | DictionaryMappingJsonRule | {
  source?: string;
  value?: unknown;
  expr?: string;
  sql?: string;
};

export type DictionaryMappingJsonCondition = {
  source?: string;
  left?: DictionaryMappingJsonRuleValue;
  and?: DictionaryMappingJsonCondition[];
  or?: DictionaryMappingJsonCondition[];
  not?: DictionaryMappingJsonCondition;
  comment?: string;
  remark?: string;
  description?: string;
  eq?: DictionaryMappingJsonRuleValue;
  ne?: DictionaryMappingJsonRuleValue;
  gt?: DictionaryMappingJsonRuleValue;
  gte?: DictionaryMappingJsonRuleValue;
  lt?: DictionaryMappingJsonRuleValue;
  lte?: DictionaryMappingJsonRuleValue;
  like?: DictionaryMappingJsonRuleValue;
  in?: DictionaryMappingJsonRuleValue[];
  not_in?: DictionaryMappingJsonRuleValue[];
};

export type DictionaryMappingJsonRule = {
  op: string;
  source?: string;
  sources?: string[];
  value?: unknown;
  default?: DictionaryMappingJsonRuleValue;
  map?: Record<string, unknown>;
  left?: DictionaryMappingJsonRuleValue;
  right?: DictionaryMappingJsonRuleValue;
  compare?: DictionaryMappingJsonRuleValue;
  expr?: string;
  sql?: string;
  type?: string;
  name?: string;
  to?: string;
  from?: string;
  delimiter?: string;
  index?: number;
  length?: number;
  marker?: string;
  stripQuotes?: boolean;
  emptyAs?: unknown;
  scale?: number;
  when?: Array<{ if?: DictionaryMappingJsonCondition; then?: DictionaryMappingJsonRuleValue }>;
  else?: DictionaryMappingJsonRuleValue;
};

export type DictionaryCaliberExpression = string | { source?: string | string[]; expr?: string; sql?: string };
export type DictionaryCaliberOrderExpression = string | { source?: string | string[]; expr?: string; sql?: string; direction?: string };
export type DictionaryCaliberTableReference = string | { table?: string; alias?: string };
export type DictionaryCaliberSelectLatest = {
  partition_by?: DictionaryCaliberExpression[];
  order_by?: DictionaryCaliberOrderExpression[];
  limit?: number;
};
export type DictionaryCaliberJoin = {
  type?: string;
  table?: DictionaryCaliberTableReference;
  alias?: string;
  on?: DictionaryMappingJsonCondition;
  select_latest?: DictionaryCaliberSelectLatest;
};
export type DictionaryCaliberRule = {
  op?: string;
  from?: DictionaryCaliberTableReference;
  joins?: DictionaryCaliberJoin[];
  where?: DictionaryMappingJsonCondition;
  group_by?: DictionaryCaliberExpression[];
  order_by?: DictionaryCaliberOrderExpression[];
  limit?: number;
  remark?: string;
};

export function dictionaryCaliberTableName(value?: DictionaryCaliberTableReference): string {
  return typeof value === "string" ? value.trim() : value?.table?.trim() ?? "";
}

export function dictionaryJoinType(type?: string): "LEFT" | "RIGHT" | "FULL" | "INNER" {
  const normalized = type?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "left";
  if (normalized === "right" || normalized === "right_join") return "RIGHT";
  if (normalized === "full" || normalized === "full_join") return "FULL";
  if (normalized === "inner" || normalized === "join") return "INNER";
  return "LEFT";
}

export function parseDictionaryCaliberRule(caliber?: string): DictionaryCaliberRule | null {
  const text = caliber?.trim() ?? "";
  if (!text.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const rule = parsed as DictionaryCaliberRule;
    const op = rule.op?.trim().toLowerCase().replace(/[\s-]+/g, "_") || "dataset";
    return ["full_extract", "dataset", "query_scope", "scope"].includes(op) ? { ...rule, op } : null;
  } catch {
    return null;
  }
}
