export const POSTGRES_PROJECT_MANAGEMENT_SCHEMA = `
  CREATE EXTENSION IF NOT EXISTS pg_trgm;

  CREATE TABLE IF NOT EXISTS pm_data_systems (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    code TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    type TEXT,
    asset_layer TEXT,
    owner TEXT,
    description TEXT,
    extra JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_systems_project ON pm_data_systems(project_id, name);
  CREATE INDEX IF NOT EXISTS idx_pm_systems_code_trgm ON pm_data_systems USING GIN (code gin_trgm_ops);

  CREATE TABLE IF NOT EXISTS pm_data_tables (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    system_id TEXT REFERENCES pm_data_systems(id) ON DELETE SET NULL,
    database_name TEXT,
    schema_name TEXT,
    table_name TEXT NOT NULL,
    table_cn TEXT,
    table_group TEXT,
    data_layer TEXT,
    table_type TEXT,
    source_kind TEXT,
    file_type TEXT,
    has_mapping BOOLEAN NOT NULL DEFAULT true,
    usage_status TEXT,
    verification_status TEXT NOT NULL DEFAULT '未验证',
    verification_remark TEXT,
    external_sql TEXT,
    description TEXT,
    caliber TEXT,
    extra JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_tables_project_system ON pm_data_tables(project_id, system_id);
  CREATE INDEX IF NOT EXISTS idx_pm_tables_name_trgm ON pm_data_tables USING GIN (table_name gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_pm_tables_cn_trgm ON pm_data_tables USING GIN (table_cn gin_trgm_ops);
  ALTER TABLE pm_data_tables ADD COLUMN IF NOT EXISTS table_group TEXT;
  ALTER TABLE pm_data_tables ADD COLUMN IF NOT EXISTS data_layer TEXT;
  ALTER TABLE pm_data_tables ADD COLUMN IF NOT EXISTS table_type TEXT;
  ALTER TABLE pm_data_tables ADD COLUMN IF NOT EXISTS source_kind TEXT;
  ALTER TABLE pm_data_tables ADD COLUMN IF NOT EXISTS file_type TEXT;
  ALTER TABLE pm_data_tables ADD COLUMN IF NOT EXISTS has_mapping BOOLEAN;
  UPDATE pm_data_tables
     SET has_mapping = CASE
       WHEN lower(coalesce(source_kind, '')) ~ '(文件|file|码表|code[[:space:]]*table)'
         OR lower(coalesce(file_type, '')) NOT IN ('', '-', 'database')
         OR lower(coalesce(table_group, '')) ~ '(码表|code[[:space:]]*table)'
       THEN false ELSE true END
   WHERE has_mapping IS NULL;
  ALTER TABLE pm_data_tables ALTER COLUMN has_mapping SET DEFAULT true;
  ALTER TABLE pm_data_tables ALTER COLUMN has_mapping SET NOT NULL;
  WITH normalized AS (
    SELECT id,
      CASE
        WHEN lower(coalesce(file_type, '')) IN ('txt', 'text') OR lower(table_name) ~ '\\.txt$' THEN 'txt'
        WHEN lower(coalesce(file_type, '')) = 'xml' OR lower(table_name) ~ '\\.xml$' THEN 'xml'
        WHEN lower(coalesce(file_type, '')) = 'csv' OR lower(table_name) ~ '\\.csv$' THEN 'csv'
        WHEN lower(coalesce(file_type, '')) IN ('excel', 'xls', 'xlsx') OR lower(table_name) ~ '\\.(xls|xlsx)$' THEN 'excel'
        ELSE NULL END AS normalized_file_type,
      CASE
        WHEN lower(coalesce(source_kind, '')) ~ '(文件|file)'
          OR lower(coalesce(file_type, '')) IN ('txt', 'text', 'xml', 'csv', 'excel', 'xls', 'xlsx')
          OR lower(table_name) ~ '\\.(txt|xml|csv|xls|xlsx)$'
        THEN '文件' ELSE '数据库' END AS normalized_source_kind
    FROM pm_data_tables
  )
  UPDATE pm_data_tables AS target
     SET source_kind = normalized.normalized_source_kind,
         file_type = normalized.normalized_file_type
    FROM normalized
   WHERE target.id = normalized.id
     AND (target.source_kind IS DISTINCT FROM normalized.normalized_source_kind
       OR target.file_type IS DISTINCT FROM normalized.normalized_file_type);
  UPDATE pm_data_tables
     SET table_type = CASE
       WHEN coalesce(table_group, '') ~ '(码表|码值)' OR coalesce(table_cn, '') ~ '(码表|码值)' OR lower(table_name) ~ '(code|codemap|usetype)' THEN '码值表'
       WHEN coalesce(data_layer, '') ~ '报文' AND (coalesce(source_kind, '') ~ '(文件|file)' OR coalesce(file_type, '') <> '') THEN '报文文件'
       WHEN coalesce(data_layer, '') ~ '报文' THEN '报文表'
       WHEN coalesce(data_layer, '') ~ '配置' OR coalesce(table_cn, '') ~ '配置' OR lower(table_name) ~ '(config|setting|parameter)' THEN '配置表'
       WHEN coalesce(data_layer, '') ~ '系统' THEN '系统表'
       WHEN coalesce(data_layer, '') ~ '贴源' THEN '贴源表'
       WHEN coalesce(data_layer, '') ~ '中间' THEN '中间表'
       WHEN coalesce(data_layer, '') ~ '前置' THEN '前置表'
       WHEN coalesce(data_layer, '') ~ '报表' THEN '报表表'
       WHEN coalesce(data_layer, '') ~ '源' OR coalesce(source_kind, '') ~ '(文件|file)' OR coalesce(file_type, '') <> '' THEN '源文件'
       ELSE NULL
     END
   WHERE coalesce(trim(table_type), '') = '';
  ALTER TABLE pm_data_tables ADD COLUMN IF NOT EXISTS usage_status TEXT;
  ALTER TABLE pm_data_tables ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT '未验证';
  ALTER TABLE pm_data_tables ADD COLUMN IF NOT EXISTS verification_remark TEXT;
  ALTER TABLE pm_data_tables ADD COLUMN IF NOT EXISTS external_sql TEXT;

  CREATE TABLE IF NOT EXISTS pm_data_fields (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    system_id TEXT REFERENCES pm_data_systems(id) ON DELETE SET NULL,
    table_id TEXT REFERENCES pm_data_tables(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    field_cn TEXT,
    field_type TEXT,
    field_length TEXT,
    format_pattern TEXT,
    carrier_kind TEXT,
    field_order INTEGER,
    source_field_order INTEGER,
    nullable TEXT,
    primary_key BOOLEAN NOT NULL DEFAULT false,
    required BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    acquire_logic TEXT,
    validation_rule TEXT,
    code_value TEXT,
    mapped_table TEXT,
    mapped_field TEXT,
    mapped_field_cn TEXT,
    data_source TEXT,
    remark TEXT,
    verification_status TEXT NOT NULL DEFAULT '未验证',
    verification_remark TEXT,
    extra JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_fields_project_system ON pm_data_fields(project_id, system_id);
  CREATE INDEX IF NOT EXISTS idx_pm_fields_project_table ON pm_data_fields(project_id, table_id);
  CREATE INDEX IF NOT EXISTS idx_pm_fields_name_trgm ON pm_data_fields USING GIN (field_name gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_pm_fields_cn_trgm ON pm_data_fields USING GIN (field_cn gin_trgm_ops);
  ALTER TABLE pm_data_fields ADD COLUMN IF NOT EXISTS format_pattern TEXT;
  ALTER TABLE pm_data_fields ADD COLUMN IF NOT EXISTS carrier_kind TEXT;
  ALTER TABLE pm_data_fields ADD COLUMN IF NOT EXISTS field_order INTEGER;
  ALTER TABLE pm_data_fields ADD COLUMN IF NOT EXISTS source_field_order INTEGER;
  ALTER TABLE pm_data_fields ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT '未验证';
  ALTER TABLE pm_data_fields ADD COLUMN IF NOT EXISTS verification_remark TEXT;

  CREATE TABLE IF NOT EXISTS pm_code_sets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_code_sets_project ON pm_code_sets(project_id, name);

  CREATE TABLE IF NOT EXISTS pm_code_items (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    code_set_id TEXT REFERENCES pm_code_sets(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    label TEXT,
    remark TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_code_items_set ON pm_code_items(project_id, code_set_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_pm_code_items_code_trgm ON pm_code_items USING GIN (code gin_trgm_ops);

  CREATE TABLE IF NOT EXISTS pm_field_code_sets (
    project_id TEXT NOT NULL,
    field_id TEXT REFERENCES pm_data_fields(id) ON DELETE CASCADE,
    code_set_id TEXT REFERENCES pm_code_sets(id) ON DELETE CASCADE,
    relation_kind TEXT NOT NULL DEFAULT 'uses_code_set',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(project_id, field_id, code_set_id)
  );
  CREATE INDEX IF NOT EXISTS idx_pm_field_code_sets_field ON pm_field_code_sets(project_id, field_id);
  CREATE INDEX IF NOT EXISTS idx_pm_field_code_sets_set ON pm_field_code_sets(project_id, code_set_id);

  CREATE TABLE IF NOT EXISTS pm_dictionary_template_versions (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    title TEXT NOT NULL,
    change_summary TEXT,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    effective_at TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_dictionary_template_version_scope
    ON pm_dictionary_template_versions(COALESCE(project_id, ''), version);
  CREATE INDEX IF NOT EXISTS idx_pm_dictionary_template_status
    ON pm_dictionary_template_versions(project_id, status, updated_at DESC);

  CREATE TABLE IF NOT EXISTS pm_dictionary_template_rules (
    id TEXT PRIMARY KEY,
    version_id TEXT NOT NULL REFERENCES pm_dictionary_template_versions(id) ON DELETE CASCADE,
    meta_type TEXT NOT NULL,
    property_key TEXT NOT NULL,
    property_label TEXT NOT NULL,
    required BOOLEAN NOT NULL DEFAULT false,
    value_type TEXT NOT NULL DEFAULT 'text',
    allowed_values JSONB NOT NULL DEFAULT '[]'::jsonb,
    validation JSONB NOT NULL DEFAULT '{}'::jsonb,
    fill_instruction TEXT NOT NULL DEFAULT '',
    prohibited_instruction TEXT,
    example_value TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_dictionary_template_rule_key
    ON pm_dictionary_template_rules(version_id, meta_type, property_key);
  CREATE INDEX IF NOT EXISTS idx_pm_dictionary_template_rule_type
    ON pm_dictionary_template_rules(version_id, meta_type, sort_order);

  CREATE TABLE IF NOT EXISTS pm_dictionary_template_changes (
    id TEXT PRIMARY KEY,
    version_id TEXT REFERENCES pm_dictionary_template_versions(id) ON DELETE SET NULL,
    change_type TEXT NOT NULL,
    title TEXT NOT NULL,
    reason TEXT NOT NULL,
    impact_scope JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft',
    proposed_by TEXT,
    approved_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_dictionary_template_changes_version
    ON pm_dictionary_template_changes(version_id, status, updated_at DESC);

  CREATE TABLE IF NOT EXISTS pm_dictionary_rectifications (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    property_key TEXT NOT NULL,
    requirement TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    resolution_note TEXT,
    created_by TEXT,
    resolved_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    resolved_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_pm_dictionary_rectifications_target
    ON pm_dictionary_rectifications(project_id, entity_type, entity_id, property_key, status);
  CREATE INDEX IF NOT EXISTS idx_pm_dictionary_rectifications_status
    ON pm_dictionary_rectifications(project_id, status, updated_at DESC);

  CREATE TABLE IF NOT EXISTS pm_mapping_scenarios (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    table_id TEXT NOT NULL REFERENCES pm_data_tables(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    caliber TEXT,
    caliber_external_sql TEXT,
    external_sql TEXT,
    remark TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(project_id, table_id, title)
  );
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_scenarios_table ON pm_mapping_scenarios(project_id, table_id, sort_order);
  CREATE TABLE IF NOT EXISTS pm_business_scenarios (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, system_id TEXT REFERENCES pm_data_systems(id) ON DELETE CASCADE,
    title TEXT NOT NULL, procedure_name TEXT NOT NULL, external_location TEXT, sql_text TEXT NOT NULL, remark TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
    validation_status TEXT NOT NULL DEFAULT 'pending', validation_sql_fingerprint TEXT, validation_message TEXT, validated_at TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pm_business_scenario_libraries (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, db_type TEXT, sql_dialect TEXT,
    connection JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(project_id, name)
  );
  ALTER TABLE pm_business_scenarios ADD COLUMN IF NOT EXISTS library_id TEXT REFERENCES pm_business_scenario_libraries(id) ON DELETE RESTRICT;
  ALTER TABLE pm_business_scenarios ALTER COLUMN system_id DROP NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_pm_business_scenario_libraries_project ON pm_business_scenario_libraries(project_id, name);
  CREATE INDEX IF NOT EXISTS idx_pm_business_scenarios_system ON pm_business_scenarios(project_id, system_id, sort_order);
  CREATE TABLE IF NOT EXISTS pm_business_scenario_tables (
    project_id TEXT NOT NULL, scenario_id TEXT NOT NULL REFERENCES pm_business_scenarios(id) ON DELETE CASCADE,
    table_id TEXT NOT NULL REFERENCES pm_data_tables(id) ON DELETE CASCADE, sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (scenario_id, table_id)
  );
  ALTER TABLE pm_mapping_scenarios ADD COLUMN IF NOT EXISTS external_sql TEXT;
  ALTER TABLE pm_mapping_scenarios ADD COLUMN IF NOT EXISTS caliber_external_sql TEXT;

  CREATE TABLE IF NOT EXISTS pm_mapping_rules (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    scenario_id TEXT,
    system_id TEXT REFERENCES pm_data_systems(id) ON DELETE SET NULL,
    table_id TEXT REFERENCES pm_data_tables(id) ON DELETE CASCADE,
    field_id TEXT REFERENCES pm_data_fields(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'draft',
    logic_text TEXT,
    converted_sql TEXT,
    external_sql TEXT,
    remark TEXT,
    verification_status TEXT NOT NULL DEFAULT '未验证',
    verification_remark TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_rules_project_table ON pm_mapping_rules(project_id, table_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_rules_project_field ON pm_mapping_rules(project_id, field_id);
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_rules_status ON pm_mapping_rules(project_id, status);
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_rules_logic_trgm ON pm_mapping_rules USING GIN (logic_text gin_trgm_ops);
  ALTER TABLE pm_mapping_rules
    ALTER COLUMN raw TYPE JSONB USING CASE
      WHEN raw IS NULL OR btrim(raw::text) = '' THEN '{}'::jsonb
      ELSE raw::jsonb
    END,
    ALTER COLUMN raw SET DEFAULT '{}'::jsonb;
  ALTER TABLE pm_mapping_rules ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT '未验证';
  ALTER TABLE pm_mapping_rules ADD COLUMN IF NOT EXISTS verification_remark TEXT;
  ALTER TABLE pm_mapping_rules ADD COLUMN IF NOT EXISTS external_sql TEXT;

  -- 将早期写入 raw 的参考 SQL 迁移到专用列；专用列已有值时绝不覆盖。
  UPDATE pm_data_tables SET external_sql = extra->>'externalSql'
   WHERE NULLIF(btrim(external_sql), '') IS NULL AND NULLIF(btrim(extra->>'externalSql'), '') IS NOT NULL;
  UPDATE pm_mapping_scenarios SET external_sql = raw->>'externalSql', caliber_external_sql = raw->>'caliberExternalSql'
   WHERE (NULLIF(btrim(external_sql), '') IS NULL AND NULLIF(btrim(raw->>'externalSql'), '') IS NOT NULL)
      OR (NULLIF(btrim(caliber_external_sql), '') IS NULL AND NULLIF(btrim(raw->>'caliberExternalSql'), '') IS NOT NULL);
  UPDATE pm_mapping_rules SET external_sql = raw->>'externalSql'
   WHERE NULLIF(btrim(external_sql), '') IS NULL AND NULLIF(btrim(raw->>'externalSql'), '') IS NOT NULL;

  INSERT INTO pm_mapping_scenarios (id, project_id, table_id, title, caliber, sort_order, raw, created_at, updated_at)
  SELECT 'pm-map-scenario-' || md5(project_id || ':' || table_id || ':' || jsonb_extract_path_text(raw::jsonb, 'scenario')),
         project_id, table_id, jsonb_extract_path_text(raw::jsonb, 'scenario'), min(nullif(jsonb_extract_path_text(raw::jsonb, 'condition'), '')), min(sort_order),
         jsonb_build_object('migratedFrom', 'pm_mapping_rules'), min(created_at), max(updated_at)
    FROM pm_mapping_rules
   WHERE table_id IS NOT NULL AND coalesce(jsonb_extract_path_text(raw::jsonb, 'scenario'), '') <> ''
   GROUP BY project_id, table_id, jsonb_extract_path_text(raw::jsonb, 'scenario')
  ON CONFLICT (project_id, table_id, title) DO NOTHING;
  UPDATE pm_mapping_rules rule
     SET scenario_id = scenario.id
    FROM pm_mapping_scenarios scenario
   WHERE rule.project_id = scenario.project_id
     AND rule.table_id = scenario.table_id
     AND coalesce(jsonb_extract_path_text(rule.raw::jsonb, 'scenario'), '') = scenario.title
     AND rule.scenario_id IS DISTINCT FROM scenario.id;

  -- 历史字段 Mapping 在引入场景表之前没有 scenario 标识。仅为已声明 has_mapping
  -- 且尚未维护任何结构化场景的表补一个默认场景，避免源文件、码表等无 Mapping 表被误展示。
  INSERT INTO pm_mapping_scenarios (id, project_id, table_id, title, caliber, remark, sort_order, raw, created_at, updated_at)
  SELECT 'pm-map-scenario-default-' || md5(rule.project_id || ':' || rule.table_id),
         rule.project_id, rule.table_id, '默认场景', table_meta.caliber, '由历史字段 Mapping 自动迁移。', 0,
         '{"migratedFrom":"legacyFieldMappings"}'::jsonb, min(rule.created_at), max(rule.updated_at)
    FROM pm_mapping_rules rule
    JOIN pm_data_tables table_meta ON table_meta.id = rule.table_id AND table_meta.project_id = rule.project_id
   WHERE table_meta.has_mapping IS TRUE
     AND rule.scenario_id IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM pm_mapping_scenarios existing
        WHERE existing.project_id = rule.project_id AND existing.table_id = rule.table_id
     )
   GROUP BY rule.project_id, rule.table_id, table_meta.caliber
  ON CONFLICT (project_id, table_id, title) DO NOTHING;
  UPDATE pm_mapping_rules rule
     SET scenario_id = scenario.id
    FROM pm_mapping_scenarios scenario
   WHERE rule.project_id = scenario.project_id
     AND rule.table_id = scenario.table_id
     AND rule.scenario_id IS NULL
     AND scenario.raw->>'migratedFrom' = 'legacyFieldMappings';

  -- 更早的导入版本把 Mapping 直接保存于 pm_data_fields.acquire_logic，尚未产生
  -- pm_mapping_rules。将其完整迁移为“默认场景 → 字段动作”，保留无逻辑字段以便
  -- 新界面明确展示为空，而不是回退读取旧字段。
  INSERT INTO pm_mapping_scenarios (id, project_id, table_id, title, caliber, remark, sort_order, raw, created_at, updated_at)
  SELECT 'pm-map-scenario-field-' || md5(table_meta.project_id || ':' || table_meta.id),
         table_meta.project_id, table_meta.id, '默认场景', table_meta.caliber, '由历史字段元 Mapping 自动迁移。', 0,
         '{"migratedFrom":"pm_data_fields"}'::jsonb, min(field.created_at), max(field.updated_at)
    FROM pm_data_tables table_meta
    JOIN pm_data_fields field ON field.project_id = table_meta.project_id AND field.table_id = table_meta.id
   WHERE table_meta.has_mapping IS TRUE
     AND NOT EXISTS (
       SELECT 1 FROM pm_mapping_scenarios existing
        WHERE existing.project_id = table_meta.project_id AND existing.table_id = table_meta.id
     )
     AND EXISTS (
       SELECT 1 FROM pm_data_fields mapped
        WHERE mapped.project_id = table_meta.project_id AND mapped.table_id = table_meta.id
          AND (nullif(btrim(mapped.acquire_logic), '') IS NOT NULL OR nullif(btrim(mapped.mapped_field), '') IS NOT NULL)
     )
   GROUP BY table_meta.project_id, table_meta.id, table_meta.caliber;
  INSERT INTO pm_mapping_rules (id, project_id, scenario_id, system_id, table_id, field_id, status, logic_text, sort_order, raw, created_at, updated_at)
  SELECT 'pm-map-rule-field-' || md5(field.project_id || ':' || field.table_id || ':' || field.id),
         field.project_id, scenario.id, field.system_id, field.table_id, field.id, 'active',
         coalesce(nullif(btrim(field.acquire_logic), ''), jsonb_build_object('op', 'direct', 'source', concat_ws('.', nullif(field.mapped_table, ''), field.mapped_field))::text),
         coalesce(field.field_order, 0), '{"migratedFrom":"pm_data_fields"}'::jsonb, field.created_at, field.updated_at
    FROM pm_data_fields field
    JOIN pm_mapping_scenarios scenario
      ON scenario.project_id = field.project_id AND scenario.table_id = field.table_id
     AND scenario.raw->>'migratedFrom' = 'pm_data_fields'
   WHERE NOT EXISTS (
     SELECT 1 FROM pm_mapping_rules existing
      WHERE existing.project_id = field.project_id AND existing.field_id = field.id AND existing.scenario_id = scenario.id
   )
  ON CONFLICT (id) DO NOTHING;

  CREATE TABLE IF NOT EXISTS pm_mapping_source_fields (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    mapping_rule_id TEXT REFERENCES pm_mapping_rules(id) ON DELETE CASCADE,
    field_id TEXT REFERENCES pm_data_fields(id) ON DELETE SET NULL,
    ref_path TEXT NOT NULL,
    alias TEXT,
    role TEXT,
    remark TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_source_fields_rule ON pm_mapping_source_fields(project_id, mapping_rule_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_source_fields_field ON pm_mapping_source_fields(project_id, field_id);
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_source_fields_ref_trgm ON pm_mapping_source_fields USING GIN (ref_path gin_trgm_ops);

  CREATE TABLE IF NOT EXISTS pm_mapping_actions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    mapping_rule_id TEXT REFERENCES pm_mapping_rules(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL DEFAULT 'manual_logic',
    condition_text TEXT,
    expression_text TEXT,
    result_text TEXT,
    remark TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_actions_rule ON pm_mapping_actions(project_id, mapping_rule_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_actions_type ON pm_mapping_actions(project_id, action_type);

  CREATE TABLE IF NOT EXISTS pm_mapping_action_source_fields (
    project_id TEXT NOT NULL,
    action_id TEXT REFERENCES pm_mapping_actions(id) ON DELETE CASCADE,
    source_field_id TEXT REFERENCES pm_mapping_source_fields(id) ON DELETE CASCADE,
    relation_kind TEXT NOT NULL DEFAULT 'uses',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(project_id, action_id, source_field_id)
  );
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_action_source_fields_action ON pm_mapping_action_source_fields(project_id, action_id);
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_action_source_fields_source ON pm_mapping_action_source_fields(project_id, source_field_id);

  CREATE TABLE IF NOT EXISTS pm_mapping_temp_tables (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    target_table_id TEXT REFERENCES pm_data_tables(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    table_cn TEXT,
    logic_text TEXT,
    converted_sql TEXT,
    external_sql TEXT,
    remark TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  ALTER TABLE pm_mapping_temp_tables ADD COLUMN IF NOT EXISTS scenario_id TEXT REFERENCES pm_mapping_scenarios(id) ON DELETE SET NULL;
  ALTER TABLE pm_mapping_temp_tables ADD COLUMN IF NOT EXISTS external_sql TEXT;
  ALTER TABLE pm_mapping_temp_fields ADD COLUMN IF NOT EXISTS external_sql TEXT;
  ALTER TABLE pm_mapping_temp_tables
    ALTER COLUMN raw TYPE JSONB USING raw::jsonb,
    ALTER COLUMN raw SET DEFAULT '{}'::jsonb;
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_temp_tables_target
    ON pm_mapping_temp_tables(project_id, target_table_id, sort_order);

  CREATE TABLE IF NOT EXISTS pm_mapping_temp_fields (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    temp_table_id TEXT REFERENCES pm_mapping_temp_tables(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    field_cn TEXT,
    field_type TEXT,
    field_length TEXT,
    logic_text TEXT,
    converted_sql TEXT,
    external_sql TEXT,
    remark TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  ALTER TABLE pm_mapping_temp_fields
    ALTER COLUMN raw TYPE JSONB USING raw::jsonb,
    ALTER COLUMN raw SET DEFAULT '{}'::jsonb;
  UPDATE pm_mapping_temp_tables SET external_sql = raw->>'externalSql'
   WHERE NULLIF(btrim(external_sql), '') IS NULL AND NULLIF(btrim(raw->>'externalSql'), '') IS NOT NULL;
  UPDATE pm_mapping_temp_fields SET external_sql = raw->>'externalSql'
   WHERE NULLIF(btrim(external_sql), '') IS NULL AND NULLIF(btrim(raw->>'externalSql'), '') IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_temp_fields_table
    ON pm_mapping_temp_fields(project_id, temp_table_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_temp_fields_ref
    ON pm_mapping_temp_fields(project_id, temp_table_id, field_name);

  CREATE TABLE IF NOT EXISTS pm_modules (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    module_key TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_modules_project_key ON pm_modules(project_id, module_key, sort_order);

  CREATE TABLE IF NOT EXISTS pm_module_items (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    module_key TEXT NOT NULL,
    parent_id TEXT,
    title TEXT NOT NULL,
    subtitle TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_items_project_key ON pm_module_items(project_id, module_key, sort_order);
  CREATE INDEX IF NOT EXISTS idx_pm_items_parent ON pm_module_items(parent_id, sort_order);

  CREATE TABLE IF NOT EXISTS flowcharts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    graph_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_flowcharts_updated_at ON flowcharts(updated_at DESC);

  CREATE TABLE IF NOT EXISTS deliverables (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_deliverables_updated_at ON deliverables(updated_at DESC);

  CREATE TABLE IF NOT EXISTS pm_automation_plans (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_automation_plans_project ON pm_automation_plans(project_id, sort_order);

  CREATE TABLE IF NOT EXISTS pm_automation_groups (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    plan_id TEXT NOT NULL REFERENCES pm_automation_plans(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_automation_groups_plan ON pm_automation_groups(project_id, plan_id, sort_order);

  CREATE TABLE IF NOT EXISTS pm_automation_items (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    plan_id TEXT NOT NULL REFERENCES pm_automation_plans(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL REFERENCES pm_automation_groups(id) ON DELETE CASCADE,
    table_id TEXT NOT NULL REFERENCES pm_data_tables(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(plan_id, table_id)
  );
  CREATE INDEX IF NOT EXISTS idx_pm_automation_items_group ON pm_automation_items(project_id, group_id, sort_order);

  CREATE TABLE IF NOT EXISTS pm_automation_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    runtime_params JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    updated_at TEXT NOT NULL
  );
  ALTER TABLE pm_automation_runs ADD COLUMN IF NOT EXISTS runtime_params JSONB NOT NULL DEFAULT '{}'::jsonb;
  CREATE INDEX IF NOT EXISTS idx_pm_automation_runs_plan ON pm_automation_runs(project_id, plan_id, started_at DESC);

  CREATE TABLE IF NOT EXISTS pm_automation_run_items (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES pm_automation_runs(id) ON DELETE CASCADE,
    table_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    group_id TEXT NOT NULL,
    group_name TEXT NOT NULL,
    group_order INTEGER NOT NULL,
    item_order INTEGER NOT NULL,
    status TEXT NOT NULL,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    affected_rows INTEGER,
    failed_step TEXT,
    error TEXT,
    started_at TEXT,
    finished_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_pm_automation_run_items_run ON pm_automation_run_items(run_id, group_order, item_order);

  CREATE TABLE IF NOT EXISTS pm_test_tasks (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, objective TEXT NOT NULL DEFAULT '', test_data TEXT NOT NULL DEFAULT '', test_links TEXT NOT NULL DEFAULT '', app_version TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pm_test_groups (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, task_id TEXT NOT NULL REFERENCES pm_test_tasks(id) ON DELETE CASCADE, parent_group_id TEXT REFERENCES pm_test_groups(id) ON DELETE SET NULL, title TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_test_groups_tree ON pm_test_groups(project_id, task_id, parent_group_id, sort_order);
  CREATE TABLE IF NOT EXISTS pm_test_cases (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, task_id TEXT REFERENCES pm_test_tasks(id) ON DELETE SET NULL, group_id TEXT REFERENCES pm_test_groups(id) ON DELETE SET NULL, scenario TEXT NOT NULL DEFAULT '', code TEXT NOT NULL, title TEXT NOT NULL, objective TEXT NOT NULL DEFAULT '', type TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'medium', status TEXT NOT NULL DEFAULT 'draft', sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(project_id, code)
  );
  CREATE INDEX IF NOT EXISTS idx_pm_test_cases_project ON pm_test_cases(project_id, status, updated_at DESC);
  CREATE TABLE IF NOT EXISTS pm_test_runs (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, case_id TEXT NOT NULL REFERENCES pm_test_cases(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'testing', actual_result TEXT NOT NULL DEFAULT '', started_at TEXT NOT NULL, finished_at TEXT, created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_test_runs_case ON pm_test_runs(project_id, case_id, created_at DESC);
  CREATE TABLE IF NOT EXISTS pm_test_case_steps (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, case_id TEXT NOT NULL REFERENCES pm_test_cases(id) ON DELETE CASCADE, step_order INTEGER NOT NULL, instruction TEXT NOT NULL, expected_result TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pm_test_run_steps (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, run_id TEXT NOT NULL REFERENCES pm_test_runs(id) ON DELETE CASCADE, case_step_id TEXT REFERENCES pm_test_case_steps(id) ON DELETE SET NULL, step_order INTEGER NOT NULL, instruction TEXT NOT NULL DEFAULT '', expected_result TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, actual_result TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  ALTER TABLE pm_test_run_steps ADD COLUMN IF NOT EXISTS instruction TEXT NOT NULL DEFAULT '';
  ALTER TABLE pm_test_run_steps ADD COLUMN IF NOT EXISTS expected_result TEXT NOT NULL DEFAULT '';
  CREATE TABLE IF NOT EXISTS pm_test_evidence (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, run_id TEXT NOT NULL REFERENCES pm_test_runs(id) ON DELETE CASCADE, run_step_id TEXT REFERENCES pm_test_run_steps(id) ON DELETE SET NULL, title TEXT NOT NULL, kind TEXT NOT NULL, location TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pm_test_issues (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, case_id TEXT NOT NULL REFERENCES pm_test_cases(id) ON DELETE CASCADE, run_id TEXT REFERENCES pm_test_runs(id) ON DELETE SET NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', owner TEXT, external_ref TEXT, custom_fields TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'open', sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pm_test_grid_settings (
    project_id TEXT NOT NULL, grid_key TEXT NOT NULL, columns_json TEXT NOT NULL DEFAULT '[]', updated_at TEXT NOT NULL, PRIMARY KEY (project_id, grid_key)
  );
  CREATE TABLE IF NOT EXISTS pm_test_issue_discussions (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, issue_id TEXT NOT NULL REFERENCES pm_test_issues(id) ON DELETE CASCADE, content TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pm_test_case_comments (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, case_id TEXT NOT NULL REFERENCES pm_test_cases(id) ON DELETE CASCADE, content TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_test_case_comments_case ON pm_test_case_comments(project_id, case_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS pm_search_index (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    module_key TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    subtitle TEXT,
    body TEXT NOT NULL DEFAULT '',
    keywords TEXT NOT NULL DEFAULT '',
    search_text TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_search_entity ON pm_search_index(project_id, entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_pm_search_project_module ON pm_search_index(project_id, module_key);
  CREATE INDEX IF NOT EXISTS idx_pm_search_text_trgm ON pm_search_index USING GIN (search_text gin_trgm_ops);
  CREATE INDEX IF NOT EXISTS idx_pm_search_tsv ON pm_search_index USING GIN (
    to_tsvector('simple', coalesce(search_text, ''))
  );

  CREATE TABLE IF NOT EXISTS pm_entity_links (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    from_type TEXT NOT NULL,
    from_id TEXT NOT NULL,
    to_type TEXT NOT NULL,
    to_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    weight INTEGER NOT NULL DEFAULT 1,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_links_from ON pm_entity_links(project_id, from_type, from_id);
  CREATE INDEX IF NOT EXISTS idx_pm_links_to ON pm_entity_links(project_id, to_type, to_id);
`;

export const SQLITE_PROJECT_MANAGEMENT_SCHEMA = `
  CREATE TABLE IF NOT EXISTS pm_data_systems (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    code TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    type TEXT,
    asset_layer TEXT,
    owner TEXT,
    description TEXT,
    extra TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_systems_project ON pm_data_systems(project_id, name);
  CREATE INDEX IF NOT EXISTS idx_pm_systems_code ON pm_data_systems(code);

  CREATE TABLE IF NOT EXISTS pm_data_tables (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    system_id TEXT REFERENCES pm_data_systems(id) ON DELETE SET NULL,
    database_name TEXT,
    schema_name TEXT,
    table_name TEXT NOT NULL,
    table_cn TEXT,
    table_group TEXT,
    data_layer TEXT,
    table_type TEXT,
    source_kind TEXT,
    file_type TEXT,
    has_mapping INTEGER NOT NULL DEFAULT 1,
    usage_status TEXT,
    verification_status TEXT NOT NULL DEFAULT '未验证',
    verification_remark TEXT,
    description TEXT,
    caliber TEXT,
    extra TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_tables_project_system ON pm_data_tables(project_id, system_id);
  CREATE INDEX IF NOT EXISTS idx_pm_tables_name ON pm_data_tables(table_name);
  CREATE INDEX IF NOT EXISTS idx_pm_tables_cn ON pm_data_tables(table_cn);

  CREATE TABLE IF NOT EXISTS pm_data_fields (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    system_id TEXT REFERENCES pm_data_systems(id) ON DELETE SET NULL,
    table_id TEXT REFERENCES pm_data_tables(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    field_cn TEXT,
    field_type TEXT,
    field_length TEXT,
    format_pattern TEXT,
    carrier_kind TEXT,
    field_order INTEGER,
    source_field_order INTEGER,
    nullable TEXT,
    primary_key INTEGER NOT NULL DEFAULT 0,
    required INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    acquire_logic TEXT,
    validation_rule TEXT,
    code_value TEXT,
    mapped_table TEXT,
    mapped_field TEXT,
    mapped_field_cn TEXT,
    data_source TEXT,
    remark TEXT,
    verification_status TEXT NOT NULL DEFAULT '未验证',
    verification_remark TEXT,
    extra TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_fields_project_system ON pm_data_fields(project_id, system_id);
  CREATE INDEX IF NOT EXISTS idx_pm_fields_project_table ON pm_data_fields(project_id, table_id);
  CREATE INDEX IF NOT EXISTS idx_pm_fields_name ON pm_data_fields(field_name);
  CREATE INDEX IF NOT EXISTS idx_pm_fields_cn ON pm_data_fields(field_cn);

  CREATE TABLE IF NOT EXISTS pm_code_sets (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    raw TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_code_sets_project ON pm_code_sets(project_id, name);

  CREATE TABLE IF NOT EXISTS pm_code_items (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    code_set_id TEXT REFERENCES pm_code_sets(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    label TEXT,
    remark TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    raw TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_code_items_set ON pm_code_items(project_id, code_set_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_pm_code_items_code ON pm_code_items(code);

  CREATE TABLE IF NOT EXISTS pm_field_code_sets (
    project_id TEXT NOT NULL,
    field_id TEXT REFERENCES pm_data_fields(id) ON DELETE CASCADE,
    code_set_id TEXT REFERENCES pm_code_sets(id) ON DELETE CASCADE,
    relation_kind TEXT NOT NULL DEFAULT 'uses_code_set',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(project_id, field_id, code_set_id)
  );
  CREATE INDEX IF NOT EXISTS idx_pm_field_code_sets_field ON pm_field_code_sets(project_id, field_id);
  CREATE INDEX IF NOT EXISTS idx_pm_field_code_sets_set ON pm_field_code_sets(project_id, code_set_id);

  CREATE TABLE IF NOT EXISTS pm_dictionary_template_versions (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    title TEXT NOT NULL,
    change_summary TEXT,
    content TEXT NOT NULL DEFAULT '{}',
    effective_at TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_dictionary_template_version_scope
    ON pm_dictionary_template_versions(project_id, version);
  CREATE INDEX IF NOT EXISTS idx_pm_dictionary_template_status
    ON pm_dictionary_template_versions(project_id, status, updated_at DESC);

  CREATE TABLE IF NOT EXISTS pm_dictionary_template_rules (
    id TEXT PRIMARY KEY,
    version_id TEXT NOT NULL REFERENCES pm_dictionary_template_versions(id) ON DELETE CASCADE,
    meta_type TEXT NOT NULL,
    property_key TEXT NOT NULL,
    property_label TEXT NOT NULL,
    required INTEGER NOT NULL DEFAULT 0,
    value_type TEXT NOT NULL DEFAULT 'text',
    allowed_values TEXT NOT NULL DEFAULT '[]',
    validation TEXT NOT NULL DEFAULT '{}',
    fill_instruction TEXT NOT NULL DEFAULT '',
    prohibited_instruction TEXT,
    example_value TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_dictionary_template_rule_key
    ON pm_dictionary_template_rules(version_id, meta_type, property_key);
  CREATE INDEX IF NOT EXISTS idx_pm_dictionary_template_rule_type
    ON pm_dictionary_template_rules(version_id, meta_type, sort_order);

  CREATE TABLE IF NOT EXISTS pm_dictionary_template_changes (
    id TEXT PRIMARY KEY,
    version_id TEXT REFERENCES pm_dictionary_template_versions(id) ON DELETE SET NULL,
    change_type TEXT NOT NULL,
    title TEXT NOT NULL,
    reason TEXT NOT NULL,
    impact_scope TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'draft',
    proposed_by TEXT,
    approved_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_dictionary_template_changes_version
    ON pm_dictionary_template_changes(version_id, status, updated_at DESC);

  CREATE TABLE IF NOT EXISTS pm_dictionary_rectifications (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    property_key TEXT NOT NULL,
    requirement TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    resolution_note TEXT,
    created_by TEXT,
    resolved_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    resolved_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_pm_dictionary_rectifications_target
    ON pm_dictionary_rectifications(project_id, entity_type, entity_id, property_key, status);
  CREATE INDEX IF NOT EXISTS idx_pm_dictionary_rectifications_status
    ON pm_dictionary_rectifications(project_id, status, updated_at DESC);

  CREATE TABLE IF NOT EXISTS pm_mapping_scenarios (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    table_id TEXT NOT NULL REFERENCES pm_data_tables(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    caliber TEXT,
    caliber_external_sql TEXT,
    external_sql TEXT,
    remark TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    raw TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(project_id, table_id, title)
  );
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_scenarios_table ON pm_mapping_scenarios(project_id, table_id, sort_order);
  CREATE TABLE IF NOT EXISTS pm_business_scenarios (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, system_id TEXT REFERENCES pm_data_systems(id) ON DELETE CASCADE,
    title TEXT NOT NULL, procedure_name TEXT NOT NULL, external_location TEXT, sql_text TEXT NOT NULL, remark TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
    validation_status TEXT NOT NULL DEFAULT 'pending', validation_sql_fingerprint TEXT, validation_message TEXT, validated_at TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pm_business_scenario_libraries (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, db_type TEXT, sql_dialect TEXT,
    connection TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(project_id, name)
  );
  CREATE INDEX IF NOT EXISTS idx_pm_business_scenario_libraries_project ON pm_business_scenario_libraries(project_id, name);
  CREATE INDEX IF NOT EXISTS idx_pm_business_scenarios_system ON pm_business_scenarios(project_id, system_id, sort_order);
  CREATE TABLE IF NOT EXISTS pm_business_scenario_tables (
    project_id TEXT NOT NULL, scenario_id TEXT NOT NULL REFERENCES pm_business_scenarios(id) ON DELETE CASCADE,
    table_id TEXT NOT NULL REFERENCES pm_data_tables(id) ON DELETE CASCADE, sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (scenario_id, table_id)
  );

  CREATE TABLE IF NOT EXISTS pm_mapping_rules (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    scenario_id TEXT,
    system_id TEXT REFERENCES pm_data_systems(id) ON DELETE SET NULL,
    table_id TEXT REFERENCES pm_data_tables(id) ON DELETE CASCADE,
    field_id TEXT REFERENCES pm_data_fields(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'draft',
    logic_text TEXT,
    converted_sql TEXT,
    external_sql TEXT,
    remark TEXT,
    verification_status TEXT NOT NULL DEFAULT '未验证',
    verification_remark TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    raw TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_rules_project_table ON pm_mapping_rules(project_id, table_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_rules_project_field ON pm_mapping_rules(project_id, field_id);
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_rules_status ON pm_mapping_rules(project_id, status);
  INSERT OR IGNORE INTO pm_mapping_scenarios (id, project_id, table_id, title, caliber, sort_order, raw, created_at, updated_at)
  SELECT 'pm-map-scenario-' || lower(hex(randomblob(16))), project_id, table_id,
         json_extract(raw, '$.scenario'), json_extract(raw, '$.condition'), min(sort_order),
         '{"migratedFrom":"pm_mapping_rules"}', min(created_at), max(updated_at)
    FROM pm_mapping_rules
   WHERE table_id IS NOT NULL AND coalesce(json_extract(raw, '$.scenario'), '') <> ''
   GROUP BY project_id, table_id, json_extract(raw, '$.scenario');
  UPDATE pm_mapping_rules
     SET scenario_id = (SELECT id FROM pm_mapping_scenarios scenario
                         WHERE scenario.project_id = pm_mapping_rules.project_id
                           AND scenario.table_id = pm_mapping_rules.table_id
                           AND scenario.title = json_extract(pm_mapping_rules.raw, '$.scenario'))
   WHERE scenario_id IS NULL AND coalesce(json_extract(raw, '$.scenario'), '') <> '';

  CREATE TABLE IF NOT EXISTS pm_mapping_temp_tables (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, target_table_id TEXT NOT NULL REFERENCES pm_data_tables(id) ON DELETE CASCADE,
    scenario_id TEXT REFERENCES pm_mapping_scenarios(id) ON DELETE SET NULL, table_name TEXT NOT NULL, table_cn TEXT,
    logic_text TEXT, converted_sql TEXT, external_sql TEXT, remark TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
    raw TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_temp_tables_target ON pm_mapping_temp_tables(project_id, target_table_id, sort_order);
  CREATE TABLE IF NOT EXISTS pm_mapping_temp_fields (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, temp_table_id TEXT NOT NULL REFERENCES pm_mapping_temp_tables(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL, field_cn TEXT, field_type TEXT, field_length TEXT, logic_text TEXT, converted_sql TEXT,
    external_sql TEXT, remark TEXT, sort_order INTEGER NOT NULL DEFAULT 0, raw TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_temp_fields_table ON pm_mapping_temp_fields(project_id, temp_table_id, sort_order);

  -- 历史字段 Mapping 在引入场景表之前没有 scenario 标识。仅为已声明 has_mapping
  -- 且尚未维护任何结构化场景的表补一个默认场景，避免源文件、码表等无 Mapping 表被误展示。
  INSERT OR IGNORE INTO pm_mapping_scenarios (id, project_id, table_id, title, caliber, remark, sort_order, raw, created_at, updated_at)
  SELECT 'pm-map-scenario-default-' || lower(hex(randomblob(16))),
         rule.project_id, rule.table_id, '默认场景', table_meta.caliber, '由历史字段 Mapping 自动迁移。', 0,
         '{"migratedFrom":"legacyFieldMappings"}', min(rule.created_at), max(rule.updated_at)
    FROM pm_mapping_rules rule
    JOIN pm_data_tables table_meta ON table_meta.id = rule.table_id AND table_meta.project_id = rule.project_id
   WHERE table_meta.has_mapping = 1
     AND rule.scenario_id IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM pm_mapping_scenarios existing
        WHERE existing.project_id = rule.project_id AND existing.table_id = rule.table_id
     )
   GROUP BY rule.project_id, rule.table_id, table_meta.caliber;
  UPDATE pm_mapping_rules
     SET scenario_id = (SELECT id FROM pm_mapping_scenarios scenario
                         WHERE scenario.project_id = pm_mapping_rules.project_id
                           AND scenario.table_id = pm_mapping_rules.table_id
                           AND json_extract(scenario.raw, '$.migratedFrom') = 'legacyFieldMappings')
   WHERE scenario_id IS NULL;

  -- 更早的导入版本把 Mapping 直接保存于 pm_data_fields.acquire_logic，尚未产生
  -- pm_mapping_rules。将其完整迁移为“默认场景 → 字段动作”。
  INSERT OR IGNORE INTO pm_mapping_scenarios (id, project_id, table_id, title, caliber, remark, sort_order, raw, created_at, updated_at)
  SELECT 'pm-map-scenario-field-' || lower(hex(randomblob(16))),
         table_meta.project_id, table_meta.id, '默认场景', table_meta.caliber, '由历史字段元 Mapping 自动迁移。', 0,
         '{"migratedFrom":"pm_data_fields"}', min(field.created_at), max(field.updated_at)
    FROM pm_data_tables table_meta
    JOIN pm_data_fields field ON field.project_id = table_meta.project_id AND field.table_id = table_meta.id
   WHERE table_meta.has_mapping = 1
     AND NOT EXISTS (
       SELECT 1 FROM pm_mapping_scenarios existing
        WHERE existing.project_id = table_meta.project_id AND existing.table_id = table_meta.id
     )
     AND EXISTS (
       SELECT 1 FROM pm_data_fields mapped
        WHERE mapped.project_id = table_meta.project_id AND mapped.table_id = table_meta.id
          AND (nullif(trim(mapped.acquire_logic), '') IS NOT NULL OR nullif(trim(mapped.mapped_field), '') IS NOT NULL)
     )
   GROUP BY table_meta.project_id, table_meta.id, table_meta.caliber;
  INSERT OR IGNORE INTO pm_mapping_rules (id, project_id, scenario_id, system_id, table_id, field_id, status, logic_text, sort_order, raw, created_at, updated_at)
  SELECT 'pm-map-rule-field-' || lower(hex(randomblob(16))),
         field.project_id, scenario.id, field.system_id, field.table_id, field.id, 'active',
         coalesce(nullif(trim(field.acquire_logic), ''), json_object('op', 'direct', 'source', trim(coalesce(field.mapped_table || '.', '') || field.mapped_field, '.'))),
         coalesce(field.field_order, 0), '{"migratedFrom":"pm_data_fields"}', field.created_at, field.updated_at
    FROM pm_data_fields field
    JOIN pm_mapping_scenarios scenario
      ON scenario.project_id = field.project_id AND scenario.table_id = field.table_id
     AND json_extract(scenario.raw, '$.migratedFrom') = 'pm_data_fields'
   WHERE NOT EXISTS (
     SELECT 1 FROM pm_mapping_rules existing
      WHERE existing.project_id = field.project_id AND existing.field_id = field.id AND existing.scenario_id = scenario.id
   );

  CREATE TABLE IF NOT EXISTS pm_mapping_source_fields (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    mapping_rule_id TEXT REFERENCES pm_mapping_rules(id) ON DELETE CASCADE,
    field_id TEXT REFERENCES pm_data_fields(id) ON DELETE SET NULL,
    ref_path TEXT NOT NULL,
    alias TEXT,
    role TEXT,
    remark TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    raw TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_source_fields_rule ON pm_mapping_source_fields(project_id, mapping_rule_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_source_fields_field ON pm_mapping_source_fields(project_id, field_id);
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_source_fields_ref ON pm_mapping_source_fields(ref_path);

  CREATE TABLE IF NOT EXISTS pm_mapping_actions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    mapping_rule_id TEXT REFERENCES pm_mapping_rules(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL DEFAULT 'manual_logic',
    condition_text TEXT,
    expression_text TEXT,
    result_text TEXT,
    remark TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    raw TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_actions_rule ON pm_mapping_actions(project_id, mapping_rule_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_actions_type ON pm_mapping_actions(project_id, action_type);

  CREATE TABLE IF NOT EXISTS pm_mapping_action_source_fields (
    project_id TEXT NOT NULL,
    action_id TEXT REFERENCES pm_mapping_actions(id) ON DELETE CASCADE,
    source_field_id TEXT REFERENCES pm_mapping_source_fields(id) ON DELETE CASCADE,
    relation_kind TEXT NOT NULL DEFAULT 'uses',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(project_id, action_id, source_field_id)
  );
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_action_source_fields_action ON pm_mapping_action_source_fields(project_id, action_id);
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_action_source_fields_source ON pm_mapping_action_source_fields(project_id, source_field_id);

  CREATE TABLE IF NOT EXISTS pm_modules (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    module_key TEXT NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    content TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_modules_project_key ON pm_modules(project_id, module_key, sort_order);

  CREATE TABLE IF NOT EXISTS pm_module_items (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    module_key TEXT NOT NULL,
    parent_id TEXT,
    title TEXT NOT NULL,
    subtitle TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    content TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_items_project_key ON pm_module_items(project_id, module_key, sort_order);
  CREATE INDEX IF NOT EXISTS idx_pm_items_parent ON pm_module_items(parent_id, sort_order);

  CREATE TABLE IF NOT EXISTS flowcharts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    graph_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_flowcharts_updated_at ON flowcharts(updated_at DESC);

  CREATE TABLE IF NOT EXISTS deliverables (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_deliverables_updated_at ON deliverables(updated_at DESC);

  CREATE TABLE IF NOT EXISTS pm_automation_plans (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_automation_plans_project ON pm_automation_plans(project_id, sort_order);

  CREATE TABLE IF NOT EXISTS pm_automation_groups (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    plan_id TEXT NOT NULL REFERENCES pm_automation_plans(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_automation_groups_plan ON pm_automation_groups(project_id, plan_id, sort_order);

  CREATE TABLE IF NOT EXISTS pm_automation_items (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    plan_id TEXT NOT NULL REFERENCES pm_automation_plans(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL REFERENCES pm_automation_groups(id) ON DELETE CASCADE,
    table_id TEXT NOT NULL REFERENCES pm_data_tables(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(plan_id, table_id)
  );
  CREATE INDEX IF NOT EXISTS idx_pm_automation_items_group ON pm_automation_items(project_id, group_id, sort_order);

  CREATE TABLE IF NOT EXISTS pm_automation_runs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    runtime_params TEXT NOT NULL DEFAULT '{}',
    started_at TEXT NOT NULL,
    finished_at TEXT,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_automation_runs_plan ON pm_automation_runs(project_id, plan_id, started_at DESC);

  CREATE TABLE IF NOT EXISTS pm_automation_run_items (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES pm_automation_runs(id) ON DELETE CASCADE,
    table_id TEXT NOT NULL,
    table_name TEXT NOT NULL,
    group_id TEXT NOT NULL,
    group_name TEXT NOT NULL,
    group_order INTEGER NOT NULL,
    item_order INTEGER NOT NULL,
    status TEXT NOT NULL,
    steps TEXT NOT NULL DEFAULT '[]',
    affected_rows INTEGER,
    failed_step TEXT,
    error TEXT,
    started_at TEXT,
    finished_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_pm_automation_run_items_run ON pm_automation_run_items(run_id, group_order, item_order);

  CREATE TABLE IF NOT EXISTS pm_search_index (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    module_key TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    subtitle TEXT,
    body TEXT NOT NULL DEFAULT '',
    keywords TEXT NOT NULL DEFAULT '',
    search_text TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_search_entity ON pm_search_index(project_id, entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_pm_search_project_module ON pm_search_index(project_id, module_key);

  CREATE TABLE IF NOT EXISTS pm_test_tasks (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, objective TEXT NOT NULL DEFAULT '', test_data TEXT NOT NULL DEFAULT '', test_links TEXT NOT NULL DEFAULT '', app_version TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pm_test_groups (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, task_id TEXT NOT NULL REFERENCES pm_test_tasks(id) ON DELETE CASCADE, parent_group_id TEXT REFERENCES pm_test_groups(id) ON DELETE SET NULL, title TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pm_test_cases (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, task_id TEXT REFERENCES pm_test_tasks(id) ON DELETE SET NULL, group_id TEXT REFERENCES pm_test_groups(id) ON DELETE SET NULL, scenario TEXT NOT NULL DEFAULT '', code TEXT NOT NULL, title TEXT NOT NULL, objective TEXT NOT NULL DEFAULT '', type TEXT NOT NULL, priority TEXT NOT NULL DEFAULT 'medium', status TEXT NOT NULL DEFAULT 'draft', sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(project_id, code)
  );
  CREATE INDEX IF NOT EXISTS idx_pm_test_cases_project ON pm_test_cases(project_id, status, updated_at DESC);
  CREATE TABLE IF NOT EXISTS pm_test_runs (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, case_id TEXT NOT NULL REFERENCES pm_test_cases(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'testing', actual_result TEXT NOT NULL DEFAULT '', started_at TEXT NOT NULL, finished_at TEXT, created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_test_runs_case ON pm_test_runs(project_id, case_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS pm_test_case_steps (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, case_id TEXT NOT NULL REFERENCES pm_test_cases(id) ON DELETE CASCADE, step_order INTEGER NOT NULL, instruction TEXT NOT NULL, expected_result TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pm_test_run_steps (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, run_id TEXT NOT NULL REFERENCES pm_test_runs(id) ON DELETE CASCADE, case_step_id TEXT REFERENCES pm_test_case_steps(id) ON DELETE SET NULL, step_order INTEGER NOT NULL, instruction TEXT NOT NULL DEFAULT '', expected_result TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, actual_result TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pm_test_evidence (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, run_id TEXT NOT NULL REFERENCES pm_test_runs(id) ON DELETE CASCADE, run_step_id TEXT REFERENCES pm_test_run_steps(id) ON DELETE SET NULL, title TEXT NOT NULL, kind TEXT NOT NULL, location TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pm_test_issues (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, case_id TEXT NOT NULL REFERENCES pm_test_cases(id) ON DELETE CASCADE, run_id TEXT REFERENCES pm_test_runs(id) ON DELETE SET NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', owner TEXT, external_ref TEXT, custom_fields TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'open', sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pm_test_grid_settings (
    project_id TEXT NOT NULL, grid_key TEXT NOT NULL, columns_json TEXT NOT NULL DEFAULT '[]', updated_at TEXT NOT NULL, PRIMARY KEY (project_id, grid_key)
  );
  CREATE TABLE IF NOT EXISTS pm_test_issue_discussions (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, issue_id TEXT NOT NULL REFERENCES pm_test_issues(id) ON DELETE CASCADE, content TEXT NOT NULL, created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pm_test_case_comments (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, case_id TEXT NOT NULL REFERENCES pm_test_cases(id) ON DELETE CASCADE, content TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_test_case_comments_case ON pm_test_case_comments(project_id, case_id, created_at DESC);

  CREATE VIRTUAL TABLE IF NOT EXISTS pm_search_index_fts USING fts5(
    title,
    subtitle,
    body,
    keywords,
    search_text,
    content='pm_search_index',
    content_rowid='rowid'
  );

  CREATE TABLE IF NOT EXISTS pm_entity_links (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    from_type TEXT NOT NULL,
    from_id TEXT NOT NULL,
    to_type TEXT NOT NULL,
    to_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    weight INTEGER NOT NULL DEFAULT 1,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_links_from ON pm_entity_links(project_id, from_type, from_id);
  CREATE INDEX IF NOT EXISTS idx_pm_links_to ON pm_entity_links(project_id, to_type, to_id);
`;
