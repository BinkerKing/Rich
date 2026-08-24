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
    source_kind TEXT,
    file_type TEXT,
    usage_status TEXT,
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
  ALTER TABLE pm_data_tables ADD COLUMN IF NOT EXISTS source_kind TEXT;
  ALTER TABLE pm_data_tables ADD COLUMN IF NOT EXISTS file_type TEXT;
  ALTER TABLE pm_data_tables ADD COLUMN IF NOT EXISTS usage_status TEXT;

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
    remark TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_rules_project_table ON pm_mapping_rules(project_id, table_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_rules_project_field ON pm_mapping_rules(project_id, field_id);
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_rules_status ON pm_mapping_rules(project_id, status);
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_rules_logic_trgm ON pm_mapping_rules USING GIN (logic_text gin_trgm_ops);

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
    remark TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
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
    remark TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  ALTER TABLE pm_mapping_temp_fields
    ALTER COLUMN raw TYPE JSONB USING raw::jsonb,
    ALTER COLUMN raw SET DEFAULT '{}'::jsonb;
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
    source_kind TEXT,
    file_type TEXT,
    usage_status TEXT,
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
    remark TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    raw TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_rules_project_table ON pm_mapping_rules(project_id, table_id, sort_order);
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_rules_project_field ON pm_mapping_rules(project_id, field_id);
  CREATE INDEX IF NOT EXISTS idx_pm_mapping_rules_status ON pm_mapping_rules(project_id, status);

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
