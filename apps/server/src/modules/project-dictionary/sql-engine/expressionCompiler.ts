import {
  type DictionaryMappingJsonCondition,
  type DictionaryMappingJsonRule,
  type DictionaryMappingJsonRuleValue,
} from "@ke/domain";
import type { ProjectDictionaryFieldDetail, ProjectDictionarySystem, ProjectDictionaryTable } from "../../../repos/ProjectManagementRepo.js";
import { quoteDictionaryEntityIdentifier } from "./dialect.js";
import {
  collectDictionaryExtractionValueRefs,
  normalizeDictionaryExtractionOp,
  parseDictionaryExtractionJsonRule,
  validateDictionaryExtractionJsonRule,
} from "./mappingRules.js";
import {
  dictionaryEntityColumnMetaType,
  mapDictionaryEntityColumnType,
  normalizeDictionaryEntityType,
  type DictionaryEntityColumnMeta,
} from "../schema/schemaSql.js";
import {
  dictionaryEntityColumnName,
  dictionaryEntityString,
  resolveDictionaryEntityColumnName,
} from "../test-data/entityRows.js";

type DictionaryMappingRuleValue = DictionaryMappingJsonRuleValue;

type DictionaryExtractionFieldSqlMeta = {
  field: ProjectDictionaryFieldDetail;
  column?: DictionaryEntityColumnMeta;
};

export function isSupportedDictionaryExtractionOp(op: string): boolean {
  return new Set([
    "direct", "literal", "default", "const", "null", "empty", "random", "db_generated",
    "code_mapping", "case", "cast", "abs_cast", "coalesce", "coalesce_cast", "date_parse",
    "param", "runtime_context", "substring_marker", "split_part", "round", "divide", "multiply",
    "subtract", "add", "nullif", "concat", "required_lookup", "lookup_or_error",
    "group_aggregate", "relative_date_boundary",
  ]).has(normalizeDictionaryExtractionOp(op));
}

export type DictionaryExtractionSqlTableSource = {
  table: ProjectDictionaryTable;
  fields: ProjectDictionaryFieldDetail[];
  columns: DictionaryEntityColumnMeta[];
  alias: string;
  aliases?: string[];
  primary?: boolean;
};

export type DictionaryExtractionSqlContext = {
  dialect: "postgresql" | "sqlserver";
  sourceSystem: ProjectDictionarySystem;
  sourceTable: ProjectDictionaryTable;
  sourceFields: ProjectDictionaryFieldDetail[];
  sourceColumns: DictionaryEntityColumnMeta[];
  sourceTableSources: Map<string, DictionaryExtractionSqlTableSource>;
  targetTable: ProjectDictionaryTable;
  targetFields: ProjectDictionaryFieldDetail[];
  targetColumns: DictionaryEntityColumnMeta[];
  targetExpressions: Map<string, string>;
  usedAliases: Set<string>;
  runtimeParams?: Record<string, unknown>;
  allowMissingRuntimeParams?: boolean;
  visiting: Set<string>;
};

export function buildDictionaryExtractionFieldSqlExpression(field: ProjectDictionaryFieldDetail, context: DictionaryExtractionSqlContext): string {
  const fieldKey = normalizeDictionaryExtractionKey(field.fieldName);
  const cached = context.targetExpressions.get(fieldKey);
  if (cached) return cached;
  if (context.visiting.has(fieldKey)) throw new Error(`字段 ${field.fieldName} 存在循环引用`);
  context.visiting.add(fieldKey);
  try {
    const logic = dictionaryExtractionLogicText(field);
    if (isDictionaryExtractionDbGeneratedField(field, logic)) {
      const expression = buildDictionaryExtractionDbGeneratedSqlExpression(context.dialect);
      context.targetExpressions.set(fieldKey, expression);
      return expression;
    }
    const rule = parseDictionaryExtractionJsonRule(logic);
    if (logic.startsWith("{") && !rule) throw new SyntaxError("Mapping 逻辑不是标准 JSON，无法解析");
    const ruleErrors = rule ? validateDictionaryExtractionJsonRule(rule) : [];
    if (ruleErrors.length) throw new SyntaxError(`Mapping 规则不标准：${ruleErrors.join("；")}`);
    if (rule && !isSupportedDictionaryExtractionOp(rule.op)) {
      const op = normalizeDictionaryExtractionOp(rule.op);
      throw new Error(op === "sql" || op === "expr"
        ? "使用了 SQL 兜底动作，不能参与自动抽取；请改为标准动作"
        : `使用了暂不支持的动作：${rule.op}`);
    }
    if (rule) ensureDictionaryExtractionRuleRefsBound(rule, context);
    const expression = rule
      ? buildDictionaryExtractionRuleSqlExpression(rule, field, context)
      : field.mappedField
        ? dictionaryExtractionSourceSqlExpression(field.mappedField, context)
        : "";
    if (!expression) throw new Error("没有可转换的 Mapping SQL");
    context.targetExpressions.set(fieldKey, expression);
    return expression;
  } finally {
    context.visiting.delete(fieldKey);
  }
}

function ensureDictionaryExtractionRuleRefsBound(rule: DictionaryMappingJsonRule, context: DictionaryExtractionSqlContext): void {
  const missingRefs = collectDictionaryExtractionValueRefs(rule)
    .filter(ref => !canResolveDictionaryExtractionSourceRef(ref, context));
  if (missingRefs.length) {
    throw new Error(`关联字段元不存在：${Array.from(new Set(missingRefs)).join("、")}`);
  }
}

function canResolveDictionaryExtractionSourceRef(ref: string, context: DictionaryExtractionSqlContext): boolean {
  if (dictionaryExtractionRuntimeParamName(ref)) return true;
  const sourceRef = parseDictionaryExtractionRef(ref);
  if (!sourceRef.fieldName) return false;
  if (isDictionaryExtractionRuntimeTable(sourceRef.tableName)) return true;
  const tableSource = findDictionaryExtractionSqlTableSource(sourceRef.tableName, context);
  if (tableSource) return Boolean(findDictionaryExtractionFieldByName(tableSource.fields, sourceRef.fieldName));
  if (isDictionaryExtractionTableRef(sourceRef.tableName, context.targetTable)) {
    return Boolean(findDictionaryExtractionFieldByName(context.targetFields, sourceRef.fieldName));
  }
  return false;
}

export function coerceDictionaryExtractionExpressionForTarget(
  expression: string,
  field: ProjectDictionaryFieldDetail,
  column: DictionaryEntityColumnMeta | undefined,
  dialect: "postgresql" | "sqlserver",
): string {
  const targetType = normalizeDictionaryEntityType(column ? dictionaryEntityColumnMetaType(column, dialect) : mapDictionaryEntityColumnType(field, dialect), dialect);
  if (expression === "NULL" || targetType.includes("char") || targetType === "text" || targetType === "nvarchar(max)") return expression;
  if (targetType === "date") {
    return isDictionaryExtractionTypedSqlExpression(expression, "date", dialect)
      ? expression
      : buildDictionaryExtractionDateCoerceSql(expression, dialect);
  }
  if (targetType === "timestamp" || targetType === "datetime2") {
    return isDictionaryExtractionTypedSqlExpression(expression, "timestamp", dialect)
      ? expression
      : buildDictionaryExtractionTimestampCoerceSql(expression, dialect);
  }
  if (targetType === "integer" || targetType === "int" || targetType === "bigint") return buildDictionaryExtractionNumericCoerceSql(expression, targetType.toUpperCase(), dialect);
  if (targetType.startsWith("numeric") || targetType.startsWith("decimal")) return buildDictionaryExtractionNumericCoerceSql(expression, targetType.toUpperCase(), dialect);
  if (targetType === "boolean" || targetType === "bit") return `CAST(${expression} AS ${dialect === "sqlserver" ? "BIT" : "BOOLEAN"})`;
  return expression;
}

function buildDictionaryExtractionNumericCoerceSql(
  expression: string,
  targetType: string,
  dialect: "postgresql" | "sqlserver",
): string {
  if (dialect === "sqlserver") {
    return `CAST(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(max), ${expression}))), '') AS ${targetType})`;
  }
  return `CAST(NULLIF(BTRIM((${expression})::text), '') AS ${targetType})`;
}

function isDictionaryExtractionTypedSqlExpression(expression: string, targetType: "date" | "timestamp", dialect: "postgresql" | "sqlserver"): boolean {
  const normalized = expression.trim().replace(/\s+/g, " ");
  if (!normalized) return false;
  if (targetType === "date") {
    if (/^current_date$/i.test(normalized)) return true;
    if (/^to_date\s*\(/i.test(normalized)) return true;
    if (/^cast\s*\(.+\s+as\s+date\s*\)$/i.test(normalized)) return true;
    if (dialect === "sqlserver" && /^convert\s*\(\s*date\s*,/i.test(normalized)) return true;
  }
  if (targetType === "timestamp") {
    if (/^current_timestamp$/i.test(normalized)) return true;
    if (/^cast\s*\(.+\s+as\s+(timestamp|datetime|datetime2)\s*\)$/i.test(normalized)) return true;
    if (dialect === "sqlserver" && /^(sysdatetime|getdate)\s*\(\s*\)$/i.test(normalized)) return true;
    if (dialect === "sqlserver" && /^convert\s*\(\s*(datetime|datetime2)\s*,/i.test(normalized)) return true;
  }
  return false;
}

function isDictionaryExtractionRequiredTarget(field: ProjectDictionaryFieldDetail, column: DictionaryEntityColumnMeta | undefined): boolean {
  if (field.primaryKey || field.required || /^(no|false|0)$/i.test(field.nullable ?? "")) return true;
  return column?.nullable === false;
}

export function isDictionaryExtractionDbGeneratedField(field: ProjectDictionaryFieldDetail, logic: string): boolean {
  const normalizedLogic = normalizeDictionaryExtractionOp(logic);
  return field.primaryKey
    || normalizedLogic.includes("db_generated")
    || /数据库(?:\/ORM)?生成|数据库生成|自动生成主键|orm生成主键/i.test(logic);
}

function buildDictionaryExtractionDbGeneratedSqlExpression(dialect: "postgresql" | "sqlserver"): string {
  return dialect === "sqlserver" ? "ROW_NUMBER() OVER (ORDER BY (SELECT NULL))" : "ROW_NUMBER() OVER ()";
}

export function buildDictionaryExtractionFallbackSqlExpression(
  field: ProjectDictionaryFieldDetail,
  column: DictionaryEntityColumnMeta | undefined,
  dialect: "postgresql" | "sqlserver",
): string {
  if (field.primaryKey) return buildDictionaryExtractionDbGeneratedSqlExpression(dialect);
  if (!isDictionaryExtractionRequiredTarget(field, column)) return "NULL";
  const targetType = normalizeDictionaryEntityType(column ? dictionaryEntityColumnMetaType(column, dialect) : mapDictionaryEntityColumnType(field, dialect), dialect);
  if (targetType === "date") return dialect === "sqlserver" ? "CAST(GETDATE() AS DATE)" : "CURRENT_DATE";
  if (targetType === "timestamp" || targetType === "datetime2") return dialect === "sqlserver" ? "SYSDATETIME()" : "CURRENT_TIMESTAMP";
  if (targetType === "boolean" || targetType === "bit") return dialect === "sqlserver" ? "0" : "FALSE";
  if (targetType === "integer" || targetType === "int" || targetType === "bigint" || targetType.startsWith("numeric") || targetType.startsWith("decimal")) return "0";
  return "''";
}

function buildDictionaryExtractionRuleSqlExpression(
  rule: DictionaryMappingJsonRule,
  targetField: ProjectDictionaryFieldDetail,
  context: DictionaryExtractionSqlContext,
): string {
  const op = normalizeDictionaryExtractionOp(rule.op);
  if (op === "direct") return dictionaryExtractionSourceSqlExpression(rule.source, context);
  if (op === "literal" || op === "default" || op === "const") return formatDictionaryExtractionSqlLiteral(rule.value, context.dialect);
  if (op === "null" || op === "empty") return "NULL";
  if (op === "random") return buildDictionaryExtractionRandomSqlExpression(rule.type || (rule.length ? `number:${rule.length}` : ""), context.dialect);
  if (op === "db_generated") return buildDictionaryExtractionDbGeneratedSqlExpression(context.dialect);
  if (op === "code_mapping") {
    const source = dictionaryExtractionSourceSqlExpression(rule.source, context);
    const entries = Object.entries(rule.map ?? {});
    if (!source || entries.length === 0) return "";
    const branches = entries.map(([from, to]) => `WHEN ${source} = ${formatDictionaryExtractionSqlLiteral(from, context.dialect)} THEN ${buildDictionaryExtractionValueSqlExpression(to as DictionaryMappingRuleValue, targetField, context)}`);
    return `CASE ${branches.join(" ")} ELSE ${buildDictionaryExtractionValueSqlExpression(rule.else, targetField, context) || "NULL"} END`;
  }
  if (op === "case") {
    const branches = (rule.when ?? [])
      .map(branch => {
        const condition = buildDictionaryExtractionConditionSql(branch.if, targetField, context);
        const thenValue = buildDictionaryExtractionValueSqlExpression(branch.then, targetField, context);
        return condition && thenValue ? `WHEN ${condition} THEN ${thenValue}` : "";
      })
      .filter(Boolean);
    return branches.length ? `CASE ${branches.join(" ")} ELSE ${buildDictionaryExtractionValueSqlExpression(rule.else, targetField, context) || "NULL"} END` : "";
  }
  if (op === "cast") {
    const value = buildDictionaryExtractionValueSqlExpression(rule.value as DictionaryMappingRuleValue | undefined ?? (rule.source ? { source: rule.source } : undefined), targetField, context);
    return value && rule.to ? buildDictionaryExtractionExplicitCastSql(value, rule.to, context.dialect) : "";
  }
  if (op === "abs_cast") {
    const source = dictionaryExtractionSourceSqlExpression(rule.source, context);
    return source && rule.to ? `ABS(${buildDictionaryExtractionExplicitCastSql(source, rule.to, context.dialect)})` : "";
  }
  if (op === "coalesce_cast") {
    const source = dictionaryExtractionSourceSqlExpression(rule.source, context);
    return source && rule.to
      ? buildDictionaryExtractionCoalesceCastSql(source, rule.to, formatDictionaryExtractionSqlLiteral(rule.emptyAs ?? "0", context.dialect), context.dialect)
      : "";
  }
  if (op === "coalesce") {
    const source = dictionaryExtractionSourceSqlExpression(rule.source, context);
    const defaultValue = buildDictionaryExtractionValueSqlExpression(rule.default, targetField, context);
    return source && defaultValue ? `COALESCE(${source}, ${defaultValue})` : "";
  }
  if (op === "date_parse") {
    const source = dictionaryExtractionSourceSqlExpression(rule.source, context);
    return source && rule.from ? buildDictionaryExtractionDateParseSql(source, rule.from, context.dialect) : "";
  }
  if (op === "required_lookup" || op === "lookup_or_error") {
    const source = dictionaryExtractionSourceSqlExpression(rule.source, context);
    const lookup = dictionaryExtractionSourceSqlExpression(rule.lookup, context);
    if (!source || !lookup) return "";
    const nonEmpty = context.dialect === "sqlserver"
      ? `CONVERT(nvarchar(max), ${source}) <> ''`
      : `(${source})::text <> ''`;
    return `CASE WHEN ${source} IS NOT NULL AND ${nonEmpty} THEN ${lookup} ELSE NULL END`;
  }
  if (op === "param") return dictionaryExtractionRuntimeSqlExpression(rule.name, context);
  if (op === "runtime_context") return dictionaryExtractionSystemRuntimeContextSqlExpression(rule.name, context.dialect)
    || dictionaryExtractionRuntimeSqlExpression(rule.name, context);
  if (op === "substring_marker") {
    const source = dictionaryExtractionSourceSqlExpression(rule.source, context);
    if (!source || !rule.marker || !rule.length) return "";
    const expression = buildDictionaryExtractionSubstringMarkerSql(source, rule.marker, Number(rule.length), context.dialect);
    return rule.stripQuotes ? `REPLACE(${expression}, ${formatDictionaryExtractionSqlLiteral("\"", context.dialect)}, '')` : expression;
  }
  if (op === "split_part") {
    const source = dictionaryExtractionSourceSqlExpression(rule.source, context);
    return source && rule.delimiter && rule.index ? buildDictionaryExtractionSplitPartSql(source, rule.delimiter, Number(rule.index), context.dialect) : "";
  }
  if (op === "round") {
    const value = buildDictionaryExtractionValueSqlExpression(rule.value as DictionaryMappingRuleValue | undefined, targetField, context);
    return value ? `ROUND(${value}, ${rule.scale ?? 0})` : "";
  }
  if (op === "divide" || op === "multiply" || op === "subtract") {
    const left = buildDictionaryExtractionValueSqlExpression(rule.left, targetField, context);
    const right = buildDictionaryExtractionValueSqlExpression(rule.right, targetField, context);
    const operator = op === "divide" ? "/" : op === "multiply" ? "*" : "-";
    return left && right ? `(${left} ${operator} ${right})` : "";
  }
  if (op === "add") {
    const pieces = (rule.sources ?? []).map(source => dictionaryExtractionSourceSqlExpression(source, context)).filter(Boolean);
    const left = buildDictionaryExtractionValueSqlExpression(rule.left, targetField, context);
    const right = buildDictionaryExtractionValueSqlExpression(rule.right, targetField, context);
    const values = pieces.length ? pieces : [left, right].filter(Boolean);
    return values.length ? `(${values.join(" + ")})` : "";
  }
  if (op === "nullif") {
    const value = buildDictionaryExtractionValueSqlExpression(rule.value as DictionaryMappingRuleValue | undefined, targetField, context);
    const compare = buildDictionaryExtractionValueSqlExpression(rule.compare ?? 0, targetField, context);
    return value ? `NULLIF(${value}, ${compare || "0"})` : "";
  }
  if (op === "concat") {
    const pieces = (rule.sources ?? []).map(source => dictionaryExtractionSourceSqlExpression(source, context)).filter(Boolean);
    if (!pieces.length) return "";
    return rule.delimiter !== undefined
      ? `CONCAT_WS(${formatDictionaryExtractionSqlLiteral(rule.delimiter, context.dialect)}, ${pieces.join(", ")})`
      : `CONCAT(${pieces.join(", ")})`;
  }
  if (op === "group_aggregate") {
    const source = dictionaryExtractionSourceSqlExpression(rule.source, context);
    const aggregate = dictionaryEntityString(rule.aggregate).toUpperCase();
    return source && /^(SUM|COUNT|AVG|MIN|MAX)$/.test(aggregate) ? `${aggregate}(${source})` : "";
  }
  if (op === "relative_date_boundary") {
    const source = dictionaryExtractionSourceSqlExpression(rule.source, context);
    return source ? buildDictionaryExtractionRelativeDateBoundarySql(source, rule.unit, rule.offset, rule.boundary, context.dialect) : "";
  }
  return "";
}

function buildDictionaryExtractionExplicitCastSql(
  expression: string,
  targetType: string,
  dialect: "postgresql" | "sqlserver",
): string {
  return /^(?:numeric|decimal|number|int|integer|bigint)\b/i.test(targetType.trim())
    ? buildDictionaryExtractionNumericCoerceSql(expression, targetType, dialect)
    : `CAST(${expression} AS ${targetType})`;
}

function buildDictionaryExtractionValueSqlExpression(
  value: DictionaryMappingRuleValue | undefined,
  targetField: ProjectDictionaryFieldDetail,
  context: DictionaryExtractionSqlContext,
): string {
  if (value === undefined) return "";
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return formatDictionaryExtractionSqlLiteral(value, context.dialect);
  }
  if ("op" in value && typeof value.op === "string") return buildDictionaryExtractionRuleSqlExpression(value, targetField, context);
  if ("source" in value && value.source) return dictionaryExtractionSourceSqlExpression(value.source, context);
  if ("value" in value) return formatDictionaryExtractionSqlLiteral(value.value, context.dialect);
  if ("expr" in value || "sql" in value) return normalizeDictionaryExtractionSqlExpression(dictionaryEntityString(value.expr || value.sql), context);
  return "";
}

export function buildDictionaryExtractionConditionSql(
  condition: DictionaryMappingJsonCondition | undefined,
  targetField: ProjectDictionaryFieldDetail,
  context: DictionaryExtractionSqlContext,
): string {
  if (!condition) return "";
  if (condition.and?.length) {
    const parts = condition.and.map(item => buildDictionaryExtractionConditionSql(item, targetField, context)).filter(Boolean);
    return parts.length ? parts.map(part => `(${part})`).join(" AND ") : "";
  }
  if (condition.or?.length) {
    const parts = condition.or.map(item => buildDictionaryExtractionConditionSql(item, targetField, context)).filter(Boolean);
    return parts.length ? parts.map(part => `(${part})`).join(" OR ") : "";
  }
  if (condition.not) {
    const part = buildDictionaryExtractionConditionSql(condition.not, targetField, context);
    return part ? `NOT (${part})` : "";
  }
  const leftValue = condition.left ?? (condition.source ? { source: condition.source } : undefined);
  const left = buildDictionaryExtractionValueSqlExpression(leftValue, targetField, context);
  if (!left) return "";
  if (condition.eq === null) return `${left} IS NULL`;
  if (condition.ne === null) return `${left} IS NOT NULL`;
  if (condition.in !== undefined || condition.not_in !== undefined) {
    const values = condition.in ?? condition.not_in ?? [];
    const sqlValues = values
      .map(value => buildDictionaryExtractionValueSqlExpressionForComparison(value, leftValue, targetField, context))
      .filter(Boolean);
    return sqlValues.length ? `${left} ${condition.in !== undefined ? "IN" : "NOT IN"} (${sqlValues.join(", ")})` : "";
  }
  const operators: Array<[keyof DictionaryMappingJsonCondition, string]> = [["eq", "="], ["ne", "<>"], ["gt", ">"], ["gte", ">="], ["lt", "<"], ["lte", "<="], ["like", "LIKE"]];
  for (const [key, operator] of operators) {
    if (condition[key] !== undefined) {
      const rightValue = condition[key] as DictionaryMappingRuleValue;
      const right = buildDictionaryExtractionValueSqlExpression(rightValue, targetField, context);
      if (!right) return "";
      const [typedLeft, typedRight] = coerceDictionaryExtractionRuntimeComparisonOperands(leftValue, rightValue, left, right, context);
      return `${typedLeft} ${operator} ${typedRight}`;
    }
  }
  return "";
}

function buildDictionaryExtractionValueSqlExpressionForComparison(
  value: DictionaryMappingRuleValue,
  peerValue: DictionaryMappingRuleValue | undefined,
  targetField: ProjectDictionaryFieldDetail,
  context: DictionaryExtractionSqlContext,
): string {
  const expression = buildDictionaryExtractionValueSqlExpression(value, targetField, context);
  if (!expression) return "";
  return coerceDictionaryExtractionRuntimeComparisonExpression(value, peerValue, expression, context);
}

function coerceDictionaryExtractionRuntimeComparisonOperands(
  leftValue: DictionaryMappingRuleValue | undefined,
  rightValue: DictionaryMappingRuleValue | undefined,
  leftSql: string,
  rightSql: string,
  context: DictionaryExtractionSqlContext,
): [string, string] {
  return [
    coerceDictionaryExtractionRuntimeComparisonExpression(leftValue, rightValue, leftSql, context),
    coerceDictionaryExtractionRuntimeComparisonExpression(rightValue, leftValue, rightSql, context),
  ];
}

function coerceDictionaryExtractionRuntimeComparisonExpression(
  value: DictionaryMappingRuleValue | undefined,
  peerValue: DictionaryMappingRuleValue | undefined,
  expression: string,
  context: DictionaryExtractionSqlContext,
): string {
  const peerRuntimeParamName = dictionaryExtractionRuleValueRuntimeParamName(peerValue);
  if (peerRuntimeParamName) {
    const valueMeta = dictionaryExtractionSourceFieldMetaFromRuleValue(value, context);
    const valueType = valueMeta ? dictionaryExtractionFieldSqlType(valueMeta, context.dialect) : "";
    if ((valueType.includes("char") || valueType === "text" || valueType === "nvarchar(max)") && /date|time/i.test(peerRuntimeParamName)) {
      return buildDictionaryExtractionTimestampCoerceSql(expression, context.dialect);
    }
  }
  if (!dictionaryExtractionRuleValueRuntimeParamName(value)) return expression;
  const peerMeta = dictionaryExtractionSourceFieldMetaFromRuleValue(peerValue, context);
  if (!peerMeta) return expression;
  const peerType = dictionaryExtractionFieldSqlType(peerMeta, context.dialect);
  if (peerType === "date") return buildDictionaryExtractionDateCoerceSql(expression, context.dialect);
  if (peerType === "timestamp" || peerType === "datetime2") return buildDictionaryExtractionTimestampCoerceSql(expression, context.dialect);
  // 源字段虽以字符列保存日期（如 YYYYMMDD）时，另一侧日期参数也必须先解析；
  // 否则源侧已转 timestamp、参数仍是 TEXT，会生成 timestamp = text。
  if ((peerType.includes("char") || peerType === "text" || peerType === "nvarchar(max)") && /date|time/i.test(dictionaryExtractionRuleValueRuntimeParamName(value))) {
    return buildDictionaryExtractionTimestampCoerceSql(expression, context.dialect);
  }
  return expression;
}

function dictionaryExtractionRuleValueRuntimeParamName(value: DictionaryMappingRuleValue | undefined): string {
  if (typeof value === "string") return dictionaryExtractionRuntimeParamName(value);
  if (!value || typeof value !== "object") return "";
  if ("op" in value && (normalizeDictionaryExtractionOp(value.op) === "param" || normalizeDictionaryExtractionOp(value.op) === "runtime_context")) {
    return dictionaryEntityString(value.name);
  }
  if (!("source" in value)) return "";
  return dictionaryExtractionRuntimeParamName(value.source);
}

function dictionaryExtractionSourceFieldMetaFromRuleValue(
  value: DictionaryMappingRuleValue | undefined,
  context: DictionaryExtractionSqlContext,
): DictionaryExtractionFieldSqlMeta | null {
  const source = typeof value === "string"
    ? value
    : value && typeof value === "object" && "source" in value
      ? value.source
      : "";
  if (!source || dictionaryExtractionRuntimeParamName(source)) return null;
  const sourceRef = parseDictionaryExtractionRef(source);
  if (!sourceRef.fieldName || isDictionaryExtractionRuntimeTable(sourceRef.tableName)) return null;
  const tableSource = findDictionaryExtractionSqlTableSource(sourceRef.tableName, context);
  if (tableSource) {
    const field = findDictionaryExtractionFieldByName(tableSource.fields, sourceRef.fieldName);
    if (!field) return null;
    const columnName = resolveDictionaryEntityColumnName(field, tableSource.columns);
    return {
      field,
      column: tableSource.columns.find(column => normalizeDictionaryExtractionKey(column.columnName) === normalizeDictionaryExtractionKey(columnName)),
    };
  }
  if (!isDictionaryExtractionTableRef(sourceRef.tableName, context.targetTable)) return null;
  const field = findDictionaryExtractionFieldByName(context.targetFields, sourceRef.fieldName);
  if (!field) return null;
  const columnName = dictionaryEntityColumnName(field);
  return {
    field,
    column: context.targetColumns.find(column => normalizeDictionaryExtractionKey(column.columnName) === normalizeDictionaryExtractionKey(columnName)),
  };
}

function dictionaryExtractionFieldSqlType(
  meta: DictionaryExtractionFieldSqlMeta,
  dialect: "postgresql" | "sqlserver",
): string {
  return normalizeDictionaryEntityType(
    meta.column ? dictionaryEntityColumnMetaType(meta.column, dialect) : mapDictionaryEntityColumnType(meta.field, dialect),
    dialect,
  );
}

export function dictionaryExtractionSourceSqlExpression(ref: string | undefined, context: DictionaryExtractionSqlContext): string {
  const runtimeParam = dictionaryExtractionRuntimeParamName(ref);
  if (runtimeParam) return dictionaryExtractionRuntimeSqlExpression(runtimeParam, context);
  const sourceRef = parseDictionaryExtractionRef(ref);
  if (!sourceRef.fieldName) return "";
  if (isDictionaryExtractionRuntimeTable(sourceRef.tableName)) return dictionaryExtractionRuntimeSqlExpression(sourceRef.fieldName, context);
  const tableSource = findDictionaryExtractionSqlTableSource(sourceRef.tableName, context);
  if (tableSource) {
    const sourceField = findDictionaryExtractionFieldByName(tableSource.fields, sourceRef.fieldName);
    if (!sourceField) throw new Error(`关联的上游字段不存在：${sourceRef.tableName || tableSource.table.tableName}.${sourceRef.fieldName}`);
    return `${quoteDictionaryEntityIdentifier(tableSource.alias, context.dialect)}.${quoteDictionaryEntityIdentifier(resolveDictionaryEntityColumnName(sourceField, tableSource.columns), context.dialect)}`;
  }
  if (isDictionaryExtractionTableRef(sourceRef.tableName, context.targetTable)) {
    const targetField = findDictionaryExtractionFieldByName(context.targetFields, sourceRef.fieldName);
    if (!targetField) throw new Error(`关联的目标字段不存在：${sourceRef.tableName}.${sourceRef.fieldName}`);
    return `(${buildDictionaryExtractionFieldSqlExpression(targetField, context)})`;
  }
  throw new Error(`关联的上游表不在当前口径 FROM 中：${sourceRef.tableName}.${sourceRef.fieldName}`);
}

export function normalizeDictionaryExtractionSqlExpression(value: string, context: DictionaryExtractionSqlContext): string {
  let next = dictionaryEntityString(value);
  if (!next) return "";
  next = next
    .replace(/(^|[^\w$"'])(参数|入参)[.\s:：]+([A-Za-z_][\w$]*)\b/g, (match, prefix, _label, name) => `${prefix}${dictionaryExtractionRuntimeSqlExpression(name, context) || match}`)
    .replace(/(^|[^\w$"'])(param|params|runtime|runtime_context)[.:：]+([A-Za-z_][\w$]*)\b/gi, (match, prefix, _label, name) => `${prefix}${dictionaryExtractionRuntimeSqlExpression(name, context) || match}`);
  next = next.replace(/:([A-Za-z_][\w$]*)/g, (_match, name) => dictionaryExtractionRuntimeSqlExpression(name, context));
  next = next.replace(/\{([^}]+)\}/g, (_match, token) => dictionaryExtractionSourceSqlExpression(token, context));

  const candidates = buildDictionaryExtractionSqlRefCandidates(context);
  for (const candidate of candidates) {
    if (!candidate.token || candidate.token === candidate.sql) continue;
    next = replaceDictionaryExtractionSqlIdentifierToken(next, candidate.token, candidate.sql);
  }
  return next;
}

function buildDictionaryExtractionSqlRefCandidates(context: DictionaryExtractionSqlContext): Array<{ token: string; sql: string }> {
  const values: Array<{ token: string; sql: string }> = [];
  const singleFieldMatches = new Map<string, string[]>();
  context.sourceTableSources.forEach(source => {
    source.fields.forEach(field => {
      const sql = `${quoteDictionaryEntityIdentifier(source.alias, context.dialect)}.${quoteDictionaryEntityIdentifier(resolveDictionaryEntityColumnName(field, source.columns), context.dialect)}`;
      const tableTokens = [
        source.alias,
        source.table.tableName,
        source.table.tableCn,
        dictionaryEntityString(source.table.extra?.entityTableName),
        dictionaryEntityString(source.table.extra?.sourceFile),
      ].filter(Boolean);
      const fieldTokens = [
        field.fieldName,
        field.fieldCn,
        dictionaryEntityColumnName(field),
      ].filter(Boolean);
      tableTokens.forEach(tableToken => {
        fieldTokens.forEach(fieldToken => values.push({ token: `${tableToken}.${fieldToken}`, sql }));
      });
      fieldTokens.forEach(fieldToken => {
        const key = normalizeDictionaryExtractionKey(fieldToken);
        if (!key) return;
        singleFieldMatches.set(key, [...(singleFieldMatches.get(key) ?? []), sql]);
      });
    });
  });
  singleFieldMatches.forEach((matches, key) => {
    const unique = Array.from(new Set(matches));
    if (unique.length === 1) values.push({ token: key, sql: unique[0] });
  });
  return values.sort((a, b) => b.token.length - a.token.length);
}

function replaceDictionaryExtractionSqlIdentifierToken(text: string, token: string, replacement: string): string {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(^|[^\\w$.])(${escaped})(?![\\w$])`, "gi"), (_match, prefix) => `${prefix}${replacement}`);
}

export function findDictionaryExtractionSqlTableSource(tableName: string, context: DictionaryExtractionSqlContext): DictionaryExtractionSqlTableSource | undefined {
  if (!tableName) return findDictionaryExtractionPrimaryTableSource(context);
  const keys = dictionaryExtractionTableRefKeys(tableName);
  for (const key of keys) {
    const source = context.sourceTableSources.get(key);
    if (source) return source;
  }
  return undefined;
}

export function findDictionaryExtractionPrimaryTableSource(context: DictionaryExtractionSqlContext): DictionaryExtractionSqlTableSource | undefined {
  return context.sourceTableSources.get("__primary__")
    || Array.from(context.sourceTableSources.values()).find(source => source.primary)
    || Array.from(context.sourceTableSources.values())[0];
}

function parseDictionaryExtractionRef(ref: string | undefined): { tableName: string; fieldName: string } {
  const value = dictionaryEntityString(ref);
  const parts = value.split(".").map(part => part.trim()).filter(Boolean);
  if (parts.length <= 1) return { tableName: "", fieldName: parts[0] || "" };
  return { tableName: parts.slice(0, -1).join("."), fieldName: parts.at(-1) || "" };
}

export function isDictionaryExtractionRuntimeTable(tableName: string): boolean {
  return ["参数", "入参", "param", "params", "runtime", "runtime_context"].includes(normalizeDictionaryExtractionOp(tableName));
}

function dictionaryExtractionRuntimeParamName(value: string | undefined): string {
  const text = dictionaryEntityString(value);
  const placeholder = text.match(/^:([A-Za-z_][\w$]*)$/);
  if (placeholder) return placeholder[1];
  const cnMatch = text.match(/^(参数|入参)[.\s:：]+([A-Za-z_][\w$]*)$/);
  if (cnMatch) return cnMatch[2] || "";
  const enMatch = text.match(/^(param|params|runtime|runtime_context)[.:：]+([A-Za-z_][\w$]*)$/i);
  return enMatch?.[2] || "";
}

export function isDictionaryExtractionTableRef(tableName: string, table: ProjectDictionaryTable): boolean {
  const keys = dictionaryExtractionTableRefKeys(tableName);
  if (keys.length === 0) return false;
  return [
    table.id,
    table.tableName,
    table.tableCn,
    dictionaryEntityString(table.extra?.entityTableName),
  ].some(value => {
    const normalized = normalizeDictionaryExtractionKey(value);
    return normalized && keys.includes(normalized);
  });
}

function findDictionaryExtractionFieldByName(fields: ProjectDictionaryFieldDetail[], fieldName: string): ProjectDictionaryFieldDetail | undefined {
  const key = normalizeDictionaryExtractionKey(fieldName);
  return fields.find(field => [
    field.id,
    field.fieldName,
    field.fieldCn,
    dictionaryEntityColumnName(field),
].some(value => normalizeDictionaryExtractionKey(value) === key));
}

export function dictionaryExtractionTableRefKeys(tableName: string): string[] {
  const parts = dictionaryEntityString(tableName).split(".").map(part => part.trim()).filter(Boolean);
  const values = parts.length
    ? parts.map((_, index) => parts.slice(index).join("."))
    : [tableName];
  return Array.from(new Set(values.map(normalizeDictionaryExtractionKey).filter(Boolean)));
}

function dictionaryExtractionRuntimeSqlExpression(name: string | undefined, context: DictionaryExtractionSqlContext): string {
  const key = normalizeDictionaryExtractionKey(name);
  const paramEntry = Object.entries(context.runtimeParams ?? {})
    .find(([paramName]) => normalizeDictionaryExtractionKey(paramName) === key);
  if (paramEntry && paramEntry[1] !== undefined && paramEntry[1] !== null && String(paramEntry[1]).trim() !== "") {
    return formatDictionaryExtractionSqlLiteral(paramEntry[1], context.dialect);
  }
  if (context.allowMissingRuntimeParams) return `:${name || "param"}`;
  throw new Error(`需要填写运行参数：${name || "-"}`);
}

function dictionaryExtractionSystemRuntimeContextSqlExpression(
  name: string | undefined,
  dialect: "postgresql" | "sqlserver",
): string {
  const key = normalizeDictionaryExtractionKey(name);
  if (["currenttimestamp", "currenttime", "now", "当前时间", "系统时间"].includes(key)) {
    return dialect === "sqlserver" ? "SYSDATETIME()" : "CURRENT_TIMESTAMP";
  }
  if (["currentdate", "today", "当前日期", "系统日期"].includes(key)) {
    return dialect === "sqlserver" ? "CAST(GETDATE() AS DATE)" : "CURRENT_DATE";
  }
  return "";
}

export function formatDictionaryExtractionSqlLiteral(value: unknown, dialect: "postgresql" | "sqlserver"): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return dialect === "sqlserver" ? (value ? "1" : "0") : (value ? "TRUE" : "FALSE");
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildDictionaryExtractionCoalesceCastSql(source: string, to: string, emptyAs: string, dialect: "postgresql" | "sqlserver"): string {
  if (dialect === "sqlserver") return `CAST(COALESCE(NULLIF(${source}, ''), ${emptyAs}) AS ${to})`;
  return `COALESCE(NULLIF(${source}, ''), ${emptyAs})::${to}`;
}

function buildDictionaryExtractionDateParseSql(source: string, format: string, dialect: "postgresql" | "sqlserver"): string {
  if (dialect === "sqlserver") {
    if (/^YYYYMMDD$/i.test(format)) return `CONVERT(date, ${source}, 112)`;
    if (/^YYYY-MM-DD$/i.test(format)) return `CONVERT(date, ${source}, 23)`;
  }
  return `TO_DATE(${source}, ${formatDictionaryExtractionSqlLiteral(format, dialect)})`;
}

function buildDictionaryExtractionRelativeDateBoundarySql(
  source: string,
  unit: "day" | "month" | "year" | undefined,
  offset: number | undefined,
  boundary: "start" | "end" | undefined,
  dialect: "postgresql" | "sqlserver",
): string {
  const normalizedUnit = unit ?? "day";
  const normalizedOffset = Number.isInteger(offset) ? offset : 0;
  const normalizedBoundary = boundary ?? "start";
  if (dialect === "sqlserver") {
    const shifted = `DATEADD(${normalizedUnit}, ${normalizedOffset}, CAST(${source} AS date))`;
    if (normalizedUnit === "day") return shifted;
    if (normalizedUnit === "month") return normalizedBoundary === "end" ? `EOMONTH(${shifted})` : `DATEFROMPARTS(YEAR(${shifted}), MONTH(${shifted}), 1)`;
    return normalizedBoundary === "end" ? `DATEFROMPARTS(YEAR(${shifted}), 12, 31)` : `DATEFROMPARTS(YEAR(${shifted}), 1, 1)`;
  }
  const shifted = `(${source})::date + (${normalizedOffset} * INTERVAL '1 ${normalizedUnit}')`;
  if (normalizedUnit === "day") return `(${shifted})::date`;
  const truncated = `DATE_TRUNC('${normalizedUnit}', ${shifted})`;
  if (normalizedBoundary === "start") return `(${truncated})::date`;
  return normalizedUnit === "month"
    ? `(${truncated} + INTERVAL '1 month - 1 day')::date`
    : `(${truncated} + INTERVAL '1 year - 1 day')::date`;
}

function buildDictionaryExtractionDateCoerceSql(source: string, dialect: "postgresql" | "sqlserver"): string {
  if (dialect === "sqlserver") {
    return `COALESCE(TRY_CONVERT(date, CONVERT(nvarchar(max), ${source}), 112), TRY_CONVERT(date, CONVERT(nvarchar(max), ${source}), 23), TRY_CONVERT(date, ${source}))`;
  }
  return [
    "CASE",
    `WHEN ${source} IS NULL OR (${source})::text = '' THEN NULL`,
    `WHEN (${source})::text ~ '^\\d{8}$' THEN TO_DATE((${source})::text, 'YYYYMMDD')`,
    `WHEN (${source})::text ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING((${source})::text FROM 1 FOR 10)::date`,
    `ELSE (${source})::date`,
    "END",
  ].join(" ");
}

function buildDictionaryExtractionTimestampCoerceSql(source: string, dialect: "postgresql" | "sqlserver"): string {
  if (dialect === "sqlserver") {
    return `COALESCE(TRY_CONVERT(datetime2, CONVERT(nvarchar(max), ${source}), 112), TRY_CONVERT(datetime2, CONVERT(nvarchar(max), ${source}), 126), TRY_CONVERT(datetime2, ${source}))`;
  }
  return [
    "CASE",
    `WHEN ${source} IS NULL OR (${source})::text = '' THEN NULL`,
    `WHEN (${source})::text ~ '^\\d{8}$' THEN TO_DATE((${source})::text, 'YYYYMMDD')::timestamp`,
    `WHEN (${source})::text ~ '^\\d{4}-\\d{2}-\\d{2}' THEN (${source})::timestamp`,
    // 源文件中可能有 "2026" 一类不完整日期；不能让单条脏数据终止整批抽取。
    "ELSE NULL",
    "END",
  ].join(" ");
}

function buildDictionaryExtractionSubstringMarkerSql(source: string, marker: string, length: number, dialect: "postgresql" | "sqlserver"): string {
  const markerLiteral = formatDictionaryExtractionSqlLiteral(marker, dialect);
  if (dialect === "sqlserver") {
    return `CASE WHEN CHARINDEX(${markerLiteral}, ${source}) > 0 THEN SUBSTRING(${source}, CHARINDEX(${markerLiteral}, ${source}), ${length}) ELSE '' END`;
  }
  return `CASE WHEN POSITION(${markerLiteral} IN ${source}) > 0 THEN SUBSTRING(${source} FROM POSITION(${markerLiteral} IN ${source}) FOR ${length}) ELSE '' END`;
}

function buildDictionaryExtractionSplitPartSql(source: string, delimiter: string, index: number, dialect: "postgresql" | "sqlserver"): string {
  if (dialect === "sqlserver") return `JSON_VALUE(CONCAT('["', REPLACE(${source}, ${formatDictionaryExtractionSqlLiteral(delimiter, dialect)}, '","'), '"]'), '$[${Math.max(0, index - 1)}]')`;
  return `SPLIT_PART(${source}, ${formatDictionaryExtractionSqlLiteral(delimiter, dialect)}, ${index})`;
}

function buildDictionaryExtractionRandomSqlExpression(kind: string, dialect: "postgresql" | "sqlserver"): string {
  const normalized = kind.replace(/\s+/g, "");
  if (/uuid/i.test(normalized)) return dialect === "sqlserver" ? "NEWID()" : "gen_random_uuid()";
  if (/数字|number|id/i.test(normalized)) {
    return dialect === "sqlserver"
      ? "CAST(FLOOR(RAND(CHECKSUM(NEWID())) * 1000000000000000) AS BIGINT)"
      : "CAST(FLOOR(RANDOM() * 1000000000000000) AS BIGINT)";
  }
  return dialect === "sqlserver"
    ? "CAST(FLOOR(RAND(CHECKSUM(NEWID())) * 1000000000000000) AS BIGINT)"
    : "CAST(FLOOR(RANDOM() * 1000000000000000) AS BIGINT)";
}

export function dictionaryExtractionLogicText(field: ProjectDictionaryFieldDetail): string {
  const text = field.acquireLogic?.trim() || "";
  if (text.startsWith("{")) return text;
  const lines = text.replace(/\r/g, "\n").split("\n");
  const labelPattern = /^(逻辑|规则|逻辑\/规则|加工逻辑|取数逻辑|条件|结果)[：:]\s*(.*)$/;
  const stopPattern = /^(场景\s*\d+|取数范围描述|业务口径|口径说明|数据表mapping|表别名|数据字段|mapping|备注|SQL转换)[：:]/i;
  const startIndex = lines.findIndex(line => labelPattern.test(line.trim()));
  if (startIndex < 0) return "";
  const first = lines[startIndex].trim().replace(labelPattern, "$2").trim();
  const values = first ? [first] : [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed && stopPattern.test(trimmed)) break;
    values.push(line.trimEnd());
  }
  return values.join("\n").trim();
}

export function dictionaryMappingRuleLogicFingerprint(logic: string): string {
  return logic.trim();
}

export function normalizeDictionaryExtractionKey(value: unknown): string {
  return dictionaryEntityString(value).replace(/[\s_.'"`\[\]-]/g, "").toLowerCase();
}
