import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Pool, type PoolClient } from "pg";

const PROJECT_ID = "vtb-二代safe";
const RICH_URL = process.env.RICH_DB_URL ?? "postgresql://binkerking@localhost/rich?host=/tmp&port=5432";
const NOW = new Date().toISOString();
const ANALYSIS_DOC = "/Users/binkerking/Documents/Ai-WorkSpace/Rich/docs/VTB_SAFE1_AUTOMATION_SCOPE_ANALYSIS.md";
const SAFE2_CLASSES = "/Users/binkerking/Documents/Riking-Project/Tomcat/tomcat-9.0.120-safe/webapps/safe-api/WEB-INF/classes";

const TARGETS = [
  "T_SAFE_BOPA", "T_SAFE_BOPB", "T_SAFE_BOPC", "T_SAFE_BOPD", "T_SAFE_BOPE", "T_SAFE_BOPF", "T_SAFE_BOPA_G", "T_SAFE_BOPB_H",
  "T_SAFE_ACCCA", "T_SAFE_ACCCB",
  "T_SAFE_JSHD", "T_SAFE_JSHE", "T_SAFE_JSHD_F", "T_SAFE_JSHE_G",
  "T_SAFE_CFAC_A", "T_SAFE_CFAC_B", "T_SAFE_CFAD_A", "T_SAFE_CFAD_B",
  "T_SAFE_FAL_Z02", "T_SAFE_FALD_02", "T_SAFE_FALD_0501", "T_SAFE_FALD_09", "T_SAFE_FALF_01",
  "T_SAFE_EXDA_N", "T_SAFE_EXDA_S", "T_SAFE_SAC_JP", "T_SAFE_SAC_JR",
] as const;

const SAC_TABLES = [
  { name: "T_SAFE_SAC_JP", cn: "[报表]机构大额结汇资金使用数据", dict: `${SAFE2_CLASSES}/static/dict/sacjp.json`, entity: "net.riking.sac.entity.Sacjp" },
  { name: "T_SAFE_SAC_JR", cn: "[报表]机构大额购汇资金来源数据", dict: `${SAFE2_CLASSES}/static/dict/sacjr.json`, entity: "net.riking.sac.entity.Sacjr" },
] as const;

const RECTIFICATIONS = [
  ["BOP_FINAL_CLASSIFICATION", "BOP", "classification_rule", "确认 BopTransaction 待判定记录到 BOPA-F 六类基础表的分类规则，以及 BOPA_G/BOPB_H 申报信息的自动来源；一代 VTB 主链路没有可证明的全自动分类规则。"],
  ["JSH_PURCHASE_MANAGEMENT", "T_SAFE_JSHE_G", "source_mapping", "确认购汇管理信息 T_SAFE_JSHE_G 的自动来源、与 T_SAFE_JSHE 的关联键、用途/交易码表规则。"],
  ["EXD_AN_AS_RICH_MAPPING", "T_SAFE_EXDA_N/T_SAFE_EXDA_S", "field_mapping", "现有二代 ODS 已实现并回归 EXDA_N/EXDA_S，但字段级 Mapping 尚未回写 Rich；需确认采用一代复刻口径还是二代纠偏口径。"],
  ["SAC_JP_JR_NEW_SCOPE", "T_SAFE_SAC_JP/T_SAFE_SAC_JR", "source_mapping", "本 Issue 将 JP/JR 纳入自动化，但一代 VTB extractVTBData 未触发 SAC。需提供源系统/文件、字段映射、筛选阈值、调度频率、增量键和重跑策略。"],
] as const;

type DictionaryAttr = { prop?: string; alias?: string; desc?: string; type?: string; verify?: string; dict_key?: string };
type DictionaryFile = { attrs?: DictionaryAttr[] };

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: RICH_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await upsertSacSystem(client);
    for (const table of SAC_TABLES) await upsertSacTable(client, table);
    await markAutomationScope(client);
    await upsertRectifications(client);
    await rebuildSearchIndex(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
  console.log(`VTB automation scope synced: ${TARGETS.length} targets, ${SAC_TABLES.length} SAC dictionaries, ${RECTIFICATIONS.length} open items.`);
}

async function upsertSacSystem(client: PoolClient): Promise<void> {
  await client.query(
    `INSERT INTO pm_data_systems (id,project_id,code,name,type,asset_layer,description,extra,created_at,updated_at)
     VALUES ('vtb-safe-report-sac',$1,'SAFE_SAC','SAFE 报表层-SAC','reporting','报表层','个人外汇业务监测系统。JP/JR 为 RICH-2 新确认的二代自动化范围。',$2::jsonb,$3,$3)
     ON CONFLICT (id) DO UPDATE SET description=EXCLUDED.description,extra=pm_data_systems.extra||EXCLUDED.extra,updated_at=EXCLUDED.updated_at`,
    [PROJECT_ID, JSON.stringify({ evidence: [ANALYSIS_DOC], scopeDecision: "RICH-2", onegenVtbEntryConfirmed: false }), NOW],
  );
}

async function upsertSacTable(client: PoolClient, table: typeof SAC_TABLES[number]): Promise<void> {
  const id = tableId(table.name);
  const parsed = JSON.parse(await readFile(table.dict, "utf8")) as DictionaryFile;
  await client.query(
    `INSERT INTO pm_data_tables (id,project_id,system_id,database_name,table_name,table_cn,description,caliber,extra,created_at,updated_at,data_layer,source_kind,table_group,usage_status,has_mapping)
     VALUES ($1,$2,'vtb-safe-report-sac','safe',$3,$4,$5,$6,$7::jsonb,$8,$8,'报表层','应用字典','个人外汇业务监测','使用',false)
     ON CONFLICT (id) DO UPDATE SET table_cn=EXCLUDED.table_cn,description=EXCLUDED.description,caliber=EXCLUDED.caliber,extra=pm_data_tables.extra||EXCLUDED.extra,usage_status='使用',updated_at=EXCLUDED.updated_at`,
    [id, PROJECT_ID, table.name, table.cn, `${table.cn}。二代 SAFE 应用存在实体及页面字段字典；一代 VTB 主入口未发现 SAC 自动加工链路。`, "RICH-2 已确认属于自动化范围；当前仅维护二代目标字段依据，上游 Mapping 待业务输入。", JSON.stringify({ evidence: [table.dict, `${SAFE2_CLASSES}/${table.entity.replaceAll(".", "/")}.class`, ANALYSIS_DOC], evidenceType: "safe2_application_model", physicalConfirmed: false, onegenVtbSourceConfirmed: false, automationScope: "RICH-2" }), NOW],
  );
  await client.query("DELETE FROM pm_data_fields WHERE project_id=$1 AND table_id=$2", [PROJECT_ID, id]);
  for (const [index, attr] of (parsed.attrs ?? []).entries()) {
    if (!attr.prop) continue;
    await client.query(
      `INSERT INTO pm_data_fields (id,project_id,system_id,table_id,field_name,field_cn,field_type,nullable,required,description,code_value,data_source,remark,extra,created_at,updated_at,field_order,carrier_kind)
       VALUES ($1,$2,'vtb-safe-report-sac',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$14,$15,'application_config')`,
      [fieldId(table.name, attr.prop), PROJECT_ID, id, attr.prop, label(attr), normalizeType(attr.type), attr.verify === "required" ? "否" : "是", attr.verify === "required", attr.desc ?? null, attr.dict_key ?? null, table.dict, "字段来自二代 SAFE 应用字典；是否为物理列及精确长度待 SQL Server 元数据复核。", JSON.stringify({ evidence: [table.dict], physicalConfirmed: false, sourceProperty: attr.prop, dictionaryType: attr.type ?? null }), NOW, index + 1],
    );
  }
}

async function markAutomationScope(client: PoolClient): Promise<void> {
  await client.query(
    `UPDATE pm_data_tables t SET usage_status='使用',
       has_mapping=EXISTS (
         SELECT 1
         FROM pm_mapping_rules r
         WHERE r.project_id=t.project_id
           AND r.table_id=t.id
           AND r.status NOT IN ('cancelled','archived')
           AND NULLIF(btrim(r.logic_text),'') IS NOT NULL
       ),
       extra=coalesce(t.extra,'{}'::jsonb)||jsonb_build_object('automationScope','RICH-2','automationScopeConfirmedAt',$3::text,'automationScopeEvidence',$4::text),updated_at=$3::text
     WHERE t.project_id=$1 AND t.table_name=ANY($2::text[])`,
    [PROJECT_ID, TARGETS, NOW, ANALYSIS_DOC],
  );
}

async function upsertRectifications(client: PoolClient): Promise<void> {
  for (const [key, entityId, propertyKey, requirement] of RECTIFICATIONS) {
    await client.query(
      `INSERT INTO pm_dictionary_rectifications (id,project_id,entity_type,entity_id,property_key,requirement,status,created_by,created_at,updated_at)
       VALUES ($1,$2,'mapping',$3,$4,$5,'open','codex-rich-2',$6,$6)
       ON CONFLICT (id) DO UPDATE SET requirement=EXCLUDED.requirement,status='open',updated_at=EXCLUDED.updated_at`,
      [`vtb-rich-2-${hash(key)}`, PROJECT_ID, entityId, propertyKey, requirement, NOW],
    );
  }
}

async function rebuildSearchIndex(client: PoolClient): Promise<void> {
  await client.query("DELETE FROM pm_search_index WHERE project_id=$1 AND entity_id IN ($2,$3)", [PROJECT_ID, tableId("T_SAFE_SAC_JP"), tableId("T_SAFE_SAC_JR")]);
  await client.query(
    `INSERT INTO pm_search_index (id,project_id,module_key,entity_type,entity_id,title,subtitle,body,keywords,search_text,updated_at)
     SELECT 'dict-table:'||id,project_id,'dictionary','table',id,table_name,coalesce(table_cn,''),coalesce(description,''),coalesce(table_group,''),table_name||' '||coalesce(table_cn,'')||' '||coalesce(description,''),$2
     FROM pm_data_tables WHERE project_id=$1 AND id IN ($3,$4)`,
    [PROJECT_ID, NOW, tableId("T_SAFE_SAC_JP"), tableId("T_SAFE_SAC_JR")],
  );
}

function label(attr: DictionaryAttr): string | null { return attr.alias?.startsWith("#{") ? attr.alias : attr.alias ?? attr.desc ?? null; }
function normalizeType(type?: string): string { return type === "money" ? "decimal" : type === "date" || type === "datetime" ? type : "string"; }
function tableId(name: string): string { return `vtb-safe-sac-table-${hash(name)}`; }
function fieldId(table: string, field: string): string { return `vtb-safe-sac-field-${hash(`${table}|${field}`)}`; }
function hash(value: string): string { return createHash("sha1").update(value).digest("hex").slice(0, 16); }

main().catch((error) => { console.error(error); process.exitCode = 1; });
