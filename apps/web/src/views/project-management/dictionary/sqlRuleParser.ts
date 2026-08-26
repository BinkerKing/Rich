import type {
  DictionaryCaliberRule,
  DictionaryCaliberSelectLatest,
  DictionaryMappingJsonCondition,
  DictionaryMappingJsonRule,
  DictionaryMappingJsonRuleValue,
} from "@ke/domain";

type DictionaryMappingJsonValue = DictionaryMappingJsonRuleValue;
type DictionaryCaliberJsonRule = DictionaryCaliberRule;

export function parseDictionaryJsonRule(logic: string): DictionaryMappingJsonRule | null {
  return parseDictionaryJsonRuleStrict(logic).rule ?? null;
}

export function parseDictionaryCaliberJsonRuleStrict(logic: string): { rule?: DictionaryCaliberJsonRule; error?: string } {
  const text = logic.trim();
  if (!text.startsWith("{")) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { error: "必须是 JSON 对象" };
    const rule = parsed as DictionaryCaliberJsonRule;
    const normalizedRule = { ...rule, op: typeof rule.op === "string" ? normalizeDictionaryJsonOp(rule.op) : "dataset" };
    const errors = validateDictionaryCaliberJsonRule(normalizedRule);
    return errors.length ? { error: errors.join("；") } : { rule: normalizedRule };
  } catch {
    return { error: "JSON 格式错误" };
  }
}

function validateDictionaryCaliberJsonRule(rule: DictionaryCaliberJsonRule): string[] {
  const errors: string[] = [];
  if (rule.op && !["dataset", "query_scope", "scope", "口径", "full_extract", "全表抽取"].includes(rule.op)) errors.push(`口径未知 op：${rule.op}`);
  if (!dictionaryCaliberTableName(rule.from)) errors.push("口径缺少 from");
  rule.joins?.forEach((join, index) => {
    if (!dictionaryCaliberTableName(join.table)) errors.push(`joins[${index}] 缺少 table`);
    if (!join.on) errors.push(`joins[${index}] 缺少 on`);
    else validateDictionaryJsonCondition(join.on, `joins[${index}].on`).forEach(error => errors.push(error));
    validateDictionaryCaliberSelectLatest(join.select_latest, `joins[${index}].select_latest`).forEach(error => errors.push(error));
  });
  if (rule.where) validateDictionaryJsonCondition(rule.where, "where").forEach(error => errors.push(error));
  if (rule.limit !== undefined && (!Number.isInteger(rule.limit) || rule.limit <= 0)) errors.push("limit 必须是正整数");
  return errors;
}

function validateDictionaryCaliberSelectLatest(rule: DictionaryCaliberSelectLatest | undefined, path: string): string[] {
  if (!rule) return [];
  const errors: string[] = [];
  if (!Array.isArray(rule.order_by) || rule.order_by.length === 0) errors.push(`${path}.order_by 必须填写，用于判定最新记录`);
  rule.order_by?.forEach((item, index) => {
    if (typeof item === "string") return;
    const direction = item.direction?.trim().toUpperCase();
    if (direction && direction !== "ASC" && direction !== "DESC") errors.push(`${path}.order_by[${index}].direction 只能是 ASC 或 DESC`);
    if (!item.source && !item.expr) errors.push(`${path}.order_by[${index}] 缺少 source 或 expr`);
  });
  rule.partition_by?.forEach((item, index) => {
    if (typeof item !== "string" && !item.source && !item.expr) errors.push(`${path}.partition_by[${index}] 缺少 source 或 expr`);
  });
  if (rule.limit !== undefined && (!Number.isInteger(rule.limit) || rule.limit <= 0)) errors.push(`${path}.limit 必须是正整数`);
  return errors;
}

export function parseDictionaryJsonRuleStrict(logic: string): { rule?: DictionaryMappingJsonRule; error?: string } {
  const text = logic.trim();
  if (!text.startsWith("{")) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { error: "必须是 JSON 对象" };
    const rule = parsed as DictionaryMappingJsonRule;
    if (typeof rule.op !== "string" || !rule.op.trim()) return { error: "缺少 op" };
    const normalizedRule = normalizeDictionaryJsonParamRule({ ...rule, op: normalizeDictionaryJsonOp(rule.op) });
    const errors = validateDictionaryJsonRule(normalizedRule);
    return errors.length ? { error: errors.join("；") } : { rule: normalizedRule };
  } catch {
    return { error: "JSON 格式错误" };
  }
}

function normalizeDictionaryJsonParamRule(rule: DictionaryMappingJsonRule): DictionaryMappingJsonRule {
  if (rule.op !== "direct" || typeof rule.source !== "string") return rule;
  const paramName = dictionaryRuntimeParamName(rule.source);
  return paramName ? { ...rule, op: "param", name: paramName } : rule;
}

export function normalizeDictionaryJsonOp(op: string): string {
  const normalized = op.trim().replace(/\s+/g, "").toLowerCase();
  const aliases: Record<string, string> = {
    "空值兜底": "coalesce",
  };
  return aliases[normalized] || normalized;
}

function validateDictionaryJsonRule(rule: DictionaryMappingJsonRule, path = "规则"): string[] {
  const errors: string[] = [];
  const requireSource = () => {
    if (!isNonEmptyString(rule.source)) errors.push(`${path}.${rule.op} 缺少 source`);
  };
  const requireValue = (key: keyof DictionaryMappingJsonRule) => {
    if (rule[key] === undefined) errors.push(`${path}.${rule.op} 缺少 ${String(key)}`);
  };

  switch (rule.op) {
    case "direct":
      requireSource();
      break;
    case "random":
      break;
    case "null":
      break;
    case "literal":
    case "default":
    case "const":
      requireValue("value");
      break;
    case "sql":
    case "expr":
      if (!isNonEmptyString(rule.sql) && !isNonEmptyString(rule.expr)) errors.push(`${path}.${rule.op} 缺少 expr/sql`);
      break;
    case "cast":
      if (rule.value === undefined && !isNonEmptyString(rule.source)) errors.push(`${path}.cast 缺少 source/value`);
      if (!isNonEmptyString(rule.to)) errors.push(`${path}.cast 缺少 to`);
      validateDictionaryJsonValue(rule.value as DictionaryMappingJsonValue | undefined, `${path}.cast.value`).forEach(error => errors.push(error));
      break;
    case "abs_cast":
    case "coalesce_cast":
      requireSource();
      if (!isNonEmptyString(rule.to)) errors.push(`${path}.${rule.op} 缺少 to`);
      break;
    case "coalesce":
      requireSource();
      if (rule.default === undefined) errors.push(`${path}.coalesce 缺少 default`);
      validateDictionaryJsonValue(rule.default, `${path}.coalesce.default`).forEach(error => errors.push(error));
      break;
    case "date_parse":
      requireSource();
      if (!isNonEmptyString(rule.from)) errors.push(`${path}.date_parse 缺少 from`);
      break;
    case "param":
      if (!isNonEmptyString(rule.name)) errors.push(`${path}.param 缺少 name`);
      break;
    case "required_lookup":
    case "lookup_or_error":
      requireSource();
      if (!isNonEmptyString(rule.lookup)) errors.push(`${path}.${rule.op} 缺少 lookup`);
      break;
    case "substring_marker":
      requireSource();
      if (!isNonEmptyString(rule.marker)) errors.push(`${path}.substring_marker 缺少 marker`);
      if (!isPositiveNumber(rule.length)) errors.push(`${path}.substring_marker 缺少 length`);
      break;
    case "split_part":
      requireSource();
      if (!isNonEmptyString(rule.delimiter)) errors.push(`${path}.split_part 缺少 delimiter`);
      if (!isPositiveNumber(rule.index)) errors.push(`${path}.split_part 缺少 index`);
      break;
    case "round":
      requireValue("value");
      if (rule.scale !== undefined && !Number.isFinite(rule.scale)) errors.push(`${path}.round.scale 必须是数字`);
      validateDictionaryJsonValue(rule.value as DictionaryMappingJsonValue | undefined, `${path}.round.value`).forEach(error => errors.push(error));
      break;
    case "divide":
    case "multiply":
    case "subtract":
      requireValue("left");
      requireValue("right");
      validateDictionaryJsonValue(rule.left, `${path}.${rule.op}.left`).forEach(error => errors.push(error));
      validateDictionaryJsonValue(rule.right, `${path}.${rule.op}.right`).forEach(error => errors.push(error));
      break;
    case "add":
      if ((!rule.sources || rule.sources.length === 0) && (rule.left === undefined || rule.right === undefined)) {
        errors.push(`${path}.add 缺少 sources 或 left/right`);
      }
      validateDictionaryJsonValue(rule.left, `${path}.add.left`).forEach(error => errors.push(error));
      validateDictionaryJsonValue(rule.right, `${path}.add.right`).forEach(error => errors.push(error));
      break;
    case "nullif":
      requireValue("value");
      validateDictionaryJsonValue(rule.value as DictionaryMappingJsonValue | undefined, `${path}.nullif.value`).forEach(error => errors.push(error));
      validateDictionaryJsonValue(rule.compare, `${path}.nullif.compare`).forEach(error => errors.push(error));
      break;
    case "concat":
      if (!rule.sources || rule.sources.length === 0) errors.push(`${path}.concat 缺少 sources`);
      break;
    case "code_mapping":
      requireSource();
      if (!rule.map || typeof rule.map !== "object" || Array.isArray(rule.map) || Object.keys(rule.map).length === 0) {
        errors.push(`${path}.code_mapping 缺少 map`);
      }
      validateDictionaryJsonValue(rule.else, `${path}.code_mapping.else`).forEach(error => errors.push(error));
      break;
    case "case":
      if (!rule.when?.length) errors.push(`${path}.case 缺少 when`);
      rule.when?.forEach((branch, index) => {
        if (!branch.if) errors.push(`${path}.case.when[${index}] 缺少 if`);
        else validateDictionaryJsonCondition(branch.if, `${path}.case.when[${index}].if`).forEach(error => errors.push(error));
        if (branch.then === undefined) errors.push(`${path}.case.when[${index}] 缺少 then`);
        validateDictionaryJsonValue(branch.then, `${path}.case.when[${index}].then`).forEach(error => errors.push(error));
      });
      validateDictionaryJsonValue(rule.else, `${path}.case.else`).forEach(error => errors.push(error));
      break;
    case "manual_logic":
      break;
    case "db_generated":
    case "runtime_context":
      break;
    default:
      errors.push(`${path} 未知 op：${rule.op}`);
  }
  return errors;
}

function validateDictionaryJsonCondition(condition: DictionaryMappingJsonCondition, path: string): string[] {
  const errors: string[] = [];
  if (condition.and !== undefined) {
    if (!condition.and.length) errors.push(`${path}.and 不能为空`);
    condition.and.forEach((item, index) => validateDictionaryJsonCondition(item, `${path}.and[${index}]`).forEach(error => errors.push(error)));
    return errors;
  }
  if (condition.or !== undefined) {
    if (!condition.or.length) errors.push(`${path}.or 不能为空`);
    condition.or.forEach((item, index) => validateDictionaryJsonCondition(item, `${path}.or[${index}]`).forEach(error => errors.push(error)));
    return errors;
  }
  if (condition.not !== undefined) return validateDictionaryJsonCondition(condition.not, `${path}.not`);

  const operatorKeys: Array<keyof DictionaryMappingJsonCondition> = ["eq", "ne", "gt", "gte", "lt", "lte", "like", "in", "not_in"];
  const activeOperators = operatorKeys.filter(key => condition[key] !== undefined);
  if (condition.left === undefined && !isNonEmptyString(condition.source)) errors.push(`${path} 缺少 source/left`);
  if (activeOperators.length !== 1) errors.push(`${path} 必须且只能填写一个比较动作`);
  activeOperators.forEach(key => {
    if (key === "in" || key === "not_in") {
      const values = condition[key];
      if (!Array.isArray(values) || values.length === 0) {
        errors.push(`${path}.${String(key)} 必须是非空数组`);
        return;
      }
      values.forEach((value, index) => validateDictionaryJsonValue(value, `${path}.${String(key)}[${index}]`).forEach(error => errors.push(error)));
      return;
    }
    validateDictionaryJsonValue(condition[key] as DictionaryMappingJsonValue, `${path}.${String(key)}`).forEach(error => errors.push(error));
  });
  validateDictionaryJsonValue(condition.left, `${path}.left`).forEach(error => errors.push(error));
  return errors;
}

function validateDictionaryJsonValue(value: DictionaryMappingJsonValue | undefined, path: string): string[] {
  if (value === undefined || value === null) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return [];
  if ("op" in value && typeof value.op === "string") return validateDictionaryJsonRule({ ...value, op: normalizeDictionaryJsonOp(value.op) }, path);
  if ("source" in value && value.source !== undefined) return isNonEmptyString(value.source) ? [] : [`${path}.source 不能为空`];
  if ("value" in value) return [];
  if ("expr" in value || "sql" in value) return isNonEmptyString(value.expr) || isNonEmptyString(value.sql) ? [] : [`${path}.expr/sql 不能为空`];
  return [`${path} 不是标准值结构`];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function dictionaryCaliberTableName(value?: string | { table?: string; alias?: string }): string {
  if (typeof value === "string") return value.trim();
  return value?.table?.trim() || "";
}

export function dictionaryRuntimeParamName(value?: string): string {
  const text = value?.trim() || "";
  const placeholder = text.match(/^:([A-Za-z_][\w$]*)$/);
  if (placeholder) return placeholder[1];
  const cnMatch = text.match(/^(参数|入参)[.\s:：]+([A-Za-z_][\w$]*)$/);
  if (cnMatch) return cnMatch[2] || "";
  const enMatch = text.match(/^(param|params|runtime|runtime_context)[.:：]+([A-Za-z_][\w$]*)$/i);
  return enMatch?.[2] || "";
}
