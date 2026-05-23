import { Pool } from "pg";

export interface PgPool {
  pool: Pool;
  ready: Promise<void>;
  query: Pool["query"];
  connect: Pool["connect"];
}

export function openPostgresPool(connectionString: string): PgPool {
  const pool = new Pool({ connectionString });
  const ready = applySchema(pool);
  return {
    pool,
    ready,
    query: pool.query.bind(pool),
    connect: pool.connect.bind(pool),
  };
}

async function applySchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS elements (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      aliases TEXT,
      tags TEXT,
      domain TEXT,
      difficulty TEXT,
      content TEXT NOT NULL,
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
      snapshot TEXT NOT NULL,
      PRIMARY KEY (element_id, timestamp),
      FOREIGN KEY (element_id) REFERENCES elements(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_versions_element ON element_versions(element_id, timestamp DESC);

    CREATE TABLE IF NOT EXISTS relations (
      order_id BIGSERIAL,
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
      steps TEXT NOT NULL,
      estimated_time TEXT,
      created_at TEXT NOT NULL,
      metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_paths_center ON paths(center_id);

    CREATE TABLE IF NOT EXISTS signals (
      id BIGSERIAL PRIMARY KEY,
      ts TEXT NOT NULL,
      type TEXT NOT NULL,
      manual TEXT,
      element_id TEXT,
      op TEXT,
      adapter TEXT,
      data TEXT
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
      analysis TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_annotations_element ON annotations(element_id, created_at);

    CREATE TABLE IF NOT EXISTS state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS center_history (
      id BIGSERIAL PRIMARY KEY,
      ts TEXT NOT NULL,
      from_id TEXT,
      to_id TEXT NOT NULL,
      dwell_ms INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_center_history_ts ON center_history(id DESC);

    CREATE TABLE IF NOT EXISTS tool_invocations (
      id TEXT PRIMARY KEY,
      tool_name TEXT NOT NULL,
      args_json TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL,
      created_by TEXT NOT NULL,
      scheduled_for TEXT,
      started_at TEXT,
      finished_at TEXT,
      result TEXT,
      error TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tool_invocations_status_ts ON tool_invocations(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tool_invocations_tool ON tool_invocations(tool_name, created_at DESC);
  `);
}
