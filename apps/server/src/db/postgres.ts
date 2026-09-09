import { Pool } from "pg";
import { WORKBENCH_SCHEMA } from "../task-workbench/repository.js";
import { POSTGRES_PROJECT_MANAGEMENT_SCHEMA } from "./projectManagementSchema.js";

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
  await pool.query(WORKBENCH_SCHEMA);
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
      status TEXT,                  -- 项目实战：仅 step 类型用，todo/doing/done
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      generated_by TEXT NOT NULL,
      ai_model TEXT,
      ai_session_id TEXT,
      richness INTEGER NOT NULL
    );
    -- 对老库幂等加列
    ALTER TABLE elements ADD COLUMN IF NOT EXISTS status TEXT;
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

    CREATE TABLE IF NOT EXISTS improvement_tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT '',
      prd_content TEXT NOT NULL DEFAULT '',
      tasks_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT,
      category TEXT,
      created_by TEXT NOT NULL DEFAULT 'hermes',
      related_files TEXT,
      verifications_json TEXT NOT NULL DEFAULT '[]',
      requested_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      -- Agent claim：哪个 agent 抢到了这条任务，null = 未认领
      assigned_agent_id TEXT,
      assigned_at TEXT
    );
    -- 对老库幂等加列（CREATE TABLE 已建表时不会触发，新增字段必须 ALTER）
    ALTER TABLE improvement_tasks ADD COLUMN IF NOT EXISTS assigned_agent_id TEXT;
    ALTER TABLE improvement_tasks ADD COLUMN IF NOT EXISTS assigned_at TEXT;
    ALTER TABLE improvement_tasks ADD COLUMN IF NOT EXISTS prd_content TEXT NOT NULL DEFAULT '';
    ALTER TABLE improvement_tasks ADD COLUMN IF NOT EXISTS tasks_json TEXT NOT NULL DEFAULT '[]';
    CREATE INDEX IF NOT EXISTS idx_improvement_tasks_status ON improvement_tasks(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_improvement_tasks_assigned ON improvement_tasks(assigned_agent_id);

    CREATE TABLE IF NOT EXISTS center_history (
      id BIGSERIAL PRIMARY KEY,
      ts TEXT NOT NULL,
      from_id TEXT,
      to_id TEXT NOT NULL,
      dwell_ms BIGINT
    );
    ALTER TABLE center_history ALTER COLUMN dwell_ms TYPE BIGINT;
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

    CREATE TABLE IF NOT EXISTS mcp_operation_log (
      tool_name TEXT NOT NULL,
      request_id TEXT NOT NULL,
      input_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      response_json TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      PRIMARY KEY (tool_name, request_id)
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_operation_status ON mcp_operation_log(status, created_at DESC);

    CREATE TABLE IF NOT EXISTS mcp_tasks (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      request_json TEXT NOT NULL,
      status TEXT NOT NULL,
      backend TEXT,
      external_task_id TEXT,
      progress_summary TEXT,
      result_refs_json TEXT NOT NULL DEFAULT '[]',
      error TEXT,
      conversation_id TEXT,
      request_id TEXT,
      review_status TEXT,
      review_notes TEXT,
      created_at TEXT NOT NULL,
      started_at TEXT,
      updated_at TEXT NOT NULL,
      finished_at TEXT,
      last_synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_tasks_status ON mcp_tasks(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mcp_tasks_external ON mcp_tasks(backend, external_task_id);

    CREATE TABLE IF NOT EXISTS multica_project_bindings (
      rich_project_id TEXT PRIMARY KEY,
      binding_json JSONB NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS multica_team_plans (
      id TEXT PRIMARY KEY,
      rich_project_id TEXT NOT NULL,
      request_json JSONB NOT NULL,
      plan_json JSONB NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      applied_at TEXT,
      resolved_binding_json JSONB
    );
    CREATE INDEX IF NOT EXISTS idx_multica_team_plans_project ON multica_team_plans(rich_project_id, created_at DESC);

    -- Rich 首页动画展示系统 v0.1：visual 块独立持久化
    CREATE TABLE IF NOT EXISTS chat_visual_blocks (
      id                TEXT PRIMARY KEY,
      message_id        TEXT NOT NULL DEFAULT '',
      block_type        TEXT NOT NULL,
      payload           JSONB NOT NULL,
      order_in_message  INTEGER NOT NULL DEFAULT 0,
      created_at        TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cvb_message ON chat_visual_blocks(message_id, order_in_message);
    CREATE INDEX IF NOT EXISTS idx_cvb_created ON chat_visual_blocks(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cvb_type ON chat_visual_blocks(block_type, created_at DESC);

    -- Rich 照片对话支持 v0.1：聊天附件（图片）独立持久化。
    -- data 列存原始字节（≤ 2MB inline）；url 列预留 V1 OSS 切换。
    -- sha256 做去重 + 同图复用。message_id 关联 chat_history 消息。
    CREATE TABLE IF NOT EXISTS chat_attachments (
      id          TEXT PRIMARY KEY,
      message_id  TEXT NOT NULL DEFAULT '',
      kind        TEXT NOT NULL DEFAULT 'image',  -- image / future: audio / pdf
      mime        TEXT NOT NULL,
      size_bytes  INTEGER NOT NULL,
      width       INTEGER,
      height      INTEGER,
      caption     TEXT,                            -- 异步填充（V0.1 可空）
      data        BYTEA,                           -- MVP 内嵌；V1 切对象存储
      url         TEXT,                            -- V1 用：外部对象存储 URL
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
      conversation_id   TEXT NOT NULL UNIQUE REFERENCES chat_conversations(id) ON DELETE CASCADE,
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
      last_active_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_deliverable_codex_scope_active
      ON deliverable_codex_conversations(scope_key, status, last_active_at DESC);

    CREATE TABLE IF NOT EXISTS agent_conversation_configs (
      conversation_id     TEXT PRIMARY KEY REFERENCES chat_conversations(id) ON DELETE CASCADE,
      executor            TEXT NOT NULL DEFAULT 'hermes',
      permission_profile  TEXT NOT NULL DEFAULT 'chat_only',
      workspace_root      TEXT,
      allowed_mcp_servers JSONB NOT NULL DEFAULT '[]'::jsonb,
      status              TEXT NOT NULL DEFAULT 'inactive',
      model_session_id    TEXT,
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_conversation_turns (
      id                 TEXT PRIMARY KEY,
      conversation_id    TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
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
      UNIQUE (conversation_id, sequence)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_conversation_turn_active
      ON agent_conversation_turns(conversation_id)
      WHERE status IN ('queued', 'running', 'waiting_approval');

    CREATE TABLE IF NOT EXISTS agent_tool_calls (
      id                TEXT PRIMARY KEY,
      turn_id           TEXT NOT NULL REFERENCES agent_conversation_turns(id) ON DELETE CASCADE,
      runtime_call_id   TEXT NOT NULL,
      name              TEXT NOT NULL,
      arguments_json    JSONB NOT NULL,
      arguments_digest  TEXT NOT NULL,
      idempotency_key   TEXT NOT NULL,
      status            TEXT NOT NULL DEFAULT 'requested',
      result_json       JSONB,
      error             TEXT,
      approval_id       TEXT,
      created_at        TEXT NOT NULL,
      updated_at        TEXT NOT NULL,
      UNIQUE (turn_id, runtime_call_id),
      UNIQUE (turn_id, idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS idx_agent_tool_calls_turn ON agent_tool_calls(turn_id, created_at);

    CREATE TABLE IF NOT EXISTS agent_approvals (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, turn_id TEXT NOT NULL,
      tool_call_id TEXT NOT NULL, arguments_digest TEXT NOT NULL, expires_at TEXT NOT NULL,
      consumed_at TEXT, decision TEXT, created_at TEXT NOT NULL
    );
    ALTER TABLE agent_approvals ADD COLUMN IF NOT EXISTS decision TEXT;

    CREATE TABLE IF NOT EXISTS chat_messages (
      id               TEXT PRIMARY KEY,
      conversation_id  TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
      role             TEXT NOT NULL,
      content          TEXT NOT NULL,
      adapter          TEXT,
      model_session_id TEXT,
      metadata         JSONB,
      created_at       TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);

    CREATE TABLE IF NOT EXISTS chat_conversation_summaries (
      conversation_id TEXT PRIMARY KEY REFERENCES chat_conversations(id) ON DELETE CASCADE,
      summary         TEXT NOT NULL,
      message_count   INTEGER NOT NULL DEFAULT 0,
      last_message_id TEXT,
      updated_at      TEXT NOT NULL
    );

    -- ─── Rich 私人健康档案 · Body Insights v0.1 ──────────────────────
    -- 单用户 MVP（user_id = 'me'）。9 张表：profile / weight / workout / set /
    -- meal / sleep / mood / weekly_plan / weekly_report / health_alert。
    -- 所有 timestamp 用 ISO 8601 文本（Rich 全局约定）。

    CREATE TABLE IF NOT EXISTS health_profile (
      user_id         TEXT PRIMARY KEY DEFAULT 'me',
      height_cm       INTEGER,
      sex             TEXT,                       -- 'male' | 'female' | 'other'
      dob             TEXT,                       -- ISO date
      goal            TEXT,                       -- 'cut' | 'maintain' | 'bulk'
      activity_level  TEXT,                       -- 'sedentary'..'very-active'
      target_weight_kg REAL,
      health_notes    TEXT,
      allergies       TEXT,
      updated_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS health_weight_log (
      id            TEXT PRIMARY KEY,
      logged_at     TEXT NOT NULL,                -- ISO datetime
      kg            REAL NOT NULL,
      body_fat_pct  REAL,
      notes         TEXT,
      source        TEXT NOT NULL DEFAULT 'manual', -- manual | apple-health | smart-scale | ai-photo
      created_at    TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_health_weight_at ON health_weight_log(logged_at DESC);

    CREATE TABLE IF NOT EXISTS health_workout_log (
      id            TEXT PRIMARY KEY,
      session_name  TEXT,
      performed_at  TEXT NOT NULL,
      duration_min  INTEGER,
      total_volume  REAL,                          -- sum of weight×reps
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
      rpe           INTEGER,                       -- 1-10
      order_index   INTEGER NOT NULL DEFAULT 0,
      notes         TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_health_workout_set ON health_workout_set(workout_id, order_index);

    CREATE TABLE IF NOT EXISTS health_meal_log (
      id              TEXT PRIMARY KEY,
      consumed_at     TEXT NOT NULL,
      meal_type       TEXT,                        -- breakfast | lunch | dinner | snack
      items           JSONB NOT NULL DEFAULT '[]', -- [{name, grams?, kcal, protein_g, ...}]
      total_kcal      REAL,
      total_protein_g REAL,
      total_carb_g    REAL,
      total_fat_g     REAL,
      total_fiber_g   REAL,
      photo_url       TEXT,
      source          TEXT NOT NULL DEFAULT 'manual', -- manual | ai-text | ai-photo
      notes           TEXT,
      created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_health_meal_at ON health_meal_log(consumed_at DESC);

    CREATE TABLE IF NOT EXISTS health_sleep_log (
      id            TEXT PRIMARY KEY,
      sleep_date    TEXT NOT NULL,                 -- 该夜的日期（入睡当天）
      duration_min  INTEGER,
      quality       INTEGER,                       -- 1-10
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
      energy      INTEGER,                         -- 1-10
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
      payload       JSONB NOT NULL,
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
      aggregation_style  TEXT NOT NULL,            -- cumulative | discrete
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
      week_start      TEXT NOT NULL,               -- ISO date 周一
      goal_snapshot   TEXT,
      diet_plan       TEXT,                        -- markdown
      training_plan   TEXT,                        -- markdown
      notes           TEXT,
      generated_at    TEXT NOT NULL,
      generated_by    TEXT NOT NULL DEFAULT 'ai',  -- ai | user
      status          TEXT NOT NULL DEFAULT 'active' -- draft | active | archived
    );
    CREATE INDEX IF NOT EXISTS idx_health_plan_start ON health_weekly_plan(week_start DESC);

    CREATE TABLE IF NOT EXISTS health_weekly_report (
      id            TEXT PRIMARY KEY,
      week_start    TEXT NOT NULL,
      body          TEXT NOT NULL,                 -- markdown 周报正文
      metrics       JSONB,                         -- {weight_avg, weight_trend, kcal_avg, ...}
      generated_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_health_report_start ON health_weekly_report(week_start DESC);

    CREATE TABLE IF NOT EXISTS health_alert (
      id              TEXT PRIMARY KEY,
      kind            TEXT NOT NULL,               -- weight-spike | low-protein | overtrain | ...
      severity        TEXT NOT NULL,               -- low | medium | high
      message         TEXT NOT NULL,
      context         JSONB,                       -- 触发时的相关数据
      status          TEXT NOT NULL DEFAULT 'open', -- open | acknowledged | dismissed
      created_at      TEXT NOT NULL,
      acknowledged_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_health_alert_status ON health_alert(status, created_at DESC);
  `);
  await pool.query(POSTGRES_PROJECT_MANAGEMENT_SCHEMA);
}
