import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";
import {
  completeSafeIntermediateScenarioMappings,
  standardSafeIntermediateLogic,
  type SafeIntermediateField as FieldSpec,
  type SafeIntermediateMapping as MappingSpec,
  type SafeStandardMappingLogic as StandardMappingLogic,
} from "../src/modules/project-dictionary/safe/intermediateMapping.js";

const PROJECT_ID = "vtb-二代safe";
const SYSTEM_ID = "vtb-safe-middle";
const RICH_URL = process.env.RICH_DB_URL ?? "postgresql://binkerking@localhost/rich?host=/tmp&port=5432";
const SOURCE_DOC =
  "/Users/binkerking/Documents/Riking-Project/8-VBT/项目部署/sql/VTB_OneGen_Intermediate_Tables_Mapping_Rich_CN.md";
const ONEGEN_SRC_ROOT = "/Users/binkerking/Documents/Riking-Project/8-VBT/SVN/FBDS/代码/fbds_vtb/src";
const HBM_FILES_BY_TABLE: Record<string, string> = {
  BopTransaction: `${ONEGEN_SRC_ROOT}/net/riking/bop/model/BopTransaction.hbm.xml`,
  CFACATab: `${ONEGEN_SRC_ROOT}/net/riking/business/model/CFACATab.hbm.xml`,
  CFACBTab: `${ONEGEN_SRC_ROOT}/net/riking/business/model/CFACBTab.hbm.xml`,
  CFADATab: `${ONEGEN_SRC_ROOT}/net/riking/business/model/CFADATab.hbm.xml`,
  CFADBTab: `${ONEGEN_SRC_ROOT}/net/riking/business/model/CFADBTab.hbm.xml`,
  FAEBaseInfo: `${ONEGEN_SRC_ROOT}/net/riking/aboq/model/FAEBaseInfo.hbm.xml`,
  FAEManage: `${ONEGEN_SRC_ROOT}/net/riking/aboq/model/FAEManage.hbm.xml`,
};

const CONFIRMED_FIELD_LENGTH_OVERRIDES: Record<string, string> = {
  "CFACATab.DebtorCode": "18",
  "CFADATab.DebtorCode": "18",
};
const FIELD_CN_FALLBACKS: Record<string, string> = {
  ActionType: "操作类型",
  ActionDesc: "修改/删除原因或申报无误理由",
  AnninRate: "年化利率值",
  bopType: "BOP类型",
  BRCA: "银行分支代码",
  CfeogudAd: "中资企业境外担保项下贷款业务批准文件号",
  CfeogudAmount: "中资企业境外担保项下境内贷款额度金额",
  CfeogudCurr: "中资企业境外担保项下境内贷款额度币种",
  ChangeNo: "变动编号",
  CreatedBy: "创建人",
  CreatedTime: "创建时间",
  CRTUser: "填报人",
  DebtorType: "债务人类型",
  DofoexloCode: "国内外汇贷款编号",
  DofoexloType: "国内外汇贷款类型",
  Exrate: "汇率",
  Foreign_bank_fee: "境外银行费用",
  GuarantllBala: "担保责任余额",
  GuperAmount: "履约金额",
  inSafe: "入 SAFE 状态",
  INPTELC: "填报人电话",
  jshType: "结售汇类型",
  LastModifiedBy: "最后修改人",
  LastModifiedTime: "最后修改时间",
  Lcyacc: "人民币账号",
  Lcyamt: "人民币金额",
  Lenagree: "转贷协议号",
  LenproName: "转贷项目名称",
  Local_bank_fee: "本地银行费用",
  LounexguCode: "外保内贷编号",
  Maturity: "到期日",
  Net_amount: "净额",
  OldDealNo: "原银行内部唯一标识",
  OfficeRemark: "银行备注",
  OP_Area_code: "交易对手地区代码",
  Op_account: "交易对手账号",
  Op_bank: "交易对手银行名称",
  OP_bank_code: "交易对手银行代码",
  op_en_code: "交易对手英文代码",
  Op_Institution_code: "交易对手机构代码",
  Op_lins: "交易对手机构属性",
  Op_location: "交易对手所在地",
  PicAmount: "付息费",
  PinpayAmount: "购汇付息金额",
  PNAR: "交易附言",
  PRESTOREFIVE: "预留字段五",
  PRESTOREFOUR: "预留字段四",
  PRESTOREONE: "预留字段一",
  PRESTORETHREE: "预留字段三",
  PRESTORETWO: "预留字段二",
  PrepayAmount: "购汇还本金额",
  RegNo: "外汇局批件号/备案表号/业务编号",
  Remark: "备注",
  REPDate: "报告日期",
  RepNo: "报告编号",
  SafeBranchCode: "SAFE 机构代码",
  SettAmount: "结汇金额",
  TCAT: "交易类别",
  TCID: "交易代码",
  TCIT: "交易项目",
  tname: "接口文件名",
  TotalInterest: "利息总额",
  Transfered_amount: "划转金额",
  transId: "交易ID",
  TRAT: "交易汇率",
  Useofunds: "资金用途",
};
const NOW = new Date().toISOString();

const STRUCTURED_EXTRACTION_CALIBERS = [
  {
    tableName: "FAEBaseInfo",
    scenario: "JSH结汇",
    remark: "t 为当日交易，p 为按关联编号匹配的 T-1 交易，c 为客户主数据。",
    rule: {
      op: "dataset",
      from: { table: "TransactionTab", alias: "t" },
      joins: [
        {
          type: "inner",
          table: { table: "TransactionTab", alias: "p" },
          on: {
            and: [
              { source: "p.refNo", eq: { source: "t.refNo" } },
              { source: "p.Id", ne: { source: "t.Id" } },
            ],
          },
          select_latest_date_group: {
            latest_date: "p.transactionDate",
            current_date: "t.transactionDate",
            partition_by: [{ latest: "p.refNo", current: "t.refNo" }],
            exclude_self: { latest: "p.Id", current: "t.Id" },
            date_format: "YYYYMMDD",
          },
        },
        { type: "left", table: { table: "Customer", alias: "c" }, on: { source: "c.bankCustomerCode", eq: { source: "p.customerCode" } } },
      ],
      where: { source: "t.transactionType", like: "04%" },
    },
  },
  {
    tableName: "FAEBaseInfo",
    scenario: "JSH购汇",
    remark: "t 为当日交易，p 为按关联编号匹配的 T-1 交易，c 为客户主数据。",
    rule: {
      op: "dataset",
      from: { table: "TransactionTab", alias: "t" },
      joins: [
        {
          type: "inner",
          table: { table: "TransactionTab", alias: "p" },
          on: {
            and: [
              { source: "p.refNo", eq: { source: "t.refNo" } },
              { source: "p.Id", ne: { source: "t.Id" } },
            ],
          },
          select_latest_date_group: {
            latest_date: "p.transactionDate",
            current_date: "t.transactionDate",
            partition_by: [{ latest: "p.refNo", current: "t.refNo" }],
            exclude_self: { latest: "p.Id", current: "t.Id" },
            date_format: "YYYYMMDD",
          },
        },
        { type: "left", table: { table: "Customer", alias: "c" }, on: { source: "c.bankCustomerCode", eq: { source: "p.customerCode" } } },
      ],
      where: { source: "t.transactionType", like: "03%" },
    },
  },
  {
    tableName: "FAEManage",
    scenario: "结汇用途明细",
    remark: "f 为已生成的结售汇基础信息，t 为当日交易，u/x 分别为用途码和交易编码。",
    rule: {
      op: "dataset",
      from: { table: "FAEBaseInfo", alias: "f" },
      joins: [
        { type: "inner", table: { table: "TransactionTab", alias: "t" }, on: { source: "t.refNo", eq: { source: "f.BusCode" } } },
        { type: "inner", table: { table: "UseType", alias: "u" }, on: { source: "u.useTypeCode", eq: { source: "t.useType" } } },
        { type: "left", table: { table: "TxCode", alias: "x" }, on: { source: "x.txCode", eq: { source: "t.bopTxCode" } } },
      ],
      where: {
        and: [
          { source: "f.jghFlag", eq: "1" },
          { source: "t.useType", ne: null },
        ],
      },
    },
  },
] as const;

type TableSpec = {
  tableName: string;
  tableCn: string;
  group: string;
  dataLayer: string;
  sourceKind: string;
  caliber: string;
  generation: string;
  upstream: string;
  downstream: string;
  evidence: string;
  remark: string;
};

type HbmFieldDefinition = {
  fieldType: string;
  fieldLength: string;
  formatPattern: string;
  evidence: string;
};

type CodeSetSpec = {
  name: string;
  items: { code: string; label: string; remark: string; sortOrder: number }[];
};

async function main(): Promise<void> {
  const markdown = await readFile(SOURCE_DOC, "utf8");
  const tables = parseTables(markdown);
  const hbmDefinitions = await loadHbmFieldDefinitions();
  const fields = enrichFieldsWithHbm(parseFields(markdown), hbmDefinitions);
  const mappings = completeSafeIntermediateScenarioMappings(parseMappings(markdown), fields);
  const codeSets = parseCodeSets(markdown);
  const rectifications = parseRectifications(markdown);

  const pool = new Pool({ connectionString: RICH_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await clearPreviousSync(client);
    await upsertSystem(client);
    await insertTables(client, tables);
    await insertFields(client, fields);
    await insertCodeSets(client, codeSets);
    await bindFieldCodeSets(client, fields);
    await insertMappings(client, mappings);
    await insertStructuredExtractionCalibers(client);
    await applyRequiredLookupMappings(client);
    await insertRectifications(client, rectifications);
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
    tables: tables.length,
    fields: fields.length,
    mappings: mappings.length,
    codeSets: codeSets.length,
    rectifications: rectifications.length,
  });
}

function parseTables(markdown: string): TableSpec[] {
  return rowsAfterHeading(markdown, "## 表元清单").map((row) => ({
    tableName: row[0],
    tableCn: row[1],
    group: row[2],
    dataLayer: row[3],
    sourceKind: row[4],
    caliber: row[5],
    generation: row[6],
    upstream: row[7],
    downstream: row[8],
    evidence: row[9],
    remark: row[10] ?? "",
  }));
}

function parseFields(markdown: string): FieldSpec[] {
  const fields: FieldSpec[] = [];
  const bopRows = rowsAfterHeading(markdown, "## 字段元：BopTransaction");
  for (const row of bopRows) {
    fields.push(...expandFieldRow("BopTransaction", row, false));
  }
  const cfaRows = rowsAfterHeading(markdown, "## 字段元：CFA Tab 表");
  for (const row of cfaRows) {
    fields.push(...expandFieldRow(row[1], [row[0], ...row.slice(2)], true));
  }
  const jshRows = rowsAfterHeading(markdown, "## 字段元：JSH 前置表");
  for (const row of jshRows) {
    fields.push(...expandFieldRow(row[1], [row[0], ...row.slice(2)], true));
  }
  const orderByTable = new Map<string, number>();
  return fields.map((field) => {
    const order = (orderByTable.get(field.tableName) ?? 0) + 1;
    orderByTable.set(field.tableName, order);
    return { ...field, order };
  });
}

async function loadHbmFieldDefinitions(): Promise<Map<string, HbmFieldDefinition>> {
  const definitions = new Map<string, HbmFieldDefinition>();
  for (const [tableName, filePath] of Object.entries(HBM_FILES_BY_TABLE)) {
    const xml = await readFile(filePath, "utf8");
    for (const [columnName, definition] of parseHbmColumns(xml, filePath)) {
      definitions.set(fieldKey(tableName, columnName), definition);
    }
  }
  return definitions;
}

function enrichFieldsWithHbm(fields: FieldSpec[], hbmDefinitions: Map<string, HbmFieldDefinition>): FieldSpec[] {
  return fields.map((field) => {
    const definition = hbmDefinitions.get(fieldKey(field.tableName, field.fieldName));
    if (!definition) return normalizeUnknownDefinition(withFallbackFieldCn(field));
    return {
      ...field,
      fieldCn: fallbackFieldCn(field),
      fieldType: definition.fieldType,
      fieldLength: CONFIRMED_FIELD_LENGTH_OVERRIDES[`${field.tableName}.${field.fieldName}`] ?? definition.fieldLength,
      formatPattern: definition.formatPattern,
      evidence: appendEvidence(field.evidence, definition.evidence),
    };
  });
}

function normalizeUnknownDefinition(field: FieldSpec): FieldSpec {
  return {
    ...field,
    fieldCn: fallbackFieldCn(field),
    fieldType: field.fieldType === "待确认" ? "" : field.fieldType,
    fieldLength: field.fieldLength === "待确认" ? "" : field.fieldLength,
    formatPattern: field.formatPattern === "待确认" ? "" : field.formatPattern,
  };
}

function withFallbackFieldCn(field: FieldSpec): FieldSpec {
  return { ...field, fieldCn: fallbackFieldCn(field) };
}

function fallbackFieldCn(field: FieldSpec): string {
  return field.fieldCn || FIELD_CN_FALLBACKS[field.fieldName] || "";
}

function parseHbmColumns(xml: string, filePath: string): [string, HbmFieldDefinition][] {
  const rows: [string, HbmFieldDefinition][] = [];
  const blockPatterns = [
    /<id\b([^>]*)>([\s\S]*?)<\/id>/g,
    /<property\b([^>]*)>([\s\S]*?)<\/property>/g,
    /<many-to-one\b([^>]*)>([\s\S]*?)<\/many-to-one>/g,
  ];
  for (const pattern of blockPatterns) {
    for (const match of xml.matchAll(pattern)) {
      const tagAttrs = parseXmlAttributes(match[1]);
      const body = match[2];
      if (body.includes("<formula>")) continue;
      const columnMatch = body.match(/<column\b([^>]*)\/?>/);
      if (!columnMatch) continue;
      const columnAttrs = parseXmlAttributes(columnMatch[1]);
      const columnName = columnAttrs.name;
      if (!columnName) continue;
      rows.push([columnName, definitionFromHbmType(tagAttrs.type, columnAttrs, filePath)]);
    }
  }
  return rows;
}

function definitionFromHbmType(typeName: string | undefined, columnAttrs: Record<string, string>, filePath: string): HbmFieldDefinition {
  if (!typeName && columnAttrs.name) {
    return { fieldType: "int", fieldLength: "", formatPattern: "外键", evidence: filePath };
  }
  if (typeName === "java.lang.String") {
    return {
      fieldType: "string",
      fieldLength: normalizeHbmLength(columnAttrs.length),
      formatPattern: columnAttrs.length ? `varchar(${columnAttrs.length})` : "varchar",
      evidence: filePath,
    };
  }
  if (typeName === "java.math.BigDecimal") {
    const precision = columnAttrs.precision ?? "";
    const scale = columnAttrs.scale ?? "";
    const length = precision && scale ? `${precision},${scale}` : precision;
    return {
      fieldType: "decimal",
      fieldLength: length,
      formatPattern: length ? `decimal(${length})` : "decimal",
      evidence: filePath,
    };
  }
  if (typeName === "java.util.Date") {
    return {
      fieldType: "date",
      fieldLength: normalizeHbmLength(columnAttrs.length),
      formatPattern: "datetime",
      evidence: filePath,
    };
  }
  if (typeName === "java.lang.Integer") {
    return { fieldType: "int", fieldLength: normalizeHbmLength(columnAttrs.length), formatPattern: "", evidence: filePath };
  }
  if (typeName === "java.lang.Boolean") {
    return { fieldType: "boolean", fieldLength: normalizeHbmLength(columnAttrs.length), formatPattern: "bit", evidence: filePath };
  }
  return { fieldType: typeName?.replace(/^java\.lang\./, "") ?? "", fieldLength: normalizeHbmLength(columnAttrs.length), formatPattern: "", evidence: filePath };
}

function parseXmlAttributes(value: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of value.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function normalizeHbmLength(value: string | undefined): string {
  if (!value || value === "0") return "";
  return value;
}

function expandFieldRow(tableName: string, row: string[], _hasTableColumn: boolean): FieldSpec[] {
  const [sourceOrder, fieldNameRaw, fieldCn, fieldType, fieldLength, formatPattern, requiredRaw, pkRaw, description, codeSetName, evidence, remark] = row;
  const names = splitNames(fieldNameRaw);
  return names.map((fieldName) => ({
    tableName,
    fieldName,
    fieldCn: fieldCn === "待确认" ? "" : fieldCn,
    fieldType,
    fieldLength: normalizeEmpty(fieldLength),
    formatPattern: normalizeEmpty(formatPattern),
    nullable: nullableFrom(requiredRaw),
    primaryKey: pkRaw === "是",
    required: requiredRaw === "是",
    description,
    codeSetName: normalizeEmpty(codeSetName),
    evidence,
    remark,
    order: Number(sourceOrder) || 0,
    expandedFrom: names.length > 1 ? fieldNameRaw : undefined,
  }));
}

function parseMappings(markdown: string): MappingSpec[] {
  const mappings: MappingSpec[] = [];
  const sections = [...markdown.matchAll(/^## Mapping：(.+)$/gm)];
  for (const [sectionIndex, section] of sections.entries()) {
    const tableName = section[1].trim();
    const start = (section.index ?? 0) + section[0].length;
    const end = sections[sectionIndex + 1]?.index ?? markdown.search(/^## 码值元：/m);
    const sectionText = markdown.slice(start, end < 0 ? markdown.length : end);
    const scenarios = [...sectionText.matchAll(/^### 场景：(.+)$/gm)];
    for (const [scenarioIndex, scenarioMatch] of scenarios.entries()) {
      const scenario = scenarioMatch[1].trim();
      const scenarioStart = (scenarioMatch.index ?? 0) + scenarioMatch[0].length;
      const scenarioEnd = scenarios[scenarioIndex + 1]?.index ?? sectionText.length;
      const scenarioText = sectionText.slice(scenarioStart, scenarioEnd);
      const condition = extractCondition(scenarioText);
      for (const row of markdownRows(scenarioText)) {
        if (row.length < 7 || row[0] === "目标字段") continue;
        const targetNames = splitNames(row[0]);
        for (const targetField of targetNames) {
          mappings.push({
            tableName,
            scenario,
            condition,
            targetField,
            targetCn: row[1],
            sourceRefs: normalizeSourceRefs(row[2], targetField),
            logic: row[3],
            sql: stripTicks(row[4]),
            evidence: row[5],
            remark: row[6] ?? "",
            order: mappings.length + 1,
            expandedFrom: targetNames.length > 1 ? row[0] : undefined,
          });
        }
      }
    }
  }
  return mappings;
}

function parseCodeSets(markdown: string): CodeSetSpec[] {
  const codeSets: CodeSetSpec[] = [];
  const headings = [...markdown.matchAll(/^## 码值元：(.+)$/gm)];
  for (const [index, heading] of headings.entries()) {
    const name = heading[1].trim();
    const start = (heading.index ?? 0) + heading[0].length;
    const end = headings[index + 1]?.index ?? markdown.search(/^## 待确认项/m);
    const section = markdown.slice(start, end < 0 ? markdown.length : end);
    const items = rowsAfterText(section).map((row) => ({
      code: row[0],
      label: row[1],
      remark: row[2] ?? "",
      sortOrder: Number(row[3]) || 0,
    }));
    codeSets.push({ name, items });
  }
  return codeSets;
}

function parseRectifications(markdown: string): { entityType: string; entityName: string; propertyKey: string; requirement: string }[] {
  return rowsAfterHeading(markdown, "## 待确认项").map((row) => ({
    entityType: row[0],
    entityName: row[1],
    propertyKey: row[2],
    requirement: `${row[3]} 需要补充的证据：${row[4]}`,
  }));
}

async function upsertSystem(client: PoolClient): Promise<void> {
  await client.query(
    `
      INSERT INTO pm_data_systems (id, project_id, code, name, type, asset_layer, description, extra, created_at, updated_at)
      VALUES ($1,$2,'SAFE_MIDDLE','SAFE 中间层','ods','中间层',$3,$4::jsonb,$5,$5)
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
      "二代 SAFE 中间层及一代 VTB Java 链路对照中间层。本文档同步了一代 Java 明确生成的 BOP、CFA、JSH 报表前置数据。",
      JSON.stringify({ evidence: [SOURCE_DOC], onegenLegacyIntermediateImported: true }),
      NOW,
    ],
  );
}

async function clearPreviousSync(client: PoolClient): Promise<void> {
  const tables = await client.query<{ id: string }>(
    "SELECT id FROM pm_data_tables WHERE project_id=$1 AND id LIKE 'vtb-onegen-middle-%'",
    [PROJECT_ID],
  );
  const tableIds = tables.rows.map((row) => row.id);
  const fields = await client.query<{ id: string }>(
    "SELECT id FROM pm_data_fields WHERE project_id=$1 AND table_id = ANY($2::text[])",
    [PROJECT_ID, tableIds],
  );
  const fieldIds = fields.rows.map((row) => row.id);
  const entityIds = [...tableIds, ...fieldIds];

  await client.query(
    `
      DELETE FROM pm_search_index
      WHERE project_id=$1 AND (
        entity_id = ANY($2::text[])
        OR id LIKE 'dict-table:vtb-onegen-middle-%'
        OR id LIKE 'dict-field:vtb-onegen-middle-%'
      )
    `,
    [PROJECT_ID, entityIds],
  );
  await client.query("DELETE FROM pm_mapping_rules WHERE project_id=$1 AND id LIKE 'vtb-onegen-middle-map-%'", [PROJECT_ID]);
  await client.query("DELETE FROM pm_dictionary_rectifications WHERE project_id=$1 AND created_by='codex-onegen-middle-sync'", [PROJECT_ID]);
  await client.query(
    `
      DELETE FROM pm_entity_links
      WHERE project_id=$1 AND (from_id = ANY($2::text[]) OR to_id = ANY($2::text[]))
    `,
    [PROJECT_ID, entityIds],
  );
  await client.query("DELETE FROM pm_data_tables WHERE project_id=$1 AND id LIKE 'vtb-onegen-middle-%'", [PROJECT_ID]);
  await client.query("DELETE FROM pm_code_sets WHERE project_id=$1 AND id LIKE 'vtb-onegen-middle-cs-%'", [PROJECT_ID]);
}

async function insertTables(client: PoolClient, tables: TableSpec[]): Promise<void> {
  for (const table of tables) {
    await client.query(
      `
        INSERT INTO pm_data_tables (
          id, project_id, system_id, table_name, table_cn, table_group, data_layer, source_kind, usage_status,
          description, caliber, extra, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'使用',$9,$10,$11::jsonb,$12,$12)
      `,
      [
        tableId(table.tableName),
        PROJECT_ID,
        SYSTEM_ID,
        table.tableName,
        table.tableCn,
        table.group,
        table.dataLayer,
        table.sourceKind,
        `${table.caliber} 生成方式：${table.generation}；上游来源：${table.upstream}；下游去向：${table.downstream}。`,
        table.caliber,
        JSON.stringify({
          evidence: [SOURCE_DOC, ...splitEvidence(table.evidence)],
          evidenceType: "code_logic",
          generation: table.generation,
          upstream: table.upstream,
          downstream: table.downstream,
          remark: table.remark,
          importedBy: "codex-onegen-middle-sync",
        }),
        NOW,
      ],
    );
  }
}

async function insertFields(client: PoolClient, fields: FieldSpec[]): Promise<void> {
  for (const field of fields) {
    await client.query(
      `
        INSERT INTO pm_data_fields (
          id, project_id, system_id, table_id, field_name, field_cn, field_type, field_length,
          format_pattern, carrier_kind, field_order, source_field_order, nullable, primary_key,
          required, description, acquire_logic, validation_rule, code_value, mapped_table,
          mapped_field, mapped_field_cn, data_source, remark, extra, created_at, updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,'database',$10,NULL,$11,$12,$13,$14,NULL,NULL,$15,
          NULL,NULL,NULL,$16,$17,$18::jsonb,$19,$19
        )
      `,
      [
        fieldId(field.tableName, field.fieldName),
        PROJECT_ID,
        SYSTEM_ID,
        tableId(field.tableName),
        field.fieldName,
        field.fieldCn || null,
        field.fieldType,
        field.fieldLength || null,
        field.formatPattern || null,
        field.order,
        field.nullable,
        field.primaryKey,
        field.required,
        field.description,
        field.codeSetName || null,
        "VTB OneGen 中间层 Mapping 输入稿",
        field.remark,
        JSON.stringify({
          evidence: [SOURCE_DOC, ...splitEvidence(field.evidence)],
          evidenceType: "code_logic",
          expandedFrom: field.expandedFrom ?? null,
          importedBy: "codex-onegen-middle-sync",
        }),
        NOW,
      ],
    );
  }
}

async function insertCodeSets(client: PoolClient, codeSets: CodeSetSpec[]): Promise<void> {
  for (const codeSet of codeSets) {
    await client.query(
      `
        INSERT INTO pm_code_sets (id, project_id, name, description, raw, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6,$6)
      `,
      [
        codeSetId(codeSet.name),
        PROJECT_ID,
        codeSet.name,
        `VTB OneGen 中间层字段使用的码值集合：${codeSet.name}。`,
        JSON.stringify({ evidence: [SOURCE_DOC], importedBy: "codex-onegen-middle-sync" }),
        NOW,
      ],
    );
    for (const item of codeSet.items) {
      await client.query(
        `
          INSERT INTO pm_code_items (id, project_id, code_set_id, code, label, remark, sort_order, raw, created_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$9)
        `,
        [
          stableId("vtb-onegen-middle-ci", `${codeSet.name}|${item.code}`),
          PROJECT_ID,
          codeSetId(codeSet.name),
          item.code,
          item.label,
          item.remark,
          item.sortOrder,
          JSON.stringify({ evidence: [SOURCE_DOC] }),
          NOW,
        ],
      );
    }
  }
}

async function bindFieldCodeSets(client: PoolClient, fields: FieldSpec[]): Promise<void> {
  for (const field of fields.filter((item) => item.codeSetName)) {
    await client.query(
      `
        INSERT INTO pm_field_code_sets (project_id, field_id, code_set_id, relation_kind, created_at)
        VALUES ($1,$2,$3,'uses_code_set',$4)
        ON CONFLICT DO NOTHING
      `,
      [PROJECT_ID, fieldId(field.tableName, field.fieldName), codeSetId(field.codeSetName), NOW],
    );
  }
}

async function insertMappings(client: PoolClient, mappings: MappingSpec[]): Promise<void> {
  for (const mapping of mappings) {
    const id = mappingId(mapping);
    const targetFieldId = await findFieldId(client, mapping.tableName, mapping.targetField);
    const standardLogic = standardSafeIntermediateLogic(mapping);
    await client.query(
      `
        INSERT INTO pm_mapping_rules (
          id, project_id, system_id, table_id, field_id, status, logic_text, converted_sql,
          remark, sort_order, raw, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,'published',$6,$7,$8,$9,$10::jsonb,$11,$11)
      `,
      [
        id,
        PROJECT_ID,
        SYSTEM_ID,
        tableId(mapping.tableName),
        targetFieldId,
        mapping.logic,
        mapping.sql,
        mapping.remark,
        mapping.order,
        JSON.stringify({
          evidence: [SOURCE_DOC, ...splitEvidence(mapping.evidence)],
          scenario: mapping.scenario,
          condition: mapping.condition,
          targetCn: mapping.targetCn,
          standardLogic,
          standardLogicVersion: "rich-mapping-logic-v1",
          expandedFrom: mapping.expandedFrom ?? null,
          importedBy: "codex-onegen-middle-sync",
        }),
        NOW,
      ],
    );
    const actionId = stableId("vtb-onegen-middle-action", `${id}|1`);
    await client.query(
      `
        INSERT INTO pm_mapping_actions (
          id, project_id, mapping_rule_id, action_type, condition_text, expression_text,
          result_text, remark, sort_order, raw, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,$9::jsonb,$10,$10)
      `,
      [
        actionId,
        PROJECT_ID,
        id,
        inferActionType(mapping.logic),
        mapping.condition || null,
        mapping.logic,
        mapping.targetField,
        mapping.remark,
        JSON.stringify({
          standardLogic,
          standardLogicVersion: "rich-mapping-logic-v1",
          derivedSql: mapping.sql,
          evidence: [SOURCE_DOC],
        }),
        NOW,
      ],
    );
    for (const [index, refPath] of mapping.sourceRefs.entries()) {
      const sourceFieldId = await resolveSourceFieldId(client, refPath);
      const sourceRefId = stableId("vtb-onegen-middle-src", `${id}|${index}|${refPath}`);
      await client.query(
        `
          INSERT INTO pm_mapping_source_fields (
            id, project_id, mapping_rule_id, field_id, ref_path, alias, role, remark,
            sort_order, raw, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,NULL,'source',NULL,$6,$7::jsonb,$8,$8)
        `,
        [
          sourceRefId,
          PROJECT_ID,
          id,
          sourceFieldId,
          refPath,
          index + 1,
          JSON.stringify({ evidence: [SOURCE_DOC], resolved: Boolean(sourceFieldId) }),
          NOW,
        ],
      );
      await client.query(
        `
          INSERT INTO pm_mapping_action_source_fields (project_id, action_id, source_field_id, relation_kind, created_at)
          VALUES ($1,$2,$3,'uses',$4)
          ON CONFLICT DO NOTHING
        `,
        [PROJECT_ID, actionId, sourceRefId, NOW],
      );
    }
  }
}

async function insertStructuredExtractionCalibers(client: PoolClient): Promise<void> {
  for (const [index, caliber] of STRUCTURED_EXTRACTION_CALIBERS.entries()) {
    const id = `vtb-onegen-middle-map-${caliber.tableName.toLowerCase()}-caliber-${index + 1}`;
    await client.query(
      `
        INSERT INTO pm_mapping_rules (
          id, project_id, system_id, table_id, field_id, status, logic_text, converted_sql,
          remark, sort_order, raw, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,NULL,'published',$5,NULL,$6,$7,$8::jsonb,$9,$9)
        ON CONFLICT (id) DO UPDATE SET
          logic_text=EXCLUDED.logic_text,
          remark=EXCLUDED.remark,
          sort_order=EXCLUDED.sort_order,
          raw=EXCLUDED.raw,
          updated_at=EXCLUDED.updated_at
      `,
      [
        id,
        PROJECT_ID,
        SYSTEM_ID,
        tableId(caliber.tableName),
        JSON.stringify(caliber.rule),
        caliber.remark,
        index + 1,
        JSON.stringify({ scenario: caliber.scenario, structuredCaliber: true, importedBy: "codex-onegen-middle-sync" }),
        NOW,
      ],
    );
  }
}

async function applyRequiredLookupMappings(client: PoolClient): Promise<void> {
  await client.query(
    `UPDATE pm_mapping_rules
        SET logic_text=$3,
            converted_sql='required_lookup(TransactionTab.bopTxCode, TxCode.Id)',
            updated_at=$4
      WHERE project_id=$1 AND table_id=$2
        AND field_id IN (SELECT id FROM pm_data_fields WHERE project_id=$1 AND table_id=$2 AND field_name='TxCodeId')`,
    [PROJECT_ID, tableId("FAEManage"), JSON.stringify({ op: "required_lookup", source: "t.bopTxCode", lookup: "x.Id" }), NOW],
  );
}

async function insertRectifications(
  client: PoolClient,
  rectifications: { entityType: string; entityName: string; propertyKey: string; requirement: string }[],
): Promise<void> {
  for (const item of rectifications) {
    await client.query(
      `
        INSERT INTO pm_dictionary_rectifications (
          id, project_id, entity_type, entity_id, property_key, requirement, status,
          created_by, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,'open','codex-onegen-middle-sync',$7,$7)
      `,
      [
        stableId("vtb-onegen-middle-rect", `${item.entityType}|${item.entityName}|${item.propertyKey}`),
        PROJECT_ID,
        normalizeRectificationEntityType(item.entityType),
        item.entityName,
        item.propertyKey,
        item.requirement,
        NOW,
      ],
    );
  }
}

async function rebuildSearchIndex(client: PoolClient): Promise<void> {
  await client.query(
    `
      INSERT INTO pm_search_index (id, project_id, module_key, entity_type, entity_id, title, subtitle, body, keywords, search_text, updated_at)
      SELECT 'dict-table:' || id, project_id, 'dictionary', 'table', id, table_name, coalesce(table_cn,''),
        coalesce(description,''), coalesce(table_group,'') || ' 中间层 OneGen',
        table_name || ' ' || coalesce(table_cn,'') || ' ' || coalesce(description,'') || ' ' || coalesce(caliber,''), $2
      FROM pm_data_tables
      WHERE project_id=$1 AND id LIKE 'vtb-onegen-middle-%'
      ON CONFLICT (project_id, entity_type, entity_id) DO UPDATE SET
        title=EXCLUDED.title, subtitle=EXCLUDED.subtitle, body=EXCLUDED.body,
        keywords=EXCLUDED.keywords, search_text=EXCLUDED.search_text, updated_at=EXCLUDED.updated_at
    `,
    [PROJECT_ID, NOW],
  );
  await client.query(
    `
      INSERT INTO pm_search_index (id, project_id, module_key, entity_type, entity_id, title, subtitle, body, keywords, search_text, updated_at)
      SELECT 'dict-field:' || f.id, f.project_id, 'dictionary', 'field', f.id, f.field_name, coalesce(f.field_cn,''),
        coalesce(f.description,''), coalesce(t.table_name,'') || ' ' || coalesce(f.field_type,'') || ' ' || coalesce(f.format_pattern,''),
        coalesce(t.table_name,'') || ' ' || coalesce(t.table_cn,'') || ' ' || f.field_name || ' ' || coalesce(f.field_cn,'') || ' ' || coalesce(f.description,'') || ' ' || coalesce(f.code_value,''), $2
      FROM pm_data_fields f
      JOIN pm_data_tables t ON t.id=f.table_id
      WHERE f.project_id=$1 AND f.table_id LIKE 'vtb-onegen-middle-%'
      ON CONFLICT (project_id, entity_type, entity_id) DO UPDATE SET
        title=EXCLUDED.title, subtitle=EXCLUDED.subtitle, body=EXCLUDED.body,
        keywords=EXCLUDED.keywords, search_text=EXCLUDED.search_text, updated_at=EXCLUDED.updated_at
    `,
    [PROJECT_ID, NOW],
  );
}

async function findFieldId(client: PoolClient, tableName: string, fieldName: string): Promise<string | null> {
  const exact = await client.query<{ id: string }>(
    "SELECT id FROM pm_data_fields WHERE project_id=$1 AND table_id=$2 AND field_name=$3 LIMIT 1",
    [PROJECT_ID, tableId(tableName), fieldName],
  );
  if (exact.rows[0]) return exact.rows[0].id;
  return null;
}

async function resolveSourceFieldId(client: PoolClient, refPath: string): Promise<string | null> {
  const normalizedRef = refPath.replace(/^T-1\./, "").replace(/^T\./, "");
  const parts = normalizedRef.split(".");
  if (parts.length < 2) {
    return resolveFieldByTableAndName(client, "TransactionTab", normalizedRef);
  }
  if (parts[0] === "TransactionTab" && parts.length > 2) {
    return resolveFieldByTableAndName(client, "TransactionTab", parts.at(-1) as string);
  }
  if (parts.length < 2) return null;
  const fieldName = parts.pop() as string;
  const tableName = parts.join(".");
  return resolveFieldByTableAndName(client, tableName, fieldName);
}

async function resolveFieldByTableAndName(client: PoolClient, tableName: string, fieldName: string): Promise<string | null> {
  const result = await client.query<{ id: string }>(
    `
      SELECT f.id
      FROM pm_data_fields f
      JOIN pm_data_tables t ON t.id=f.table_id
      WHERE f.project_id=$1 AND t.table_name=$2 AND f.field_name=$3
      ORDER BY f.updated_at DESC
      LIMIT 1
    `,
    [PROJECT_ID, tableName, fieldName],
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
  const headerCells = new Set(["属性", "序号", "值", "对象类型", "表英文名", "目标字段"]);
  return markdownRows(text).filter((row) => row.length > 0 && !row.every((cell) => /^-+$/.test(cell)) && !headerCells.has(row[0]));
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
  return value.trim().replace(/\\\|/g, "|");
}

function extractCondition(scenarioText: string): string {
  const beforeTable = scenarioText.split("\n").filter((line) => !line.trim().startsWith("|")).join("\n");
  return beforeTable.replace(/触发条件[:：]?/g, "").replace(/\n{2,}/g, "\n").trim();
}

function normalizeSourceRefs(value: string, targetField: string): string[] {
  const clean = stripTicks(value).trim();
  if (!clean || clean === "无") return [];
  if (clean === "同上") return [];
  if (clean.includes("TransactionTab 同名字段")) return [`TransactionTab.${targetField}`];
  const refs = clean
    .split(/[；;、，]/)
    .flatMap((part) => part.split(/\s+\/\s+/))
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^T\s+/, "T.").replace(/^T-1\s+/, "T-1."))
    .filter((part) => part !== "无");
  return [...new Set(refs)];
}

function splitNames(value: string): string[] {
  const clean = stripTicks(value).trim();
  if (!clean.includes("/")) return [clean];
  return clean.split("/").map((item) => item.trim()).filter(Boolean);
}

function splitEvidence(value: string): string[] {
  return stripTicks(value).split(/[；;]/).map((item) => item.trim()).filter((item) => item && item !== "同上");
}

function appendEvidence(current: string, next: string): string {
  const values = [...splitEvidence(current), next].filter(Boolean);
  return [...new Set(values)].join("；");
}

function fieldKey(tableName: string, fieldName: string): string {
  return `${tableName.toLowerCase()}.${fieldName.toLowerCase()}`;
}

function inferActionType(logic: string): string {
  if (logic.includes("直取")) return "direct";
  if (logic.includes("常量") || logic.includes("固定")) return "constant";
  if (logic.includes("条件")) return "case_when";
  if (logic.includes("转换")) return "transform";
  if (logic === "-" || logic.includes("未赋值") || logic.includes("不赋值") || logic.includes("无来源字段")) return "not_assigned";
  return "manual_logic";
}

function nullableFrom(value: string): string {
  if (value === "是") return "否";
  if (value === "否") return "是";
  return value || "待确认";
}

function normalizeEmpty(value: string): string {
  return value === " " ? "" : value.trim();
}

function stripTicks(value: string): string {
  return value.replace(/`/g, "").trim();
}

function normalizeRectificationEntityType(value: string): string {
  if (value.includes("字段")) return "field";
  if (value.includes("码值")) return "codeSet";
  if (value.includes("Mapping")) return "mapping";
  if (value.includes("表")) return "table";
  return "mapping";
}

function tableId(tableName: string): string {
  return `vtb-onegen-middle-${slug(tableName)}`;
}

function fieldId(tableName: string, fieldName: string): string {
  return stableId("vtb-onegen-middle-field", `${tableName}|${fieldName}`);
}

function mappingId(mapping: MappingSpec): string {
  return stableId("vtb-onegen-middle-map", `${mapping.tableName}|${mapping.scenario}|${mapping.targetField}|${mapping.order}`);
}

function codeSetId(name: string): string {
  return `vtb-onegen-middle-cs-${slug(name)}`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function stableId(prefix: string, value: string): string {
  return `${prefix}-${createHash("sha1").update(`${PROJECT_ID}:${value}`).digest("hex").slice(0, 20)}`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
