import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";

const PROJECT_ID = "vtb-二代safe";
const LEGACY_SYSTEM_ID = "vtb-safe-report";
const SOURCE_DOC = "/Users/binkerking/Documents/Ai-WorkSpace/Rich/docs/VTB_SAFE2_REPORTING_DATA_DICTIONARY_INPUT.md";
const RICH_URL = process.env.RICH_DB_URL ?? "postgresql://binkerking@localhost/rich?host=/tmp&port=5432";
const NOW = new Date().toISOString();

const REPORTING_MODULES = [
  { key: "CFA", id: "vtb-safe-report-cfa", code: "SAFE_CFA", name: "SAFE 报表层-CFA", group: "资本项目" },
  { key: "EXD", id: "vtb-safe-report-exd", code: "SAFE_EXD", name: "SAFE 报表层-EXD", group: "银行自身外债" },
  { key: "FAL", id: "vtb-safe-report-fal", code: "SAFE_FAL", name: "SAFE 报表层-FAL", group: "对外金融资产负债及交易统计" },
  { key: "ACC", id: "vtb-safe-report-acc", code: "SAFE_ACC", name: "SAFE 报表层-ACC", group: "外汇账户" },
  { key: "JSH", id: "vtb-safe-report-jsh", code: "SAFE_JSH", name: "SAFE 报表层-JSH", group: "外汇账户内结售汇" },
  { key: "BOP", id: "vtb-safe-report-bop", code: "SAFE_BOP", name: "SAFE 报表层-BOP", group: "国际收支" },
] as const;

type ReportingModule = typeof REPORTING_MODULES[number];

type TableSpec = {
  ownerSystem: string;
  tableName: string;
  tableCn: string | null;
  tableGroup: string | null;
  dataLayer: string | null;
  sourceKind: string | null;
  caliber: string | null;
  evidence: string | null;
  remark: string | null;
};

type FieldSpec = {
  tableName: string;
  order: number;
  fieldName: string;
  fieldCn: string | null;
  fieldType: string | null;
  fieldLength: string | null;
  formatPattern: string | null;
  required: boolean;
  nullable: string;
  primaryKey: boolean;
  description: string | null;
  codeValue: string | null;
  evidence: string | null;
  remark: string | null;
};

async function main(): Promise<void> {
  const markdown = await readFile(SOURCE_DOC, "utf8");
  const system = parseSystem(markdown);
  const tables = parseTables(markdown);
  const fields = parseFields(markdown);
  const tableSystems = new Map(tables.map((table) => [table.tableName, moduleForTable(table).id]));

  const pool = new Pool({ connectionString: RICH_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await upsertSystems(client, system);
    await clearReportingSystems(client);
    await insertTables(client, tables);
    await insertFields(client, fields, tableSystems);
    await rebuildSearchIndex(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  const fieldTables = new Set(fields.map((field) => field.tableName));
  const moduleCounts = REPORTING_MODULES.reduce<Record<string, string>>((result, module) => {
    const moduleTables = tables.filter((table) => moduleForTable(table).id === module.id);
    const names = new Set(moduleTables.map((table) => table.tableName));
    const fieldCount = fields.filter((field) => names.has(field.tableName)).length;
    result[module.code] = `${moduleTables.length} tables / ${fieldCount} fields`;
    return result;
  }, {});
  console.table({
    tables: tables.length,
    fieldTables: fieldTables.size,
    fields: fields.length,
    skippedUnknownTableNames: [...fieldTables].filter((name) => !tables.some((table) => table.tableName === name)).length,
    ...moduleCounts,
  });
}

function parseSystem(markdown: string): TableSpec {
  const [row] = rowsAfterHeading(markdown, "## 1. 库元");
  if (!row) throw new Error("未找到库元表。");
  return {
    ownerSystem: cleanRequired(row[0]),
    tableName: cleanRequired(row[0]),
    tableCn: cleanOptional(row[1]),
    tableGroup: null,
    dataLayer: cleanOptional(row[3]),
    sourceKind: cleanOptional(row[2]),
    caliber: cleanOptional(row[4]),
    evidence: cleanOptional(row[6]),
    remark: cleanOptional(row[7]),
  };
}

function parseTables(markdown: string): TableSpec[] {
  return rowsAfterHeading(markdown, "## 2. 表元清单")
    .filter((row) => row[0] === "SAFE_REPORTING")
    .map((row) => ({
      ownerSystem: cleanRequired(row[0]),
      tableName: cleanRequired(row[1]),
      tableCn: cleanOptional(row[2]),
      tableGroup: cleanOptional(row[3]),
      dataLayer: cleanOptional(row[4]) ?? "报表层",
      sourceKind: normalizeCarrier(cleanOptional(row[5])) ?? "数据库",
      caliber: cleanOptional(row[6]),
      evidence: cleanOptional(row[10]),
      remark: cleanOptional(row[11]),
    }));
}

function parseFields(markdown: string): FieldSpec[] {
  const fields: FieldSpec[] = [];
  const heading = /^### 表：(.+)$/gm;
  const matches = [...markdown.matchAll(heading)];
  for (const [index, match] of matches.entries()) {
    const tableName = cleanRequired(match[1]);
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? markdown.length;
    const section = markdown.slice(start, end);
    for (const row of rowsAfterText(section)) {
      const order = Number(row[0]);
      if (!Number.isFinite(order) || !row[1]) continue;
      const required = cleanOptional(row[6]) === "是";
      fields.push({
        tableName,
        order,
        fieldName: cleanRequired(row[1]),
        fieldCn: cleanOptional(row[2]),
        fieldType: cleanOptional(row[3]),
        fieldLength: cleanOptional(row[4]),
        formatPattern: cleanOptional(row[5]),
        required,
        nullable: required ? "否" : "是",
        primaryKey: cleanOptional(row[7]) === "是",
        description: cleanOptional(row[8]),
        codeValue: cleanOptional(row[9]),
        evidence: cleanOptional(row[10]),
        remark: cleanOptional(row[11]),
      });
    }
  }
  return fields;
}

async function upsertSystems(client: PoolClient, system: TableSpec): Promise<void> {
  for (const module of REPORTING_MODULES) {
    await client.query(
      `
        INSERT INTO pm_data_systems (id, project_id, code, name, type, asset_layer, description, extra, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$9)
        ON CONFLICT (id) DO UPDATE SET
          code=EXCLUDED.code,
          name=EXCLUDED.name,
          type=EXCLUDED.type,
          asset_layer=EXCLUDED.asset_layer,
          description=EXCLUDED.description,
          extra=pm_data_systems.extra || EXCLUDED.extra,
          updated_at=EXCLUDED.updated_at
      `,
      [
        module.id,
        PROJECT_ID,
        module.code,
        module.name,
        system.sourceKind ?? "reporting",
        system.dataLayer ?? "报表层",
        `${module.group}报表层，承载二代 SAFE ${module.key} 模块的数据维护、报文生成前数据结构及报表口径字段。`,
        JSON.stringify({
          evidence: evidenceList(system.evidence),
          sourceDocument: SOURCE_DOC,
          reportingModule: module.key,
          reportingGroup: module.group,
          reportingDictionarySyncedAt: NOW,
        }),
        NOW,
      ],
    );
  }
}

async function clearReportingSystems(client: PoolClient): Promise<void> {
  const entityIds = await currentEntityIds(client);
  const systemIds = reportingSystemIds();
  await client.query(
    `
      DELETE FROM pm_search_index
      WHERE project_id=$1
        AND (
          entity_id = ANY($2::text[])
          OR id LIKE 'dict-table:vtb-safe-report%'
          OR id LIKE 'dict-field:vtb-safe-report%'
        )
    `,
    [PROJECT_ID, entityIds],
  );
  await client.query("DELETE FROM pm_entity_links WHERE project_id=$1 AND (from_id = ANY($2::text[]) OR to_id = ANY($2::text[]))", [
    PROJECT_ID,
    entityIds,
  ]);
  await client.query("DELETE FROM pm_dictionary_rectifications WHERE project_id=$1 AND entity_id = ANY($2::text[])", [PROJECT_ID, entityIds]);
  await client.query("DELETE FROM pm_mapping_rules WHERE project_id=$1 AND system_id = ANY($2::text[])", [PROJECT_ID, systemIds]);
  await client.query("DELETE FROM pm_data_tables WHERE project_id=$1 AND system_id = ANY($2::text[])", [PROJECT_ID, systemIds]);
  await client.query("DELETE FROM pm_data_systems WHERE project_id=$1 AND id=$2", [PROJECT_ID, LEGACY_SYSTEM_ID]);
}

async function currentEntityIds(client: PoolClient): Promise<string[]> {
  const systemIds = reportingSystemIds();
  const result = await client.query<{ id: string }>(
    `
      SELECT id FROM pm_data_tables WHERE project_id=$1 AND system_id = ANY($2::text[])
      UNION
      SELECT id FROM pm_data_fields WHERE project_id=$1 AND system_id = ANY($2::text[])
    `,
    [PROJECT_ID, systemIds],
  );
  return result.rows.map((row) => row.id);
}

async function insertTables(client: PoolClient, tables: TableSpec[]): Promise<void> {
  for (const table of tables) {
    await client.query(
      `
        INSERT INTO pm_data_tables (
          id, project_id, system_id, database_name, schema_name, table_name, table_cn,
          description, caliber, extra, created_at, updated_at, data_layer, source_kind,
          table_group, file_type, usage_status
        ) VALUES ($1,$2,$3,'safe',NULL,$4,$5,$6,$7,$8::jsonb,$9,$9,$10,$11,$12,'database','待确认')
      `,
      [
        tableIdFor(table.tableName),
        PROJECT_ID,
        moduleForTable(table).id,
        table.tableName,
        table.tableCn,
        table.caliber ? `${table.caliber}。` : null,
        table.caliber,
        JSON.stringify({
          evidence: evidenceList(table.evidence),
          sourceDocument: SOURCE_DOC,
          sourceSystemCode: table.ownerSystem,
          reportingModule: moduleForTable(table).key,
          originalCarrier: table.sourceKind,
          remark: table.remark,
          reportingDictionarySyncedAt: NOW,
        }),
        NOW,
        table.dataLayer ?? "报表层",
        table.sourceKind ?? "数据库表",
        table.tableGroup,
      ],
    );
  }
}

async function insertFields(client: PoolClient, fields: FieldSpec[], tableSystems: Map<string, string>): Promise<void> {
  for (const field of fields) {
    const systemId = tableSystems.get(field.tableName);
    if (!systemId) continue;
    await client.query(
      `
        INSERT INTO pm_data_fields (
          id, project_id, system_id, table_id, field_name, field_cn, field_type,
          field_length, nullable, primary_key, required, description, acquire_logic,
          validation_rule, code_value, data_source, remark, extra, created_at, updated_at,
          format_pattern, field_order, carrier_kind
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NULL,NULL,$13,$14,$15,$16::jsonb,$17,$17,$18,$19,'database'
        )
      `,
      [
        fieldIdFor(field.tableName, field.fieldName),
        PROJECT_ID,
        systemId,
        tableIdFor(field.tableName),
        field.fieldName,
        field.fieldCn,
        field.fieldType,
        field.fieldLength,
        field.nullable,
        field.primaryKey,
        field.required,
        field.description,
        field.codeValue,
        SOURCE_DOC,
        field.remark,
        JSON.stringify({
          evidence: evidenceList(field.evidence),
          sourceDocument: SOURCE_DOC,
          rawFormat: field.formatPattern,
          reportingDictionarySyncedAt: NOW,
        }),
        NOW,
        field.formatPattern,
        field.order,
      ],
    );
  }
}

async function rebuildSearchIndex(client: PoolClient): Promise<void> {
  const systemIds = REPORTING_MODULES.map((module) => module.id);
  await client.query(
    `
      INSERT INTO pm_search_index (id, project_id, module_key, entity_type, entity_id, title, subtitle, body, keywords, search_text, updated_at)
      SELECT 'dict-table:' || id, project_id, 'dictionary', 'table', id, table_name, coalesce(table_cn,''),
        coalesce(description,''), coalesce(data_layer,'') || ' ' || coalesce(source_kind,'') || ' ' || coalesce(table_group,''),
        table_name || ' ' || coalesce(table_cn,'') || ' ' || coalesce(description,'') || ' ' || coalesce(caliber,''), $2
      FROM pm_data_tables
      WHERE project_id=$1 AND system_id = ANY($3::text[])
      ON CONFLICT (project_id, entity_type, entity_id) DO UPDATE SET
        title=EXCLUDED.title, subtitle=EXCLUDED.subtitle, body=EXCLUDED.body,
        keywords=EXCLUDED.keywords, search_text=EXCLUDED.search_text, updated_at=EXCLUDED.updated_at
    `,
    [PROJECT_ID, NOW, systemIds],
  );
  await client.query(
    `
      INSERT INTO pm_search_index (id, project_id, module_key, entity_type, entity_id, title, subtitle, body, keywords, search_text, updated_at)
      SELECT 'dict-field:' || f.id, f.project_id, 'dictionary', 'field', f.id, f.field_name, coalesce(f.field_cn,''),
        coalesce(f.description,''), coalesce(f.field_type,'') || ' ' || coalesce(f.field_length,'') || ' ' || coalesce(f.format_pattern,''),
        coalesce(t.table_name,'') || ' ' || coalesce(t.table_cn,'') || ' ' || f.field_name || ' ' || coalesce(f.field_cn,'') || ' ' || coalesce(f.description,''), $2
      FROM pm_data_fields f
      JOIN pm_data_tables t ON t.id=f.table_id
      WHERE f.project_id=$1 AND f.system_id = ANY($3::text[])
      ON CONFLICT (project_id, entity_type, entity_id) DO UPDATE SET
        title=EXCLUDED.title, subtitle=EXCLUDED.subtitle, body=EXCLUDED.body,
        keywords=EXCLUDED.keywords, search_text=EXCLUDED.search_text, updated_at=EXCLUDED.updated_at
    `,
    [PROJECT_ID, NOW, systemIds],
  );
}

function rowsAfterHeading(markdown: string, heading: string): string[][] {
  const start = markdown.indexOf(heading);
  if (start < 0) return [];
  const next = markdown.slice(start + heading.length).search(/^## /m);
  const section = markdown.slice(start + heading.length, next < 0 ? markdown.length : start + heading.length + next);
  return rowsAfterText(section);
}

function rowsAfterText(text: string): string[][] {
  const firstCells = new Set(["库编码", "所属库", "序号"]);
  return markdownRows(text).filter((row) => row.length > 0 && !firstCells.has(row[0]));
}

function markdownRows(section: string): string[][] {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && !line.includes("---"))
    .map(splitMarkdownTableRow);
}

function splitMarkdownTableRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  const trimmed = line.replace(/^\|/, "").replace(/\|$/, "");
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char === "|" && trimmed[index - 1] !== "\\") {
      cells.push(cleanCell(current));
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(cleanCell(current));
  return cells;
}

function cleanCell(value: string): string {
  return value
    .trim()
    .replace(/\\\|/g, "|")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/^`|`$/g, "")
    .trim();
}

function cleanRequired(value?: string): string {
  const cleaned = cleanOptional(value);
  if (!cleaned) throw new Error(`必填值缺失：${value ?? ""}`);
  return cleaned;
}

function cleanOptional(value?: string): string | null {
  const cleaned = (value ?? "").replace(/`/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned === "待确认" || cleaned === "-") return null;
  return cleaned;
}

function normalizeCarrier(value: string | null): string | null {
  if (!value) return null;
  return /文件|file|txt|csv|excel|xlsx|xml/i.test(value) ? "文件" : "数据库";
}

function moduleForTable(table: TableSpec): ReportingModule {
  const module = REPORTING_MODULES.find((item) => item.group === table.tableGroup);
  if (!module) throw new Error(`无法识别报表分组：${table.tableName} / ${table.tableGroup ?? ""}`);
  return module;
}

function reportingSystemIds(): string[] {
  return [LEGACY_SYSTEM_ID, ...REPORTING_MODULES.map((module) => module.id)];
}

function evidenceList(value: string | null): string[] {
  const items = value?.split(/[；;]/).map((item) => item.trim()).filter(Boolean) ?? [];
  return [SOURCE_DOC, ...items];
}

function tableIdFor(tableName: string): string {
  return `vtb-safe-report-table-${hash(tableName)}`;
}

function fieldIdFor(tableName: string, fieldName: string): string {
  return `vtb-safe-report-field-${hash(`${tableName}|${fieldName}`)}`;
}

function hash(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 16);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
