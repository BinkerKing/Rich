import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";
import {
  parseSafeSourceStageDocument,
  type SafeSourceStageField as ParsedField,
  type SafeSourceTable as SourceTable,
  type SafeStageAutoField as AutoField,
} from "../src/modules/project-dictionary/safe/sourceStageMapping.js";

const PROJECT_ID = "vtb-二代safe";
const RICH_URL = process.env.RICH_DB_URL ?? "postgresql://binkerking@localhost/rich?host=/tmp&port=5432";
const SOURCE_DOC =
  "/Users/binkerking/Documents/Riking-Project/8-VBT/项目部署/sql/VTB_OneGen_Source_To_Stage_Field_Mapping_CN.md";
const NOW = new Date().toISOString();

const FILE_RULES = {
  encoding: "UTF-16（Java Charset.forName(\"Unicode\")）",
  delimiter: "|",
  parseMode: "分隔符",
  splitRule: "split(\"\\\\|\", -1)，保留尾部空字段",
  fileCountRequirement: "源目录内必须匹配 5 个文件",
  sourceConfig: "net/config/system.properties: srcImportDir",
  importMethod: "DataImportServiceImpl#importVTBData",
  parseMethod: "DataImportServiceImpl#parseTxtFile",
  postProcess: "TXT 入库后调用 cfaVTBImportService.importCFATab(importDate)，再调用 proc_processData(?)",
} as const;

const SOURCE_TABLE_IDS: Record<string, string> = {
  "AIF2.TXT": "vtb-safe-src-aif",
  "BLN2.TXT": "vtb-safe-src-bln",
  "CIF2.TXT": "vtb-safe-src-cif",
  "TRN2.TXT": "vtb-safe-src-trn",
};
const TABLE_NOTES: Record<string, { subject: string; cn: string; description: string; caliber: string }> = {
  CifTab: {
    subject: "客户信息",
    cn: "[贴源]客户信息",
    description: "一代 VTB OneGen 文件入库贴源表，由 CIF2.TXT 解析写入。证据来自 OneGen 源文件到贴源层字段映射文档和一代 Java 入库代码说明。",
    caliber: "CIF2.TXT 客户主数据贴源结果。物理字段类型未由本文档证明，保持待确认。",
  },
  AifTab: {
    subject: "账户信息",
    cn: "[贴源]账户信息",
    description: "一代 VTB OneGen 文件入库贴源表，由 AIF2.TXT 解析写入；仅保留满足 AifTab.isAccountIdFlag() 的账号。",
    caliber: "AIF2.TXT 外汇账户贴源结果；过滤规则为账号以 40 开头且不以 409 开头。",
  },
  BlnTab: {
    subject: "余额信息",
    cn: "[贴源]余额信息",
    description: "一代 VTB OneGen 文件入库贴源表，由 BLN2.TXT 解析写入；按业务日期重入。",
    caliber: "BLN2.TXT 账户余额贴源结果；币种 RUR 入库为 RUB。",
  },
  TransactionTab: {
    subject: "交易信息",
    cn: "[贴源]交易信息",
    description: "一代 VTB OneGen 文件入库贴源表，由 TRN2.TXT/TRN2.txt 解析写入；按交易日期重入。",
    caliber: "TRN2.TXT 交易流水贴源结果；第 12 字段可用于解析汇率。",
  },
};

async function main(): Promise<void> {
  const markdown = await readFile(SOURCE_DOC, "utf8");
  const { sourceTables, fields, autoFields } = parseSafeSourceStageDocument(markdown);

  const pool = new Pool({ connectionString: RICH_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await clearPreviousSync(client);
    await upsertSourceTables(client, sourceTables);
    await upsertStageTables(client, sourceTables);
    await ensureStageTablesForFields(client, fields);
    await upsertStageFields(client, fields, autoFields);
    await updateSourceFields(client, fields);
    await insertFieldLinks(client, fields);
    await insertRectifications(client);
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
    sourceTables: sourceTables.length,
    mappedSourceFields: fields.length,
    autoOrDerivedFields: autoFields.length,
    onegenStageTables: new Set(fields.map((field) => field.targetTable).filter(Boolean)).size,
  });
}

async function clearPreviousSync(client: PoolClient): Promise<void> {
  await client.query("DELETE FROM pm_search_index WHERE project_id=$1 AND (id LIKE 'dict-table:vtb-onegen-%' OR id LIKE 'dict-field:vtb-onegen-%')", [PROJECT_ID]);
  await client.query("DELETE FROM pm_entity_links WHERE project_id=$1 AND relation_type LIKE 'onegen_%'", [PROJECT_ID]);
  await client.query("DELETE FROM pm_data_tables WHERE project_id=$1 AND id LIKE 'vtb-onegen-stage-%'", [PROJECT_ID]);
  await deleteObsoleteReportSourceTable(client);
  await client.query("DELETE FROM pm_dictionary_rectifications WHERE project_id=$1 AND created_by='codex-onegen-sync'", [PROJECT_ID]);
}

async function deleteObsoleteReportSourceTable(client: PoolClient): Promise<void> {
  const reportFieldIds = await client.query<{ id: string }>(
    "SELECT id FROM pm_data_fields WHERE project_id=$1 AND table_id='vtb-safe-src-report'",
    [PROJECT_ID],
  );
  const fieldIds = reportFieldIds.rows.map((row) => row.id);
  await client.query(
    `
      DELETE FROM pm_search_index
      WHERE project_id=$1
        AND (entity_id='vtb-safe-src-report' OR entity_id = ANY($2::text[]))
    `,
    [PROJECT_ID, fieldIds],
  );
  await client.query(
    `
      DELETE FROM pm_entity_links
      WHERE project_id=$1
        AND (from_id='vtb-safe-src-report' OR to_id='vtb-safe-src-report' OR from_id = ANY($2::text[]) OR to_id = ANY($2::text[]))
    `,
    [PROJECT_ID, fieldIds],
  );
  await client.query(
    `
      DELETE FROM pm_dictionary_rectifications
      WHERE project_id=$1
        AND (entity_id='vtb-safe-src-report' OR entity_id = ANY($2::text[]))
    `,
    [PROJECT_ID, fieldIds],
  );
  await client.query("DELETE FROM pm_data_tables WHERE project_id=$1 AND id='vtb-safe-src-report'", [PROJECT_ID]);
}

async function upsertSourceTables(client: PoolClient, sourceTables: SourceTable[]): Promise<void> {
  for (const table of sourceTables) {
    const id = SOURCE_TABLE_IDS[table.fileName] ?? stableId("vtb-safe-src", table.fileName);
    const tableCn = sourceTableCn(table);
    await client.query(
      `
        INSERT INTO pm_data_tables (
          id, project_id, system_id, table_name, table_cn, data_layer, source_kind, file_type, usage_status,
          description, caliber, extra, created_at, updated_at
        ) VALUES ($1,$2,'vtb-safe-src',$3,$4,'源数据层','文件','txt','使用',$5,$6,$7::jsonb,$8,$8)
        ON CONFLICT (id) DO UPDATE SET
          table_cn=EXCLUDED.table_cn,
          source_kind=EXCLUDED.source_kind,
          file_type=EXCLUDED.file_type,
          usage_status=EXCLUDED.usage_status,
          description=EXCLUDED.description,
          caliber=EXCLUDED.caliber,
          extra=pm_data_tables.extra || EXCLUDED.extra,
          updated_at=EXCLUDED.updated_at
      `,
      [
        id,
        PROJECT_ID,
        table.fileName,
        tableCn,
        table.stageTable
          ? `VTB OneGen 源文件 ${table.fileName}，按 ${FILE_RULES.encoding}、分隔符 ${FILE_RULES.delimiter} 解析；已确认入库承接表为 ${table.stageTable}。`
          : `VTB OneGen 源文件 ${table.fileName}，参与 5 文件完整性校验；当前证据未发现独立业务贴源表。`,
        table.stageTable ? `${table.fileName} 到 ${table.stageTable} 的文件入库去向/承接关系；源文件自身如何生成当前无证据。` : `${table.fileName} 仅作为源目录完整性校验文件，业务意义待确认。`,
        JSON.stringify({
          evidence: [SOURCE_DOC],
          evidenceType: "code_logic",
          tableCnDerivation: table.stageTable
            ? "由一对一贴源表中文名派生，保留源文件载体语义"
            : "由文件完整性校验证据派生，业务口径仍待确认",
          onegenSourceFile: { ...FILE_RULES, importStrategy: table.importStrategy, remark: table.remark, stageTable: table.stageTable },
          fileType: "txt",
        }),
        NOW,
      ],
    );
  }
}

function sourceTableCn(table: SourceTable): string {
  if (!table.stageTable) return `[源文件]${table.fileName}`;
  const subject = TABLE_NOTES[table.stageTable]?.subject;
  if (!subject) return `[源文件]${table.fileName}`;
  return `[源文件]${subject}`;
}

async function upsertStageTables(client: PoolClient, sourceTables: SourceTable[]): Promise<void> {
  for (const source of sourceTables.filter((table) => table.stageTable)) {
    const tableName = source.stageTable as string;
    const note = TABLE_NOTES[tableName];
    await client.query(
      `
        INSERT INTO pm_data_tables (
          id, project_id, system_id, table_name, table_cn, data_layer, source_kind, usage_status,
          description, caliber, extra, created_at, updated_at
        ) VALUES ($1,$2,'vtb-safe-stage',$3,$4,'贴源层','数据库表','使用',$5,$6,$7::jsonb,$8,$8)
        ON CONFLICT (id) DO UPDATE SET
          table_cn=EXCLUDED.table_cn,
          usage_status=EXCLUDED.usage_status,
          description=EXCLUDED.description,
          caliber=EXCLUDED.caliber,
          extra=EXCLUDED.extra,
          updated_at=EXCLUDED.updated_at
      `,
      [
        stageTableId(tableName),
        PROJECT_ID,
        tableName,
        note?.cn ?? null,
        note?.description ?? `VTB OneGen 文件入库贴源表 ${tableName}。`,
        note?.caliber ?? `${source.fileName} 入库贴源结果。`,
        JSON.stringify({
          evidence: [SOURCE_DOC],
          evidenceType: "code_logic",
          physicalConfirmed: false,
          sourceFile: source.fileName,
          importStrategy: source.importStrategy,
          remark: source.remark,
        }),
        NOW,
      ],
    );
  }
}

async function ensureStageTablesForFields(client: PoolClient, fields: ParsedField[]): Promise<void> {
  const tableNames = [...new Set(fields.map((field) => field.targetTable).filter((value): value is string => Boolean(value)))];
  for (const tableName of tableNames) {
    const note = TABLE_NOTES[tableName];
    await client.query(
      `
        INSERT INTO pm_data_tables (
          id, project_id, system_id, table_name, table_cn, data_layer, source_kind, usage_status,
          description, caliber, extra, created_at, updated_at
        ) VALUES ($1,$2,'vtb-safe-stage',$3,$4,'贴源层','数据库表','使用',$5,$6,$7::jsonb,$8,$8)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        stageTableId(tableName),
        PROJECT_ID,
        tableName,
        note?.cn ?? null,
        note?.description ?? `VTB OneGen 文件入库贴源表 ${tableName}。`,
        note?.caliber ?? `OneGen 文件入库贴源结果。`,
        JSON.stringify({ evidence: [SOURCE_DOC], evidenceType: "code_logic", physicalConfirmed: false }),
        NOW,
      ],
    );
  }
}

async function upsertStageFields(client: PoolClient, fields: ParsedField[], autoFields: AutoField[]): Promise<void> {
  const orderByTable = new Map<string, number>();
  for (const field of fields.filter((item) => item.targetTable && item.targetField)) {
    const order = nextOrder(orderByTable, field.targetTable as string);
    const sourceField = await lookupSourceField(client, field.sourceFile, field.sourceOrder);
    await upsertStageField(client, {
      tableName: field.targetTable as string,
      fieldName: field.targetField as string,
      fieldCn: field.cn,
      description: `OneGen 入库字段：${field.sourceFile} 第 ${field.sourceOrder} 字段（Java 下标 ${field.javaIndex}）写入 ${field.targetTable}.${field.targetField}。`,
      acquireLogic: field.importLogic,
      mappedTable: field.sourceFile,
      mappedField: sourceField?.fieldName ?? null,
      mappedFieldCn: sourceField?.fieldCn ?? field.cn,
      fieldOrder: order,
      extra: {
        evidence: [SOURCE_DOC],
        evidenceType: "code_logic",
        onegenMapping: {
          sourceFile: field.sourceFile,
          sourceFieldOrder: field.sourceOrder,
          javaIndex: field.javaIndex,
          importLogic: field.importLogic,
        },
      },
    });
  }

  for (const field of autoFields) {
    const order = nextOrder(orderByTable, field.targetTable);
    await upsertStageField(client, {
      tableName: field.targetTable,
      fieldName: field.targetField,
      fieldCn: field.cn,
      description: `OneGen 自动/派生/非文件字段：${field.importLogic}。`,
      acquireLogic: field.importLogic,
      mappedTable: null,
      mappedField: null,
      mappedFieldCn: null,
      fieldOrder: order,
      extra: {
        evidence: [SOURCE_DOC],
        evidenceType: "code_logic",
        onegenMapping: { importLogic: field.importLogic, sourceFieldOrder: null },
      },
    });
  }
}

async function upsertStageField(
  client: PoolClient,
  input: {
    tableName: string;
    fieldName: string;
    fieldCn: string;
    description: string;
    acquireLogic: string;
    mappedTable: string | null;
    mappedField: string | null;
    mappedFieldCn: string | null;
    fieldOrder: number;
    extra: Record<string, unknown>;
  },
): Promise<void> {
  await client.query(
    `
      INSERT INTO pm_data_fields (
        id, project_id, system_id, table_id, field_name, field_cn, field_type, field_length,
        format_pattern, nullable, primary_key, required, description, acquire_logic,
        mapped_table, mapped_field, mapped_field_cn, data_source, remark, extra,
        field_order, source_field_order, carrier_kind, created_at, updated_at
      ) VALUES ($1,$2,'vtb-safe-stage',$3,$4,$5,NULL,NULL,'待确认','待确认',false,false,$6,$7,$8,$9,$10,'OneGen源文件入库',$11,$12::jsonb,$13,NULL,'database',$14,$14)
    `,
    [
      stageFieldId(input.tableName, input.fieldName),
      PROJECT_ID,
      stageTableId(input.tableName),
      input.fieldName,
      input.fieldCn,
      input.description,
      input.acquireLogic,
      input.mappedTable,
      input.mappedField,
      input.mappedFieldCn,
      "字段类型、长度和物理列约束未由当前 Markdown 证明，保持待确认；不得据此覆盖二代物理结构。",
      JSON.stringify(input.extra),
      input.fieldOrder,
      NOW,
    ],
  );
}

async function updateSourceFields(client: PoolClient, fields: ParsedField[]): Promise<void> {
  for (const field of fields) {
    const sourceId = await lookupSourceFieldId(client, field.sourceFile, field.sourceOrder);
    if (!sourceId) continue;
    await client.query(
      `
        UPDATE pm_data_fields SET
          field_cn=$3,
          description=$4,
          acquire_logic=NULL,
          mapped_table=NULL,
          mapped_field=NULL,
          mapped_field_cn=NULL,
          remark=$5,
          extra=extra || $6::jsonb,
          updated_at=$7
        WHERE id=$1 AND project_id=$2
      `,
      [
        sourceId,
        PROJECT_ID,
        field.cn,
        field.targetTable
          ? `源文件 ${field.sourceFile} 第 ${field.sourceOrder} 字段（Java 下标 ${field.javaIndex}），按 ${FILE_RULES.encoding}、分隔符 ${FILE_RULES.delimiter} 解析；入库承接字段为 ${field.targetTable}.${field.targetField}。`
          : `源文件 ${field.sourceFile} 第 ${field.sourceOrder} 字段（Java 下标 ${field.javaIndex}），中文说明为“${field.cn}”；OneGen 入库逻辑明确不取该字段。`,
        field.targetTable
          ? "这是源文件字段的入库承接关系，不是源文件自身的 Mapping 来源逻辑；源文件如何生成当前无证据。"
          : "OneGen 明确不取该源文件字段；源文件如何生成当前无证据。",
        JSON.stringify({
          evidence: [SOURCE_DOC],
          evidenceType: "code_logic",
          onegenSourceFileField: {
            sourceFile: field.sourceFile,
            sourceFieldOrder: field.sourceOrder,
            javaIndex: field.javaIndex,
            parseMode: FILE_RULES.parseMode,
            delimiterOrLayout: FILE_RULES.delimiter,
            encoding: FILE_RULES.encoding,
            targetTable: field.targetTable,
            targetField: field.targetField,
            importLogic: field.importLogic,
          },
        }),
        NOW,
      ],
    );
  }
}

async function insertFieldLinks(client: PoolClient, fields: ParsedField[]): Promise<void> {
  for (const field of fields.filter((item) => item.targetTable && item.targetField)) {
    const sourceId = await lookupSourceFieldId(client, field.sourceFile, field.sourceOrder);
    if (!sourceId) continue;
    await client.query(
      `
        INSERT INTO pm_entity_links (id, project_id, from_type, from_id, to_type, to_id, relation_type, metadata, created_at)
        VALUES ($1,$2,'field',$3,'field',$4,'onegen_file_ingests_to',$5::jsonb,$6)
      `,
      [
        stableId("onegen-link", `${field.sourceFile}|${field.sourceOrder}|${field.targetTable}.${field.targetField}`),
        PROJECT_ID,
        sourceId,
        stageFieldId(field.targetTable as string, field.targetField as string),
        JSON.stringify({
          evidence: SOURCE_DOC,
          sourceFile: field.sourceFile,
          sourceFieldOrder: field.sourceOrder,
          javaIndex: field.javaIndex,
          importLogic: field.importLogic,
        }),
        NOW,
      ],
    );
  }
}

async function insertRectifications(client: PoolClient): Promise<void> {
  const refNoId = stageFieldId("TransactionTab", "refNo");
  await client.query(
    `
      INSERT INTO pm_dictionary_rectifications (
        id, project_id, entity_type, entity_id, property_key, requirement,
        status, created_by, created_at, updated_at
      ) VALUES
        ($1,$2,'field',$3,'acquire_logic',$4,'open','codex-onegen-sync',$5,$5)
    `,
    [
      stableId("rect", "Q-STG-001"),
      PROJECT_ID,
      refNoId,
      "Q-STG-001：TransactionTab.refNo 的最终赋值来源待确认。当前 Markdown 说明 parseTxtFile 未直接 setRefNo，但后续逻辑依赖该字段，需结合 proc_processData(?)、触发器或历史数据确认。",
      NOW,
    ],
  );
}

async function rebuildSearchIndex(client: PoolClient): Promise<void> {
  const sourceTableIds = Object.values(SOURCE_TABLE_IDS);
  await client.query(
    `
      DELETE FROM pm_search_index
      WHERE project_id=$1 AND (
        entity_id LIKE 'vtb-onegen-stage-%'
        OR entity_id = ANY($2)
        OR entity_id IN (SELECT id FROM pm_data_fields WHERE project_id=$1 AND table_id = ANY($2))
      )
    `,
    [PROJECT_ID, sourceTableIds],
  );
  await client.query(
    `
      INSERT INTO pm_search_index (id, project_id, module_key, entity_type, entity_id, title, subtitle, body, keywords, search_text, updated_at)
      SELECT 'dict-table:' || id, project_id, 'dictionary', 'table', id, table_name, coalesce(table_cn,''),
        coalesce(description,''), coalesce(data_layer,'') || ' ' || coalesce(source_kind,''),
        table_name || ' ' || coalesce(table_cn,'') || ' ' || coalesce(description,'') || ' ' || coalesce(caliber,''), $2
      FROM pm_data_tables
      WHERE project_id=$1 AND (id LIKE 'vtb-onegen-stage-%' OR id = ANY($3))
    `,
    [PROJECT_ID, NOW, sourceTableIds],
  );
  await client.query(
    `
      INSERT INTO pm_search_index (id, project_id, module_key, entity_type, entity_id, title, subtitle, body, keywords, search_text, updated_at)
      SELECT 'dict-field:' || id, project_id, 'dictionary', 'field', id, field_name, coalesce(field_cn,''),
        coalesce(description,''), coalesce(field_type,'') || ' ' || coalesce(format_pattern,'') || ' ' || coalesce(acquire_logic,''),
        field_name || ' ' || coalesce(field_cn,'') || ' ' || coalesce(description,'') || ' ' || coalesce(acquire_logic,''), $2
      FROM pm_data_fields
      WHERE project_id=$1 AND (table_id LIKE 'vtb-onegen-stage-%' OR table_id = ANY($3))
    `,
    [PROJECT_ID, NOW, sourceTableIds],
  );
}

async function lookupSourceField(client: PoolClient, sourceFile: string, sourceOrder: number): Promise<{ id: string; fieldName: string; fieldCn: string | null } | null> {
  const result = await client.query<{ id: string; field_name: string; field_cn: string | null }>(
    `
      SELECT f.id, f.field_name, f.field_cn
      FROM pm_data_fields f
      JOIN pm_data_tables t ON t.id=f.table_id
      WHERE f.project_id=$1 AND t.table_name=$2 AND f.source_field_order=$3
      ORDER BY f.updated_at DESC
      LIMIT 1
    `,
    [PROJECT_ID, sourceFile, sourceOrder],
  );
  const row = result.rows[0];
  return row ? { id: row.id, fieldName: row.field_name, fieldCn: row.field_cn } : null;
}

async function lookupSourceFieldId(client: PoolClient, sourceFile: string, sourceOrder: number): Promise<string | null> {
  return (await lookupSourceField(client, sourceFile, sourceOrder))?.id ?? null;
}

function nextOrder(orderByTable: Map<string, number>, tableName: string): number {
  const next = (orderByTable.get(tableName) ?? 0) + 1;
  orderByTable.set(tableName, next);
  return next;
}

function stageTableId(tableName: string): string {
  return `vtb-onegen-stage-${tableName.toLowerCase()}`;
}

function stageFieldId(tableName: string, fieldName: string): string {
  return stableId("vtb-onegen-stage-field", `${tableName}|${fieldName}`);
}

function stableId(prefix: string, value: string): string {
  return `${prefix}-${createHash("sha1").update(`${PROJECT_ID}:${value}`).digest("hex").slice(0, 20)}`;
}


main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
