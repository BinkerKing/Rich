import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

const MAPPING_ROOT = "/Users/binkerking/Documents/Riking-Project/8-VBT/03-Mapping/逻辑代码版本控制";
const PROJECT_ID = "vtb-二代safe";
const RICH_URL = process.env.RICH_DB_URL ?? "postgresql://binkerking@localhost/rich?host=/tmp&port=5432";
const WORKSPACE = "/Users/binkerking/Documents/Ai-WorkSpace/Rich";
const REFERENCE_SQL = "/Users/binkerking/Documents/Riking-Project/8-VBT/04-环境与部署/项目部署/sql/vtb_ods_postgres_setup.sql";

const SHARED_PROCEDURES = [
  "usp_vtb_process_import_side_effects",
  "usp_vtb_validate_acccb_balance",
  "usp_vtb_safe2_extract_bop_stage",
] as const;

function extractProcedure(source: string, name: string): string {
  const signature = `CREATE OR REPLACE PROCEDURE vtb.${name}(`;
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Missing PostgreSQL procedure: ${name}`);
  const next = source.indexOf("\nCREATE OR REPLACE PROCEDURE vtb.", start + signature.length);
  return source.slice(start, next < 0 ? source.length : next).trim();
}

function checksum(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

async function main(): Promise<void> {
  const version = process.argv[2];
  if (!/^v\d+\.\d+\.\d+_\d{4}-\d{2}-\d{2}$/.test(version ?? "")) {
    throw new Error("Version must be v<major>.<minor>.<patch>_YYYY-MM-DD");
  }
  const destination = join(MAPPING_ROOT, version);
  if (existsSync(destination)) throw new Error(`Version already exists and cannot be overwritten: ${destination}`);
  await mkdir(destination, { recursive: true });

  const sourceLoad = join(WORKSPACE, "apps/server/scripts/sql/vtb-source-load-procedures.sql");
  const tableLevel = join(WORKSPACE, "apps/server/scripts/sql/vtb-table-process-procedures.sql");
  await copyFile(sourceLoad, join(destination, "01_source_load_procedures.sql"));
  await copyFile(tableLevel, join(destination, "02_table_level_procedures.sql"));

  const reference = await readFile(REFERENCE_SQL, "utf8");
  const shared = `${SHARED_PROCEDURES.map((name) => extractProcedure(reference, name)).join("\n\n")}\n`;
  await writeFile(join(destination, "03_shared_orchestration_procedures.sql"), shared, "utf8");

  const pool = new Pool({ connectionString: RICH_URL });
  try {
    const result = await pool.query<{ table_name: string; external_sql: string }>(
      `SELECT table_name, external_sql
       FROM pm_data_tables
       WHERE project_id=$1 AND external_sql LIKE '%VTB SAFE 一代逻辑%'
       ORDER BY table_name`,
      [PROJECT_ID],
    );
    if (result.rows.length !== 41) throw new Error(`Expected 41 VTB table external SQL records, got ${result.rows.length}`);
    const externalSql = result.rows
      .map((row) => `/* Rich table: ${row.table_name} */\n${row.external_sql.trim()}`)
      .join("\n\n") + "\n";
    await writeFile(join(destination, "04_rich_table_external_sql_snapshot.sql"), externalSql, "utf8");

    const files = [
      "01_source_load_procedures.sql",
      "02_table_level_procedures.sql",
      "03_shared_orchestration_procedures.sql",
      "04_rich_table_external_sql_snapshot.sql",
    ];
    const snapshots = await Promise.all(files.map(async (file) => [file, await readFile(join(destination, file), "utf8")] as const));
    const checksums = snapshots.map(([file, content]) => `${checksum(content)}  ${file}`).join("\n") + "\n";
    await writeFile(join(destination, "CHECKSUMS.sha256"), checksums, "utf8");
    const manifest = `# ${version}\n\n- 项目：VTB 二代 SAFE\n- 快照日期：${version.slice(-10)}\n- Rich 表级外部 SQL：${result.rows.length} 张\n- 表级自动过程：20 个\n- 无自动落表过程、仅保留原因说明：15 张\n- 共享过程：${SHARED_PROCEDURES.join("、")}\n\n本快照不可覆盖；后续变更新建下一版本目录。\n`;
    await writeFile(join(destination, "VERSION.md"), manifest, "utf8");
  } finally {
    await pool.end();
  }
  console.log(`Created immutable VTB stored-procedure snapshot: ${destination}`);
}

void main();
