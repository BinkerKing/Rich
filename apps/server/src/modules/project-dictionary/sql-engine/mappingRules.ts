import type { DictionaryMappingJsonCondition, DictionaryMappingJsonRule, DictionaryMappingJsonRuleValue } from "@ke/domain";

type DictionaryMappingRuleValue = DictionaryMappingJsonRuleValue;
const dictionaryEntityString = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
function dictionaryExtractionRuntimeParamName(value: string | undefined): string {
  const text = dictionaryEntityString(value);
  const placeholder = text.match(/^:([A-Za-z_][\w$]*)$/);
  if (placeholder) return placeholder[1] || "";
  const cnMatch = text.match(/^(参数|入参)[.\s:：]+([A-Za-z_][\w$]*)$/);
  if (cnMatch) return cnMatch[2] || "";
  return text.match(/^(param|params|runtime|runtime_context)[.:：]+([A-Za-z_][\w$]*)$/i)?.[2] || "";
}

export function normalizeDictionaryExtractionOp(op: string): string {
  const normalized = op.trim().replace(/\s+/g, "").toLowerCase();
  const aliases: Record<string, string> = {
    "直取": "direct",
    "直接取数": "direct",
    "常量": "literal",
    "默认值": "default",
    "置空": "null",
    "随机生成": "random",
    "数据库生成": "db_generated",
    "码值映射": "code_mapping",
    "判断": "case",
    "类型转换": "cast",
    "空值兜底": "coalesce",
    "全表抽取": "full_extract",
    "分组聚合": "group_aggregate",
    "相对日期边界": "relative_date_boundary",
  };
  return aliases[normalized] || normalized;
}

export function validateDictionaryExtractionJsonRule(rule: DictionaryMappingJsonRule, path = "规则"): string[] {
  const op = normalizeDictionaryExtractionOp(rule.op);
  const errors: string[] = [];
  const requireSource = () => {
    if (!dictionaryEntityString(rule.source)) errors.push(`${path}.${op} 缺少 source`);
  };
  const requireValue = (key: keyof DictionaryMappingJsonRule) => {
    if (rule[key] === undefined) errors.push(`${path}.${op} 缺少 ${String(key)}`);
  };
  switch (op) {
    case "direct":
      requireSource();
      break;
    case "literal":
    case "default":
    case "const":
      requireValue("value");
      break;
    case "null":
    case "empty":
    case "random":
    case "db_generated":
      break;
    case "code_mapping":
      requireSource();
      if (!rule.map || typeof rule.map !== "object" || Array.isArray(rule.map) || Object.keys(rule.map).length === 0) {
        errors.push(`${path}.code_mapping 缺少 map`);
      }
      validateDictionaryExtractionRuleValue(rule.else, `${path}.code_mapping.else`).forEach(error => errors.push(error));
      break;
    case "case":
      if (!rule.when?.length) errors.push(`${path}.case 缺少 when`);
      rule.when?.forEach((branch, index) => {
        if (!branch.if) errors.push(`${path}.case.when[${index}] 缺少 if`);
        else validateDictionaryExtractionConditionRule(branch.if, `${path}.case.when[${index}].if`).forEach(error => errors.push(error));
        if (branch.then === undefined) errors.push(`${path}.case.when[${index}] 缺少 then`);
        validateDictionaryExtractionRuleValue(branch.then, `${path}.case.when[${index}].then`).forEach(error => errors.push(error));
      });
      validateDictionaryExtractionRuleValue(rule.else, `${path}.case.else`).forEach(error => errors.push(error));
      break;
    case "cast":
      if (rule.value === undefined && !dictionaryEntityString(rule.source)) errors.push(`${path}.cast 缺少 source/value`);
      if (!dictionaryEntityString(rule.to)) errors.push(`${path}.cast 缺少 to`);
      validateDictionaryExtractionRuleValue(rule.value as DictionaryMappingRuleValue | undefined, `${path}.cast.value`).forEach(error => errors.push(error));
      break;
    case "abs_cast":
    case "coalesce_cast":
      requireSource();
      if (!dictionaryEntityString(rule.to)) errors.push(`${path}.${op} 缺少 to`);
      break;
    case "coalesce":
      requireSource();
      if (rule.default === undefined) errors.push(`${path}.coalesce 缺少 default`);
      validateDictionaryExtractionRuleValue(rule.default, `${path}.coalesce.default`).forEach(error => errors.push(error));
      break;
    case "date_parse":
      requireSource();
      if (!dictionaryEntityString(rule.from)) errors.push(`${path}.date_parse 缺少 from`);
      break;
    case "param":
    case "runtime_context":
      if (!dictionaryEntityString(rule.name)) errors.push(`${path}.${op} 缺少 name`);
      break;
    case "required_lookup":
    case "lookup_or_error":
      requireSource();
      if (!dictionaryEntityString(rule.lookup)) errors.push(`${path}.${op} 缺少 lookup`);
      break;
    case "substring_marker":
      requireSource();
      if (!dictionaryEntityString(rule.marker)) errors.push(`${path}.substring_marker 缺少 marker`);
      if (!isPositiveDictionaryExtractionNumber(rule.length)) errors.push(`${path}.substring_marker 缺少 length`);
      break;
    case "split_part":
      requireSource();
      if (!dictionaryEntityString(rule.delimiter)) errors.push(`${path}.split_part 缺少 delimiter`);
      if (!isPositiveDictionaryExtractionNumber(rule.index)) errors.push(`${path}.split_part 缺少 index`);
      break;
    case "round":
      requireValue("value");
      validateDictionaryExtractionRuleValue(rule.value as DictionaryMappingRuleValue | undefined, `${path}.round.value`).forEach(error => errors.push(error));
      break;
    case "divide":
    case "multiply":
    case "subtract":
      requireValue("left");
      requireValue("right");
      validateDictionaryExtractionRuleValue(rule.left, `${path}.${op}.left`).forEach(error => errors.push(error));
      validateDictionaryExtractionRuleValue(rule.right, `${path}.${op}.right`).forEach(error => errors.push(error));
      break;
    case "add":
      if ((!rule.sources || rule.sources.length === 0) && (rule.left === undefined || rule.right === undefined)) {
        errors.push(`${path}.add 缺少 sources 或 left/right`);
      }
      validateDictionaryExtractionRuleValue(rule.left, `${path}.add.left`).forEach(error => errors.push(error));
      validateDictionaryExtractionRuleValue(rule.right, `${path}.add.right`).forEach(error => errors.push(error));
      break;
    case "nullif":
      requireValue("value");
      validateDictionaryExtractionRuleValue(rule.value as DictionaryMappingRuleValue | undefined, `${path}.nullif.value`).forEach(error => errors.push(error));
      validateDictionaryExtractionRuleValue(rule.compare, `${path}.nullif.compare`).forEach(error => errors.push(error));
      break;
    case "concat":
      if (!rule.sources?.length) errors.push(`${path}.concat 缺少 sources`);
      break;
    case "group_aggregate":
      requireSource();
      if (!/^(sum|count|avg|min|max)$/i.test(dictionaryEntityString(rule.aggregate))) {
        errors.push(`${path}.group_aggregate aggregate 仅支持 sum/count/avg/min/max`);
      }
      break;
    case "union_all":
      if (!rule.branches?.length) errors.push(`${path}.union_all 缺少 branches`);
      rule.branches?.forEach((branch, index) => {
        if (!dictionaryEntityString(branch.source) && branch.value === undefined) errors.push(`${path}.union_all.branches[${index}] 缺少 source/value`);
      });
      break;
    case "relative_date_boundary":
      requireSource();
      if (rule.unit && !["day", "month", "year"].includes(rule.unit)) errors.push(`${path}.relative_date_boundary unit 仅支持 day/month/year`);
      if (rule.boundary && !["start", "end"].includes(rule.boundary)) errors.push(`${path}.relative_date_boundary boundary 仅支持 start/end`);
      if (rule.offset !== undefined && (!Number.isFinite(rule.offset) || !Number.isInteger(rule.offset))) errors.push(`${path}.relative_date_boundary offset 必须是整数`);
      break;
    case "sql":
    case "expr":
      errors.push(`${path}.${op} 是 SQL 兜底动作，不参与自动抽取`);
      break;
    default:
      errors.push(`${path} 未知 op：${rule.op}`);
  }
  return errors;
}

function validateDictionaryExtractionRuleValue(value: DictionaryMappingRuleValue | undefined, path: string): string[] {
  if (value === undefined || value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return [];
  if ("op" in value && typeof value.op === "string") return validateDictionaryExtractionJsonRule({ ...value, op: normalizeDictionaryExtractionOp(value.op) }, path);
  if ("source" in value) return dictionaryEntityString(value.source) ? [] : [`${path}.source 不能为空`];
  if ("value" in value) return [];
  return [`${path} 不是标准值结构`];
}

function validateDictionaryExtractionConditionRule(condition: DictionaryMappingJsonCondition, path: string): string[] {
  const errors: string[] = [];
  if (condition.and !== undefined) {
    if (!condition.and.length) errors.push(`${path}.and 不能为空`);
    condition.and.forEach((item, index) => validateDictionaryExtractionConditionRule(item, `${path}.and[${index}]`).forEach(error => errors.push(error)));
    return errors;
  }
  if (condition.or !== undefined) {
    if (!condition.or.length) errors.push(`${path}.or 不能为空`);
    condition.or.forEach((item, index) => validateDictionaryExtractionConditionRule(item, `${path}.or[${index}]`).forEach(error => errors.push(error)));
    return errors;
  }
  if (condition.not !== undefined) return validateDictionaryExtractionConditionRule(condition.not, `${path}.not`);
  const operatorKeys: Array<keyof DictionaryMappingJsonCondition> = ["eq", "ne", "gt", "gte", "lt", "lte", "like", "in", "not_in"];
  const activeOperators = operatorKeys.filter(key => condition[key] !== undefined);
  if (condition.left === undefined && !dictionaryEntityString(condition.source)) errors.push(`${path} 缺少 source/left`);
  if (activeOperators.length !== 1) errors.push(`${path} 必须且只能填写一个比较动作`);
  activeOperators.forEach(key => {
    if (key === "in" || key === "not_in") {
      const values = condition[key];
      if (!Array.isArray(values) || values.length === 0) {
        errors.push(`${path}.${String(key)} 必须是非空数组`);
        return;
      }
      values.forEach((value, index) => validateDictionaryExtractionRuleValue(value, `${path}.${String(key)}[${index}]`).forEach(error => errors.push(error)));
      return;
    }
    validateDictionaryExtractionRuleValue(condition[key] as DictionaryMappingRuleValue, `${path}.${String(key)}`).forEach(error => errors.push(error));
  });
  validateDictionaryExtractionRuleValue(condition.left, `${path}.left`).forEach(error => errors.push(error));
  return errors;
}

function isPositiveDictionaryExtractionNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function parseDictionaryExtractionJsonRule(logic: string): DictionaryMappingJsonRule | null {
  const text = logic.trim();
  if (!text.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const rule = parsed as DictionaryMappingJsonRule;
    return typeof rule.op === "string"
      ? normalizeDictionaryExtractionParamRule({ ...rule, op: normalizeDictionaryExtractionOp(rule.op) })
      : null;
  } catch {
    return null;
  }
}

function normalizeDictionaryExtractionParamRule(rule: DictionaryMappingJsonRule): DictionaryMappingJsonRule {
  if (normalizeDictionaryExtractionOp(rule.op) !== "direct") return rule;
  const paramName = dictionaryExtractionRuntimeParamName(rule.source);
  return paramName ? { ...rule, op: "param", name: paramName } : rule;
}

export function collectDictionaryExtractionValueRefs(value: unknown): string[] {
  const refs: string[] = [];
  const visit = (item: unknown) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    if (typeof record.source === "string") refs.push(record.source);
    if (Array.isArray(record.sources)) {
      record.sources.forEach(source => {
        if (typeof source === "string") refs.push(source);
      });
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  return refs;
}

export function collectDictionaryExtractionConditionRefs(condition: DictionaryMappingJsonCondition | undefined): string[] {
  if (!condition) return [];
  return [
    ...(condition.source ? [condition.source] : []),
    ...collectDictionaryExtractionValueRefs(condition.left),
    ...collectDictionaryExtractionValueRefs(condition.eq),
    ...collectDictionaryExtractionValueRefs(condition.ne),
    ...collectDictionaryExtractionValueRefs(condition.gt),
    ...collectDictionaryExtractionValueRefs(condition.gte),
    ...collectDictionaryExtractionValueRefs(condition.lt),
    ...collectDictionaryExtractionValueRefs(condition.lte),
    ...collectDictionaryExtractionValueRefs(condition.like),
    ...(condition.in ?? []).flatMap(collectDictionaryExtractionValueRefs),
    ...(condition.not_in ?? []).flatMap(collectDictionaryExtractionValueRefs),
    ...(condition.and ?? []).flatMap(collectDictionaryExtractionConditionRefs),
    ...(condition.or ?? []).flatMap(collectDictionaryExtractionConditionRefs),
    ...collectDictionaryExtractionConditionRefs(condition.not),
  ];
}
