import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Open / create the SQLite database, run idempotent schema migrations, and
 * return the handle. We use a single file per project (default: data/ke.db).
 *
 * Design choices:
 * - JSON blobs for `elements.content`, `elements.aliases`, etc. — schema
 *   stays compact and the per-type content shape can evolve without DDL.
 * - WAL mode + foreign-key enforcement on. Concurrent readers are safe.
 * - All timestamps are ISO 8601 strings (TEXT). We keep them human-readable
 *   so DBs are inspectable by hand.
 */
export function openDb(filePath: string): Database.Database {
  mkdirSync(dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  applySchema(db);
  return db;
}

function applySchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS elements (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      aliases TEXT,            -- JSON array
      tags TEXT,               -- JSON array
      domain TEXT,
      difficulty TEXT,
      content TEXT NOT NULL,   -- JSON
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      generated_by TEXT NOT NULL,
      ai_model TEXT,
      ai_session_id TEXT,
      richness INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_elements_type ON elements(type);

    CREATE TABLE IF NOT EXISTS element_versions (
      element_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      snapshot TEXT NOT NULL,   -- full JSON serialized Element
      PRIMARY KEY (element_id, timestamp),
      FOREIGN KEY (element_id) REFERENCES elements(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_versions_element ON element_versions(element_id, timestamp DESC);

    CREATE TABLE IF NOT EXISTS relations (
      id TEXT PRIMARY KEY,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      strength INTEGER,
      reason TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_id);
    CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_id);
    CREATE INDEX IF NOT EXISTS idx_relations_kind ON relations(kind);

    CREATE TABLE IF NOT EXISTS paths (
      id TEXT PRIMARY KEY,
      center_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      label TEXT,
      color TEXT,
      steps TEXT NOT NULL,        -- JSON array of element ids
      estimated_time TEXT,
      created_at TEXT NOT NULL,
      metadata TEXT               -- JSON
    );
    CREATE INDEX IF NOT EXISTS idx_paths_center ON paths(center_id);

    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      type TEXT NOT NULL,
      manual TEXT,
      element_id TEXT,
      op TEXT,
      adapter TEXT,
      data TEXT                   -- JSON
    );
    CREATE INDEX IF NOT EXISTS idx_signals_ts ON signals(ts);
    CREATE INDEX IF NOT EXISTS idx_signals_element ON signals(element_id);
    CREATE INDEX IF NOT EXISTS idx_signals_type ON signals(type);

    CREATE TABLE IF NOT EXISTS qa (
      id TEXT PRIMARY KEY,
      element_id TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      anchor TEXT,
      created_at TEXT NOT NULL,
      ai_model TEXT,
      ai_session_id TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_qa_element ON qa(element_id, created_at);

    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      element_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      text TEXT NOT NULL,
      context_before TEXT,
      context_after TEXT,
      note TEXT,
      analysis TEXT,              -- JSON { title?, body, aiModel?, createdAt }
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_annotations_element ON annotations(element_id, created_at);

    -- A single-row 'state' table for the current center. History goes in
    -- center_history with newest-first via id DESC.
    CREATE TABLE IF NOT EXISTS state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS center_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      from_id TEXT,
      to_id TEXT NOT NULL,
      dwell_ms INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_center_history_ts ON center_history(id DESC);

    -- System-improvement task board. Used by the workflow:
    --   Hermes hits a missing capability → INSERT row with status='pending'
    --   Developer ships the fix → UPDATE status='ready_to_verify'
    --   Hermes verifies → UPDATE status='verified' or 'rejected' + verification note
    -- verifications_json is a JSON array of {ts, result, notes} audit entries.
    CREATE TABLE IF NOT EXISTS improvement_tasks (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      reason        TEXT NOT NULL DEFAULT '',
      status        TEXT NOT NULL DEFAULT 'pending',
      priority      TEXT,
      category      TEXT,
      created_by    TEXT NOT NULL DEFAULT 'hermes',
      related_files TEXT,
      verifications_json TEXT NOT NULL DEFAULT '[]',
      requested_at  TEXT NOT NULL,
      updated_at    TEXT NOT NULL,
      -- Agent claim：哪个 agent 抢到了这条任务（null = 未认领）
      assigned_agent_id TEXT,
      assigned_at   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_improvement_tasks_status ON improvement_tasks(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_improvement_tasks_assigned ON improvement_tasks(assigned_agent_id);

    -- Toolbox: log of every tool invocation (manual UI button + Hermes via MCP).
    -- args_json + result are TEXT; scheduled_for lets a tool defer to a future
    -- time (cancellable from UI before it fires).
    CREATE TABLE IF NOT EXISTS tool_invocations (
      id            TEXT PRIMARY KEY,
      tool_name     TEXT NOT NULL,
      args_json     TEXT NOT NULL DEFAULT '{}',
      status        TEXT NOT NULL,          -- scheduled | running | completed | failed | cancelled
      created_by    TEXT NOT NULL,          -- hermes | user
      scheduled_for TEXT,
      started_at    TEXT,
      finished_at   TEXT,
      result        TEXT,
      error         TEXT,
      created_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tool_invocations_status_ts ON tool_invocations(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tool_invocations_tool ON tool_invocations(tool_name, created_at DESC);
  `);

  // Idempotent column additions for older DBs created before these fields existed.
  ensureColumn(db, "qa", "anchor", "TEXT");
  ensureColumn(db, "improvement_tasks", "assigned_agent_id", "TEXT");
  ensureColumn(db, "improvement_tasks", "assigned_at", "TEXT");
}

function ensureColumn(db: Database.Database, table: string, column: string, type: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (rows.some(r => r.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}
