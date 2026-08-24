export type SafeIntermediateField = {
  tableName: string;
  fieldName: string;
  fieldCn: string;
  fieldType: string;
  fieldLength: string;
  formatPattern: string;
  nullable: string;
  primaryKey: boolean;
  required: boolean;
  description: string;
  codeSetName: string;
  evidence: string;
  remark: string;
  order: number;
  expandedFrom?: string;
};

export type SafeIntermediateMapping = {
  tableName: string;
  scenario: string;
  condition: string;
  targetField: string;
  targetCn: string;
  sourceRefs: string[];
  logic: string;
  sql: string;
  evidence: string;
  remark: string;
  order: number;
  expandedFrom?: string;
};

export type SafeStandardMappingLogic =
  | { op: "none" }
  | { op: "db_generated" }
  | { op: "direct"; source: string }
  | { op: "literal"; value: string | number }
  | { op: "cast"; source: string; to: string }
  | { op: "abs_cast"; source: string; to: string }
  | { op: "coalesce_cast"; source: string; emptyAs: string; to: string }
  | { op: "date_parse"; source: string; from: string }
  | { op: "param"; name: string }
  | { op: "substring_marker"; source: string; marker: string; length: number; stripQuotes?: boolean }
  | { op: "runtime_context"; name: string }
  | { op: "sql"; expr: string };

/** Completes every documented scenario without changing its mapping semantics. */
export function completeSafeIntermediateScenarioMappings(
  parsedMappings: SafeIntermediateMapping[],
  fields: SafeIntermediateField[],
): SafeIntermediateMapping[] {
  const fieldsByTable = new Map<string, SafeIntermediateField[]>();
  for (const field of fields) {
    const tableFields = fieldsByTable.get(field.tableName) ?? [];
    tableFields.push(field);
    fieldsByTable.set(field.tableName, tableFields);
  }
  for (const tableFields of fieldsByTable.values()) {
    tableFields.sort((left, right) => left.order - right.order || left.fieldName.localeCompare(right.fieldName));
  }

  const scenarioKeys: string[] = [];
  const mappingsByScenario = new Map<string, SafeIntermediateMapping[]>();
  for (const mapping of parsedMappings) {
    const key = scenarioKey(mapping.tableName, mapping.scenario);
    if (!mappingsByScenario.has(key)) {
      mappingsByScenario.set(key, []);
      scenarioKeys.push(key);
    }
    mappingsByScenario.get(key)?.push(mapping);
  }

  const completed: SafeIntermediateMapping[] = [];
  for (const key of scenarioKeys) {
    const scenarioMappings = mappingsByScenario.get(key) ?? [];
    const firstMapping = scenarioMappings[0];
    if (!firstMapping) continue;
    const tableFields = fieldsByTable.get(firstMapping.tableName) ?? [];
    const existingByField = new Map<string, SafeIntermediateMapping>();
    for (const mapping of scenarioMappings) {
      if (!existingByField.has(mapping.targetField)) existingByField.set(mapping.targetField, mapping);
    }
    for (const field of tableFields) {
      completed.push(existingByField.get(field.fieldName) ?? buildUnassignedMapping(firstMapping, field));
    }
  }
  return resolveInheritedMappings(completed).map((mapping, index) => ({ ...mapping, order: index + 1 }));
}

export function standardSafeIntermediateLogic(input: Pick<SafeIntermediateMapping, "logic" | "sql" | "sourceRefs">): SafeStandardMappingLogic {
  const logic = input.logic.trim();
  const sql = input.sql.trim();
  const onlySource = input.sourceRefs.length === 1 ? input.sourceRefs[0] : "";
  if (/^(无|空|null|-)$/i.test(logic) || /^(null)$/i.test(sql)) return { op: "none" };
  if (/数据库(?:\/ORM)?生成/.test(`${logic} ${sql}`)) return { op: "db_generated" };
  if (onlySource && isSimpleSqlPath(sql)) return { op: "direct", source: onlySource };
  const dateParseMatch = sql.match(/^to_date\((.+?),\s*'([^']+)'\)$/i);
  if (onlySource && dateParseMatch) return { op: "date_parse", source: onlySource, from: dateParseMatch[2].trim() };
  const absCastMatch = sql.match(/^abs\(cast\((.+?)\s+as\s+(.+?)\)\)$/i);
  if (onlySource && absCastMatch) return { op: "abs_cast", source: onlySource, to: absCastMatch[2].trim() };
  const coalesceCastMatch = sql.match(/^coalesce\(nullif\((.+?),\s*''\),\s*'([^']+)'\)::([A-Za-z0-9_(),]+)$/i);
  if (onlySource && coalesceCastMatch) return { op: "coalesce_cast", source: onlySource, emptyAs: coalesceCastMatch[2].trim(), to: coalesceCastMatch[3].trim() };
  const substringMarkerMatch = sql.match(/^substring\((.+?)\s+from\s+position\('([^']+)'\s+in\s+.+?\)\s+for\s+(\d+)\)$/i);
  if (onlySource && substringMarkerMatch) return { op: "substring_marker", source: onlySource, marker: substringMarkerMatch[2], length: Number(substringMarkerMatch[3]) };
  const replaceSubstringMarkerMatch = sql.match(/^replace\(substring\((.+?)\s+from\s+position\('([^']+)'\s+in\s+.+?\)\s+for\s+(\d+)\),\s*'\\"',\s*''\)$/i);
  if (onlySource && replaceSubstringMarkerMatch) {
    return { op: "substring_marker", source: onlySource, marker: replaceSubstringMarkerMatch[2], length: Number(replaceSubstringMarkerMatch[3]), stripQuotes: true };
  }
  const castMatch = sql.match(/^cast\((.+)\s+as\s+(.+)\)$/i);
  if (onlySource && castMatch) return { op: "cast", source: onlySource, to: castMatch[2].trim() };
  if (sql === "p_import_date") return { op: "param", name: "importDate" };
  if (/^无法直接 SQL 化/.test(sql)) return { op: "runtime_context", name: logic || sql };
  if (/^'.*'$/.test(sql)) return { op: "literal", value: sql.slice(1, -1) };
  if (/^-?\d+(?:\.\d+)?$/.test(sql)) return { op: "literal", value: Number(sql) };
  return { op: "sql", expr: sql };
}

function resolveInheritedMappings(mappings: SafeIntermediateMapping[]): SafeIntermediateMapping[] {
  const previousByField = new Map<string, SafeIntermediateMapping>();
  return mappings.map(mapping => {
    const key = `${mapping.tableName}\u0000${mapping.targetField}`;
    const inherited = isInheritedSql(mapping.sql) ? previousByField.get(key) : undefined;
    const resolved = inherited?.sql && !isInheritedSql(inherited.sql)
      ? { ...mapping, sql: inherited.sql, sourceRefs: mapping.sourceRefs.length > 0 ? mapping.sourceRefs : inherited.sourceRefs, remark: mergeRemarks(mapping.remark, `SQL转换继承自场景：${inherited.scenario}`) }
      : mapping;
    if (!isInheritedSql(resolved.sql)) previousByField.set(key, resolved);
    return resolved;
  });
}

function isInheritedSql(sql: string): boolean { return /^同/.test(sql.trim()); }

function buildUnassignedMapping(scenarioMapping: SafeIntermediateMapping, field: SafeIntermediateField): SafeIntermediateMapping {
  const isGeneratedKey = isGeneratedPrimaryKey(field);
  return {
    tableName: field.tableName, scenario: scenarioMapping.scenario, condition: scenarioMapping.condition,
    targetField: field.fieldName, targetCn: field.fieldCn || "待确认", sourceRefs: [],
    logic: isGeneratedKey ? "数据库/ORM生成主键；本场景无来源字段，Java 逻辑不赋值。" : "-",
    sql: isGeneratedKey ? "数据库/ORM生成" : "NULL", evidence: field.evidence || "字段设计补齐",
    remark: mergeRemarks(field.remark, "字段设计补齐项；本场景无来源字段，Java 自动生成逻辑未见赋值证据。"),
    order: 0, expandedFrom: field.expandedFrom,
  };
}

function isGeneratedPrimaryKey(field: SafeIntermediateField): boolean {
  return field.primaryKey || /主键|Hibernate native/i.test(`${field.fieldCn} ${field.description}`);
}

function isSimpleSqlPath(value: string): boolean { return /^[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)?$/.test(value.trim()); }
function mergeRemarks(...values: string[]): string { return values.map(value => value.trim()).filter(Boolean).join("；"); }
function scenarioKey(tableName: string, scenario: string): string { return `${tableName}\u0000${scenario}`; }
