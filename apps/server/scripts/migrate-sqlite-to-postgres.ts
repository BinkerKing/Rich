import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { openPostgresPool, type PgPool } from "../src/db/postgres.js";
import { dataDir } from "../src/lib/paths.js";

const SQLITE_PATH = process.env.KE_SQLITE_PATH ?? join(dataDir(), "ke.db");
const POSTGRES_URL = process.env.DATABASE_URL ?? process.env.KE_DATABASE_URL;
const RESET = process.argv.includes("--reset");

if (!POSTGRES_URL) {
  throw new Error("Set DATABASE_URL or KE_DATABASE_URL before running this migration.");
}

type Row = Record<string, unknown>;

async function main() {
  const pg = openPostgresPool(POSTGRES_URL);
  await pg.ready;

  if (RESET) await resetPostgres(pg);

  const counts: Record<string, number> = {};
  counts.elements = await copyTable(pg, "elements", [
    "id", "type", "title", "subtitle", "aliases", "tags", "domain", "difficulty", "content",
    "created_at", "updated_at", "generated_by", "ai_model", "ai_session_id", "richness",
  ], "id");
  counts.element_versions = await copyTable(pg, "element_versions", [
    "element_id", "timestamp", "snapshot",
  ], ["element_id", "timestamp"]);
  counts.relations = await copyTable(pg, "relations", [
    "id", "from_id", "to_id", "kind", "strength", "reason", "created_at",
  ], "id");
  counts.paths = await copyTable(pg, "paths", [
    "id", "center_id", "kind", "label", "color", "steps", "estimated_time", "created_at", "metadata",
  ], "id");
  counts.signals = await copyAppendOnly(pg, "signals", [
    "ts", "type", "manual", "element_id", "op", "adapter", "data",
  ]);
  counts.qa = await copyTable(pg, "qa", [
    "id", "element_id", "question", "answer", "anchor", "created_at", "ai_model", "ai_session_id",
  ], "id");
  counts.annotations = await copyTable(pg, "annotations", [
    "id", "element_id", "kind", "text", "context_before", "context_after", "note", "analysis", "created_at",
  ], "id");
  counts.state = await copyTable(pg, "state", [
    "key", "value", "updated_at",
  ], "key");
  counts.center_history = await copyAppendOnly(pg, "center_history", [
    "ts", "from_id", "to_id", "dwell_ms",
  ]);
  counts.tool_invocations = await copyTable(pg, "tool_invocations", [
    "id", "tool_name", "args_json", "status", "created_by", "scheduled_for",
    "started_at", "finished_at", "result", "error", "created_at",
  ], "id");

  await pg.pool.end();
  console.log(JSON.stringify({ ok: true, sqlite: SQLITE_PATH, reset: RESET, counts }, null, 2));
}

async function resetPostgres(pg: PgPool): Promise<void> {
  await pg.query(`
    TRUNCATE TABLE
      element_versions,
      relations,
      paths,
      signals,
      qa,
      annotations,
      center_history,
      tool_invocations,
      state,
      elements
    RESTART IDENTITY CASCADE
  `);
}

async function copyTable(
  pg: PgPool,
  table: string,
  columns: string[],
  conflictColumns: string | string[],
): Promise<number> {
  const rows = readSqliteRows(table, columns);
  if (rows.length === 0) return 0;
  const conflicts = Array.isArray(conflictColumns) ? conflictColumns : [conflictColumns];
  const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(", ");
  const updates = columns
    .filter(col => !conflicts.includes(col))
    .map(col => `${col}=EXCLUDED.${col}`)
    .join(", ");
  const sql = `
    INSERT INTO ${table} (${columns.join(", ")})
    VALUES (${placeholders})
    ON CONFLICT (${conflicts.join(", ")}) DO ${updates ? `UPDATE SET ${updates}` : "NOTHING"}
  `;
  for (const row of rows) {
    await pg.query(sql, columns.map(col => row[col] ?? null));
  }
  return rows.length;
}

async function copyAppendOnly(
  pg: PgPool,
  table: string,
  columns: string[],
): Promise<number> {
  const rows = readSqliteRows(table, columns);
  if (rows.length === 0) return 0;
  const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(", ");
  const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
  for (const row of rows) {
    await pg.query(sql, columns.map(col => row[col] ?? null));
  }
  return rows.length;
}

function readSqliteRows(table: string, columns: string[]): Row[] {
  const out = execFileSync("sqlite3", [
    "-json",
    SQLITE_PATH,
    `SELECT ${columns.join(", ")} FROM ${table}`,
  ], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
  if (!out.trim()) return [];
  return JSON.parse(out) as Row[];
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
