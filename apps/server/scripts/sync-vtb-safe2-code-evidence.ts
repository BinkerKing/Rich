import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Pool } from "pg";

const PROJECT_ID = "vtb-二代safe";
const RICH_URL = process.env.RICH_DB_URL ?? "postgresql://binkerking@localhost/rich?host=/tmp&port=5432";
const RELEASE_ROOT = "/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/逻辑代码版本控制/v1.0.1_2026-10-08";
const TABLE_OWNER_RELEASE_ROOT = "/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/逻辑代码版本控制/v1.1.0_2026-10-09";
const JSH_INTERMEDIATE_RELEASE_ROOT = "/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/逻辑代码版本控制/v1.1.6_2026-10-10";
const JSH_RESULT_RELEASE_ROOT = "/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/逻辑代码版本控制/v1.1.1_2026-10-09";
const BOP_OWNER_RELEASE_ROOT = "/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/逻辑代码版本控制/v1.1.5_2026-10-10";
const FAL_OWNER_RELEASE_ROOT = "/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/逻辑代码版本控制/v1.1.3_2026-10-10";
const CFA_RESULT_OWNER_RELEASE_ROOT = "/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/逻辑代码版本控制/v1.1.4_2026-10-10";
const SAFE2_DEV_ROOT = "/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/sql";
const SAC_PIPELINE = "/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/二代SAFE逻辑开发/sql/67_add_safe2_sac_pipeline.sql";
const CUSTOMER_PIPELINE = `${SAFE2_DEV_ROOT}/14_refresh_customer_from_cif.sql`;
const CFA_INTERMEDIATE_PIPELINE = `${TABLE_OWNER_RELEASE_ROOT}/11_cfa_intermediate_table_owner_pipeline.sql`;
const TABLE_OWNER_ACC_PIPELINE = `${TABLE_OWNER_RELEASE_ROOT}/09_acc_table_owner_pipeline.sql`;
const JSH_OWNER_PIPELINES = [
  `${JSH_INTERMEDIATE_RELEASE_ROOT}/18_jsh_intermediate_scenario_split.sql`,
  `${JSH_RESULT_RELEASE_ROOT}/13_jsh_result_table_owners.sql`,
  `${JSH_RESULT_RELEASE_ROOT}/14_jsh_g_orchestrators.sql`,
];
const BOP_OWNER_PIPELINE = `${BOP_OWNER_RELEASE_ROOT}/17_bop_stage_scenario_split.sql`;
const FAL_OWNER_PIPELINE = `${FAL_OWNER_RELEASE_ROOT}/16_fald0501_table_owner.sql`;
const CFA_RESULT_OWNER_PIPELINES = [
  `${CFA_RESULT_OWNER_RELEASE_ROOT}/116_refactor_cfac_a_table_owner.sql`,
  `${CFA_RESULT_OWNER_RELEASE_ROOT}/117_refactor_cfac_b_table_owner.sql`,
  `${CFA_RESULT_OWNER_RELEASE_ROOT}/118_refactor_cfad_a_table_owners.sql`,
  `${CFA_RESULT_OWNER_RELEASE_ROOT}/119_refactor_cfad_b_table_owner.sql`,
  `${CFA_RESULT_OWNER_RELEASE_ROOT}/120_refactor_cfa_orchestrator.sql`,
];
const RELEASE_VERSION = "v1.0.1_2026-10-08";
const TABLE_OWNER_VERSION = "v1.1.0_2026-10-09";
const JSH_OWNER_VERSION = "v1.1.6_2026-10-10";
const BOP_OWNER_VERSION = "v1.1.5_2026-10-10";
const FAL_OWNER_VERSION = "v1.1.3_2026-10-10";
const CFA_RESULT_OWNER_VERSION = "v1.1.4_2026-10-10";
const NOW = new Date().toISOString();
const DRY_RUN = process.argv.includes("--dry-run");
const JSH_ONLY = process.argv.includes("--jsh-only");
const BOP_ONLY = process.argv.includes("--bop-only");
const FAL_ONLY = process.argv.includes("--fal-only");
const CFA_RESULTS_ONLY = process.argv.includes("--cfa-results-only");

type RichTable = { id: string; table_name: string; external_sql: string | null };
type Scenario = { id: string; table_id: string; title: string; external_sql: string | null; caliber_external_sql: string | null };
type Rule = { id: string; table_id: string; field_id: string; scenario_id: string | null; field_name: string; status: string; external_sql: string | null };
type DataField = { id: string; table_id: string; field_name: string; field_cn: string | null; field_order: number | null };
type RuleCreate = {
  id: string;
  tableId: string;
  fieldId: string;
  scenarioId: string;
  status: string;
  logicText: string;
  remark: string;
  sortOrder: number;
  externalSql: string;
};
type FieldCreate = {
  id: string;
  tableId: string;
  fieldName: string;
  fieldCn: string;
  fieldType: string;
  fieldOrder: number;
};
type InsertMap = {
  target: string;
  procedure: string;
  sourceFile: string;
  sourceKind: "release" | "active_sac" | "deployed_customer_cfa" | "active_table_owner" | "active_jsh_owner" | "active_bop_owner" | "active_fal_owner" | "active_cfa_result_owner";
  line: number;
  scenarioName: string | null;
  columns: string[];
  expressions: string[];
  insertSql: string;
  procedureSql: string;
};

const TABLE_OWNER_MAPPING_TABLES = new Set([
  "safeaccount", "safebalance", "tsafeaccca", "tsafeacccb",
  "cfacatab", "cfacbtab", "cfadatab", "cfadbtab",
  "faebaseinfo", "faemanage", "tsafejshd", "tsafejshdf", "tsafejshe", "tsafejsheg",
  "boptransaction",
  "tsafefald0501",
  "tsafecfaca", "tsafecfacb", "tsafecfada", "tsafecfadb", "tsafecfadafogucodeinfo",
]);
const JSH_TABLES = new Set(["faebaseinfo", "faemanage", "tsafejshd", "tsafejshdf", "tsafejshe", "tsafejsheg"]);
const BOP_TABLES = new Set(["boptransaction"]);
const FAL_TABLES = new Set(["tsafefald0501"]);
const CFA_RESULT_TABLES = new Set(["tsafecfaca", "tsafecfacb", "tsafecfada", "tsafecfadb", "tsafecfadafogucodeinfo"]);
const LATEST_FIELD_SQL_TABLES = new Set(["cfacatab", "cfacbtab", "cfadatab", "cfadbtab", "faebaseinfo", "faemanage", "tsafejshd", "tsafejshdf", "tsafejshe", "tsafejsheg", "boptransaction", "tsafefald0501", ...CFA_RESULT_TABLES]);
const CALIBER_CODE_TABLES = new Set(["safeaccount", "safebalance", "cfacatab", "cfacbtab", "cfadatab", "cfadbtab", "faebaseinfo", "faemanage", "tsafejshd", "tsafejshdf", "tsafejshe", "tsafejsheg", "boptransaction", "tsafefald0501", ...CFA_RESULT_TABLES]);
const DATABASE_IDENTITY_FIELDS = new Set([
  "safeaccount.id", "safebalance.id",
  "cfacatab.id", "cfacbtab.id", "cfadatab.id", "cfadbtab.id",
  "boptransaction.id",
]);

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

function isDatabaseIdentityField(tableName: string, fieldName: string): boolean {
  return DATABASE_IDENTITY_FIELDS.has(`${normalize(tableName)}.${normalize(fieldName)}`);
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

function insertColumnName(value: string): string {
  // Column-list comments are evidence for human readers.  They are not part
  // of the physical field name used to bind Rich Mapping rules.
  return value.replace(/\/\*[\s\S]*?\*\//g, "").replaceAll('"', "").trim();
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

function statementEnd(text: string, start: number): number {
  let depth = 0;
  let quote = "";
  for (let i = start; i < text.length; i += 1) {
    const character = text[i];
    if (quote) {
      if (character === quote && text[i - 1] !== "\\") quote = "";
      continue;
    }
    if (character === "'" || character === '"') { quote = character; continue; }
    if (character === "(") { depth += 1; continue; }
    if (character === ")") { depth -= 1; continue; }
    if (character === ";" && depth === 0) return i + 1;
  }
  return text.length;
}

function statementStart(text: string, insertStart: number): number {
  // A Mapping scenario must be executable/readable on its own.  When an
  // INSERT is preceded by a top-level WITH clause, retain that clause rather
  // than starting the displayed statement halfway through its CTEs.
  let cursor = 0;
  let candidate = -1;
  while (cursor < insertStart) {
    const withAt = keywordAtTopLevel(text, cursor, "WITH");
    if (withAt < 0 || withAt >= insertStart) break;
    if (statementEnd(text, withAt) >= insertStart) candidate = withAt;
    cursor = withAt + 4;
  }
  return candidate >= 0 ? candidate : insertStart;
}

function procedureBlocks(sql: string): Array<{ name: string; start: number; body: string }> {
  const starts = [...sql.matchAll(/CREATE OR REPLACE PROCEDURE\s+vtb\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gi)];
  return starts.map((match, index) => ({
    name: match[1],
    start: match.index ?? 0,
    body: sql.slice(match.index, starts[index + 1]?.index ?? sql.length),
  }));
}

function assertSingleTableOwner(sql: string): void {
  for (const procedure of procedureBlocks(sql)) {
    const targets = new Set(
      [...procedure.body.matchAll(/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+vtb\.((?:"[^"]+")|(?:[a-zA-Z_][a-zA-Z0-9_]*))/gi)]
        .map((match) => match[1].replaceAll('"', ""))
        .filter((target) => normalize(target) !== "processlog"),
    );
    if (targets.size > 1) {
      throw new Error(`table-owner violation: ${procedure.name} writes ${[...targets].join(", ")}`);
    }
  }
}

function runTableOwnerSelfTest(): void {
  const invalid = `CREATE OR REPLACE PROCEDURE vtb.bad_owner() LANGUAGE plpgsql AS $$
  BEGIN INSERT INTO vtb.safe_account(account_no) SELECT 'A'; DELETE FROM vtb.t_safe_accca; END; $$;`;
  let rejected = false;
  try { assertSingleTableOwner(invalid); } catch (error) {
    rejected = error instanceof Error && error.message === "table-owner violation: bad_owner writes safe_account, t_safe_accca";
  }
  if (!rejected) throw new Error("table-owner self-test did not reject a multi-table writer");
  assertSingleTableOwner(`CREATE OR REPLACE PROCEDURE vtb.good_owner() LANGUAGE plpgsql AS $$
  BEGIN DELETE FROM vtb.safe_account; INSERT INTO vtb.safe_account(account_no) SELECT 'A'; END; $$;`);
  console.log("table-owner self-test passed");
}

function runInsertParserSelfTest(): void {
  const sql = `CREATE OR REPLACE PROCEDURE vtb.demo() LANGUAGE plpgsql AS $$
  BEGIN
    WITH source_rows AS (SELECT 1 AS n)
    INSERT INTO vtb.demo_target (
      field_a /* field_a: 字段 A */
    )
    SELECT NULL::varchar AS field_a /* field_a: 显式空值 */
      FROM (VALUES (1)) AS source_row(n);
  END;
  $$;`;
  const parsed = parseInserts(sql, "demo.sql", "active_table_owner");
  if (parsed.length !== 1 || parsed[0].columns[0] !== "field_a") {
    throw new Error("insert parser self-test did not strip INSERT field comments");
  }
  const scenario = scenarioSql("demo_target", "演示口径", parsed);
  if (scenario.includes("CREATE OR REPLACE PROCEDURE") || !scenario.includes("WITH source_rows AS") || !scenario.includes("NULL::varchar AS field_a")) {
    throw new Error("insert parser self-test did not generate scenario-level SQL");
  }
  console.log("insert parser self-test passed");
}

function scenarioNameBefore(body: string, insertStart: number): string | null {
  const marker = /\/\*\s*@rich-scenario:\s*([^*]+?)\s*\*\//g;
  const beforeInsert = body.slice(0, insertStart);
  const matches = [...beforeInsert.matchAll(marker)];
  return matches.length === 0 ? null : matches[matches.length - 1][1].trim();
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
      const columns = splitTopLevel(procedure.body.slice(columnOpen + 1, columnClose)).map(insertColumnName);
      const expressions = splitTopLevel(procedure.body.slice(selectAt + 6, fromAt));
      if (columns.length !== expressions.length) continue;
      mappings.push({
        target: insert[1].replaceAll('"', ""),
        procedure: procedure.name,
        sourceFile,
        sourceKind,
        line: lineAt(sql, procedure.start + start),
        scenarioName: scenarioNameBefore(procedure.body, start),
        columns,
        expressions,
        insertSql: procedure.body.slice(statementStart(procedure.body, start), statementEnd(procedure.body, start)).trim(),
        procedureSql: procedure.body.trim(),
      });
    }
  }
  return mappings;
}

function versionsFor(mappings: InsertMap[]): string {
  const versions = new Set(mappings.map((mapping) => (
    mapping.sourceKind === "active_cfa_result_owner" ? CFA_RESULT_OWNER_VERSION
      : mapping.sourceKind === "active_fal_owner" ? FAL_OWNER_VERSION
      : mapping.sourceKind === "active_bop_owner" ? BOP_OWNER_VERSION
      : mapping.sourceKind === "active_jsh_owner" ? JSH_OWNER_VERSION
      : mapping.sourceKind === "active_table_owner" ? TABLE_OWNER_VERSION : RELEASE_VERSION
  )));
  return [...versions].join("；");
}

function tableSql(tableName: string, mappings: InsertMap[]): string {
  const sourceKinds = new Set(mappings.map((mapping) => mapping.sourceKind));
  const caveats: string[] = [];
  if (sourceKinds.has("release")) caveats.push("过程全文来自 v1.0.1_2026-10-08 已校验静态发布包。");
  if (sourceKinds.has("active_sac")) caveats.push("SAC 过程全文来自当前部署管道脚本；发布包中的 05_safe2_sac_mapping_fix.sql 仅固化差异修复，不含过程全文。");
  if (sourceKinds.has("deployed_customer_cfa")) caveats.push("Customer/CFA 中间层过程来自当前开发且已部署验证的脚本；该逻辑未收录在 v1.0.1 固定包，属于发布包完整性缺口。");
  if (sourceKinds.has("active_table_owner")) caveats.push("按表归属过程来自 v1.1.0_2026-10-09 已校验候选发布包；其部署脚本与发布文件 SHA-256 一致。");
  if (sourceKinds.has("active_jsh_owner")) caveats.push("JSH 按表归属过程来自 v1.1.6_2026-10-10 发布增量包；FAEBaseInfo 的结汇、购汇分别绑定独立直接贴源 SQL，不使用临时表或共享 CTE；部署脚本、VERSION 与 SHA-256 已校验。");
  if (sourceKinds.has("active_bop_owner")) caveats.push("BOP 数据池按表归属过程来自 v1.1.5_2026-10-10 发布增量包；两个业务场景分别绑定独立 INSERT SQL，不使用临时表、source_rows CTE 或 UNION ALL；部署脚本、VERSION 与 SHA-256 已校验，并通过 20260903/05 双向差集与回归。");
  if (sourceKinds.has("active_fal_owner")) caveats.push("FAL D0501 按表归属过程来自 v1.1.3_2026-10-10 发布增量包；部署脚本、VERSION 与 SHA-256 已校验，并通过 20260906/07 AM/AL 字段核验与回归。D02/D09/F01 不在该发布范围。");
  if (sourceKinds.has("active_cfa_result_owner")) caveats.push("CFA 产品结果按表归属过程来自 v1.1.4_2026-10-10 发布增量包；部署脚本、VERSION 与 SHA-256 已校验，并通过 CA/CB/DA/DB 自动字段双向差集与回归。人工维护、审批及原 Action 编号字段保持边界。");
  const sources = [...new Set(mappings.map((mapping) => `${mapping.sourceFile}:${mapping.line}`))].join(", ");
  const bodies = [...new Map(mappings.map((mapping) => [mapping.procedure, mapping.procedureSql])).values()];
  return `/*\n二代 SAFE 当前代码证据\n目标表：${tableName}\n代码版本：${versionsFor(mappings)}\n来源：${sources}\n说明：${caveats.join(" ")}\n*/\n\n${bodies.join("\n\n")}`;
}

function mappingsForScenario(tableName: string, title: string, mappings: InsertMap[]): InsertMap[] {
  const explicitlyMarked = mappings.filter((mapping) => mapping.scenarioName === title);
  if (explicitlyMarked.length > 0) return explicitlyMarked;
  const normalizedTable = normalize(tableName);
  if ((normalizedTable === "cfacbtab" || normalizedTable === "cfadbtab") && mappings.length > 1) {
    return title.includes("提款") ? [mappings[0]] : [mappings[mappings.length - 1]];
  }
  return mappings;
}

function scenarioSql(tableName: string, title: string, mappings: InsertMap[]): string {
  const sources = [...new Set(mappings.map((mapping) => `${mapping.sourceFile}:${mapping.line}`))].join(", ");
  return `/*
二代 SAFE Mapping 口径 SQL
目标表：${tableName}
口径：${title}
代码版本：${versionsFor(mappings)}
来源：${sources}
说明：此处仅展示本口径的字段写入 SQL；完整存储过程见本表“表说明”的 External SQL。
*/

${mappings.map((mapping) => mapping.insertSql).join("\n\n")}`;
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

function latestFieldSql(tableName: string, fieldName: string, mappings: InsertMap[]): string {
  // A dictionary field has one current External SQL expression.  When a
  // single table process has several business branches (e.g. loan issue and
  // repayment), source-order last write is the latest effective definition.
  for (const mapping of [...mappings].reverse()) {
    const index = mapping.columns.findIndex((column) => sameField(column, fieldName));
    if (index < 0) continue;
    return `/* 二代 SAFE 当前字段 SQL｜目标表：${tableName}｜代码版本：${versionsFor(mappings)} */\n/* ${mapping.procedure}｜${mapping.sourceFile}:${mapping.line}｜最新写入分支 */\n${mapping.expressions[index]}`;
  }
  return `/* 二代 SAFE 当前字段 SQL｜目标表：${tableName}｜代码版本：${versionsFor(mappings)} */`;
}

function resolveRichTable(target: string, tables: RichTable[]): RichTable | undefined {
  if (normalize(target) === "boptransactionstage") return tables.find((table) => table.table_name === "BopTransaction");
  return tables.find((table) => normalize(table.table_name) === normalize(target));
}

async function main(): Promise<void> {
  if (process.argv.includes("--table-owner-self-test")) {
    runTableOwnerSelfTest();
    return;
  }
  if (process.argv.includes("--insert-parser-self-test")) {
    runInsertParserSelfTest();
    return;
  }
  const sources = await Promise.all([
    readFile(`${RELEASE_ROOT}/01_source_load_procedures.sql`, "utf8").then((sql) => ({ sql, file: "01_source_load_procedures.sql", kind: "release" as const })),
    readFile(`${RELEASE_ROOT}/02_table_level_procedures.sql`, "utf8").then((sql) => ({ sql, file: "02_table_level_procedures.sql", kind: "release" as const })),
    readFile(`${RELEASE_ROOT}/03_shared_orchestration_procedures.sql`, "utf8").then((sql) => ({ sql, file: "03_shared_orchestration_procedures.sql", kind: "release" as const })),
    readFile(SAC_PIPELINE, "utf8").then((sql) => ({ sql, file: "67_add_safe2_sac_pipeline.sql", kind: "active_sac" as const })),
    readFile(CUSTOMER_PIPELINE, "utf8").then((sql) => ({ sql, file: "14_refresh_customer_from_cif.sql", kind: "deployed_customer_cfa" as const })),
    readFile(CFA_INTERMEDIATE_PIPELINE, "utf8").then((sql) => ({ sql, file: "11_cfa_intermediate_table_owner_pipeline.sql", kind: "active_table_owner" as const })),
    readFile(TABLE_OWNER_ACC_PIPELINE, "utf8").then((sql) => ({ sql, file: "09_acc_table_owner_pipeline.sql", kind: "active_table_owner" as const })),
    ...JSH_OWNER_PIPELINES.map((path) => readFile(path, "utf8").then((sql) => ({ sql, file: path.split("/").at(-1)!, kind: "active_jsh_owner" as const }))),
    readFile(BOP_OWNER_PIPELINE, "utf8").then((sql) => ({ sql, file: "15_bop_stage_table_owner.sql", kind: "active_bop_owner" as const })),
    readFile(FAL_OWNER_PIPELINE, "utf8").then((sql) => ({ sql, file: "16_fald0501_table_owner.sql", kind: "active_fal_owner" as const })),
    ...CFA_RESULT_OWNER_PIPELINES.map((path) => readFile(path, "utf8").then((sql) => ({ sql, file: path.split("/").at(-1)!, kind: "active_cfa_result_owner" as const }))),
  ]);
  for (const source of sources.filter((source) => source.kind === "active_table_owner" || source.kind === "active_jsh_owner" || source.kind === "active_bop_owner" || source.kind === "active_fal_owner" || source.kind === "active_cfa_result_owner")) {
    assertSingleTableOwner(source.sql);
  }
  const inserts = sources
    .flatMap((source) => parseInserts(source.sql, source.file, source.kind))
    // The active ACC table-owner implementation is the sole current writer
    // for its two result tables.  Do not present historic release writers as
    // concurrently effective Mapping logic.
    .filter((mapping) => !["tsafeaccca", "tsafeacccb"].includes(normalize(mapping.target))
      || mapping.sourceKind === "active_table_owner")
    // JSH has been refactored to table owners in the active validated scripts.
    // Do not bind Rich to historic release procedures that used different
    // aliases or directly wrote several business tables.
    .filter((mapping) => !JSH_TABLES.has(normalize(mapping.target))
      || mapping.sourceKind === "active_jsh_owner");
  const currentInserts = inserts
    .filter((mapping) => normalize(mapping.target) !== "boptransactionstage" || mapping.sourceKind === "active_bop_owner")
    .filter((mapping) => normalize(mapping.target) !== "tsafefald0501" || mapping.sourceKind === "active_fal_owner")
    .filter((mapping) => !CFA_RESULT_TABLES.has(normalize(mapping.target)) || mapping.sourceKind === "active_cfa_result_owner");
  const pool = new Pool({ connectionString: RICH_URL });
  const client = await pool.connect();
  try {
    const tableResult = await client.query<RichTable>("SELECT id, table_name, external_sql FROM pm_data_tables WHERE project_id=$1", [PROJECT_ID]);
    const scenarioResult = await client.query<Scenario>("SELECT id, table_id, title, external_sql, caliber_external_sql FROM pm_mapping_scenarios WHERE project_id=$1", [PROJECT_ID]);
    const ruleResult = await client.query<Rule>(`
        SELECT r.id, r.table_id, r.field_id, r.scenario_id, f.field_name, r.status, r.external_sql
          FROM pm_mapping_rules r
          JOIN pm_data_fields f ON f.id=r.field_id
         WHERE r.project_id=$1 AND r.field_id IS NOT NULL
      `, [PROJECT_ID]);
    const fieldResult = await client.query<DataField>(`
        SELECT id, table_id, field_name, field_cn, field_order
          FROM pm_data_fields
         WHERE project_id=$1
      `, [PROJECT_ID]);
    const byRichTable = new Map<string, InsertMap[]>();
    for (const insert of currentInserts) {
      const table = resolveRichTable(insert.target, tableResult.rows);
      if (!table) continue;
      const list = byRichTable.get(table.id) ?? [];
      list.push(insert);
      byRichTable.set(table.id, list);
    }

    const tableUpdates: Array<{ id: string; sql: string }> = [];
    const scenarioUpdates: Array<{ id: string; sql: string; caliberSql: string | null }> = [];
    const ruleUpdates: Array<{ id: string; sql: string }> = [];
    const ruleCreates: RuleCreate[] = [];
    const fieldCreates: FieldCreate[] = [];
    const codeFieldsWithoutRule: string[] = [];
    const rulesWithoutCode: string[] = [];

    for (const table of tableResult.rows) {
      if (JSH_ONLY && !JSH_TABLES.has(normalize(table.table_name))) continue;
      if (BOP_ONLY && !BOP_TABLES.has(normalize(table.table_name))) continue;
      if (FAL_ONLY && !FAL_TABLES.has(normalize(table.table_name))) continue;
      if (CFA_RESULTS_ONLY && !CFA_RESULT_TABLES.has(normalize(table.table_name))) continue;
      const mappings = byRichTable.get(table.id) ?? [];
      if (!mappings.length) continue;
      const externalSql = tableSql(table.table_name, mappings);
      if (table.external_sql !== externalSql) tableUpdates.push({ id: table.id, sql: externalSql });
      for (const scenario of scenarioResult.rows.filter((item) => item.table_id === table.id)) {
        const scenarioMappings = mappingsForScenario(table.table_name, scenario.title, mappings);
        const scenarioExternalSql = TABLE_OWNER_MAPPING_TABLES.has(normalize(table.table_name))
          ? scenarioSql(table.table_name, scenario.title, scenarioMappings)
          : externalSql;
        const caliberSql = CALIBER_CODE_TABLES.has(normalize(table.table_name)) ? scenarioExternalSql : null;
        if (scenario.external_sql !== scenarioExternalSql || (caliberSql !== null && scenario.caliber_external_sql !== caliberSql)) {
          scenarioUpdates.push({ id: scenario.id, sql: scenarioExternalSql, caliberSql });
        }
      }

      const mappedCodeFields = new Set(mappings.flatMap((mapping) => mapping.columns.map(canonicalField)));
      const rules = ruleResult.rows.filter((rule) => rule.table_id === table.id);
      const fields = fieldResult.rows.filter((field) => field.table_id === table.id);
      const defaultScenario = scenarioResult.rows.find((scenario) => scenario.table_id === table.id);
      for (const codeField of mappedCodeFields) {
        const field = fields.find((item) => sameField(codeField, item.field_name));
        if (!field) {
          if (BOP_ONLY && BOP_TABLES.has(normalize(table.table_name))) {
            const fieldKey = createHash("sha256").update(`${PROJECT_ID}:bop-field:${table.id}:${codeField}`).digest("hex").slice(0, 20);
            const fieldId = `pm-data-field-bop-owner-${fieldKey}`;
            const fieldCn = canonicalField(codeField) === "sourceside" ? "技术来源侧" : "贴源交易主键";
            const fieldType = canonicalField(codeField) === "sourceside" ? "string" : "int";
            const fieldOrder = Math.max(0, ...fields.map((item) => item.field_order ?? 0), ...fieldCreates.filter((item) => item.tableId === table.id).map((item) => item.fieldOrder)) + 1;
            fieldCreates.push({ id: fieldId, tableId: table.id, fieldName: codeField, fieldCn, fieldType, fieldOrder });
            const scenario = defaultScenario;
            if (scenario) {
              const ruleKey = createHash("sha256").update(`${PROJECT_ID}:bop-rule:${scenario.id}:${fieldId}`).digest("hex").slice(0, 20);
              ruleCreates.push({
                id: `pm-map-rule-bop-owner-${ruleKey}`,
                tableId: table.id,
                fieldId,
                scenarioId: scenario.id,
                status: "verified",
                logicText: "按表 owner 已显式写入；字段真实表达式见 External SQL。",
                remark: "BOP 20260903/05 已完成代码合同与自动字段双向差集；技术字段不参与业务字段差集。",
                sortOrder: fieldOrder,
                externalSql: fieldSql(table.table_name, codeField, mappings),
              });
            }
            continue;
          }
          codeFieldsWithoutRule.push(`${table.table_name}.${normalize(codeField)}`);
          continue;
        }
        const ownerScope = (JSH_ONLY && JSH_TABLES.has(normalize(table.table_name)))
          ? "jsh" : (BOP_ONLY && BOP_TABLES.has(normalize(table.table_name))) ? "bop"
            : (FAL_ONLY && FAL_TABLES.has(normalize(table.table_name))) ? "fal"
              : (CFA_RESULTS_ONLY && CFA_RESULT_TABLES.has(normalize(table.table_name))) ? "cfa-results" : null;
        if (!rules.some((rule) => rule.field_id === field.id) && ownerScope && defaultScenario) {
          const key = createHash("sha256").update(`${PROJECT_ID}:${ownerScope}-rule:${defaultScenario.id}:${field.id}`).digest("hex").slice(0, 20);
          const expression = fieldSql(table.table_name, field.field_name, mappings);
          ruleCreates.push({
            id: `pm-map-rule-${ownerScope}-owner-${key}`,
            tableId: table.id,
            fieldId: field.id,
            scenarioId: defaultScenario.id,
            status: "verified",
            logicText: "按表 owner 已显式写入；字段真实表达式见 External SQL。",
            remark: ownerScope === "jsh"
              ? "JSH 20260903 已完成代码合同与自动字段双向差集；人工/审批字段按原 Action 边界保留。"
              : ownerScope === "bop"
                ? "BOP 20260903/05 已完成代码合同与自动字段双向差集；CNUM 与技术字段按允许增强边界保留。"
                : ownerScope === "fal"
                  ? "FAL D0501 20260906/07 AM/AL 已完成原提取/审批后字段核验；人工/Action 字段按边界保留。"
                  : "CFA CA/CB/DA/DB 已完成自动字段双向差集与回归；人工维护、审批及原 Action 编号字段保持边界。",
            sortOrder: field.field_order ?? 0,
            externalSql: expression,
          });
        } else if (!rules.some((rule) => rule.field_id === field.id)) {
          codeFieldsWithoutRule.push(`${table.table_name}.${normalize(codeField)}`);
        }
      }
      for (const rule of rules) {
        if (![...mappedCodeFields].some((codeField) => sameField(codeField, rule.field_name))) {
          if (isDatabaseIdentityField(table.table_name, rule.field_name)) continue;
          rulesWithoutCode.push(`${table.table_name}.${rule.field_name}（${rule.status}）`);
          continue;
        }
        const scenario = scenarioResult.rows.find((item) => item.id === rule.scenario_id);
        const ruleMappings = scenario && LATEST_FIELD_SQL_TABLES.has(normalize(table.table_name))
          ? mappingsForScenario(table.table_name, scenario.title, mappings)
          : mappings;
        const externalSql = LATEST_FIELD_SQL_TABLES.has(normalize(table.table_name))
          ? latestFieldSql(table.table_name, rule.field_name, ruleMappings)
          : fieldSql(table.table_name, rule.field_name, ruleMappings);
        if (rule.external_sql !== externalSql) ruleUpdates.push({ id: rule.id, sql: externalSql });
      }
    }

    console.table({
      codeInsertTargets: byRichTable.size,
      tableExternalSqlUpdates: tableUpdates.length,
      scenarioExternalSqlUpdates: scenarioUpdates.length,
      fieldExternalSqlUpdates: ruleUpdates.length,
      fieldMappingRuleCreates: ruleCreates.length,
      dataFieldCreates: fieldCreates.length,
      codeFieldsWithoutRichRule: codeFieldsWithoutRule.length,
      richRulesWithoutCurrentInsertField: rulesWithoutCode.length,
      mode: DRY_RUN ? "dry-run" : "apply",
      scope: JSH_ONLY ? "JSH only" : BOP_ONLY ? "BOP only" : FAL_ONLY ? "FAL D0501 only" : CFA_RESULTS_ONLY ? "CFA result tables only" : "all eligible tables",
    });
    if (codeFieldsWithoutRule.length) console.log("代码写入字段但 Rich 无字段 Mapping：\n" + codeFieldsWithoutRule.join("\n"));
    if (rulesWithoutCode.length) console.log("Rich 字段 Mapping 未出现在当前 INSERT 目标列：\n" + rulesWithoutCode.join("\n"));
    if (DRY_RUN) return;

    await client.query("BEGIN");
    for (const create of fieldCreates) {
      await client.query(`
        INSERT INTO pm_data_fields (
          id, project_id, table_id, field_name, field_cn, field_type,
          nullable, primary_key, required, description, remark,
          source_field_order, field_order, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,'是',false,false,$7,$7,$8,$8,$9,$9)
        ON CONFLICT (id) DO UPDATE SET
          field_name=EXCLUDED.field_name, field_cn=EXCLUDED.field_cn,
          field_type=EXCLUDED.field_type, description=EXCLUDED.description,
          remark=EXCLUDED.remark, source_field_order=EXCLUDED.source_field_order,
          field_order=EXCLUDED.field_order, updated_at=EXCLUDED.updated_at
      `, [
        create.id, PROJECT_ID, create.tableId, create.fieldName, create.fieldCn, create.fieldType,
        "BOP 数据池技术追溯字段。", create.fieldOrder, NOW,
      ]);
    }
    for (const create of ruleCreates) {
      await client.query(`
        INSERT INTO pm_mapping_rules (
          id, project_id, scenario_id, table_id, field_id, status,
          logic_text, remark, sort_order, raw, created_at, updated_at,
          verification_status, verification_remark, external_sql
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'{}'::jsonb,$10,$10,$11,$12,$13)
        ON CONFLICT (id) DO UPDATE SET
          status=EXCLUDED.status, logic_text=EXCLUDED.logic_text, remark=EXCLUDED.remark,
          sort_order=EXCLUDED.sort_order, updated_at=EXCLUDED.updated_at,
          verification_status=EXCLUDED.verification_status,
          verification_remark=EXCLUDED.verification_remark, external_sql=EXCLUDED.external_sql
      `, [
        create.id, PROJECT_ID, create.scenarioId, create.tableId, create.fieldId, create.status,
        create.logicText, create.remark, create.sortOrder, NOW,
        "二代代码已核对；自动字段双跑已核对", "人工/审批字段保持原 Action 边界；其他字段见双向差集证据。", create.externalSql,
      ]);
    }
    for (const update of tableUpdates) await client.query("UPDATE pm_data_tables SET external_sql=$1, updated_at=$2 WHERE id=$3", [update.sql, NOW, update.id]);
    for (const update of scenarioUpdates) await client.query("UPDATE pm_mapping_scenarios SET external_sql=$1, caliber_external_sql=COALESCE($2, caliber_external_sql), updated_at=$3 WHERE id=$4", [update.sql, update.caliberSql, NOW, update.id]);
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
