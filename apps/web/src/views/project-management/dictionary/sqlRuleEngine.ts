import {
  dictionaryJoinType,
  type DictionaryCaliberExpression,
  type DictionaryCaliberJoin,
  type DictionaryCaliberOrderExpression,
  type DictionaryCaliberRule,
  type DictionaryCaliberSelectLatest,
  type DictionaryMappingJsonCondition,
  type DictionaryMappingJsonRule,
  type DictionaryMappingJsonRuleValue,
} from "@ke/domain";
import type { ProjectDictionaryFieldHit } from "../../../api/client.js";
import {
  buildDictionaryCoalesceCastSql,
  buildDictionaryDateParseSql,
  buildDictionaryRandomSqlExpression,
  buildDictionarySplitPartSql,
  buildDictionarySubstringMarkerSql,
  formatDictionaryLimitSql,
  formatDictionarySqlLiteral,
  stripDictionarySqlQuotes,
} from "./sqlDialectExpressions.js";
import {
  dictionaryCaliberTableName,
  dictionaryRuntimeParamName,
  normalizeDictionaryJsonOp,
  parseDictionaryCaliberJsonRuleStrict,
  parseDictionaryJsonRule,
  parseDictionaryJsonRuleStrict,
} from "./sqlRuleParser.js";

export {
  dictionaryCaliberTableName,
  dictionaryRuntimeParamName,
  normalizeDictionaryJsonOp,
  parseDictionaryCaliberJsonRuleStrict,
  parseDictionaryJsonRule,
  parseDictionaryJsonRuleStrict,
} from "./sqlRuleParser.js";

export type DictionarySourceRef = {
  label: string;
  field?: ProjectDictionaryFieldHit;
};

export type DictionarySqlConversion = {
  status: "complete" | "blocked" | "invalid";
  sql?: string;
  reason?: string;
};

export type DictionarySqlDialect = "postgresql" | "sqlserver";
export type DictionaryMappingRule = {
  field: ProjectDictionaryFieldHit;
  logic: string;
  convertedSql?: string;
  remark?: string;
  sourceRefs: DictionarySourceRef[];
};

type DictionaryMappingJsonValue = DictionaryMappingJsonRuleValue;
type DictionaryCaliberJsonRule = DictionaryCaliberRule;

export function formatDictionarySqlForDisplay(sql: string): string {
  const text = sql.trim();
  if (!text) return "";
  if (text.includes("\n")) {
    return stripDictionaryDisplayIdentifierQuotes(text
      .split(/\r?\n/)
      .map(line => line.trimEnd())
      .join("\n")
      .trim());
  }
  return stripDictionaryDisplayIdentifierQuotes(text
    .replace(/\s+/g, " ")
    .replace(/\s+(FROM)\s+/gi, "\n$1 ")
    .replace(/\s+((?:LEFT|RIGHT|FULL|INNER|CROSS)\s+JOIN(?:\s+LATERAL)?)\s+/gi, "\n$1 ")
    .replace(/\s+(JOIN\s+LATERAL)\s+/gi, "\n$1 ")
    .replace(/\s+(JOIN)\s+/gi, "\n$1 ")
    .replace(/\s+(ON)\s+/gi, "\n  $1 ")
    .replace(/\s+(WHERE)\s+/gi, "\n$1 ")
    .replace(/\s+(GROUP BY)\s+/gi, "\n$1 ")
    .replace(/\s+(ORDER BY)\s+/gi, "\n$1 ")
    .replace(/\s+(LIMIT)\s+/gi, "\n$1 ")
    .replace(/\s+(AND)\s+/gi, "\n  $1 ")
    .replace(/\s+(OR)\s+/gi, "\n  OR ")
    .replace(/\s+(ELSE)\s+/gi, "\n  $1 ")
    .replace(/\s+(END)(\s+AS\s+)/gi, "\n$1$2")
    .replace(/\s+(AS\s+[A-Za-z_][A-Za-z0-9_]*)$/i, "\n$1")
    .trim());
}

function stripDictionaryDisplayIdentifierQuotes(sql: string): string {
  return sql.replace(/"([A-Za-z_][\w$]*)"/g, "$1");
}

export function convertDictionaryMappingRuleToSql(rule: DictionaryMappingRule, dialect: DictionarySqlDialect = "postgresql"): DictionarySqlConversion {
  const target = sanitizeDictionarySqlIdentifier(rule.field.fieldName);
  if (!target) return { status: "blocked", reason: "缺少目标字段" };

  const logic = rule.logic.trim();
  if (!logic) return { status: "blocked", reason: "无法转换" };

  const jsonConversion = convertDictionaryJsonLogicToSql(logic, rule.sourceRefs, target, dialect);
  return jsonConversion ?? { status: "invalid", reason: "规则不标准：逻辑必须填写标准 JSON" };
}

export function dictionaryStoredSqlConversion(rule: DictionaryMappingRule): DictionarySqlConversion | null {
  const sql = rule.convertedSql?.trim();
  if (!sql) return null;
  if (/^(无|无法转换)$/i.test(sql)) return null;
  if (/数据库(?:\/ORM)?生成/.test(sql)) return { status: "blocked", reason: "数据库生成" };
  const target = sanitizeDictionarySqlIdentifier(rule.field.fieldName);
  if (!target) return { status: "blocked", reason: "缺少目标字段" };
  if (/\s+as\s+/i.test(sql)) return { status: "complete", sql };
  return { status: "complete", sql: `${sql} AS ${target}` };
}

function convertDictionaryJsonLogicToSql(logic: string, refs: DictionarySourceRef[], target: string, dialect: DictionarySqlDialect): DictionarySqlConversion | null {
  const parsed = parseDictionaryJsonRuleStrict(logic);
  if (!parsed.rule) {
    return parsed.error ? { status: "invalid", reason: `规则不标准：${parsed.error}` } : null;
  }
  const rule = parsed.rule;
  if (rule.op === "db_generated" || rule.op === "databasegenerated" || rule.op === "数据库生成") {
    return { status: "blocked", reason: "数据库生成" };
  }
  if (rule.op === "runtime_context" || rule.op === "运行时上下文") {
    return { status: "blocked", reason: rule.name || "依赖运行时上下文" };
  }
  if (rule.op === "manual_logic") {
    return { status: "blocked", reason: "人工逻辑，暂不自动转换" };
  }
  if (rule.op === "sql" || rule.op === "expr") {
    return { status: "blocked", reason: "SQL兜底动作，不参与自动抽取；请优先改为标准动作" };
  }
  const missingRefs = refs.filter(ref => !ref.field && !dictionaryRuntimeParamName(ref.label)).map(ref => ref.label);
  if (missingRefs.length) {
    return { status: "invalid", reason: `关联字段元不存在：${missingRefs.join("、")}` };
  }
  const expression = buildDictionaryJsonSqlExpression(rule, refs, dialect);
  return expression
    ? { status: "complete", sql: `${expression} AS ${target}` }
    : { status: "blocked", reason: `JSON规则无法转换：${rule.op || "缺少op"}` };
}


function buildDictionaryJsonSqlExpression(rule: DictionaryMappingJsonRule, refs: DictionarySourceRef[], dialect: DictionarySqlDialect = "postgresql"): string {
  switch (rule.op) {
    case "none":
    case "未赋值":
    case "-":
      return "NULL";
    case "direct":
    case "直取":
      return rule.source ? getDictionaryJsonSourceSqlName(rule.source, refs) : "";
    case "random":
    case "随机生成":
      return buildDictionaryRandomSqlExpression(rule.type || (rule.length ? `number:${rule.length}` : ""), dialect);
    case "null":
    case "empty":
    case "置空":
      return "NULL";
    case "literal":
    case "default":
    case "const":
    case "默认值":
    case "常量":
      return formatDictionarySqlLiteral(String(rule.value ?? ""));
    case "sql":
    case "expr":
    case "计算":
      return normalizeDictionarySqlExpression(rule.sql || rule.expr || "", refs);
    case "cast": {
      const source = formatDictionaryJsonSqlValue(rule.value as DictionaryMappingJsonValue | undefined, refs, dialect)
        || (rule.source ? getDictionaryJsonSourceSqlName(rule.source, refs) : "");
      return source && rule.to ? `CAST(${source} AS ${rule.to})` : "";
    }
    case "abs_cast": {
      const source = rule.source ? getDictionaryJsonSourceSqlName(rule.source, refs) : "";
      return source && rule.to ? `ABS(CAST(${source} AS ${rule.to}))` : "";
    }
    case "coalesce_cast": {
      const source = rule.source ? getDictionaryJsonSourceSqlName(rule.source, refs) : "";
      return source && rule.to ? buildDictionaryCoalesceCastSql(source, rule.to, formatDictionarySqlLiteral(typeof rule.emptyAs === "string" ? rule.emptyAs : "0"), dialect) : "";
    }
    case "coalesce": {
      const source = rule.source ? getDictionaryJsonSourceSqlName(rule.source, refs) : "";
      const defaultValue = formatDictionaryJsonSqlValue(rule.default, refs, dialect);
      return source && defaultValue ? `COALESCE(${source}, ${defaultValue})` : "";
    }
    case "date_parse": {
      const source = rule.source ? getDictionaryJsonSourceSqlName(rule.source, refs) : "";
      return source && rule.from ? buildDictionaryDateParseSql(source, rule.from, dialect) : "";
    }
    case "param":
      return rule.name ? `:${sanitizeDictionarySqlIdentifier(rule.name) || rule.name}` : "";
    case "required_lookup":
    case "lookup_or_error": {
      const source = rule.source ? getDictionaryJsonSourceSqlName(rule.source, refs) : "";
      const lookup = rule.lookup ? getDictionaryJsonSourceSqlName(rule.lookup, refs) : "";
      if (!source || !lookup) return "";
      const nonEmpty = dialect === "sqlserver" ? `CONVERT(nvarchar(max), ${source}) <> ''` : `(${source})::text <> ''`;
      return `CASE WHEN ${source} IS NOT NULL AND ${nonEmpty} THEN ${lookup} ELSE NULL END`;
    }
    case "substring_marker": {
      const source = rule.source ? getDictionaryJsonSourceSqlName(rule.source, refs) : "";
      if (!source || !rule.marker || !rule.length) return "";
      const expr = buildDictionarySubstringMarkerSql(source, rule.marker, Number(rule.length), dialect);
      return rule.stripQuotes ? `REPLACE(${expr}, '"', '')` : expr;
    }
    case "split_part":
    case "分隔取段": {
      const source = rule.source ? getDictionaryJsonSourceSqlName(rule.source, refs) : "";
      return source && rule.delimiter && rule.index ? buildDictionarySplitPartSql(source, rule.delimiter, Number(rule.index), dialect) : "";
    }
    case "round":
    case "四舍五入": {
      const value = formatDictionaryJsonSqlValue(rule.value as DictionaryMappingJsonValue | undefined, refs, dialect);
      return value ? `ROUND(${value}, ${rule.scale ?? 0})` : "";
    }
    case "divide":
    case "除法": {
      const left = formatDictionaryJsonSqlValue(rule.left, refs, dialect);
      const right = formatDictionaryJsonSqlValue(rule.right, refs, dialect);
      return left && right ? `(${left} / ${right})` : "";
    }
    case "multiply":
    case "乘法": {
      const left = formatDictionaryJsonSqlValue(rule.left, refs, dialect);
      const right = formatDictionaryJsonSqlValue(rule.right, refs, dialect);
      return left && right ? `(${left} * ${right})` : "";
    }
    case "add":
    case "加法": {
      const pieces = (rule.sources ?? []).map(source => getDictionaryJsonSourceSqlName(source, refs)).filter(Boolean);
      const left = formatDictionaryJsonSqlValue(rule.left, refs, dialect);
      const right = formatDictionaryJsonSqlValue(rule.right, refs, dialect);
      const values = pieces.length ? pieces : [left, right].filter(Boolean);
      return values.length ? `(${values.join(" + ")})` : "";
    }
    case "subtract":
    case "减法": {
      const left = formatDictionaryJsonSqlValue(rule.left, refs, dialect);
      const right = formatDictionaryJsonSqlValue(rule.right, refs, dialect);
      return left && right ? `(${left} - ${right})` : "";
    }
    case "nullif":
    case "空值保护": {
      const value = formatDictionaryJsonSqlValue(rule.value as DictionaryMappingJsonValue | undefined, refs, dialect);
      const compare = formatDictionaryJsonSqlValue(rule.compare ?? 0, refs, dialect);
      return value ? `NULLIF(${value}, ${compare || "0"})` : "";
    }
    case "concat": {
      const pieces = (rule.sources ?? []).map(source => getDictionaryJsonSourceSqlName(source, refs)).filter(Boolean);
      return pieces.length ? `CONCAT(${pieces.join(", ")})` : "";
    }
    case "code_mapping":
    case "码值映射": {
      const source = rule.source ? getDictionaryJsonSourceSqlName(rule.source, refs) : "";
      const entries = Object.entries(rule.map ?? {});
      if (!source || entries.length === 0) return "";
      const branches = entries.map(([from, to]) => `WHEN ${source} = ${formatDictionarySqlLiteral(from)} THEN ${formatDictionaryJsonSqlValue(to as DictionaryMappingJsonValue, refs, dialect)}`);
      return `CASE ${branches.join(" ")} ELSE ${formatDictionaryJsonSqlValue(rule.else, refs, dialect) || "NULL"} END`;
    }
    case "case":
    case "判断": {
      const branches = (rule.when ?? [])
        .map(branch => {
          const condition = branch.if ? buildDictionaryJsonConditionSql(branch.if, refs, dialect) : "";
          const thenValue = formatDictionaryJsonSqlValue(branch.then, refs, dialect);
          return condition && thenValue ? `WHEN ${condition} THEN ${thenValue}` : "";
        })
        .filter(Boolean);
      if (branches.length === 0) return "";
      return `CASE ${branches.join(" ")} ELSE ${formatDictionaryJsonSqlValue(rule.else, refs, dialect) || "NULL"} END`;
    }
    default:
      return "";
  }
}

function buildDictionaryJsonConditionSql(condition: DictionaryMappingJsonCondition, refs: DictionarySourceRef[], dialect: DictionarySqlDialect = "postgresql"): string {
  if (condition.and?.length) {
    const parts = condition.and.map(item => buildDictionaryJsonConditionSql(item, refs, dialect)).filter(Boolean);
    return parts.length ? parts.map(part => `(${part})`).join(" AND ") : "";
  }
  if (condition.or?.length) {
    const parts = condition.or.map(item => buildDictionaryJsonConditionSql(item, refs, dialect)).filter(Boolean);
    return parts.length ? parts.map(part => `(${part})`).join(" OR ") : "";
  }
  if (condition.not) {
    const part = buildDictionaryJsonConditionSql(condition.not, refs, dialect);
    return part ? `NOT (${part})` : "";
  }
  const left = formatDictionaryJsonSqlValue(condition.left ?? (condition.source ? { source: condition.source } : undefined), refs, dialect);
  if (!left) return "";
  const operators: Array<[keyof DictionaryMappingJsonCondition, string]> = [
    ["eq", "="],
    ["ne", "<>"],
    ["gt", ">"],
    ["gte", ">="],
    ["lt", "<"],
    ["lte", "<="],
    ["like", "LIKE"],
  ];
  if (condition.in !== undefined || condition.not_in !== undefined) {
    const values = condition.in ?? condition.not_in ?? [];
    const sqlValues = values.map(value => formatDictionaryJsonSqlValue(value, refs, dialect)).filter(Boolean);
    if (sqlValues.length === 0) return "";
    return `${left} ${condition.in !== undefined ? "IN" : "NOT IN"} (${sqlValues.join(", ")})`;
  }
  for (const [key, operator] of operators) {
    if (condition[key] !== undefined) {
      if (condition[key] === null) {
        if (key === "eq") return `${left} IS NULL`;
        if (key === "ne") return `${left} IS NOT NULL`;
      }
      const right = formatDictionaryJsonSqlValue(condition[key] as DictionaryMappingJsonValue, refs, dialect);
      return right ? `${left} ${operator} ${right}` : "";
    }
  }
  return "";
}

export function buildDictionaryCaliberSql(rule: DictionaryCaliberJsonRule, refs: DictionarySourceRef[], dialect: DictionarySqlDialect = "postgresql"): string {
  const usedAliases = new Set<string>();
  const from = formatDictionaryCaliberTable(rule.from, undefined, usedAliases);
  if (!from) return "";
  if (rule.op === "full_extract" || rule.op === "全表抽取") return `FROM ${from}`;
  const joins = (rule.joins ?? [])
    .map(join => formatDictionaryCaliberJoinSql(join, refs, dialect, usedAliases))
    .filter(Boolean);
  const where = rule.where ? buildDictionaryJsonConditionSql(rule.where, refs, dialect) : "";
  const groupBy = formatDictionaryCaliberExpressionList(rule.group_by, refs);
  const orderBy = formatDictionaryCaliberOrderList(rule.order_by, refs);
  return [
    `FROM ${from}`,
    ...joins,
    where ? `WHERE ${where}` : "",
    groupBy ? `GROUP BY ${groupBy}` : "",
    orderBy ? `ORDER BY ${orderBy}` : "",
    rule.limit ? formatDictionaryLimitSql(rule.limit, dialect) : "",
  ].filter(Boolean).join("\n");
}

function formatDictionaryCaliberJoinSql(join: DictionaryCaliberJoin, refs: DictionarySourceRef[], dialect: DictionarySqlDialect, usedAliases?: Set<string>): string {
  if (join.select_latest) return formatDictionaryCaliberSelectLatestJoinSql(join, refs, dialect, usedAliases);
  const table = formatDictionaryCaliberTable(join.table, undefined, usedAliases);
  const on = join.on ? buildDictionaryJsonConditionSql(join.on, refs, dialect) : "";
  if (!table || !on) return "";
  return `${formatDictionaryJoinType(join.type)} JOIN ${table} ON ${on}`;
}

function formatDictionaryCaliberSelectLatestJoinSql(join: DictionaryCaliberJoin, refs: DictionarySourceRef[], dialect: DictionarySqlDialect, usedAliases?: Set<string>): string {
  const tableName = dictionaryCaliberTableName(join.table);
  const alias = allocateDictionaryCaliberAlias(dictionaryCaliberDefaultAlias(tableName), usedAliases);
  const table = alias ? formatDictionaryCaliberTable(join.table, alias) : sanitizeDictionarySqlPath(tableName);
  const on = join.on ? buildDictionaryJsonConditionSql(join.on, refs, dialect) : "";
  const orderBy = formatDictionaryCaliberOrderList(join.select_latest?.order_by, refs);
  const limit = join.select_latest?.limit && join.select_latest.limit > 0 ? join.select_latest.limit : 1;
  if (!table || !alias || !on || !orderBy) return "";
  if (dialect === "sqlserver") {
    return [
      "OUTER APPLY (",
      `  SELECT TOP (${limit}) *`,
      `  FROM ${table}`,
      `  WHERE ${on}`,
      `  ORDER BY ${orderBy}`,
      `) ${alias}`,
    ].join("\n");
  }
  return [
    "LEFT JOIN LATERAL (",
    "  SELECT *",
    `  FROM ${table}`,
    `  WHERE ${on}`,
    `  ORDER BY ${orderBy}`,
    `  LIMIT ${limit}`,
    `) ${alias} ON ${on}`,
  ].join("\n");
}

export function formatDictionaryCaliberTable(value?: string | { table?: string; alias?: string }, alias?: string, usedAliases?: Set<string>): string {
  const table = dictionaryCaliberTableName(value);
  const tableAlias = alias || allocateDictionaryCaliberAlias(dictionaryCaliberDefaultAlias(table), usedAliases);
  if (!table) return "";
  return [sanitizeDictionarySqlPath(table), sanitizeDictionarySqlIdentifier(tableAlias)].filter(Boolean).join(" ");
}


function sanitizeDictionarySqlPath(value: string): string {
  return value
    .split(".")
    .map(part => sanitizeDictionarySqlIdentifier(part) || part.trim())
    .filter(Boolean)
    .join(".");
}

function dictionaryCaliberDefaultAlias(tableName: string): string {
  return sanitizeDictionarySqlIdentifier(tableName.split(".").at(-1));
}

function allocateDictionaryCaliberAlias(preferredAlias: string, usedAliases?: Set<string>): string {
  const base = sanitizeDictionarySqlIdentifier(preferredAlias) || "t";
  if (!usedAliases) return base;
  const key = base.toLowerCase();
  if (!usedAliases.has(key)) {
    usedAliases.add(key);
    return base;
  }
  const suffixes = "abcdefghijklmnopqrstuvwxyz".split("");
  for (const suffix of suffixes) {
    const candidate = `${base}_${suffix}`;
    const candidateKey = candidate.toLowerCase();
    if (!usedAliases.has(candidateKey)) {
      usedAliases.add(candidateKey);
      return candidate;
    }
  }
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}_${index}`;
    const candidateKey = candidate.toLowerCase();
    if (!usedAliases.has(candidateKey)) {
      usedAliases.add(candidateKey);
      return candidate;
    }
  }
  return `${base}_${Date.now()}`;
}

export function formatDictionaryJoinType(type?: string): string {
  return dictionaryJoinType(type);
}

function formatDictionaryCaliberExpressionList(
  values: DictionaryCaliberExpression[] | undefined,
  refs: DictionarySourceRef[],
): string {
  return (values ?? [])
    .flatMap(value => formatDictionaryCaliberExpressionParts(value, refs))
    .filter(Boolean)
    .join(", ");
}

function formatDictionaryCaliberOrderList(
  values: DictionaryCaliberOrderExpression[] | undefined,
  refs: DictionarySourceRef[],
): string {
  return (values ?? [])
    .flatMap(value => {
      const expressions = formatDictionaryCaliberExpressionParts(value, refs);
      if (typeof value === "string") return expressions;
      const direction = value.direction?.trim().toUpperCase();
      return expressions.map(expr => [expr, direction === "DESC" || direction === "ASC" ? direction : ""].filter(Boolean).join(" "));
    })
    .filter(Boolean)
    .join(", ");
}

function formatDictionaryCaliberExpressionParts(
  value: DictionaryCaliberExpression | DictionaryCaliberOrderExpression,
  refs: DictionarySourceRef[],
): string[] {
  if (typeof value === "string") return [getDictionaryJsonSourceSqlName(value, refs)].filter(Boolean);
  if (Array.isArray(value.source)) return value.source.map(source => getDictionaryJsonSourceSqlName(source, refs)).filter(Boolean);
  if (typeof value.source === "string" && value.source.trim()) return [getDictionaryJsonSourceSqlName(value.source, refs)].filter(Boolean);
  const expression = typeof value.expr === "string" && value.expr.trim()
    ? value.expr
    : typeof value.sql === "string" && value.sql.trim()
      ? value.sql
      : "";
  return expression ? [normalizeDictionarySqlExpression(expression, refs)] : [];
}

function formatDictionaryJsonSqlValue(value: DictionaryMappingJsonValue | undefined, refs: DictionarySourceRef[], dialect: DictionarySqlDialect = "postgresql"): string {
  if (value === undefined) return "";
  if (value === null) return "NULL";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return formatDictionarySqlLiteral(value);
  if ("op" in value && typeof value.op === "string") return buildDictionaryJsonSqlExpression(value, refs, dialect);
  if (value.source) return getDictionaryJsonSourceSqlName(value.source, refs);
  if (value.expr || value.sql) return normalizeDictionarySqlExpression(value.expr || value.sql || "", refs);
  return formatDictionarySqlLiteral(String(value.value ?? ""));
}

function getDictionaryJsonSourceSqlName(value: string, refs: DictionarySourceRef[]): string {
  const paramName = dictionaryRuntimeParamName(value);
  if (paramName) return dictionaryRuntimeParamSqlName(paramName);
  return getDictionaryDslFieldSqlName(value, refs);
}

function convertDictionaryDslLogicToSql(logic: string, refs: DictionarySourceRef[], target: string): DictionarySqlConversion | null {
  const action = parseDictionaryDslAction(logic);
  if (!action) return null;
  const args = parseDictionaryDslArgs(action.body);
  const firstField = args.find(arg => arg.kind === "field");
  const firstValue = args.find(arg => arg.kind === "text")?.value.trim() ?? "";

  switch (action.keyword) {
    case "直取": {
      if (!firstField) return { status: "blocked", reason: "直取缺少字段" };
      const sqlName = getDictionaryDslFieldSqlName(firstField.value, refs);
      return sqlName
        ? { status: "complete", sql: `${sqlName} AS ${target}` }
        : { status: "blocked", reason: "字段未绑定" };
    }
    case "随机生成": {
      return { status: "complete", sql: `${buildDictionaryRandomSqlExpression(firstValue)} AS ${target}` };
    }
    case "默认值":
    case "固定值":
    case "常量": {
      return { status: "complete", sql: `${formatDictionarySqlLiteral(action.body)} AS ${target}` };
    }
    case "置空": {
      return { status: "complete", sql: `NULL AS ${target}` };
    }
    case "计算":
    case "SQL": {
      return { status: "complete", sql: `${normalizeDictionarySqlExpression(action.body, refs)} AS ${target}` };
    }
    case "拼接": {
      const pieces = args.map(arg => arg.kind === "field" ? getDictionaryDslFieldSqlName(arg.value, refs) : formatDictionarySqlLiteral(arg.value.trim())).filter(Boolean);
      return pieces.length ? { status: "complete", sql: `CONCAT(${pieces.join(", ")}) AS ${target}` } : { status: "blocked", reason: "拼接缺少参数" };
    }
    case "截取": {
      if (!firstField) return { status: "blocked", reason: "截取缺少字段" };
      const sqlName = getDictionaryDslFieldSqlName(firstField.value, refs);
      const numbers = args.filter(arg => arg.kind === "text").map(arg => Number(arg.value.trim())).filter(Number.isFinite);
      return sqlName && numbers.length >= 2
        ? { status: "complete", sql: `SUBSTR(${sqlName}, ${numbers[0]}, ${numbers[1]}) AS ${target}` }
        : { status: "blocked", reason: "截取参数不足" };
    }
    case "日期转换": {
      if (!firstField) return { status: "blocked", reason: "日期转换缺少字段" };
      const sqlName = getDictionaryDslFieldSqlName(firstField.value, refs);
      const formats = args.filter(arg => arg.kind === "text").map(arg => stripDictionarySqlQuotes(arg.value.trim())).filter(Boolean);
      return sqlName && formats.length >= 2
        ? { status: "complete", sql: `TO_CHAR(TO_DATE(${sqlName}, '${formats[0]}'), '${formats[1]}') AS ${target}` }
        : { status: "blocked", reason: "日期转换参数不足" };
    }
    case "类型转换": {
      if (!firstField) return { status: "blocked", reason: "类型转换缺少字段" };
      const sqlName = getDictionaryDslFieldSqlName(firstField.value, refs);
      const typeName = getDictionaryDslBodyTailAfterField(action.body, firstField.value);
      return sqlName && typeName
        ? { status: "complete", sql: `CAST(${sqlName} AS ${typeName}) AS ${target}` }
        : { status: "blocked", reason: "类型转换参数不足" };
    }
    case "判断": {
      return { status: "complete", sql: `${normalizeDictionarySqlExpression(action.body, refs)} AS ${target}` };
    }
    case "聚合":
    case "求和":
    case "计数":
    case "最大值":
    case "最小值": {
      return { status: "complete", sql: `${normalizeDictionarySqlExpression(action.body, refs)} AS ${target}` };
    }
    default:
      return { status: "blocked", reason: `未知动作：${action.keyword}` };
  }
}

function parseDictionaryDslAction(logic: string): { keyword: string; body: string } | null {
  const match = logic.trim().match(/^[【\[]\s*([^】\]]+?)\s*[】\]]\s*([\s\S]*)$/);
  if (!match) return null;
  return { keyword: match[1].replace(/\s+/g, ""), body: match[2].trim() };
}

type DictionaryDslArg = { kind: "field" | "text"; value: string };

function parseDictionaryDslArgs(body: string): DictionaryDslArg[] {
  const args: DictionaryDslArg[] = [];
  const pattern = /\{([^}]+)\}|([^,，]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    if (match[1]) args.push({ kind: "field", value: match[1].trim() });
    else if (match[2]?.trim()) args.push({ kind: "text", value: match[2].trim() });
  }
  return args;
}

function getDictionaryDslFieldSqlName(value: string, refs: DictionarySourceRef[]): string {
  const text = value.trim();
  const paramName = dictionaryRuntimeParamName(text);
  if (paramName) return dictionaryRuntimeParamSqlName(paramName);
  const normalized = normalizeDictionaryRefKey(text);
  const ref = refs.find(item => buildDictionaryLogicRefCandidates([item])
    .some(candidate => normalizeDictionaryRefKey(candidate.token) === normalized));
  if (ref) return getDictionarySourceRefSqlName(ref);
  if (text.includes(".")) return "";
  return isSimpleDictionarySqlSource(text) ? text : "";
}


function dictionaryRuntimeParamSqlName(name: string): string {
  const safeName = sanitizeDictionarySqlIdentifier(name);
  return safeName ? `:${safeName}` : "";
}

function replaceDictionaryRuntimeParamSqlRefs(text: string): string {
  return text
    .replace(/(^|[^\w$"'])(参数|入参)[.\s:：]+([A-Za-z_][\w$]*)\b/g, (match, prefix, _label, name) => `${prefix}${dictionaryRuntimeParamSqlName(name) || match}`)
    .replace(/(^|[^\w$"'])(param|params|runtime|runtime_context)[.:：]+([A-Za-z_][\w$]*)\b/gi, (match, prefix, _label, name) => `${prefix}${dictionaryRuntimeParamSqlName(name) || match}`);
}

function getDictionaryDslBodyTailAfterField(body: string, fieldValue: string): string {
  const escaped = fieldValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return stripDictionarySqlQuotes(body.replace(new RegExp(`^\\s*\\{${escaped}\\}\\s*[,，]?\\s*`), "").trim());
}

function isDictionaryDirectMappingLogic(logic: string): boolean {
  const normalized = logic
    .replace(/\s+/g, "")
    .replace(/[：:]+$/, "");
  return /^(直取|直接取数|源字段直取|按涉及字段直取|按源字段直取|字段直取)$/.test(normalized);
}

function getSingleDictionarySourceRefSqlName(refs: DictionarySourceRef[]): string {
  if (refs.length !== 1) return "";
  return getDictionarySourceRefSqlName(refs[0]);
}

function buildDictionaryStandardActionSqlExpression(logic: string, refs: DictionarySourceRef[]): string {
  const sqlRefs = refs.map(getDictionarySourceRefSqlName).filter(Boolean);
  const normalized = logic.replace(/\s+/g, "");
  if (sqlRefs.length === 0) return "";

  if (/^(默认空|置空|空值|NULL)$/i.test(normalized)) return "NULL";

  if (/拼接|合并|\bconcat\b/i.test(logic) && sqlRefs.length > 1) {
    return `CONCAT(${sqlRefs.join(", ")})`;
  }

  if (/求和|相加|合计|汇总|\bsum\b/i.test(logic)) {
    if (/汇总|聚合|\bsum\b/i.test(logic) && sqlRefs.length === 1) return `SUM(${sqlRefs[0]})`;
    if (sqlRefs.length > 1) return `(${sqlRefs.join(" + ")})`;
  }

  if (/计数|\bcount\b/i.test(logic) && sqlRefs.length === 1) return `COUNT(${sqlRefs[0]})`;
  if (/最大|\bmax\b/i.test(logic) && sqlRefs.length === 1) return `MAX(${sqlRefs[0]})`;
  if (/最小|\bmin\b/i.test(logic) && sqlRefs.length === 1) return `MIN(${sqlRefs[0]})`;

  const substrExpr = buildDictionarySubstringSqlExpression(logic, sqlRefs[0]);
  if (substrExpr) return substrExpr;

  const dateExpr = buildDictionaryDateFormatSqlExpression(logic, sqlRefs[0]);
  if (dateExpr) return dateExpr;

  return "";
}

function buildDictionarySubstringSqlExpression(logic: string, sqlRef: string): string {
  if (!/截取|取前|取后|substr|substring/i.test(logic)) return "";
  const range = logic.match(/第?\s*(\d+)\s*(?:-|到|至|~)\s*(\d+)\s*位/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) return `SUBSTR(${sqlRef}, ${start}, ${end - start + 1})`;
  }
  const prefix = logic.match(/(?:前|左)\s*(\d+)\s*位/);
  if (prefix) return `SUBSTR(${sqlRef}, 1, ${Number(prefix[1])})`;
  const suffix = logic.match(/(?:后|右)\s*(\d+)\s*位/);
  if (suffix) return `SUBSTR(${sqlRef}, LENGTH(${sqlRef}) - ${Number(suffix[1]) - 1}, ${Number(suffix[1])})`;
  return "";
}

function buildDictionaryDateFormatSqlExpression(logic: string, sqlRef: string): string {
  if (!/日期|时间|to_date|to_char|格式/i.test(logic)) return "";
  if (/YYYY-MM-DD|yyyy-mm-dd/i.test(logic)) return `TO_CHAR(TO_DATE(${sqlRef}, 'YYYYMMDD'), 'YYYY-MM-DD')`;
  if (/YYYYMMDD|yyyymmdd/i.test(logic)) return `TO_CHAR(TO_DATE(${sqlRef}, 'YYYY-MM-DD'), 'YYYYMMDD')`;
  return "";
}

function buildDictionaryConditionSqlExpression(logic: string, refs: DictionarySourceRef[]): string {
  const explicitCase = logic.match(/(?:如果|若|当)([\s\S]+?)(?:则|那么)([\s\S]+?)(?:否则|否则为)([\s\S]+)$/);
  const shortCase = explicitCase ?? logic.match(/条件[：:]?([\s\S]+?)结果[：:]?([\s\S]+?)(?:否则[：:]?([\s\S]+))?$/);
  if (!shortCase) return "";
  const condition = normalizeDictionarySqlExpression(shortCase[1].trim(), refs);
  const thenValue = formatDictionarySqlValueOrExpression(shortCase[2].trim(), refs);
  const elseValue = formatDictionarySqlValueOrExpression((shortCase[3] ?? "NULL").trim(), refs);
  if (!condition || !thenValue) return "";
  return `CASE WHEN ${condition} THEN ${thenValue} ELSE ${elseValue} END`;
}

function formatDictionarySqlValueOrExpression(value: string, refs: DictionarySourceRef[]): string {
  const cleaned = stripDictionaryLogicPrefix(value, ["结果", "取值", "为", "返回"]);
  if (!cleaned) return "NULL";
  if (canTreatDictionaryLogicAsSqlExpression(cleaned, refs)) return normalizeDictionarySqlExpression(cleaned, refs);
  return formatDictionarySqlLiteral(cleaned);
}

function canTreatDictionaryLogicAsSqlExpression(value: string, refs: DictionarySourceRef[]): boolean {
  if (isDictionarySqlExpression(value)) return true;
  const normalized = normalizeDictionaryRefKey(value);
  return refs.some(ref => buildDictionaryLogicRefCandidates([ref])
    .some(candidate => normalizeDictionaryRefKey(candidate.token) === normalized));
}

function extractSqlExpressionByLabels(text: string, labels: string[]): string {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const line = lines.find(item => new RegExp(`^${escaped}[：:]`, "i").test(item));
    const value = line?.replace(new RegExp(`^${escaped}[：:]\\s*`, "i"), "").trim();
    if (value) return value;
  }
  return "";
}

function stripDictionaryLogicPrefix(text: string, labels: string[]): string {
  const trimmed = text.trim();
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const next = trimmed.replace(new RegExp(`^${escaped}[：:]\\s*`, "i"), "").trim();
    if (next !== trimmed) return next;
  }
  return "";
}

function isSimpleDictionarySqlSource(value: string): boolean {
  const text = value.trim();
  return /^[A-Za-z_][\w$]*(?:\.[A-Za-z_][\w$]*)*$/.test(text);
}

function isDictionarySqlExpression(value: string): boolean {
  return /[()|+\-*=\/<>]|\b(case|when|then|else|substr|substring|concat|decode|nvl|coalesce|to_char|to_date|cast|sum|count|max|min)\b/i.test(value);
}

function normalizeDictionarySqlSource(value: string, refs: DictionarySourceRef[]): string {
  const normalized = value.trim();
  const ref = refs.find(item => [item.label, item.field?.fieldName, getDictionarySourceRefEnglish(item)]
    .filter(Boolean)
    .some(token => normalizeDictionaryRefKey(token) === normalizeDictionaryRefKey(normalized)));
  return ref ? getDictionarySourceRefSqlName(ref) : normalized;
}

function normalizeDictionarySqlExpression(value: string, refs: DictionarySourceRef[]): string {
  let next = replaceDictionaryRuntimeParamSqlRefs(value.trim());
  refs.forEach(ref => {
    buildDictionaryLogicRefCandidates([ref]).forEach(candidate => {
      const sqlName = getDictionarySourceRefSqlName(ref);
      if (!sqlName || candidate.token === sqlName) return;
      next = replaceDictionarySqlToken(next, `{${candidate.token}}`, sqlName);
      next = replaceDictionarySqlIdentifierToken(next, candidate.token, sqlName);
    });
  });
  return next;
}

function replaceDictionarySqlToken(text: string, token: string, replacement: string): string {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "g"), replacement);
}

function replaceDictionarySqlIdentifierToken(text: string, token: string, replacement: string): string {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(^|[^\\w$.])(${escaped})(?![\\w$])`, "g"), (_match, prefix) => `${prefix}${replacement}`);
}

export function getDictionarySourceRefSqlName(ref: DictionarySourceRef): string {
  if (!ref.field) return ref.label;
  return [ref.field.tableName, ref.field.fieldName].filter(Boolean).join(".") || ref.field.fieldName || ref.label;
}

export function sanitizeDictionarySqlIdentifier(value?: string): string {
  const text = value?.trim() || "";
  return /^[A-Za-z_][\w$]*$/.test(text) ? text : "";
}

export function buildDictionaryLogicRefCandidates(refs: DictionarySourceRef[]) {
  const seen = new Set<string>();
  const candidates: Array<{ token: string; ref: DictionarySourceRef }> = [];
  refs.forEach(ref => {
    [
      ref.label,
      getDictionarySourceRefEnglish(ref),
      ref.field?.fieldName,
      ref.field?.mappedField,
      [ref.field?.tableName, ref.field?.fieldName].filter(Boolean).join("."),
      [ref.field?.tableName, ref.field?.mappedField].filter(Boolean).join("."),
      ref.field?.fieldCn,
    ].forEach(token => {
      const normalized = token?.trim();
      if (!normalized || normalized.length < 2 || seen.has(normalized)) return;
      seen.add(normalized);
      candidates.push({ token: normalized, ref });
    });
  });
  return candidates.sort((a, b) => b.token.length - a.token.length);
}

export function findNextDictionaryLogicRefMatch(
  text: string,
  start: number,
  candidates: Array<{ token: string; ref: DictionarySourceRef }>,
): { start: number; end: number; text: string; ref: DictionarySourceRef } | null {
  let best: { start: number; end: number; text: string; ref: DictionarySourceRef } | null = null;
  candidates.forEach(candidate => {
    const index = text.indexOf(candidate.token, start);
    if (index < 0) return;
    if (!best || index < best.start || (index === best.start && candidate.token.length > best.text.length)) {
      best = { start: index, end: index + candidate.token.length, text: candidate.token, ref: candidate.ref };
    }
  });
  return best;
}

export function getDictionarySourceRefEnglish(ref: DictionarySourceRef): string {
  if (!ref.field) return ref.label;
  return [ref.field.systemCode, ref.field.tableName, ref.field.fieldName].filter(Boolean).join(".") || ref.label;
}

export function getDictionarySourceRefChinese(ref: DictionarySourceRef): string {
  if (!ref.field) return "未绑定字段元";
  return [ref.field.systemName, ref.field.tableCn, ref.field.fieldCn].filter(Boolean).join(" / ") || ref.field.fieldCn || ref.label;
}

export function normalizeDictionaryRefKey(value?: string): string {
  return (value ?? "")
    .replace(/--.*$/g, "")
    .replace(/[“”"'`]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}
