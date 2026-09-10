import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { tableProcedureNames, VTB_TABLE_PROCESS_NOTES } from "../src/modules/project-dictionary/safe/vtbExternalSql.js";

const PROJECT_ID = "vtb-二代safe";
const RICH_URL = process.env.RICH_DB_URL ?? "postgresql://binkerking@localhost/rich?host=/tmp&port=5432";
const POSTGRESQL_SOURCE =
  "/Users/binkerking/Documents/Riking-Project/8-VBT/04-环境与部署/项目部署/sql/vtb_ods_postgres_setup.sql";
const SOURCE_LOADER_SQL = new URL("./sql/vtb-source-load-procedures.sql", import.meta.url);
const TABLE_LEVEL_SQL = new URL("./sql/vtb-table-process-procedures.sql", import.meta.url);
const NOW = new Date().toISOString();

async function main(): Promise<void> {
  const source = `${await readFile(TABLE_LEVEL_SQL, "utf8")}\n${await readFile(POSTGRESQL_SOURCE, "utf8")}\n${await readFile(SOURCE_LOADER_SQL, "utf8")}`;
  const procedures = tableProcedureNames();
  const pool = new Pool({ connectionString: RICH_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const tables = await client.query<{ id: string; table_name: string }>(
      "SELECT id, table_name FROM pm_data_tables WHERE project_id=$1",
      [PROJECT_ID],
    );
    const byName = new Map(tables.rows.map((table) => [table.table_name, table]));
    const missing = [...procedures.keys()].filter((tableName) => !byName.has(tableName));
    if (missing.length) throw new Error(`数据字典缺少 VTB 表：${missing.join(", ")}`);

    for (const [tableName, procedureNames] of procedures) {
      const table = byName.get(tableName);
      if (!table) continue;
      const externalSql = renderExternalSql(tableName, procedureNames, source);
      await client.query(
        "UPDATE pm_data_tables SET external_sql=$3, updated_at=$4 WHERE project_id=$1 AND id=$2",
        [PROJECT_ID, table.id, externalSql, NOW],
      );
      await client.query(
        "UPDATE pm_mapping_scenarios SET external_sql=$3, updated_at=$4 WHERE project_id=$1 AND table_id=$2",
        [PROJECT_ID, table.id, externalSql, NOW],
      );
    }
    await client.query("COMMIT");
    console.table({ tables: procedures.size, procedures: new Set([...procedures.values()].flat()).size });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

function renderExternalSql(tableName: string, procedureNames: string[], source: string): string {
  const boundary = tableName.startsWith("T_SAFE_BOP")
    ? "\n/* 一代 VTB 自动链路仅写入待判定 BOP 前置表；A-F 与 G/H 的最终业务分类不在一代自动逻辑内，禁止在此过程虚构自动落表。 */\n"
    : "\n";
  const blocks = [
    ...(procedureNames.includes("usp_vtb_load_fal_warehouse")
      ? [extractFunction(source, "vtb_parse_fal_date"), extractFunction(source, "vtb_fal_month_diff")]
      : []),
    ...procedureNames.map((procedureName) => extractProcedure(source, procedureName)),
  ];
  const note = VTB_TABLE_PROCESS_NOTES[tableName];
  const body = blocks.length ? blocks.join("\n\n") : `/* 无可无损拆分的自动落表过程。原因：${note ?? "一代没有该表的自动落表逻辑。"} */`;
  return `/*\nVTB SAFE 一代逻辑 PostgreSQL 等价过程。\n表：${tableName}\n证据：${POSTGRESQL_SOURCE}\n执行：按 VTB 专属顺序调用本表关联过程；不得调用包含 CFAB/CFAE/CFAF、EXDA A-M/P-R 或 SAC 的标准 SAFE 链路。\n*/${boundary}${body}`;
}

function extractFunction(source: string, functionName: string): string {
  const signature = `CREATE OR REPLACE FUNCTION vtb.${functionName}(`;
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`未在 PostgreSQL 参考脚本找到函数：${functionName}`);
  const nextProcedure = source.indexOf("\nCREATE OR REPLACE PROCEDURE vtb.", start + signature.length);
  const nextFunction = source.indexOf("\nCREATE OR REPLACE FUNCTION vtb.", start + signature.length);
  const next = [nextProcedure, nextFunction].filter((position) => position >= 0).sort((a, b) => a - b)[0] ?? -1;
  return normalizePostgresText(source.slice(start, next < 0 ? source.length : next).trim());
}

function extractProcedure(source: string, procedureName: string): string {
  const signature = `CREATE OR REPLACE PROCEDURE vtb.${procedureName}(`;
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`未在 PostgreSQL 参考脚本找到过程：${procedureName}`);
  const next = source.indexOf("\nCREATE OR REPLACE PROCEDURE vtb.", start + signature.length);
  return normalizePostgresText(source.slice(start, next < 0 ? source.length : next).trim());
}

function normalizePostgresText(sql: string): string {
  // Reference comments may name SQL Server's dbo schema; external SQL must be
  // directly recognizable as PostgreSQL and has no dbo dependency.
  return sql.replaceAll("dbo.", "first-generation ");
}

void main();
