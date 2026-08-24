import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";

const PROJECT_ID = "vtb-二代safe";
const SYSTEM_ID = "vtb-safe-message";
const SYSTEM_CODE = "SAFE_MESSAGE";
const RICH_URL = process.env.RICH_DB_URL ?? "postgresql://binkerking@localhost/rich?host=/tmp&port=5432";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const GENERATED_JSON = resolve(SCRIPT_DIR, "generated/safe-message-regulatory-nodes.json");
const NOW = new Date().toISOString();

type RegulatoryField = {
  fieldName: string;
  fieldCn: string;
  fieldType: string;
  fieldLength: string;
  formatPattern: string;
  description: string;
  validation: string;
  order: number;
  xmlTag: string;
  xmlPath: string;
  container: boolean;
  rawType: string;
};

type RegulatoryReport = {
  tableIndex: number;
  tableName: string;
  tableCn: string;
  group: string;
  title: string;
  fieldCount: number;
  dictionaryFieldCount: number;
  xmlNodeCount: number;
  interfaceNamingRule?: {
    fileType: string;
    applicationType: string;
    interfaceTypeCode: string;
    description: string;
    normalized: string;
  };
  fields: RegulatoryField[];
};

type RegulatoryExtract = {
  sourceDoc: string;
  sourceDocTitle: string;
  scope: string;
  tableCount: number;
  fieldCount: number;
  reports: RegulatoryReport[];
};

async function main(): Promise<void> {
  const payload = JSON.parse(await readFile(GENERATED_JSON, "utf8")) as RegulatoryExtract;
  const pool = new Pool({ connectionString: RICH_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureMessageSystem(client);
    await clearSafeMessage(client);
    await insertReports(client, payload);
    await rebuildSearchIndex(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.table({
    system: SYSTEM_CODE,
    reports: payload.reports.length,
    fields: payload.reports.reduce((sum, report) => sum + report.fields.length, 0),
    source: payload.sourceDocTitle,
  });
}

async function ensureMessageSystem(client: PoolClient): Promise<void> {
  await client.query(
    `
      INSERT INTO pm_data_systems (
        id, project_id, code, name, type, asset_layer,
        description, extra, created_at, updated_at
      ) VALUES ($1,$2,$3,'SAFE 报文层','regulatory message','报文层',$4,$5::jsonb,$6,$6)
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
      SYSTEM_ID,
      PROJECT_ID,
      SYSTEM_CODE,
      "依据《金融机构外汇业务数据采集规范（1.4版）》第六章整理的监管 XML 报文结构。每个 XML 节点作为一个字段元。",
      JSON.stringify({
        evidenceType: "regulatory_doc",
        regulatoryDocVersion: "1.4",
        importScope: "第六章 数据接口格式",
      }),
      NOW,
    ],
  );
}

async function clearSafeMessage(client: PoolClient): Promise<void> {
  const tables = await client.query<{ id: string }>(
    "SELECT id FROM pm_data_tables WHERE project_id=$1 AND system_id=$2",
    [PROJECT_ID, SYSTEM_ID],
  );
  const tableIds = tables.rows.map((row) => row.id);
  const fields = await client.query<{ id: string }>(
    "SELECT id FROM pm_data_fields WHERE project_id=$1 AND system_id=$2",
    [PROJECT_ID, SYSTEM_ID],
  );
  const fieldIds = fields.rows.map((row) => row.id);
  const entityIds = [...tableIds, ...fieldIds];

  await client.query(
    `
      DELETE FROM pm_search_index
      WHERE project_id=$1
        AND (
          entity_id = ANY($2::text[])
          OR (module_key='dictionary' AND id LIKE 'dict-table:vtb-safe-message-%')
          OR (module_key='dictionary' AND id LIKE 'dict-field:vtb-safe-message-%')
        )
    `,
    [PROJECT_ID, entityIds],
  );
  await client.query(
    `
      DELETE FROM pm_entity_links
      WHERE project_id=$1
        AND (from_id = ANY($2::text[]) OR to_id = ANY($2::text[]))
    `,
    [PROJECT_ID, entityIds],
  );
  await client.query(
    `
      DELETE FROM pm_dictionary_rectifications
      WHERE project_id=$1
        AND entity_id = ANY($2::text[])
    `,
    [PROJECT_ID, entityIds],
  );
  await client.query("DELETE FROM pm_data_tables WHERE project_id=$1 AND system_id=$2", [PROJECT_ID, SYSTEM_ID]);
}

async function insertReports(client: PoolClient, payload: RegulatoryExtract): Promise<void> {
  for (const report of payload.reports) {
    const tableId = tableIdFor(report.tableName);
    await client.query(
      `
        INSERT INTO pm_data_tables (
          id, project_id, system_id, table_name, table_cn, table_group, data_layer,
          source_kind, file_type, description, caliber, extra, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,'报文层','文件','xml',$7,$8,$9::jsonb,$10,$10)
      `,
      [
        tableId,
        PROJECT_ID,
        SYSTEM_ID,
        report.tableName,
        report.tableCn,
        report.group,
        `监管 XML 报文：${report.title}。证据来自《${payload.sourceDocTitle}》${payload.scope}。`,
        `${report.title} 的监管接口 XML 节点结构；字段英文名保留 XML 路径。`,
        JSON.stringify({
          evidence: [payload.sourceDoc],
          evidenceType: "regulatory_doc",
          regulatoryDocVersion: "1.4",
          extractionScope: payload.scope,
          sourceTitle: report.title,
          tableIndex: report.tableIndex,
          xmlNodeCount: report.xmlNodeCount,
          dictionaryFieldCount: report.dictionaryFieldCount,
          fileType: "xml",
          interfaceNamingRule: report.interfaceNamingRule ?? null,
          namingRule: "表英文名使用发文中金融机构信息系统生成的接口文件类型名；表中文名以 [报文] 标识监管报文结构。",
        }),
        NOW,
      ],
    );

    for (const field of report.fields) {
      await insertField(client, payload, report, tableId, field);
    }
  }
}

async function insertField(
  client: PoolClient,
  payload: RegulatoryExtract,
  report: RegulatoryReport,
  tableId: string,
  field: RegulatoryField,
): Promise<void> {
  const validation = cleanText(field.validation);
  const requiredState = requiredFromValidation(validation, field.container);
  await client.query(
    `
      INSERT INTO pm_data_fields (
        id, project_id, system_id, table_id, field_name, field_cn, field_type,
        field_length, format_pattern, carrier_kind, field_order, source_field_order,
        nullable, primary_key, required, description, acquire_logic, validation_rule,
        code_value, mapped_table, mapped_field, mapped_field_cn, data_source, remark,
        extra, created_at, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,'xml',$10,NULL,
        $11,false,$12,$13,NULL,$14,NULL,NULL,NULL,NULL,$15,$16,$17::jsonb,$18,$18
      )
    `,
    [
      fieldIdFor(report.tableName, field.fieldName),
      PROJECT_ID,
      SYSTEM_ID,
      tableId,
      field.fieldName,
      field.fieldCn || null,
      field.fieldType || "待确认",
      field.fieldLength || null,
      field.formatPattern || null,
      field.order,
      requiredState.nullable,
      requiredState.required,
      cleanText(field.description) || (field.container ? "XML 容器节点。" : null),
      validation || null,
      payload.sourceDocTitle,
      field.container ? "XML 容器节点；无独立业务取值。" : null,
      JSON.stringify({
        evidence: [payload.sourceDoc],
        evidenceType: "regulatory_doc",
        regulatoryDocVersion: "1.4",
        extractionScope: payload.scope,
        sourceTitle: report.title,
        tableIndex: report.tableIndex,
        xmlTag: field.xmlTag,
        xmlPath: field.xmlPath,
        rawType: field.rawType,
        validation,
        container: field.container,
        fieldCnEvidence: field.fieldCn ? "监管数据字典内容列" : "XML 节点，无独立中文名",
      }),
      NOW,
    ],
  );
}

async function rebuildSearchIndex(client: PoolClient): Promise<void> {
  await client.query(
    `
      INSERT INTO pm_search_index (id, project_id, module_key, entity_type, entity_id, title, subtitle, body, keywords, search_text, updated_at)
      SELECT 'dict-table:' || id, project_id, 'dictionary', 'table', id, table_name, coalesce(table_cn,''),
        coalesce(description,''), coalesce(table_group,'') || ' 报文层 文件 XML',
        table_name || ' ' || coalesce(table_cn,'') || ' ' || coalesce(table_group,'') || ' ' || coalesce(description,'') || ' ' || coalesce(caliber,''), $2
      FROM pm_data_tables
      WHERE project_id=$1 AND system_id=$3
      ON CONFLICT (project_id, entity_type, entity_id) DO UPDATE SET
        title=EXCLUDED.title,
        subtitle=EXCLUDED.subtitle,
        body=EXCLUDED.body,
        keywords=EXCLUDED.keywords,
        search_text=EXCLUDED.search_text,
        updated_at=EXCLUDED.updated_at
    `,
    [PROJECT_ID, NOW, SYSTEM_ID],
  );
  await client.query(
    `
      INSERT INTO pm_search_index (id, project_id, module_key, entity_type, entity_id, title, subtitle, body, keywords, search_text, updated_at)
      SELECT 'dict-field:' || f.id, f.project_id, 'dictionary', 'field', f.id, f.field_name, coalesce(f.field_cn,''),
        coalesce(f.description,''), coalesce(t.table_name,'') || ' ' || coalesce(f.field_type,'') || ' ' || coalesce(f.format_pattern,'') || ' XML节点',
        coalesce(t.table_name,'') || ' ' || coalesce(t.table_cn,'') || ' ' || f.field_name || ' ' || coalesce(f.field_cn,'') || ' ' || coalesce(f.description,'') || ' ' || coalesce(f.validation_rule,''), $2
      FROM pm_data_fields f
      JOIN pm_data_tables t ON t.id=f.table_id
      WHERE f.project_id=$1 AND f.system_id=$3
      ON CONFLICT (project_id, entity_type, entity_id) DO UPDATE SET
        title=EXCLUDED.title,
        subtitle=EXCLUDED.subtitle,
        body=EXCLUDED.body,
        keywords=EXCLUDED.keywords,
        search_text=EXCLUDED.search_text,
        updated_at=EXCLUDED.updated_at
    `,
    [PROJECT_ID, NOW, SYSTEM_ID],
  );
}

function requiredFromValidation(validation: string, container: boolean): { nullable: string; required: boolean } {
  if (container) return { nullable: "否", required: true };
  if (!validation) return { nullable: "待确认", required: false };
  if (validation.includes("非必填") && validation.includes("必填")) return { nullable: "条件必填", required: false };
  if (validation.includes("必填")) return { nullable: "否", required: true };
  if (validation.includes("非必填") || validation.includes("选填")) return { nullable: "是", required: false };
  if (validation.includes("当") && validation.includes("时")) return { nullable: "条件必填", required: false };
  return { nullable: "待确认", required: false };
}

function tableIdFor(tableName: string): string {
  return `vtb-safe-message-${slug(tableName)}`;
}

function fieldIdFor(tableName: string, fieldName: string): string {
  return stableId("vtb-safe-message-field", `${tableName}|${fieldName}`);
}

function stableId(prefix: string, value: string): string {
  return `${prefix}-${createHash("sha1").update(`${PROJECT_ID}:${value}`).digest("hex").slice(0, 20)}`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
