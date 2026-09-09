import Database from "better-sqlite3";
import { WORKBENCH_SCHEMA } from "../task-workbench/repository.js";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SQLITE_PROJECT_MANAGEMENT_SCHEMA } from "./projectManagementSchema.js";

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
  db.exec(WORKBENCH_SCHEMA);
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
      status TEXT,             -- 项目实战：仅 step 类型用，todo/doing/done
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
    --   User reviews PRD/tasks → UPDATE status='ready_to_develop'
    --   Developer ships the fix → UPDATE status='ready_to_verify'
    --   Hermes verifies → UPDATE status='verified' or 'rejected' + verification note
    -- verifications_json is a JSON array of {ts, result, notes} audit entries.
    CREATE TABLE IF NOT EXISTS improvement_tasks (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      reason        TEXT NOT NULL DEFAULT '',
      prd_content   TEXT NOT NULL DEFAULT '',
      tasks_json    TEXT NOT NULL DEFAULT '[]',
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

    CREATE TABLE IF NOT EXISTS mcp_operation_log (
      tool_name     TEXT NOT NULL,
      request_id    TEXT NOT NULL,
      input_hash    TEXT NOT NULL,
      status        TEXT NOT NULL,
      response_json TEXT,
      created_at    TEXT NOT NULL,
      completed_at  TEXT,
      PRIMARY KEY (tool_name, request_id)
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_operation_status ON mcp_operation_log(status, created_at DESC);

    CREATE TABLE IF NOT EXISTS mcp_tasks (
      id                TEXT PRIMARY KEY,
      type              TEXT NOT NULL,
      title             TEXT NOT NULL,
      request_json      TEXT NOT NULL,
      status            TEXT NOT NULL,
      backend           TEXT,
      external_task_id  TEXT,
      progress_summary  TEXT,
      result_refs_json  TEXT NOT NULL DEFAULT '[]',
      error             TEXT,
      conversation_id   TEXT,
      request_id        TEXT,
      review_status     TEXT,
      review_notes      TEXT,
      created_at        TEXT NOT NULL,
      started_at        TEXT,
      updated_at        TEXT NOT NULL,
      finished_at       TEXT,
      last_synced_at    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_tasks_status ON mcp_tasks(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mcp_tasks_external ON mcp_tasks(backend, external_task_id);

    CREATE TABLE IF NOT EXISTS multica_project_bindings (
      rich_project_id TEXT PRIMARY KEY,
      binding_json    TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS multica_team_plans (
      id                    TEXT PRIMARY KEY,
      rich_project_id       TEXT NOT NULL,
      request_json          TEXT NOT NULL,
      plan_json             TEXT NOT NULL,
      status                TEXT NOT NULL,
      created_at            TEXT NOT NULL,
      applied_at            TEXT,
      resolved_binding_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_multica_team_plans_project ON multica_team_plans(rich_project_id, created_at DESC);

    -- Rich 首页动画展示系统 v0.1：visual 块独立持久化（Markdown ascii 围栏内的图）。
    -- 一条 chat message 可对应 0..N 个 visual 块；orderInMessage 保留在 message 内的出现次序。
    -- payload 是 JSON：ascii / caption / parsed 三个字段
    CREATE TABLE IF NOT EXISTS chat_visual_blocks (
      id                TEXT PRIMARY KEY,
      message_id        TEXT NOT NULL DEFAULT '',
      block_type        TEXT NOT NULL,        -- flowchart | table | sequence | architecture | tree | concept | chart | sketch | raw
      payload           TEXT NOT NULL,        -- JSON
      order_in_message  INTEGER NOT NULL DEFAULT 0,
      created_at        TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cvb_message ON chat_visual_blocks(message_id, order_in_message);
    CREATE INDEX IF NOT EXISTS idx_cvb_created ON chat_visual_blocks(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cvb_type ON chat_visual_blocks(block_type, created_at DESC);

    -- Rich 照片对话支持 v0.1：聊天附件（图片）独立持久化。
    -- data 列存原始字节 BLOB（≤ 2MB inline）；url 列预留 V1 OSS。
    CREATE TABLE IF NOT EXISTS chat_attachments (
      id          TEXT PRIMARY KEY,
      message_id  TEXT NOT NULL DEFAULT '',
      kind        TEXT NOT NULL DEFAULT 'image',
      mime        TEXT NOT NULL,
      size_bytes  INTEGER NOT NULL,
      width       INTEGER,
      height      INTEGER,
      caption     TEXT,
      data        BLOB,
      url         TEXT,
      sha256      TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_attachments_message ON chat_attachments(message_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_chat_attachments_sha ON chat_attachments(sha256);
    CREATE INDEX IF NOT EXISTS idx_chat_attachments_created ON chat_attachments(created_at DESC);

    -- Rich 对话上下文：服务端持久化，不再只依赖浏览器缓存。
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id              TEXT PRIMARY KEY,
      title           TEXT NOT NULL,
      surface         TEXT NOT NULL DEFAULT 'chat',
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL,
      last_message_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_conversations_last ON chat_conversations(last_message_at DESC);

    CREATE TABLE IF NOT EXISTS deliverable_codex_conversations (
      id                TEXT PRIMARY KEY,
      conversation_id   TEXT NOT NULL UNIQUE,
      scope_key         TEXT NOT NULL,
      project_id        TEXT NOT NULL,
      deliverable_id    TEXT NOT NULL,
      title             TEXT NOT NULL,
      mode              TEXT NOT NULL,
      executor          TEXT NOT NULL DEFAULT 'codex',
      codex_thread_id   TEXT,
      status            TEXT NOT NULL DEFAULT 'active',
      context_version   TEXT,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL,
      last_active_at    TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_deliverable_codex_scope_active
      ON deliverable_codex_conversations(scope_key, status, last_active_at DESC);

    CREATE TABLE IF NOT EXISTS agent_conversation_configs (
      conversation_id    TEXT PRIMARY KEY,
      executor           TEXT NOT NULL DEFAULT 'hermes',
      permission_profile TEXT NOT NULL DEFAULT 'chat_only',
      workspace_root     TEXT,
      allowed_mcp_servers TEXT NOT NULL DEFAULT '[]',
      status             TEXT NOT NULL DEFAULT 'inactive',
      model_session_id   TEXT,
      created_at         TEXT NOT NULL,
      updated_at         TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agent_conversation_turns (
      id                 TEXT PRIMARY KEY,
      conversation_id    TEXT NOT NULL,
      client_request_id  TEXT NOT NULL,
      user_message_id    TEXT NOT NULL,
      sequence           INTEGER NOT NULL,
      status             TEXT NOT NULL DEFAULT 'queued',
      lease_owner        TEXT,
      lease_expires_at   TEXT,
      runtime_session_id TEXT,
      error              TEXT,
      created_at         TEXT NOT NULL,
      updated_at         TEXT NOT NULL,
      UNIQUE (conversation_id, client_request_id),
      UNIQUE (conversation_id, sequence),
      FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_conversation_turn_active
      ON agent_conversation_turns(conversation_id)
      WHERE status IN ('queued', 'running', 'waiting_approval');

    CREATE TABLE IF NOT EXISTS agent_tool_calls (
      id                TEXT PRIMARY KEY,
      turn_id           TEXT NOT NULL,
      runtime_call_id   TEXT NOT NULL,
      name              TEXT NOT NULL,
      arguments_json    TEXT NOT NULL,
      arguments_digest  TEXT NOT NULL,
      idempotency_key   TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'requested',
      result_json       TEXT,
      error             TEXT,
      approval_id       TEXT,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL,
      UNIQUE (turn_id, runtime_call_id),
      UNIQUE (turn_id, idempotency_key),
      FOREIGN KEY (turn_id) REFERENCES agent_conversation_turns(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_turn ON agent_tool_calls(turn_id, created_at);

    CREATE TABLE IF NOT EXISTS agent_approvals (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, turn_id TEXT NOT NULL,
      tool_call_id TEXT NOT NULL, arguments_digest TEXT NOT NULL, expires_at TEXT NOT NULL,
      consumed_at TEXT, decision TEXT, created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id               TEXT PRIMARY KEY,
      conversation_id  TEXT NOT NULL,
      role             TEXT NOT NULL,
      content          TEXT NOT NULL,
      adapter          TEXT,
      model_session_id TEXT,
      metadata         TEXT,
      created_at       TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);

    CREATE TABLE IF NOT EXISTS chat_conversation_summaries (
      conversation_id TEXT PRIMARY KEY,
      summary         TEXT NOT NULL,
      message_count   INTEGER NOT NULL DEFAULT 0,
      last_message_id TEXT,
      updated_at      TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
    );

    -- ─── Rich 私人健康档案 · Body Insights v0.1 ──────────────────────
    -- 单用户 MVP（user_id = 'me'）。Sqlite 用 TEXT 存 JSON（postgres 用 JSONB）。
    CREATE TABLE IF NOT EXISTS health_profile (
      user_id           TEXT PRIMARY KEY DEFAULT 'me',
      height_cm         INTEGER,
      sex               TEXT,
      dob               TEXT,
      goal              TEXT,
      activity_level    TEXT,
      target_weight_kg  REAL,
      health_notes      TEXT,
      allergies         TEXT,
      updated_at        TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS health_weight_log (
      id            TEXT PRIMARY KEY,
      logged_at     TEXT NOT NULL,
      kg            REAL NOT NULL,
      body_fat_pct  REAL,
      notes         TEXT,
      source        TEXT NOT NULL DEFAULT 'manual',
      created_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_health_weight_at ON health_weight_log(logged_at DESC);

    CREATE TABLE IF NOT EXISTS health_workout_log (
      id            TEXT PRIMARY KEY,
      session_name  TEXT,
      performed_at  TEXT NOT NULL,
      duration_min  INTEGER,
      total_volume  REAL,
      rpe_avg       REAL,
      notes         TEXT,
      source        TEXT NOT NULL DEFAULT 'manual',
      created_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_health_workout_at ON health_workout_log(performed_at DESC);

    CREATE TABLE IF NOT EXISTS health_workout_set (
      id            TEXT PRIMARY KEY,
      workout_id    TEXT NOT NULL,
      exercise      TEXT NOT NULL,
      reps          INTEGER,
      weight_kg     REAL,
      rpe           INTEGER,
      order_index   INTEGER NOT NULL DEFAULT 0,
      notes         TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_health_workout_set ON health_workout_set(workout_id, order_index);

    CREATE TABLE IF NOT EXISTS health_meal_log (
      id              TEXT PRIMARY KEY,
      consumed_at     TEXT NOT NULL,
      meal_type       TEXT,
      items           TEXT NOT NULL DEFAULT '[]',  -- JSON
      total_kcal      REAL,
      total_protein_g REAL,
      total_carb_g    REAL,
      total_fat_g     REAL,
      total_fiber_g   REAL,
      photo_url       TEXT,
      source          TEXT NOT NULL DEFAULT 'manual',
      notes           TEXT,
      created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_health_meal_at ON health_meal_log(consumed_at DESC);

    CREATE TABLE IF NOT EXISTS health_sleep_log (
      id            TEXT PRIMARY KEY,
      sleep_date    TEXT NOT NULL,
      duration_min  INTEGER,
      quality       INTEGER,
      bedtime       TEXT,
      wake_time     TEXT,
      notes         TEXT,
      source        TEXT NOT NULL DEFAULT 'manual',
      created_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_health_sleep_date ON health_sleep_log(sleep_date DESC);

    CREATE TABLE IF NOT EXISTS health_mood_log (
      id          TEXT PRIMARY KEY,
      logged_at   TEXT NOT NULL,
      energy      INTEGER,
      mood        INTEGER,
      fatigue     INTEGER,
      soreness    INTEGER,
      notes       TEXT,
      created_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_health_mood_at ON health_mood_log(logged_at DESC);

    CREATE TABLE IF NOT EXISTS health_raw_import (
      id            TEXT PRIMARY KEY,
      source        TEXT NOT NULL,
      kind          TEXT NOT NULL,
      record_at     TEXT,
      payload       TEXT NOT NULL,
      imported_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_health_raw_import_at ON health_raw_import(record_at DESC);
    CREATE INDEX IF NOT EXISTS idx_health_raw_import_source ON health_raw_import(source, kind);

    CREATE TABLE IF NOT EXISTS health_metric_sample (
      id                 TEXT PRIMARY KEY,
      raw_import_id      TEXT,
      source             TEXT NOT NULL,
      metric             TEXT NOT NULL,
      category           TEXT NOT NULL,
      aggregation_style  TEXT NOT NULL,
      apple_identifier   TEXT,
      recorded_at        TEXT NOT NULL,
      value              REAL NOT NULL,
      unit               TEXT,
      imported_at        TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_health_metric_sample_metric_at ON health_metric_sample(metric, recorded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_health_metric_sample_category_at ON health_metric_sample(category, recorded_at DESC);

    CREATE TABLE IF NOT EXISTS health_daily_activity_summary (
      summary_date                              TEXT NOT NULL,
      source                                    TEXT NOT NULL DEFAULT 'apple-health',
      steps_count                               REAL,
      walking_running_distance_km               REAL,
      flights_climbed                           REAL,
      walking_speed_avg_kmh                     REAL,
      walking_speed_samples                     INTEGER NOT NULL DEFAULT 0,
      walking_step_length_avg_cm                REAL,
      walking_step_length_samples               INTEGER NOT NULL DEFAULT 0,
      walking_double_support_avg_pct            REAL,
      walking_double_support_samples            INTEGER NOT NULL DEFAULT 0,
      walking_asymmetry_avg_pct                 REAL,
      walking_asymmetry_samples                 INTEGER NOT NULL DEFAULT 0,
      headphone_audio_exposure_avg_dbaspl       REAL,
      headphone_audio_exposure_max_dbaspl       REAL,
      headphone_audio_exposure_samples          INTEGER NOT NULL DEFAULT 0,
      updated_at                                TEXT NOT NULL,
      PRIMARY KEY (summary_date, source)
    );
    CREATE INDEX IF NOT EXISTS idx_health_daily_activity_date ON health_daily_activity_summary(summary_date DESC);

    CREATE TABLE IF NOT EXISTS health_weekly_plan (
      id              TEXT PRIMARY KEY,
      week_start      TEXT NOT NULL,
      goal_snapshot   TEXT,
      diet_plan       TEXT,
      training_plan   TEXT,
      notes           TEXT,
      generated_at    TEXT NOT NULL,
      generated_by    TEXT NOT NULL DEFAULT 'ai',
      status          TEXT NOT NULL DEFAULT 'active'
    );
    CREATE INDEX IF NOT EXISTS idx_health_plan_start ON health_weekly_plan(week_start DESC);

    CREATE TABLE IF NOT EXISTS health_weekly_report (
      id            TEXT PRIMARY KEY,
      week_start    TEXT NOT NULL,
      body          TEXT NOT NULL,
      metrics       TEXT,                          -- JSON
      generated_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_health_report_start ON health_weekly_report(week_start DESC);

    CREATE TABLE IF NOT EXISTS health_alert (
      id              TEXT PRIMARY KEY,
      kind            TEXT NOT NULL,
      severity        TEXT NOT NULL,
      message         TEXT NOT NULL,
      context         TEXT,                        -- JSON
      status          TEXT NOT NULL DEFAULT 'open',
      created_at      TEXT NOT NULL,
      acknowledged_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_health_alert_status ON health_alert(status, created_at DESC);
  `);
  db.exec(SQLITE_PROJECT_MANAGEMENT_SCHEMA);
  const businessScenarioColumns = db.prepare("PRAGMA table_info(pm_business_scenarios)").all() as Array<{ name: string }>;
  if (!businessScenarioColumns.some(column => column.name === "library_id")) {
    db.exec("ALTER TABLE pm_business_scenarios ADD COLUMN library_id TEXT REFERENCES pm_business_scenario_libraries(id) ON DELETE RESTRICT");
  }

  // Idempotent column additions for older DBs created before these fields existed.
  ensureColumn(db, "qa", "anchor", "TEXT");
  ensureColumn(db, "agent_approvals", "decision", "TEXT");
  ensureColumn(db, "improvement_tasks", "assigned_agent_id", "TEXT");
  ensureColumn(db, "improvement_tasks", "assigned_at", "TEXT");
  ensureColumn(db, "improvement_tasks", "prd_content", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "improvement_tasks", "tasks_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, "elements", "status", "TEXT");
  ensureColumn(db, "pm_data_tables", "table_group", "TEXT");
  ensureColumn(db, "pm_data_tables", "data_layer", "TEXT");
  ensureColumn(db, "pm_data_tables", "table_type", "TEXT");
  ensureColumn(db, "pm_data_tables", "source_kind", "TEXT");
  ensureColumn(db, "pm_data_tables", "file_type", "TEXT");
  ensureColumn(db, "pm_data_tables", "has_mapping", "INTEGER");
  ensureColumn(db, "pm_data_tables", "verification_status", "TEXT NOT NULL DEFAULT '未验证'");
  ensureColumn(db, "pm_data_tables", "verification_remark", "TEXT");
  ensureColumn(db, "pm_data_fields", "verification_status", "TEXT NOT NULL DEFAULT '未验证'");
  ensureColumn(db, "pm_data_fields", "verification_remark", "TEXT");
  ensureColumn(db, "pm_mapping_rules", "verification_status", "TEXT NOT NULL DEFAULT '未验证'");
  ensureColumn(db, "pm_mapping_rules", "verification_remark", "TEXT");
  db.exec(`
    UPDATE pm_data_tables
       SET has_mapping = CASE
         WHEN lower(coalesce(source_kind, '')) LIKE '%文件%'
           OR lower(coalesce(source_kind, '')) LIKE '%file%'
           OR lower(coalesce(source_kind, '')) LIKE '%码表%'
           OR lower(coalesce(source_kind, '')) LIKE '%code table%'
           OR lower(coalesce(file_type, '')) NOT IN ('', '-', 'database')
           OR lower(coalesce(table_group, '')) LIKE '%码表%'
           OR lower(coalesce(table_group, '')) LIKE '%code table%'
         THEN 0 ELSE 1 END
     WHERE has_mapping IS NULL
  `);
  db.exec(`
    UPDATE pm_data_tables
       SET file_type = CASE
         WHEN lower(coalesce(file_type, '')) IN ('txt', 'text') OR lower(table_name) LIKE '%.txt' THEN 'txt'
         WHEN lower(coalesce(file_type, '')) = 'xml' OR lower(table_name) LIKE '%.xml' THEN 'xml'
         WHEN lower(coalesce(file_type, '')) = 'csv' OR lower(table_name) LIKE '%.csv' THEN 'csv'
         WHEN lower(coalesce(file_type, '')) IN ('excel', 'xls', 'xlsx') OR lower(table_name) LIKE '%.xls' OR lower(table_name) LIKE '%.xlsx' THEN 'excel'
         ELSE NULL END,
           source_kind = CASE
             WHEN lower(coalesce(source_kind, '')) LIKE '%文件%'
               OR lower(coalesce(source_kind, '')) LIKE '%file%'
               OR lower(coalesce(file_type, '')) IN ('txt', 'text', 'xml', 'csv', 'excel', 'xls', 'xlsx')
               OR lower(table_name) LIKE '%.txt' OR lower(table_name) LIKE '%.xml' OR lower(table_name) LIKE '%.csv'
               OR lower(table_name) LIKE '%.xls' OR lower(table_name) LIKE '%.xlsx'
             THEN '文件' ELSE '数据库' END
  `);
  ensureColumn(db, "pm_data_tables", "usage_status", "TEXT");
  ensureColumn(db, "pm_data_fields", "format_pattern", "TEXT");
  ensureColumn(db, "pm_data_fields", "carrier_kind", "TEXT");
  ensureColumn(db, "pm_data_fields", "field_order", "INTEGER");
  ensureColumn(db, "pm_data_fields", "source_field_order", "INTEGER");
  ensureColumn(db, "pm_data_tables", "external_sql", "TEXT");
  ensureColumn(db, "pm_mapping_scenarios", "caliber_external_sql", "TEXT");
  ensureColumn(db, "pm_mapping_scenarios", "external_sql", "TEXT");
  ensureColumn(db, "pm_mapping_rules", "external_sql", "TEXT");
  ensureColumn(db, "pm_mapping_temp_tables", "external_sql", "TEXT");
  ensureColumn(db, "pm_mapping_temp_tables", "scenario_id", "TEXT");
  ensureColumn(db, "pm_mapping_temp_fields", "external_sql", "TEXT");
  db.exec(`
    UPDATE pm_data_tables SET external_sql=json_extract(extra, '$.externalSql')
      WHERE nullif(trim(external_sql), '') IS NULL AND nullif(trim(json_extract(extra, '$.externalSql')), '') IS NOT NULL;
    UPDATE pm_mapping_scenarios SET external_sql=json_extract(raw, '$.externalSql'), caliber_external_sql=json_extract(raw, '$.caliberExternalSql')
      WHERE (nullif(trim(external_sql), '') IS NULL AND nullif(trim(json_extract(raw, '$.externalSql')), '') IS NOT NULL)
         OR (nullif(trim(caliber_external_sql), '') IS NULL AND nullif(trim(json_extract(raw, '$.caliberExternalSql')), '') IS NOT NULL);
    UPDATE pm_mapping_rules SET external_sql=json_extract(raw, '$.externalSql')
      WHERE nullif(trim(external_sql), '') IS NULL AND nullif(trim(json_extract(raw, '$.externalSql')), '') IS NOT NULL;
    UPDATE pm_mapping_temp_tables SET external_sql=json_extract(raw, '$.externalSql')
      WHERE nullif(trim(external_sql), '') IS NULL AND nullif(trim(json_extract(raw, '$.externalSql')), '') IS NOT NULL;
    UPDATE pm_mapping_temp_fields SET external_sql=json_extract(raw, '$.externalSql')
      WHERE nullif(trim(external_sql), '') IS NULL AND nullif(trim(json_extract(raw, '$.externalSql')), '') IS NOT NULL;
  `);
  ensureColumn(db, "pm_automation_runs", "runtime_params", "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(db, "pm_test_run_steps", "instruction", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "pm_test_run_steps", "expected_result", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "pm_test_cases", "scenario", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "pm_test_tasks", "sort_order", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "pm_test_tasks", "test_data", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "pm_test_tasks", "test_links", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "pm_test_tasks", "app_version", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "pm_test_cases", "group_id", "TEXT");
  ensureColumn(db, "pm_test_cases", "sort_order", "INTEGER NOT NULL DEFAULT 0");
  db.exec(`
    CREATE TABLE IF NOT EXISTS pm_test_groups (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, task_id TEXT NOT NULL REFERENCES pm_test_tasks(id) ON DELETE CASCADE, parent_group_id TEXT REFERENCES pm_test_groups(id) ON DELETE SET NULL, title TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pm_test_groups_tree ON pm_test_groups(project_id, task_id, parent_group_id, sort_order);
    UPDATE pm_test_tasks SET sort_order=rowid WHERE sort_order=0;
    UPDATE pm_test_cases SET sort_order=rowid WHERE sort_order=0;
  `);
}

function ensureColumn(db: Database.Database, table: string, column: string, type: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (rows.some(r => r.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}
