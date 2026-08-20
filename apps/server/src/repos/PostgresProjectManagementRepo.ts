import { randomUUID } from "node:crypto";
import type { PgPool } from "../db/postgres.js";
import {
  PROJECT_MANAGEMENT_MODULES,
  parseDictionaryCodeItems,
  type ProjectDictionaryMappingAction,
  type ProjectDictionaryMappingActionInput,
  type ProjectDictionaryMappingActionPatch,
  type ProjectDictionaryMappingRule,
  type ProjectDictionaryMappingRulePatch,
  type ProjectDictionaryMappingSourceField,
  type ProjectDictionaryMappingSourceFieldInput,
  type ProjectDictionaryMappingValidation,
  type ProjectDictionaryMappingValidationIssue,
  type ProjectDictionaryRectification,
  type ProjectDictionaryRectificationInput,
  type ProjectDictionaryRectificationPatch,
  type ProjectDictionaryFieldDetail,
  type ProjectDictionaryFieldHit,
  type ProjectDictionarySystem,
  type ProjectDictionaryTable,
  type ProjectManagementModuleKey,
  type ProjectManagementRepo,
  type ProjectManagementSearchHit,
  type ProjectManagementSummary,
  type ProjectModuleItemInput,
  type ProjectModuleItemPatch,
  type ProjectModuleItem,
} from "./ProjectManagementRepo.js";

interface CountRow {
  key: string;
  count: string | number;
}

interface DictionaryCountsRow {
  systems: string | number;
  tables: string | number;
  fields: string | number;
}

interface SearchRow {
  id: string;
  module_key: string;
  entity_type: string;
  entity_id: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  score: string | number;
  updated_at: string;
}

interface ModuleItemRow {
  id: string;
  project_id: string;
  module_key: string;
  parent_id: string | null;
  title: string;
  subtitle: string | null;
  sort_order: number;
  content: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface SystemRow {
  id: string;
  code: string | null;
  name: string;
  type: string | null;
  asset_layer: string | null;
  field_count: string | number;
  table_count: string | number;
}

interface FieldRow {
  id: string;
  system_id: string | null;
  system_name: string | null;
  system_code: string | null;
  table_id: string | null;
  table_name: string | null;
  table_cn: string | null;
  field_name: string;
  field_cn: string | null;
  field_type: string | null;
  field_length: string | null;
  format_pattern: string | null;
  carrier_kind: string | null;
  field_order: string | number | null;
  source_field_order: string | number | null;
  description: string | null;
  acquire_logic: string | null;
  code_value: string | null;
  code_set_id?: string | null;
  code_set_name?: string | null;
  code_items?: Array<{ id?: string; value: string; description: string; remark?: string; sortOrder?: number }> | null;
  remark: string | null;
  mapped_table: string | null;
  mapped_field: string | null;
  mapped_field_cn?: string | null;
  extra?: Record<string, unknown> | null;
  score: string | number;
}

interface MappingDisplayRow {
  field_id: string | null;
  scenario: string | null;
  condition: string | null;
  logic_text: string | null;
  converted_sql: string | null;
  standard_logic: string | null;
  remark: string | null;
  refs: string | null;
  sort_order: string | number;
}

interface MappingRuleRow {
  id: string;
  project_id: string;
  scenario_id: string | null;
  system_id: string | null;
  table_id: string | null;
  field_id: string | null;
  status: string;
  logic_text: string | null;
  converted_sql: string | null;
  remark: string | null;
  sort_order: string | number;
  raw: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface MappingSourceFieldRow {
  id: string;
  project_id: string;
  mapping_rule_id: string;
  field_id: string | null;
  ref_path: string;
  alias: string | null;
  role: string | null;
  remark: string | null;
  sort_order: string | number;
  raw: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface MappingActionRow {
  id: string;
  project_id: string;
  mapping_rule_id: string;
  action_type: string;
  condition_text: string | null;
  expression_text: string | null;
  result_text: string | null;
  remark: string | null;
  sort_order: string | number;
  raw: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface MappingActionSourceFieldRow {
  action_id: string;
  source_field_id: string;
}

interface TableRow {
  id: string;
  system_id: string | null;
  table_name: string;
  table_cn: string | null;
  table_group: string | null;
  data_layer: string | null;
  source_kind: string | null;
  file_type: string | null;
  usage_status: string | null;
  description: string | null;
  caliber: string | null;
  extra: Record<string, unknown> | null;
  field_count: string | number;
}

interface DictionaryRectificationRow {
  id: string;
  project_id: string;
  entity_type: string;
  entity_id: string;
  property_key: string;
  requirement: string;
  status: string;
  resolution_note: string | null;
  created_by: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

interface FieldDetailRow extends FieldRow {
  field_length: string | null;
  nullable: string | null;
  primary_key: boolean | null;
  required: boolean | null;
  validation_rule: string | null;
  code_value: string | null;
  mapped_field_cn: string | null;
  data_source: string | null;
  remark: string | null;
  table_description: string | null;
  table_caliber: string | null;
  table_data_layer: string | null;
  table_source_kind: string | null;
  system_type: string | null;
  system_asset_layer: string | null;
  system_description: string | null;
  extra: Record<string, unknown> | null;
}

export class PostgresProjectManagementRepo implements ProjectManagementRepo {
  constructor(private readonly pg: PgPool) {}

  async getSummary(projectId: string): Promise<ProjectManagementSummary> {
    const [moduleCounts, dictionaryCounts] = await Promise.all([
      this.pg.query<CountRow>(
        `SELECT module_key AS key, count(*) AS count
           FROM pm_module_items
          WHERE project_id = $1
          GROUP BY module_key`,
        [projectId],
      ),
      this.pg.query<DictionaryCountsRow>(
        `SELECT
           (SELECT count(*) FROM pm_data_systems WHERE project_id = $1) AS systems,
           (SELECT count(*) FROM pm_data_tables WHERE project_id = $1) AS tables,
           (SELECT count(*) FROM pm_data_fields WHERE project_id = $1) AS fields`,
        [projectId],
      ),
    ]);

    const counts = new Map(moduleCounts.rows.map(row => [row.key, Number(row.count)]));
    const dictionary = dictionaryCounts.rows[0] ?? { systems: 0, tables: 0, fields: 0 };
    return {
      projectId,
      modules: PROJECT_MANAGEMENT_MODULES.map(module => ({
        ...module,
        count: module.key === "dictionary" ? Number(dictionary.fields) : counts.get(module.key) ?? 0,
      })),
      dictionary: {
        systems: Number(dictionary.systems),
        tables: Number(dictionary.tables),
        fields: Number(dictionary.fields),
      },
    };
  }

  async searchAll(projectId: string, query: string, limit: number): Promise<ProjectManagementSearchHit[]> {
    const q = query.trim();
    const boundedLimit = Math.max(1, Math.min(limit, 80));
    const params: unknown[] = [projectId, boundedLimit];
    const where = q ? "AND search_text ILIKE $3" : "";
    if (q) params.push(`%${q}%`);
    const result = await this.pg.query<SearchRow>(
      `SELECT
         id, module_key, entity_type, entity_id, title, subtitle, body, updated_at,
         CASE
           WHEN lower(title) = lower($${q ? 4 : 3}) THEN 100
           WHEN lower(coalesce(subtitle, '')) = lower($${q ? 4 : 3}) THEN 82
           WHEN title ILIKE $${q ? 5 : 4} THEN 70
           ELSE 30
         END AS score
       FROM pm_search_index
       WHERE project_id = $1
       ${where}
       ORDER BY score DESC, updated_at DESC
       LIMIT $2`,
      q ? [...params, q, `%${q}%`] : [...params, "", ""],
    );
    return result.rows.map(row => ({
      id: row.id,
      moduleKey: row.module_key as ProjectManagementSearchHit["moduleKey"],
      entityType: row.entity_type,
      entityId: row.entity_id,
      title: row.title,
      subtitle: row.subtitle ?? undefined,
      excerpt: excerpt(row.body),
      score: Number(row.score),
      updatedAt: row.updated_at,
    }));
  }

  async listModuleItems(projectId: string, moduleKey: ProjectManagementModuleKey, parentId?: string): Promise<ProjectModuleItem[]> {
    const params: unknown[] = [projectId, moduleKey];
    const parentFilter = parentId ? "AND parent_id = $3" : "AND parent_id IS NULL";
    if (parentId) params.push(parentId);
    const result = await this.pg.query<ModuleItemRow>(
      `SELECT id, project_id, module_key, parent_id, title, subtitle, sort_order, content, created_at, updated_at
         FROM pm_module_items
        WHERE project_id = $1 AND module_key = $2
          ${parentFilter}
        ORDER BY sort_order ASC, updated_at DESC`,
      params,
    );
    return result.rows.map(moduleItemFromRow);
  }

  async createModuleItem(projectId: string, input: ProjectModuleItemInput): Promise<ProjectModuleItem> {
    const now = new Date().toISOString();
    const id = `pm-item-${randomUUID()}`;
    const title = input.title.trim() || "未命名事项";
    const content = input.content ?? {};
    await this.pg.query(
      `INSERT INTO pm_module_items (id, project_id, module_key, parent_id, title, subtitle, sort_order, content, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$9)`,
      [id, projectId, input.moduleKey, input.parentId ?? null, title, input.subtitle ?? null, input.sortOrder ?? 0, JSON.stringify(content), now],
    );
    await this.upsertModuleItemSearch({ id, projectId, moduleKey: input.moduleKey, title, subtitle: input.subtitle ?? "", content, now });
    const item = await this.getModuleItem(projectId, id);
    if (!item) throw new Error("created module item not found");
    return item;
  }

  async updateModuleItem(projectId: string, itemId: string, patch: ProjectModuleItemPatch): Promise<ProjectModuleItem | null> {
    const current = await this.getModuleItem(projectId, itemId);
    if (!current) return null;
    const now = new Date().toISOString();
    const title = patch.title === undefined ? current.title : patch.title.trim() || "未命名事项";
    const subtitle = patch.subtitle === undefined ? current.subtitle ?? null : patch.subtitle ?? null;
    const parentId = patch.parentId === undefined ? current.parentId ?? null : patch.parentId ?? null;
    const sortOrder = patch.sortOrder === undefined ? current.sortOrder : patch.sortOrder;
    const content = patch.content ?? current.content;
    await this.pg.query(
      `UPDATE pm_module_items
          SET parent_id=$3, title=$4, subtitle=$5, sort_order=$6, content=$7::jsonb, updated_at=$8
        WHERE project_id=$1 AND id=$2`,
      [projectId, itemId, parentId, title, subtitle, sortOrder, JSON.stringify(content), now],
    );
    await this.upsertModuleItemSearch({ id: itemId, projectId, moduleKey: current.moduleKey, title, subtitle: subtitle ?? "", content, now });
    return await this.getModuleItem(projectId, itemId);
  }

  async deleteModuleItem(projectId: string, itemId: string): Promise<boolean> {
    const result = await this.pg.query(
      `DELETE FROM pm_module_items WHERE project_id=$1 AND id=$2`,
      [projectId, itemId],
    );
    await this.pg.query(
      `DELETE FROM pm_search_index WHERE project_id=$1 AND entity_type='moduleItem' AND entity_id=$2`,
      [projectId, itemId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async reorderModuleItems(projectId: string, moduleKey: ProjectManagementModuleKey, itemIds: string[]): Promise<void> {
    const now = new Date().toISOString();
    for (let index = 0; index < itemIds.length; index += 1) {
      await this.pg.query(
        `UPDATE pm_module_items
            SET sort_order=$4, updated_at=$5
          WHERE project_id=$1 AND module_key=$2 AND id=$3`,
        [projectId, moduleKey, itemIds[index], index, now],
      );
    }
  }

  async listDictionarySystems(projectId: string): Promise<ProjectDictionarySystem[]> {
    const result = await this.pg.query<SystemRow>(
      `SELECT
         s.id, s.code, s.name, s.type, s.asset_layer,
         COALESCE(tc.table_count, 0) AS table_count,
         COALESCE(fc.field_count, 0) AS field_count
       FROM pm_data_systems s
       LEFT JOIN (
         SELECT system_id, count(*) AS table_count
         FROM pm_data_tables
         WHERE project_id = $1
         GROUP BY system_id
       ) tc ON tc.system_id = s.id
       LEFT JOIN (
         SELECT system_id, count(*) AS field_count
         FROM pm_data_fields
         WHERE project_id = $1
         GROUP BY system_id
       ) fc ON fc.system_id = s.id
       WHERE s.project_id = $1
       ORDER BY s.name ASC`,
      [projectId],
    );
    return result.rows.map(row => ({
      id: row.id,
      code: row.code ?? "",
      name: row.name,
      type: row.type ?? undefined,
      assetLayer: row.asset_layer ?? undefined,
      tableCount: Number(row.table_count),
      fieldCount: Number(row.field_count),
    }));
  }

  private async getModuleItem(projectId: string, itemId: string): Promise<ProjectModuleItem | null> {
    const result = await this.pg.query<ModuleItemRow>(
      `SELECT id, project_id, module_key, parent_id, title, subtitle, sort_order, content, created_at, updated_at
         FROM pm_module_items
        WHERE project_id=$1 AND id=$2
        LIMIT 1`,
      [projectId, itemId],
    );
    const row = result.rows[0];
    return row ? moduleItemFromRow(row) : null;
  }

  private async upsertModuleItemSearch(input: {
    id: string;
    projectId: string;
    moduleKey: ProjectManagementModuleKey;
    title: string;
    subtitle?: string;
    content: Record<string, unknown>;
    now: string;
  }): Promise<void> {
    const body = flattenText(input.content).slice(0, 4000);
    const searchText = [input.title, input.subtitle, body].filter(Boolean).join("\n");
    await this.pg.query(
      `INSERT INTO pm_search_index (id, project_id, module_key, entity_type, entity_id, title, subtitle, body, keywords, search_text, updated_at)
       VALUES ($1,$2,$3,'moduleItem',$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (project_id, entity_type, entity_id) DO UPDATE SET
         title=EXCLUDED.title,
         subtitle=EXCLUDED.subtitle,
         body=EXCLUDED.body,
         keywords=EXCLUDED.keywords,
         search_text=EXCLUDED.search_text,
         updated_at=EXCLUDED.updated_at`,
      [`${input.id}:search`, input.projectId, input.moduleKey, input.id, input.title, input.subtitle ?? null, body, input.moduleKey, searchText, input.now],
    );
  }

  async listDictionaryTables(projectId: string, systemId?: string): Promise<ProjectDictionaryTable[]> {
    const params: unknown[] = [projectId];
    const systemFilter = systemId ? "AND t.system_id = $2" : "";
    if (systemId) params.push(systemId);
    const result = await this.pg.query<TableRow>(
      `SELECT
         t.id, t.system_id, t.table_name, t.table_cn, t.table_group, t.data_layer, t.source_kind, t.file_type, t.usage_status, t.description, t.caliber, t.extra,
         COALESCE(fc.field_count, 0) AS field_count
       FROM pm_data_tables t
       LEFT JOIN (
         SELECT table_id, count(*) AS field_count
         FROM pm_data_fields
         WHERE project_id = $1
         GROUP BY table_id
       ) fc ON fc.table_id = t.id
       WHERE t.project_id = $1
       ${systemFilter}
       ORDER BY t.table_cn ASC NULLS LAST, t.table_name ASC`,
      params,
    );
    return result.rows.map(row => ({
      id: row.id,
      systemId: row.system_id ?? undefined,
      tableName: row.table_name,
      tableCn: row.table_cn ?? undefined,
      tableGroup: row.table_group ?? undefined,
      dataLayer: row.data_layer ?? undefined,
      sourceKind: row.source_kind ?? undefined,
      fileType: row.file_type ?? undefined,
      usageStatus: row.usage_status ?? undefined,
      description: row.description ?? undefined,
      caliber: row.caliber ?? undefined,
      extra: row.extra ?? undefined,
      fieldCount: Number(row.field_count),
    }));
  }

  async listDictionaryFields(projectId: string, tableId: string): Promise<ProjectDictionaryFieldHit[]> {
    const result = await this.pg.query<FieldRow>(
      `SELECT
         f.id, f.system_id, s.name AS system_name, s.code AS system_code,
         f.table_id, t.table_name, t.table_cn,
         f.field_name, f.field_cn, f.field_type, f.field_length, f.format_pattern, f.carrier_kind, f.field_order, f.source_field_order, f.description, f.acquire_logic, f.code_value, f.remark, f.extra,
         cs.id AS code_set_id, cs.name AS code_set_name, COALESCE(ci.items, '[]'::json) AS code_items,
         f.mapped_table, f.mapped_field, f.mapped_field_cn,
         50 AS score
       FROM pm_data_fields f
       LEFT JOIN pm_data_systems s ON s.id = f.system_id
       LEFT JOIN pm_data_tables t ON t.id = f.table_id
       LEFT JOIN pm_field_code_sets fcs ON fcs.project_id = f.project_id AND fcs.field_id = f.id
       LEFT JOIN pm_code_sets cs ON cs.project_id = f.project_id AND cs.id = fcs.code_set_id
       LEFT JOIN LATERAL (
         SELECT json_agg(json_build_object(
           'id', ci.id,
           'value', ci.code,
           'description', COALESCE(ci.label, ''),
           'remark', ci.remark,
           'sortOrder', ci.sort_order
         ) ORDER BY ci.sort_order, ci.code) AS items
         FROM pm_code_items ci
         WHERE ci.project_id = f.project_id AND ci.code_set_id = cs.id
       ) ci ON true
       WHERE f.project_id = $1 AND f.table_id = $2
       ORDER BY
         CASE WHEN s.code = 'SAFE_SOURCE' THEN COALESCE(f.source_field_order, 2147483647) ELSE COALESCE(f.field_order, 2147483647) END ASC,
         f.created_at ASC NULLS LAST,
         f.id ASC`,
      [projectId, tableId],
    );
    const mappingSnippets = await this.dictionaryMappingSnippetsByField(projectId, tableId);
    return result.rows.map(row => ({
      id: row.id,
      systemId: row.system_id ?? undefined,
      systemName: row.system_name ?? undefined,
      systemCode: row.system_code ?? undefined,
      tableId: row.table_id ?? undefined,
      tableName: row.table_name ?? undefined,
      tableCn: row.table_cn ?? undefined,
      fieldName: row.field_name,
      fieldCn: row.field_cn ?? undefined,
      fieldType: row.field_type ?? undefined,
      fieldLength: row.field_length ?? undefined,
      formatPattern: row.format_pattern ?? undefined,
      carrierKind: row.carrier_kind ?? undefined,
      fieldOrder: row.field_order == null ? undefined : Number(row.field_order),
      sourceFieldOrder: row.source_field_order == null ? undefined : Number(row.source_field_order),
      description: row.description ?? undefined,
      acquireLogic: row.acquire_logic?.trim() ? row.acquire_logic : mappingSnippets.get(row.id) ?? undefined,
      codeValue: row.code_value ?? undefined,
      ...codeSetFromRow(row),
      mappedTable: row.mapped_table ?? undefined,
      mappedField: row.mapped_field ?? undefined,
      mappedFieldCn: row.mapped_field_cn ?? undefined,
      remark: row.remark ?? undefined,
      extra: row.extra ?? undefined,
      score: Number(row.score),
    }));
  }

  private async dictionaryMappingSnippetsByField(projectId: string, tableId: string): Promise<Map<string, string>> {
    const result = await this.pg.query<MappingDisplayRow>(
      `
        SELECT
          mr.field_id,
          mr.raw->>'scenario' AS scenario,
          mr.raw->>'condition' AS condition,
          mr.logic_text,
          mr.converted_sql,
          mr.raw->>'standardLogic' AS standard_logic,
          mr.remark,
          COALESCE(string_agg(msf.ref_path, '、' ORDER BY msf.sort_order), '') AS refs,
          mr.sort_order
        FROM pm_mapping_rules mr
        LEFT JOIN pm_mapping_source_fields msf ON msf.project_id=mr.project_id AND msf.mapping_rule_id=mr.id
        WHERE mr.project_id=$1 AND mr.table_id=$2 AND mr.field_id IS NOT NULL
        GROUP BY mr.id, mr.field_id, mr.raw, mr.logic_text, mr.converted_sql, mr.remark, mr.sort_order
        ORDER BY mr.sort_order, mr.id
      `,
      [projectId, tableId],
    );
    return mappingRowsToFieldSnippets(result.rows);
  }

  async resolveDictionaryFieldRefs(projectId: string, refs: string[]): Promise<ProjectDictionaryFieldHit[]> {
    const tokens = dictionaryRefTokens(refs);
    if (tokens.length === 0) return [];
    const result = await this.pg.query<FieldRow>(
      `SELECT
         f.id, f.system_id, s.name AS system_name, s.code AS system_code,
         f.table_id, t.table_name, t.table_cn,
         f.field_name, f.field_cn, f.field_type, f.field_length, f.format_pattern, f.carrier_kind, f.description, f.acquire_logic, f.code_value, f.remark,
         cs.id AS code_set_id, cs.name AS code_set_name, COALESCE(ci.items, '[]'::json) AS code_items,
         f.mapped_table, f.mapped_field, f.mapped_field_cn,
         70 AS score
       FROM pm_data_fields f
       LEFT JOIN pm_data_systems s ON s.id = f.system_id
       LEFT JOIN pm_data_tables t ON t.id = f.table_id
       LEFT JOIN pm_field_code_sets fcs ON fcs.project_id = f.project_id AND fcs.field_id = f.id
       LEFT JOIN pm_code_sets cs ON cs.project_id = f.project_id AND cs.id = fcs.code_set_id
       LEFT JOIN LATERAL (
         SELECT json_agg(json_build_object(
           'id', ci.id,
           'value', ci.code,
           'description', COALESCE(ci.label, ''),
           'remark', ci.remark,
           'sortOrder', ci.sort_order
         ) ORDER BY ci.sort_order, ci.code) AS items
         FROM pm_code_items ci
         WHERE ci.project_id = f.project_id AND ci.code_set_id = cs.id
       ) ci ON true
       WHERE f.project_id = $1
         AND (
           lower(f.field_name) = ANY($2::text[])
           OR lower(coalesce(f.field_cn, '')) = ANY($2::text[])
           OR lower(coalesce(t.table_name, '')) = ANY($2::text[])
           OR lower(coalesce(t.table_cn, '')) = ANY($2::text[])
           OR lower(coalesce(t.table_name, '') || '.' || f.field_name) = ANY($2::text[])
           OR lower(coalesce(t.table_cn, '') || '.' || f.field_name) = ANY($2::text[])
           OR lower(coalesce(t.table_name, '') || '.' || coalesce(f.mapped_field, '')) = ANY($2::text[])
           OR lower(coalesce(t.table_cn, '') || '.' || coalesce(f.mapped_field, '')) = ANY($2::text[])
           OR lower(coalesce(s.code, '') || '.' || coalesce(t.table_name, '') || '.' || f.field_name) = ANY($2::text[])
           OR lower(coalesce(s.code, '') || '.' || coalesce(t.table_name, '') || '.' || coalesce(f.mapped_field, '')) = ANY($2::text[])
         )
       ORDER BY f.updated_at DESC
       LIMIT 500`,
      [projectId, tokens],
    );
    return result.rows.map(row => ({
      id: row.id,
      systemId: row.system_id ?? undefined,
      systemName: row.system_name ?? undefined,
      systemCode: row.system_code ?? undefined,
      tableId: row.table_id ?? undefined,
      tableName: row.table_name ?? undefined,
      tableCn: row.table_cn ?? undefined,
      fieldName: row.field_name,
      fieldCn: row.field_cn ?? undefined,
      fieldType: row.field_type ?? undefined,
      fieldLength: row.field_length ?? undefined,
      formatPattern: row.format_pattern ?? undefined,
      carrierKind: row.carrier_kind ?? undefined,
      description: row.description ?? undefined,
      acquireLogic: row.acquire_logic ?? undefined,
      codeValue: row.code_value ?? undefined,
      ...codeSetFromRow(row),
      mappedTable: row.mapped_table ?? undefined,
      mappedField: row.mapped_field ?? undefined,
      mappedFieldCn: row.mapped_field_cn ?? undefined,
      remark: row.remark ?? undefined,
      score: Number(row.score),
    }));
  }

  async searchDictionaryFields(projectId: string, query: string, limit: number): Promise<ProjectDictionaryFieldHit[]> {
    const q = query.trim();
    const boundedLimit = Math.max(1, Math.min(limit, 100));
    const params: unknown[] = [projectId, boundedLimit];
    const where = q
      ? `AND (
          f.field_name ILIKE $3 OR f.field_cn ILIKE $3 OR t.table_name ILIKE $3 OR
          t.table_cn ILIKE $3 OR s.name ILIKE $3 OR s.code ILIKE $3 OR
          t.data_layer ILIKE $3 OR t.source_kind ILIKE $3 OR
          f.format_pattern ILIKE $3 OR f.description ILIKE $3 OR f.acquire_logic ILIKE $3 OR
          f.validation_rule ILIKE $3 OR f.code_value ILIKE $3 OR f.remark ILIKE $3
        )`
      : "";
    if (q) params.push(`%${q}%`);
    const result = await this.pg.query<FieldRow>(
      `SELECT
         f.id, f.system_id, s.name AS system_name, s.code AS system_code,
         f.table_id, t.table_name, t.table_cn,
         f.field_name, f.field_cn, f.field_type, f.field_length, f.format_pattern, f.carrier_kind, f.description, f.acquire_logic, f.code_value, f.remark,
         cs.id AS code_set_id, cs.name AS code_set_name, COALESCE(ci.items, '[]'::json) AS code_items,
         f.mapped_table, f.mapped_field, f.mapped_field_cn,
         CASE
           WHEN lower(f.field_name) = lower($${q ? 4 : 3}) THEN 100
           WHEN lower(coalesce(f.field_cn, '')) = lower($${q ? 4 : 3}) THEN 92
           WHEN lower(coalesce(t.table_name, '')) = lower($${q ? 4 : 3}) THEN 78
           WHEN lower(coalesce(s.code, '')) = lower($${q ? 4 : 3}) THEN 70
           ELSE 20
         END AS score
       FROM pm_data_fields f
       LEFT JOIN pm_data_systems s ON s.id = f.system_id
       LEFT JOIN pm_data_tables t ON t.id = f.table_id
       LEFT JOIN pm_field_code_sets fcs ON fcs.project_id = f.project_id AND fcs.field_id = f.id
       LEFT JOIN pm_code_sets cs ON cs.project_id = f.project_id AND cs.id = fcs.code_set_id
       LEFT JOIN LATERAL (
         SELECT json_agg(json_build_object(
           'id', ci.id,
           'value', ci.code,
           'description', COALESCE(ci.label, ''),
           'remark', ci.remark,
           'sortOrder', ci.sort_order
         ) ORDER BY ci.sort_order, ci.code) AS items
         FROM pm_code_items ci
         WHERE ci.project_id = f.project_id AND ci.code_set_id = cs.id
       ) ci ON true
       WHERE f.project_id = $1
       ${where}
       ORDER BY score DESC, f.updated_at DESC
       LIMIT $2`,
      q ? [...params, q] : [...params, ""],
    );
    return result.rows.map(row => ({
      id: row.id,
      systemId: row.system_id ?? undefined,
      systemName: row.system_name ?? undefined,
      systemCode: row.system_code ?? undefined,
      tableId: row.table_id ?? undefined,
      tableName: row.table_name ?? undefined,
      tableCn: row.table_cn ?? undefined,
      fieldName: row.field_name,
      fieldCn: row.field_cn ?? undefined,
      fieldType: row.field_type ?? undefined,
      fieldLength: row.field_length ?? undefined,
      formatPattern: row.format_pattern ?? undefined,
      carrierKind: row.carrier_kind ?? undefined,
      description: row.description ?? undefined,
      acquireLogic: row.acquire_logic ?? undefined,
      codeValue: row.code_value ?? undefined,
      ...codeSetFromRow(row),
      mappedTable: row.mapped_table ?? undefined,
      mappedField: row.mapped_field ?? undefined,
      mappedFieldCn: row.mapped_field_cn ?? undefined,
      remark: row.remark ?? undefined,
      score: Number(row.score),
    }));
  }

  async getDictionaryField(projectId: string, fieldId: string): Promise<ProjectDictionaryFieldDetail | null> {
    const result = await this.pg.query<FieldDetailRow>(
      `SELECT
         f.id, f.system_id, s.name AS system_name, s.code AS system_code,
         f.table_id, t.table_name, t.table_cn,
         f.field_name, f.field_cn, f.field_type, f.field_length, f.format_pattern, f.carrier_kind, f.nullable,
         f.primary_key, f.required, f.description, f.acquire_logic, f.validation_rule,
         f.code_value, cs.id AS code_set_id, cs.name AS code_set_name, COALESCE(ci.items, '[]'::json) AS code_items,
         f.mapped_table, f.mapped_field, f.mapped_field_cn,
         f.data_source, f.remark, f.extra,
         t.description AS table_description, t.caliber AS table_caliber,
         t.data_layer AS table_data_layer, t.source_kind AS table_source_kind,
         s.type AS system_type, s.asset_layer AS system_asset_layer, s.description AS system_description,
         100 AS score
       FROM pm_data_fields f
       LEFT JOIN pm_data_systems s ON s.id = f.system_id
       LEFT JOIN pm_data_tables t ON t.id = f.table_id
       LEFT JOIN pm_field_code_sets fcs ON fcs.project_id = f.project_id AND fcs.field_id = f.id
       LEFT JOIN pm_code_sets cs ON cs.project_id = f.project_id AND cs.id = fcs.code_set_id
       LEFT JOIN LATERAL (
         SELECT json_agg(json_build_object(
           'id', ci.id,
           'value', ci.code,
           'description', COALESCE(ci.label, ''),
           'remark', ci.remark,
           'sortOrder', ci.sort_order
         ) ORDER BY ci.sort_order, ci.code) AS items
         FROM pm_code_items ci
         WHERE ci.project_id = f.project_id AND ci.code_set_id = cs.id
       ) ci ON true
       WHERE f.project_id = $1 AND f.id = $2
       LIMIT 1`,
      [projectId, fieldId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      systemId: row.system_id ?? undefined,
      systemName: row.system_name ?? undefined,
      systemCode: row.system_code ?? undefined,
      systemType: row.system_type ?? undefined,
      systemAssetLayer: row.system_asset_layer ?? undefined,
      systemDescription: row.system_description ?? undefined,
      tableId: row.table_id ?? undefined,
      tableName: row.table_name ?? undefined,
      tableCn: row.table_cn ?? undefined,
      tableDescription: row.table_description ?? undefined,
      tableCaliber: row.table_caliber ?? undefined,
      tableDataLayer: row.table_data_layer ?? undefined,
      tableSourceKind: row.table_source_kind ?? undefined,
      fieldName: row.field_name,
      fieldCn: row.field_cn ?? undefined,
      fieldType: row.field_type ?? undefined,
      fieldLength: row.field_length ?? undefined,
      formatPattern: row.format_pattern ?? undefined,
      carrierKind: row.carrier_kind ?? undefined,
      nullable: row.nullable ?? undefined,
      primaryKey: Boolean(row.primary_key),
      required: Boolean(row.required),
      description: row.description ?? undefined,
      acquireLogic: row.acquire_logic ?? undefined,
      validationRule: row.validation_rule ?? undefined,
      codeValue: row.code_value ?? undefined,
      ...codeSetFromRow(row),
      mappedTable: row.mapped_table ?? undefined,
      mappedField: row.mapped_field ?? undefined,
      mappedFieldCn: row.mapped_field_cn ?? undefined,
      dataSource: row.data_source ?? undefined,
      remark: row.remark ?? undefined,
      extra: row.extra ?? undefined,
      score: Number(row.score),
    };
  }

  async listDictionaryRectifications(projectId: string): Promise<ProjectDictionaryRectification[]> {
    const result = await this.pg.query<DictionaryRectificationRow>(
      `SELECT id, project_id, entity_type, entity_id, property_key, requirement, status,
              resolution_note, created_by, resolved_by, created_at, updated_at, resolved_at
         FROM pm_dictionary_rectifications
        WHERE project_id = $1
        ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'fixed' THEN 1 WHEN 'verified' THEN 2 ELSE 3 END,
                 updated_at DESC`,
      [projectId],
    );
    return result.rows.map(dictionaryRectificationFromRow);
  }

  async createDictionaryRectification(
    projectId: string,
    input: ProjectDictionaryRectificationInput,
  ): Promise<ProjectDictionaryRectification> {
    const now = new Date().toISOString();
    const id = `pm-dict-rect-${randomUUID()}`;
    const result = await this.pg.query<DictionaryRectificationRow>(
      `INSERT INTO pm_dictionary_rectifications (
         id, project_id, entity_type, entity_id, property_key, requirement, status,
         resolution_note, created_by, resolved_by, created_at, updated_at, resolved_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 'open', NULL, $7, NULL, $8, $8, NULL)
       RETURNING id, project_id, entity_type, entity_id, property_key, requirement, status,
                 resolution_note, created_by, resolved_by, created_at, updated_at, resolved_at`,
      [id, projectId, input.entityType, input.entityId, input.propertyKey, input.requirement, input.createdBy ?? null, now],
    );
    return dictionaryRectificationFromRow(result.rows[0]);
  }

  async updateDictionaryRectification(
    projectId: string,
    rectificationId: string,
    patch: ProjectDictionaryRectificationPatch,
  ): Promise<ProjectDictionaryRectification | null> {
    const existing = await this.pg.query<DictionaryRectificationRow>(
      `SELECT id, project_id, entity_type, entity_id, property_key, requirement, status,
              resolution_note, created_by, resolved_by, created_at, updated_at, resolved_at
         FROM pm_dictionary_rectifications
        WHERE project_id = $1 AND id = $2`,
      [projectId, rectificationId],
    );
    const current = existing.rows[0];
    if (!current) return null;
    const status = patch.status ?? current.status;
    const resolved = status === "fixed" || status === "verified" || status === "cancelled";
    const now = new Date().toISOString();
    const result = await this.pg.query<DictionaryRectificationRow>(
      `UPDATE pm_dictionary_rectifications
          SET status = $3,
              resolution_note = $4,
              resolved_by = $5,
              resolved_at = $6,
              updated_at = $7
        WHERE project_id = $1 AND id = $2
        RETURNING id, project_id, entity_type, entity_id, property_key, requirement, status,
                  resolution_note, created_by, resolved_by, created_at, updated_at, resolved_at`,
      [
        projectId,
        rectificationId,
        status,
        patch.resolutionNote === undefined ? current.resolution_note : patch.resolutionNote,
        patch.resolvedBy === undefined ? current.resolved_by : patch.resolvedBy,
        resolved ? current.resolved_at ?? now : null,
        now,
      ],
    );
    return dictionaryRectificationFromRow(result.rows[0]);
  }

  async listDictionaryMappingRules(projectId: string, tableId: string): Promise<ProjectDictionaryMappingRule[]> {
    const result = await this.pg.query<MappingRuleRow>(
      `SELECT id, project_id, scenario_id, system_id, table_id, field_id, status,
              logic_text, converted_sql, remark, sort_order, raw, created_at, updated_at
         FROM pm_mapping_rules
        WHERE project_id = $1 AND table_id = $2
        ORDER BY sort_order ASC, id ASC`,
      [projectId, tableId],
    );
    return await this.hydrateMappingRules(projectId, result.rows);
  }

  async getDictionaryMappingRule(projectId: string, mappingRuleId: string): Promise<ProjectDictionaryMappingRule | null> {
    const result = await this.pg.query<MappingRuleRow>(
      `SELECT id, project_id, scenario_id, system_id, table_id, field_id, status,
              logic_text, converted_sql, remark, sort_order, raw, created_at, updated_at
         FROM pm_mapping_rules
        WHERE project_id = $1 AND id = $2
        LIMIT 1`,
      [projectId, mappingRuleId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return (await this.hydrateMappingRules(projectId, [row]))[0] ?? null;
  }

  async updateDictionaryMappingRule(
    projectId: string,
    mappingRuleId: string,
    patch: ProjectDictionaryMappingRulePatch,
  ): Promise<ProjectDictionaryMappingRule | null> {
    const existing = await this.pg.query<MappingRuleRow>(
      `SELECT id, project_id, scenario_id, system_id, table_id, field_id, status,
              logic_text, converted_sql, remark, sort_order, raw, created_at, updated_at
         FROM pm_mapping_rules
        WHERE project_id = $1 AND id = $2
        LIMIT 1`,
      [projectId, mappingRuleId],
    );
    const current = existing.rows[0];
    if (!current) return null;
    const now = new Date().toISOString();
    await this.pg.query(
      `UPDATE pm_mapping_rules
          SET scenario_id = $3, system_id = $4, table_id = $5, field_id = $6, status = $7,
              logic_text = $8, converted_sql = $9, remark = $10, sort_order = $11,
              raw = $12::jsonb, updated_at = $13
        WHERE project_id = $1 AND id = $2`,
      [
        projectId,
        mappingRuleId,
        patch.scenarioId === undefined ? current.scenario_id : patch.scenarioId,
        patch.systemId === undefined ? current.system_id : patch.systemId,
        patch.tableId === undefined ? current.table_id : patch.tableId,
        patch.fieldId === undefined ? current.field_id : patch.fieldId,
        patch.status ?? current.status,
        patch.logicText === undefined ? current.logic_text : patch.logicText,
        patch.convertedSql === undefined ? current.converted_sql : patch.convertedSql,
        patch.remark === undefined ? current.remark : patch.remark,
        patch.sortOrder ?? Number(current.sort_order),
        JSON.stringify(patch.raw === undefined ? current.raw ?? {} : patch.raw),
        now,
      ],
    );
    return await this.getDictionaryMappingRule(projectId, mappingRuleId);
  }

  async updateDictionaryMappingAction(
    projectId: string,
    actionId: string,
    patch: ProjectDictionaryMappingActionPatch,
  ): Promise<ProjectDictionaryMappingAction | null> {
    const existing = await this.pg.query<MappingActionRow>(
      `SELECT id, project_id, mapping_rule_id, action_type, condition_text, expression_text,
              result_text, remark, sort_order, raw, created_at, updated_at
         FROM pm_mapping_actions
        WHERE project_id = $1 AND id = $2
        LIMIT 1`,
      [projectId, actionId],
    );
    const current = existing.rows[0];
    if (!current) return null;
    const now = new Date().toISOString();
    await this.pg.query(
      `UPDATE pm_mapping_actions
          SET action_type = $3, condition_text = $4, expression_text = $5,
              result_text = $6, remark = $7, sort_order = $8, raw = $9::jsonb, updated_at = $10
        WHERE project_id = $1 AND id = $2`,
      [
        projectId,
        actionId,
        patch.actionType ?? current.action_type,
        patch.conditionText === undefined ? current.condition_text : patch.conditionText,
        patch.expressionText === undefined ? current.expression_text : patch.expressionText,
        patch.resultText === undefined ? current.result_text : patch.resultText,
        patch.remark === undefined ? current.remark : patch.remark,
        patch.sortOrder ?? Number(current.sort_order),
        JSON.stringify(patch.raw === undefined ? current.raw ?? {} : patch.raw),
        now,
      ],
    );
    if (patch.sourceFieldIds) {
      await this.pg.query(`DELETE FROM pm_mapping_action_source_fields WHERE project_id = $1 AND action_id = $2`, [projectId, actionId]);
      for (const sourceFieldId of patch.sourceFieldIds) {
        await this.pg.query(
          `INSERT INTO pm_mapping_action_source_fields (project_id, action_id, source_field_id, relation_kind, created_at)
           VALUES ($1, $2, $3, 'uses', $4)`,
          [projectId, actionId, sourceFieldId, now],
        );
      }
    }
    return await this.getMappingAction(projectId, actionId);
  }

  async replaceDictionaryMappingActions(
    projectId: string,
    mappingRuleId: string,
    actions: ProjectDictionaryMappingActionInput[],
  ): Promise<ProjectDictionaryMappingRule | null> {
    const current = await this.getDictionaryMappingRule(projectId, mappingRuleId);
    if (!current) return null;
    const now = new Date().toISOString();
    await this.pg.query(
      `DELETE FROM pm_mapping_action_source_fields
        WHERE project_id = $1
          AND action_id IN (SELECT id FROM pm_mapping_actions WHERE project_id = $1 AND mapping_rule_id = $2)`,
      [projectId, mappingRuleId],
    );
    await this.pg.query(`DELETE FROM pm_mapping_actions WHERE project_id = $1 AND mapping_rule_id = $2`, [projectId, mappingRuleId]);
    for (let index = 0; index < actions.length; index += 1) {
      const action = actions[index];
      const id = action.id ?? `pm-map-action-${randomUUID()}`;
      await this.pg.query(
        `INSERT INTO pm_mapping_actions (
           id, project_id, mapping_rule_id, action_type, condition_text, expression_text,
           result_text, remark, sort_order, raw, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$11)`,
        [
          id,
          projectId,
          mappingRuleId,
          action.actionType,
          action.conditionText ?? null,
          action.expressionText ?? null,
          action.resultText ?? null,
          action.remark ?? null,
          action.sortOrder ?? index,
          JSON.stringify(action.raw ?? {}),
          now,
        ],
      );
      for (const sourceFieldId of action.sourceFieldIds ?? []) {
        await this.pg.query(
          `INSERT INTO pm_mapping_action_source_fields (project_id, action_id, source_field_id, relation_kind, created_at)
           VALUES ($1, $2, $3, 'uses', $4)`,
          [projectId, id, sourceFieldId, now],
        );
      }
    }
    return await this.getDictionaryMappingRule(projectId, mappingRuleId);
  }

  async replaceDictionaryMappingSourceFields(
    projectId: string,
    mappingRuleId: string,
    sourceFields: ProjectDictionaryMappingSourceFieldInput[],
  ): Promise<ProjectDictionaryMappingRule | null> {
    const current = await this.getDictionaryMappingRule(projectId, mappingRuleId);
    if (!current) return null;
    const now = new Date().toISOString();
    await this.pg.query(
      `DELETE FROM pm_mapping_action_source_fields
        WHERE project_id = $1
          AND source_field_id IN (SELECT id FROM pm_mapping_source_fields WHERE project_id = $1 AND mapping_rule_id = $2)`,
      [projectId, mappingRuleId],
    );
    await this.pg.query(`DELETE FROM pm_mapping_source_fields WHERE project_id = $1 AND mapping_rule_id = $2`, [projectId, mappingRuleId]);
    for (let index = 0; index < sourceFields.length; index += 1) {
      const sourceField = sourceFields[index];
      await this.pg.query(
        `INSERT INTO pm_mapping_source_fields (
           id, project_id, mapping_rule_id, field_id, ref_path, alias, role, remark,
           sort_order, raw, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$11)`,
        [
          sourceField.id ?? `pm-map-source-${randomUUID()}`,
          projectId,
          mappingRuleId,
          sourceField.fieldId ?? null,
          sourceField.refPath,
          sourceField.alias ?? null,
          sourceField.role ?? null,
          sourceField.remark ?? null,
          sourceField.sortOrder ?? index,
          JSON.stringify(sourceField.raw ?? {}),
          now,
        ],
      );
    }
    return await this.getDictionaryMappingRule(projectId, mappingRuleId);
  }

  async validateDictionaryMappingTable(projectId: string, tableId: string): Promise<ProjectDictionaryMappingValidation> {
    return validateMappingRules(projectId, tableId, await this.listDictionaryMappingRules(projectId, tableId));
  }

  private async hydrateMappingRules(projectId: string, rows: MappingRuleRow[]): Promise<ProjectDictionaryMappingRule[]> {
    if (rows.length === 0) return [];
    const ids = rows.map(row => row.id);
    const [sourceResult, actionResult] = await Promise.all([
      this.pg.query<MappingSourceFieldRow>(
        `SELECT id, project_id, mapping_rule_id, field_id, ref_path, alias, role, remark,
                sort_order, raw, created_at, updated_at
           FROM pm_mapping_source_fields
          WHERE project_id = $1 AND mapping_rule_id = ANY($2::text[])
          ORDER BY sort_order ASC, id ASC`,
        [projectId, ids],
      ),
      this.pg.query<MappingActionRow>(
        `SELECT id, project_id, mapping_rule_id, action_type, condition_text, expression_text,
                result_text, remark, sort_order, raw, created_at, updated_at
           FROM pm_mapping_actions
          WHERE project_id = $1 AND mapping_rule_id = ANY($2::text[])
          ORDER BY sort_order ASC, id ASC`,
        [projectId, ids],
      ),
    ]);
    const actionIds = actionResult.rows.map(row => row.id);
    const linkResult = actionIds.length
      ? await this.pg.query<MappingActionSourceFieldRow>(
        `SELECT action_id, source_field_id
           FROM pm_mapping_action_source_fields
          WHERE project_id = $1 AND action_id = ANY($2::text[])`,
        [projectId, actionIds],
      )
      : { rows: [] as MappingActionSourceFieldRow[] };
    const sourcesByRule = groupBy(sourceResult.rows.map(mappingSourceFieldFromRow), source => source.mappingRuleId);
    const sourceIdsByAction = groupBy(linkResult.rows, row => row.action_id);
    const actionsByRule = groupBy(
      actionResult.rows.map(row => mappingActionFromRow(row, sourceIdsByAction.get(row.id)?.map(link => link.source_field_id) ?? [])),
      action => action.mappingRuleId,
    );
    return rows.map(row => mappingRuleFromRow(row, sourcesByRule.get(row.id) ?? [], actionsByRule.get(row.id) ?? []));
  }

  private async getMappingAction(projectId: string, actionId: string): Promise<ProjectDictionaryMappingAction | null> {
    const result = await this.pg.query<MappingActionRow>(
      `SELECT id, project_id, mapping_rule_id, action_type, condition_text, expression_text,
              result_text, remark, sort_order, raw, created_at, updated_at
         FROM pm_mapping_actions
        WHERE project_id = $1 AND id = $2
        LIMIT 1`,
      [projectId, actionId],
    );
    const row = result.rows[0];
    if (!row) return null;
    const links = await this.pg.query<MappingActionSourceFieldRow>(
      `SELECT action_id, source_field_id FROM pm_mapping_action_source_fields WHERE project_id = $1 AND action_id = $2`,
      [projectId, actionId],
    );
    return mappingActionFromRow(row, links.rows.map(link => link.source_field_id));
  }
}

function mappingRuleFromRow(
  row: MappingRuleRow,
  sourceFields: ProjectDictionaryMappingSourceField[],
  actions: ProjectDictionaryMappingAction[],
): ProjectDictionaryMappingRule {
  return {
    id: row.id,
    projectId: row.project_id,
    scenarioId: row.scenario_id ?? undefined,
    systemId: row.system_id ?? undefined,
    tableId: row.table_id ?? undefined,
    fieldId: row.field_id ?? undefined,
    status: row.status,
    logicText: row.logic_text ?? undefined,
    convertedSql: row.converted_sql ?? undefined,
    remark: row.remark ?? undefined,
    sortOrder: Number(row.sort_order),
    raw: row.raw ?? undefined,
    sourceFields,
    actions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mappingSourceFieldFromRow(row: MappingSourceFieldRow): ProjectDictionaryMappingSourceField {
  return {
    id: row.id,
    projectId: row.project_id,
    mappingRuleId: row.mapping_rule_id,
    fieldId: row.field_id ?? undefined,
    refPath: row.ref_path,
    alias: row.alias ?? undefined,
    role: row.role ?? undefined,
    remark: row.remark ?? undefined,
    sortOrder: Number(row.sort_order),
    raw: row.raw ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mappingActionFromRow(row: MappingActionRow, sourceFieldIds: string[]): ProjectDictionaryMappingAction {
  return {
    id: row.id,
    projectId: row.project_id,
    mappingRuleId: row.mapping_rule_id,
    actionType: row.action_type,
    conditionText: row.condition_text ?? undefined,
    expressionText: row.expression_text ?? undefined,
    resultText: row.result_text ?? undefined,
    remark: row.remark ?? undefined,
    sortOrder: Number(row.sort_order),
    raw: row.raw ?? undefined,
    sourceFieldIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateMappingRules(
  projectId: string,
  tableId: string,
  rules: ProjectDictionaryMappingRule[],
): ProjectDictionaryMappingValidation {
  const issues: ProjectDictionaryMappingValidationIssue[] = [];
  let completeRules = 0;
  let invalidRules = 0;
  let unableToConvertRules = 0;
  let missingSourceFieldRules = 0;
  let missingSqlRules = 0;

  for (const rule of rules) {
    const status = normalizeMappingStatus(rule.status);
    const hasLogic = Boolean(rule.logicText?.trim()) || rule.actions.length > 0;
    const hasSql = Boolean(rule.convertedSql?.trim());
    if (status === "complete" || status === "done") completeRules += 1;
    if (["invalid", "error"].includes(status)) invalidRules += 1;
    if (["unable_to_convert", "unable", "manual", "blocked"].includes(status)) unableToConvertRules += 1;
    if (rule.sourceFields.length === 0) {
      missingSourceFieldRules += 1;
      issues.push({ mappingRuleId: rule.id, fieldId: rule.fieldId, severity: "warning", code: "missing_source_fields", message: "Mapping 规则没有关联涉及字段元。" });
    }
    if (!hasLogic) {
      issues.push({ mappingRuleId: rule.id, fieldId: rule.fieldId, severity: "error", code: "missing_logic", message: "Mapping 规则缺少逻辑说明或标准动作。" });
    }
    if ((status === "complete" || status === "done") && !hasSql) {
      missingSqlRules += 1;
      issues.push({ mappingRuleId: rule.id, fieldId: rule.fieldId, severity: "error", code: "complete_without_sql", message: "Mapping 状态为完成，但没有转换后的 SQL。" });
    }
    if (!hasSql && !["unable_to_convert", "unable", "manual", "blocked"].includes(status)) {
      missingSqlRules += 1;
      issues.push({ mappingRuleId: rule.id, fieldId: rule.fieldId, severity: "info", code: "sql_not_generated", message: "Mapping 暂未生成 SQL，可补充标准动作后再转换。" });
    }
  }

  return {
    projectId,
    tableId,
    totalRules: rules.length,
    completeRules,
    invalidRules,
    unableToConvertRules,
    missingSourceFieldRules,
    missingSqlRules,
    issues,
  };
}

function normalizeMappingStatus(status: string): string {
  return status.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function groupBy<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }
  return grouped;
}

function excerpt(value?: string | null): string | undefined {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  return text.length > 160 ? `${text.slice(0, 160)}...` : text;
}

function codeSetFromRow(row: FieldRow): Pick<ProjectDictionaryFieldHit, "codeSetId" | "codeSetName" | "codeItems"> {
  const normalizedItems = row.code_items?.length
    ? row.code_items
      .filter(item => item.value || item.description)
      .map(item => ({
        id: item.id,
        value: item.value,
        description: item.description,
        remark: item.remark,
        sortOrder: item.sortOrder,
      }))
    : parseDictionaryCodeItems(row.code_value);
  if (!row.code_set_id && normalizedItems.length === 0) return {};
  return {
    codeSetId: row.code_set_id ?? undefined,
    codeSetName: row.code_set_name ?? undefined,
    codeItems: normalizedItems,
  };
}

function mappingRowsToFieldSnippets(rows: MappingDisplayRow[]): Map<string, string> {
  const grouped = new Map<string, MappingDisplayRow[]>();
  for (const row of rows) {
    if (!row.field_id) continue;
    const fieldRows = grouped.get(row.field_id) ?? [];
    fieldRows.push(row);
    grouped.set(row.field_id, fieldRows);
  }

  const snippets = new Map<string, string>();
  for (const [fieldId, fieldRows] of grouped.entries()) {
    snippets.set(fieldId, fieldRows.map(mappingRowToSnippet).join("\n\n"));
  }
  return snippets;
}

function mappingRowToSnippet(row: MappingDisplayRow, index: number): string {
  const lines = [`场景${index + 1}：${row.scenario?.trim() || "默认场景"}`];
  if (row.condition?.trim()) lines.push(`取数范围描述：${row.condition.trim()}`);
  if (row.refs?.trim()) lines.push(`mapping：${row.refs.trim()}`);
  const standardLogic = row.standard_logic?.trim();
  const logicText = row.logic_text?.trim();
  if (standardLogic) lines.push(`逻辑：${standardLogic}`);
  else if (logicText) lines.push(`逻辑：${logicText}`);
  if (standardLogic && logicText && standardLogic !== logicText) lines.push(`逻辑说明：${logicText}`);
  if (row.remark?.trim()) lines.push(`备注：${row.remark.trim()}`);
  return lines.join("\n");
}

function moduleItemFromRow(row: ModuleItemRow): ProjectModuleItem {
  return {
    id: row.id,
    projectId: row.project_id,
    moduleKey: row.module_key as ProjectManagementModuleKey,
    parentId: row.parent_id ?? undefined,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    sortOrder: row.sort_order,
    content: row.content ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function dictionaryRectificationFromRow(row: DictionaryRectificationRow): ProjectDictionaryRectification {
  return {
    id: row.id,
    projectId: row.project_id,
    entityType: row.entity_type as ProjectDictionaryRectification["entityType"],
    entityId: row.entity_id,
    propertyKey: row.property_key,
    requirement: row.requirement,
    status: row.status as ProjectDictionaryRectification["status"],
    resolutionNote: row.resolution_note ?? undefined,
    createdBy: row.created_by ?? undefined,
    resolvedBy: row.resolved_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at ?? undefined,
  };
}

function flattenText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(flattenText).filter(Boolean).join("\n");
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).map(flattenText).filter(Boolean).join("\n");
  return "";
}

function dictionaryRefTokens(refs: string[]): string[] {
  const tokens = new Set<string>();
  refs.slice(0, 300).forEach(ref => {
    String(ref)
      .split(/[,\s，、;；]+/g)
      .map(item => item.trim())
      .filter(Boolean)
      .forEach(item => {
        const normalized = item
          .replace(/^[`"'“”‘’]+|[`"'“”‘’]+$/g, "")
          .replace(/\s+/g, "")
          .toLowerCase();
        if (!normalized) return;
        tokens.add(normalized);
        normalized.split(".").filter(Boolean).forEach(part => tokens.add(part));
      });
  });
  return Array.from(tokens).filter(token => token.length <= 160).slice(0, 500);
}
