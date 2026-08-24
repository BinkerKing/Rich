import { readFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";

const PROJECT_ID = "vtb-二代safe";
const SYSTEM_ID = "vtb-safe-stage";
const SOURCE_DOC =
  "/Users/binkerking/Documents/Riking-Project/8-VBT/项目部署/sql/VTB_SAFE_STAGE_4Tables_Field_Dictionary_CN.md";
const RICH_URL = process.env.RICH_DB_URL ?? "postgresql://binkerking@localhost/rich?host=/tmp&port=5432";
const NOW = new Date().toISOString();

type TableSpec = {
  tableName: string;
  tableCn: string;
  sourceFile: string;
  fieldCount: number;
  importStrategy: string;
  evidence: string;
};

type FieldSpec = {
  tableName: string;
  order: number;
  fieldName: string;
  fieldCn: string;
  dbType: string;
  length: string;
  precision: string;
  scale: string;
  requiredRaw: string;
  primaryKeyRaw: string;
  formatPattern: string;
  sourceField: string;
  remark: string;
};

async function main(): Promise<void> {
  const markdown = await readFile(SOURCE_DOC, "utf8");
  const tables = parseTables(markdown);
  const fields = parseFields(markdown);

  const pool = new Pool({ connectionString: RICH_URL });
  const client = await pool.connect();
  let updatedFields = 0;
  try {
    await client.query("BEGIN");
    await updateTables(client, tables);
    for (const field of fields) {
      updatedFields += await updateField(client, field);
    }
    await rebuildSearchIndex(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.table({ tables: tables.length, documentFields: fields.length, updatedFields });
}

function parseTables(markdown: string): TableSpec[] {
  return rowsAfterHeading(markdown, "## 2. 表清单").map((row) => ({
    tableName: row[0],
    tableCn: row[1],
    sourceFile: stripTicks(row[2]),
    fieldCount: Number(row[3]) || 0,
    importStrategy: stripTicks(row[4]),
    evidence: stripTicks(row[5]),
  }));
}

function parseFields(markdown: string): FieldSpec[] {
  const fields: FieldSpec[] = [];
  const heading = /^## \d+\. 字段元：(.+)$/gm;
  const matches = [...markdown.matchAll(heading)];
  for (const [index, match] of matches.entries()) {
    const tableName = match[1].trim();
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? markdown.search(/^## 7\. /m);
    const section = markdown.slice(start, end < 0 ? markdown.length : end);
    for (const row of rowsAfterText(section)) {
      fields.push({
        tableName,
        order: Number(row[0]) || 0,
        fieldName: row[1],
        fieldCn: row[2],
        dbType: row[3],
        length: row[4],
        precision: row[5],
        scale: row[6],
        requiredRaw: row[7],
        primaryKeyRaw: row[8],
        formatPattern: row[9],
        sourceField: stripTicks(row[10]),
        remark: row[11] ?? "",
      });
    }
  }
  return fields;
}

async function updateTables(client: PoolClient, tables: TableSpec[]): Promise<void> {
  for (const table of tables) {
    await client.query(
      `
        UPDATE pm_data_tables
        SET table_cn=$4,
            data_layer='贴源层',
            source_kind='数据库表',
            usage_status='使用',
            description=$5,
            caliber=$6,
            extra=extra || $7::jsonb,
            updated_at=$8
        WHERE project_id=$1 AND system_id=$2 AND table_name=$3
      `,
      [
        PROJECT_ID,
        SYSTEM_ID,
        table.tableName,
        table.tableCn,
        `${table.tableName} 一代 VTB 贴源层表。源文件：${table.sourceFile}；入库策略：${table.importStrategy}。`,
        `${table.tableCn}，字段设计依据老一代 VTB 库 fbds_vtb 物理结构、HBM 映射和 Java 入库逻辑。`,
        JSON.stringify({
          evidence: [SOURCE_DOC, ...splitEvidence(table.evidence)],
          evidenceType: "physical_schema_and_code_logic",
          sourceFile: table.sourceFile,
          importStrategy: table.importStrategy,
          documentedFieldCount: table.fieldCount,
          stageFieldDictionarySyncedAt: NOW,
        }),
        NOW,
      ],
    );
  }
}

async function updateField(client: PoolClient, field: FieldSpec): Promise<number> {
  const tableId = await lookupTableId(client, field.tableName);
  if (!tableId) return 0;
  const fieldId = await lookupFieldId(client, tableId, field.fieldName);
  if (!fieldId) return 0;

  const normalized = normalizeFieldDesign(field);
  await client.query(
    `
      UPDATE pm_data_fields
      SET field_name=$4,
          field_cn=$5,
          field_type=$6,
          field_length=$7,
          format_pattern=$8,
          nullable=$9,
          primary_key=$10,
          required=$11,
          description=$12,
          data_source='VTB SAFE 贴源层字段字典',
          remark=$13,
          extra=extra || $14::jsonb,
          field_order=$15,
          carrier_kind='database',
          updated_at=$16
      WHERE project_id=$1 AND system_id=$2 AND id=$3
    `,
    [
      PROJECT_ID,
      SYSTEM_ID,
      fieldId,
      field.fieldName,
      field.fieldCn,
      normalized.fieldType,
      normalized.fieldLength,
      field.formatPattern || null,
      field.requiredRaw === "是" ? "否" : "是",
      field.primaryKeyRaw === "是",
      field.requiredRaw === "是",
      normalized.description,
      field.remark || null,
      JSON.stringify({
        evidence: [SOURCE_DOC],
        evidenceType: "physical_schema_and_code_logic",
        sourceFileField: field.sourceField,
        dbType: field.dbType,
        precision: field.precision || null,
        scale: field.scale || null,
        stageFieldDictionarySyncedAt: NOW,
      }),
      field.order,
      NOW,
    ],
  );
  return 1;
}

function normalizeFieldDesign(field: FieldSpec): { fieldType: string; fieldLength: string | null; description: string } {
  const precisionScale = field.precision && field.scale ? `${field.precision},${field.scale}` : field.precision;
  const fieldLength = field.length || precisionScale || null;
  const sourceText = field.sourceField === "无"
    ? "无源文件字段。"
    : field.sourceField === "派生字段"
      ? "由 Java 入库逻辑派生。"
      : `来源：${field.sourceField}。`;
  const description = [field.formatPattern, sourceText, field.remark].filter(Boolean).join(" ");
  return {
    fieldType: field.dbType,
    fieldLength: fieldLength || null,
    description,
  };
}

async function rebuildSearchIndex(client: PoolClient): Promise<void> {
  await client.query(
    `
      DELETE FROM pm_search_index
      WHERE project_id=$1 AND (
        entity_id IN (SELECT id FROM pm_data_tables WHERE project_id=$1 AND system_id=$2)
        OR entity_id IN (SELECT id FROM pm_data_fields WHERE project_id=$1 AND system_id=$2)
      )
    `,
    [PROJECT_ID, SYSTEM_ID],
  );
  await client.query(
    `
      INSERT INTO pm_search_index (id, project_id, module_key, entity_type, entity_id, title, subtitle, body, keywords, search_text, updated_at)
      SELECT 'dict-table:' || id, project_id, 'dictionary', 'table', id, table_name, coalesce(table_cn,''),
        coalesce(description,''), coalesce(data_layer,'') || ' ' || coalesce(source_kind,''),
        table_name || ' ' || coalesce(table_cn,'') || ' ' || coalesce(description,'') || ' ' || coalesce(caliber,''), $2
      FROM pm_data_tables
      WHERE project_id=$1 AND system_id=$3
      ON CONFLICT (project_id, entity_type, entity_id) DO UPDATE SET
        title=EXCLUDED.title, subtitle=EXCLUDED.subtitle, body=EXCLUDED.body,
        keywords=EXCLUDED.keywords, search_text=EXCLUDED.search_text, updated_at=EXCLUDED.updated_at
    `,
    [PROJECT_ID, NOW, SYSTEM_ID],
  );
  await client.query(
    `
      INSERT INTO pm_search_index (id, project_id, module_key, entity_type, entity_id, title, subtitle, body, keywords, search_text, updated_at)
      SELECT 'dict-field:' || f.id, f.project_id, 'dictionary', 'field', f.id, f.field_name, coalesce(f.field_cn,''),
        coalesce(f.description,''), coalesce(f.field_type,'') || ' ' || coalesce(f.field_length,'') || ' ' || coalesce(f.format_pattern,'') || ' ' || coalesce(f.acquire_logic,''),
        coalesce(t.table_name,'') || ' ' || coalesce(t.table_cn,'') || ' ' || f.field_name || ' ' || coalesce(f.field_cn,'') || ' ' || coalesce(f.description,'') || ' ' || coalesce(f.acquire_logic,''), $2
      FROM pm_data_fields f
      JOIN pm_data_tables t ON t.id=f.table_id
      WHERE f.project_id=$1 AND f.system_id=$3
      ON CONFLICT (project_id, entity_type, entity_id) DO UPDATE SET
        title=EXCLUDED.title, subtitle=EXCLUDED.subtitle, body=EXCLUDED.body,
        keywords=EXCLUDED.keywords, search_text=EXCLUDED.search_text, updated_at=EXCLUDED.updated_at
    `,
    [PROJECT_ID, NOW, SYSTEM_ID],
  );
}

async function lookupTableId(client: PoolClient, tableName: string): Promise<string | null> {
  const result = await client.query<{ id: string }>(
    "SELECT id FROM pm_data_tables WHERE project_id=$1 AND system_id=$2 AND table_name=$3 LIMIT 1",
    [PROJECT_ID, SYSTEM_ID, tableName],
  );
  return result.rows[0]?.id ?? null;
}

async function lookupFieldId(client: PoolClient, tableId: string, fieldName: string): Promise<string | null> {
  const result = await client.query<{ id: string }>(
    "SELECT id FROM pm_data_fields WHERE project_id=$1 AND table_id=$2 AND lower(field_name)=lower($3) LIMIT 1",
    [PROJECT_ID, tableId, fieldName],
  );
  return result.rows[0]?.id ?? null;
}

function rowsAfterHeading(markdown: string, heading: string): string[][] {
  const start = markdown.indexOf(heading);
  if (start < 0) return [];
  const next = markdown.slice(start + heading.length).search(/^## /m);
  const section = markdown.slice(start + heading.length, next < 0 ? markdown.length : start + heading.length + next);
  return rowsAfterText(section);
}

function rowsAfterText(text: string): string[][] {
  const headerCells = new Set(["表英文名", "序号", "类型"]);
  return markdownRows(text).filter((row) => row.length > 0 && !headerCells.has(row[0]));
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
      cells.push(current.trim().replace(/\\\|/g, "|"));
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim().replace(/\\\|/g, "|"));
  return cells;
}

function stripTicks(value: string): string {
  return (value ?? "").replace(/`/g, "").trim();
}

function splitEvidence(value: string): string[] {
  return stripTicks(value).split(/[；;]/).map((item) => item.trim()).filter(Boolean);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
