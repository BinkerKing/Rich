import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const PROJECT_ID = "vtb-二代safe";
const RICH_URL = process.env.RICH_DB_URL ?? "postgresql://binkerking@localhost/rich?host=/tmp&port=5432";
const RELEASE_ROOT = "/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/逻辑代码版本控制/v1.0.1_2026-10-08";
const SAFE2_DEV_ROOT = "/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/sql";
const SAC_PIPELINE = "/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/sql/67_add_safe2_sac_pipeline.sql";
const CUSTOMER_PIPELINE = `${SAFE2_DEV_ROOT}/14_refresh_customer_from_cif.sql`;
const CFA_INTERMEDIATE_PIPELINE = `${SAFE2_DEV_ROOT}/24_fix_cfa_intermediate_repayment_logic.sql`;
const TABLE_OWNER_ACC_PIPELINE = `${SAFE2_DEV_ROOT}/71_refactor_acc_table_owned_pipeline.sql`;
const RELEASE_VERSION = "v1.0.1_2026-10-08";
const TABLE_OWNER_VERSION = "v1.1.0-dev_2026-10-09-table-owner";
const NOW = new Date().toISOString();
const DRY_RUN = process.argv.includes("--dry-run");

type RichTable = { id: string; table_name: string; external_sql: string | null };
type Scenario = { id: string; table_id: string; title: string; external_sql: string | null };
type Rule = { id: string; table_id: string; field_name: string; status: string; external_sql: string | null };
type InsertMap = {
  target: string;
  procedure: string;
  sourceFile: string;
  sourceKind: "release" | "active_sac" | "deployed_customer_cfa" | "active_table_owner";
  line: number;
  columns: string[];
  expressions: string[];
  procedureSql: string;
};

function clean(text: string): string {
  return text.replace(/\r/g, "").replace(/\s+/g, " ").trim();
}

function normalize(name: string): string {
  return name.replaceAll('"', "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function canonicalField(name: string): string {
  const aliases: Record<string, string> = { accountmaintypecode: "accountmaintype" };
  return aliases[normalize(name)] ?? normalize(name);
}

function sameField(left: string, right: string): boolean {
  return canonicalField(left) === canonicalField(right);
}

function lineAt(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

function matchingParen(text: string, start: number): number {
  let depth = 0;
  let quote = "";
  for (let i = start; i < text.length; i += 1) {
    const character = text[i];
    if (quote) {
      if (character === quote && text[i - 1] !== "\\") quote = "";
      continue;
    }
    if (character === "'" || character === '"') { quote = character; continue; }
    if (character === "(") depth += 1;
    if (character === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  let quote = "";
  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];
    if (quote) {
      if (character === quote && text[i - 1] !== "\\") quote = "";
      continue;
    }
    if (character === "'" || character === '"') { quote = character; continue; }
    if (character === "(") depth += 1;
    else if (character === ")") depth -= 1;
    else if (character === "," && depth === 0) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = text.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function keywordAtTopLevel(text: string, start: number, keyword: string): number {
  let depth = 0;
  let quote = "";
  const upperKeyword = keyword.toUpperCase();
  for (let i = start; i <= text.length - upperKeyword.length; i += 1) {
    const character = text[i];
    if (quote) {
      if (character === quote && text[i - 1] !== "\\") quote = "";
      continue;
    }
    if (character === "'" || character === '"') { quote = character; continue; }
    if (character === "(") { depth += 1; continue; }
    if (character === ")") { depth -= 1; continue; }
    if (depth !== 0 || text.slice(i, i + upperKeyword.length).toUpperCase() !== upperKeyword) continue;
    const before = text[i - 1] ?? " ";
    const after = text[i + upperKeyword.length] ?? " ";
    if (!/[A-Z0-9_]/i.test(before) && !/[A-Z0-9_]/i.test(after)) return i;
  }
  return -1;
}

function procedureBlocks(sql: string): Array<{ name: string; start: number; body: string }> {
  const starts = [...sql.matchAll(/CREATE OR REPLACE PROCEDURE\s+vtb\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gi)];
  return starts.map((match, index) => ({
    name: match[1],
    start: match.index ?? 0,
    body: sql.slice(match.index, starts[index + 1]?.index ?? sql.length),
  }));
}

function parseInserts(sql: string, sourceFile: string, sourceKind: InsertMap["sourceKind"]): InsertMap[] {
  const mappings: InsertMap[] = [];
  for (const procedure of procedureBlocks(sql)) {
    const insertPattern = /INSERT\s+INTO\s+vtb\.((?:"[^"]+")|(?:[a-zA-Z_][a-zA-Z0-9_]*))\s*\(/gi;
    for (const insert of procedure.body.matchAll(insertPattern)) {
      const start = insert.index ?? 0;
      const columnOpen = start + insert[0].length - 1;
      const columnClose = matchingParen(procedure.body, columnOpen);
      if (columnClose < 0) continue;
      const selectAt = keywordAtTopLevel(procedure.body, columnClose + 1, "SELECT");
      const fromAt = selectAt < 0 ? -1 : keywordAtTopLevel(procedure.body, selectAt + 6, "FROM");
      if (fromAt < 0) continue;
      const columns = splitTopLevel(procedure.body.slice(columnOpen + 1, columnClose)).map((value) => value.replaceAll('"', "").trim());
      const expressions = splitTopLevel(procedure.body.slice(selectAt + 6, fromAt));
      if (columns.length !== expressions.length) continue;
      mappings.push({
        target: insert[1].replaceAll('"', ""),
        procedure: procedure.name,
        sourceFile,
        sourceKind,
        line: lineAt(sql, procedure.start + start),
        columns,
        expressions,
        procedureSql: procedure.body.trim(),
      });
    }
  }
  return mappings;
}

function versionsFor(mappings: InsertMap[]): string {
  const versions = new Set(mappings.map((mapping) => (
    mapping.sourceKind === "active_table_owner" ? TABLE_OWNER_VERSION : RELEASE_VERSION
  )));
  return [...versions].join("；");
}

function tableSql(tableName: string, mappings: InsertMap[]): string {
  const sourceKinds = new Set(mappings.map((mapping) => mapping.sourceKind));
  const caveats: string[] = [];
  if (sourceKinds.has("release")) caveats.push("过程全文来自 v1.0.1_2026-10-08 已校验静态发布包。");
  if (sourceKinds.has("active_sac")) caveats.push("SAC 过程全文来自当前部署管道脚本；发布包中的 05_safe2_sac_mapping_fix.sql 仅固化差异修复，不含过程全文。");
  if (sourceKinds.has("deployed_customer_cfa")) caveats.push("Customer/CFA 中间层过程来自当前开发且已部署验证的脚本；该逻辑未收录在 v1.0.1 固定包，属于发布包完整性缺口。");
  if (sourceKinds.has("active_table_owner")) caveats.push("账户/余额表归属过程来自当前阶段 1 已部署回归脚本；待完整回归后应固化为新的校验发布包。");
  const sources = [...new Set(mappings.map((mapping) => `${mapping.sourceFile}:${mapping.line}`))].join(", ");
  const bodies = [...new Map(mappings.map((mapping) => [mapping.procedure, mapping.procedureSql])).values()];
  return `/*\n二代 SAFE 当前代码证据\n目标表：${tableName}\n代码版本：${versionsFor(mappings)}\n来源：${sources}\n说明：${caveats.join(" ")}\n*/\n\n${bodies.join("\n\n")}`;
}

function fieldSql(tableName: string, fieldName: string, mappings: InsertMap[]): string {
  const branches: string[] = [];
  for (const mapping of mappings) {
    mapping.columns.forEach((column, index) => {
      if (!sameField(column, fieldName)) return;
      branches.push(`/* ${mapping.procedure}｜${mapping.sourceFile}:${mapping.line} */\n${mapping.expressions[index]}`);
    });
  }
  return `/* 二代 SAFE 当前字段 SQL｜目标表：${tableName}｜代码版本：${versionsFor(mappings)} */\n${branches.join("\n\n")}`;
}

function resolveRichTable(target: string, tables: RichTable[]): RichTable | undefined {
  if (normalize(target) === "boptransactionstage") return tables.find((table) => table.table_name === "BopTransaction");
  return tables.find((table) => normalize(table.table_name) === normalize(target));
}

async function main(): Promise<void> {
  const sources = await Promise.all([
    readFile(`${RELEASE_ROOT}/01_source_load_procedures.sql`, "utf8").then((sql) => ({ sql, file: "01_source_load_procedures.sql", kind: "release" as const })),
    readFile(`${RELEASE_ROOT}/02_table_level_procedures.sql`, "utf8").then((sql) => ({ sql, file: "02_table_level_procedures.sql", kind: "release" as const })),
    readFile(`${RELEASE_ROOT}/03_shared_orchestration_procedures.sql`, "utf8").then((sql) => ({ sql, file: "03_shared_orchestration_procedures.sql", kind: "release" as const })),
    readFile(SAC_PIPELINE, "utf8").then((sql) => ({ sql, file: "67_add_safe2_sac_pipeline.sql", kind: "active_sac" as const })),
    readFile(CUSTOMER_PIPELINE, "utf8").then((sql) => ({ sql, file: "14_refresh_customer_from_cif.sql", kind: "deployed_customer_cfa" as const })),
    readFile(CFA_INTERMEDIATE_PIPELINE, "utf8").then((sql) => ({ sql, file: "24_fix_cfa_intermediate_repayment_logic.sql", kind: "deployed_customer_cfa" as const })),
    readFile(TABLE_OWNER_ACC_PIPELINE, "utf8").then((sql) => ({ sql, file: "71_refactor_acc_table_owned_pipeline.sql", kind: "active_table_owner" as const })),
  ]);
  const inserts = sources
    .flatMap((source) => parseInserts(source.sql, source.file, source.kind))
    // The active ACC table-owner implementation is the sole current writer
    // for its two result tables.  Do not present historic release writers as
    // concurrently effective Mapping logic.
    .filter((mapping) => !["tsafeaccca", "tsafeacccb"].includes(normalize(mapping.target))
      || mapping.sourceKind === "active_table_owner");
  const pool = new Pool({ connectionString: RICH_URL });
  const client = await pool.connect();
  try {
    const tableResult = await client.query<RichTable>("SELECT id, table_name, external_sql FROM pm_data_tables WHERE project_id=$1", [PROJECT_ID]);
    const scenarioResult = await client.query<Scenario>("SELECT id, table_id, title, external_sql FROM pm_mapping_scenarios WHERE project_id=$1", [PROJECT_ID]);
    const ruleResult = await client.query<Rule>(`
        SELECT r.id, r.table_id, f.field_name, r.status, r.external_sql
          FROM pm_mapping_rules r
          JOIN pm_data_fields f ON f.id=r.field_id
         WHERE r.project_id=$1 AND r.field_id IS NOT NULL
      `, [PROJECT_ID]);
    const byRichTable = new Map<string, InsertMap[]>();
    for (const insert of inserts) {
      const table = resolveRichTable(insert.target, tableResult.rows);
      if (!table) continue;
      const list = byRichTable.get(table.id) ?? [];
      list.push(insert);
      byRichTable.set(table.id, list);
    }

    const tableUpdates: Array<{ id: string; sql: string }> = [];
    const scenarioUpdates: Array<{ id: string; sql: string }> = [];
    const ruleUpdates: Array<{ id: string; sql: string }> = [];
    const codeFieldsWithoutRule: string[] = [];
    const rulesWithoutCode: string[] = [];

    for (const table of tableResult.rows) {
      const mappings = byRichTable.get(table.id) ?? [];
      if (!mappings.length) continue;
      const externalSql = tableSql(table.table_name, mappings);
      if (table.external_sql !== externalSql) tableUpdates.push({ id: table.id, sql: externalSql });
      for (const scenario of scenarioResult.rows.filter((item) => item.table_id === table.id)) {
        if (scenario.external_sql !== externalSql) scenarioUpdates.push({ id: scenario.id, sql: externalSql });
      }

      const mappedCodeFields = new Set(mappings.flatMap((mapping) => mapping.columns.map(canonicalField)));
      const rules = ruleResult.rows.filter((rule) => rule.table_id === table.id);
      for (const codeField of mappedCodeFields) {
        if (!rules.some((rule) => sameField(codeField, rule.field_name))) codeFieldsWithoutRule.push(`${table.table_name}.${normalize(codeField)}`);
      }
      for (const rule of rules) {
        if (![...mappedCodeFields].some((codeField) => sameField(codeField, rule.field_name))) {
          rulesWithoutCode.push(`${table.table_name}.${rule.field_name}（${rule.status}）`);
          continue;
        }
        const externalSql = fieldSql(table.table_name, rule.field_name, mappings);
        if (rule.external_sql !== externalSql) ruleUpdates.push({ id: rule.id, sql: externalSql });
      }
    }

    console.table({
      codeInsertTargets: byRichTable.size,
      tableExternalSqlUpdates: tableUpdates.length,
      scenarioExternalSqlUpdates: scenarioUpdates.length,
      fieldExternalSqlUpdates: ruleUpdates.length,
      codeFieldsWithoutRichRule: codeFieldsWithoutRule.length,
      richRulesWithoutCurrentInsertField: rulesWithoutCode.length,
      mode: DRY_RUN ? "dry-run" : "apply",
    });
    if (codeFieldsWithoutRule.length) console.log("代码写入字段但 Rich 无字段 Mapping：\n" + codeFieldsWithoutRule.join("\n"));
    if (rulesWithoutCode.length) console.log("Rich 字段 Mapping 未出现在当前 INSERT 目标列：\n" + rulesWithoutCode.join("\n"));
    if (DRY_RUN) return;

    await client.query("BEGIN");
    for (const update of tableUpdates) await client.query("UPDATE pm_data_tables SET external_sql=$1, updated_at=$2 WHERE id=$3", [update.sql, NOW, update.id]);
    for (const update of scenarioUpdates) await client.query("UPDATE pm_mapping_scenarios SET external_sql=$1, updated_at=$2 WHERE id=$3", [update.sql, NOW, update.id]);
    for (const update of ruleUpdates) await client.query("UPDATE pm_mapping_rules SET external_sql=$1, updated_at=$2 WHERE id=$3", [update.sql, NOW, update.id]);
    await client.query("COMMIT");

    const verification = await client.query<{ table_count: string; scenario_count: string; rule_count: string }>(`
      SELECT
        count(DISTINCT t.id) FILTER (WHERE nullif(btrim(t.external_sql), '') IS NOT NULL)::text AS table_count,
        count(DISTINCT s.id) FILTER (WHERE nullif(btrim(s.external_sql), '') IS NOT NULL)::text AS scenario_count,
        count(DISTINCT r.id) FILTER (WHERE nullif(btrim(r.external_sql), '') IS NOT NULL)::text AS rule_count
      FROM pm_data_tables t
      LEFT JOIN pm_mapping_scenarios s ON s.project_id=t.project_id AND s.table_id=t.id
      LEFT JOIN pm_mapping_rules r ON r.project_id=t.project_id AND r.table_id=t.id
      WHERE t.project_id=$1
    `, [PROJECT_ID]);
    console.table(verification.rows);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
