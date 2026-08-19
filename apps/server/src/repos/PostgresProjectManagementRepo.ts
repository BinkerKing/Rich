import { randomUUID } from "node:crypto";
import type { PgPool } from "../db/postgres.js";
import {
  PROJECT_MANAGEMENT_MODULES,
  parseDictionaryCodeItems,
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
  description: string | null;
  acquire_logic: string | null;
  code_value: string | null;
  code_set_id?: string | null;
  code_set_name?: string | null;
  code_items?: Array<{ id?: string; value: string; description: string; remark?: string; sortOrder?: number }> | null;
  remark: string | null;
  mapped_table: string | null;
  mapped_field: string | null;
  score: string | number;
}

interface TableRow {
  id: string;
  system_id: string | null;
  table_name: string;
  table_cn: string | null;
  table_group: string | null;
  data_layer: string | null;
  source_kind: string | null;
  description: string | null;
  caliber: string | null;
  field_count: string | number;
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
         count(DISTINCT t.id) AS table_count,
         count(DISTINCT f.id) AS field_count
       FROM pm_data_systems s
       LEFT JOIN pm_data_tables t ON t.system_id = s.id AND t.project_id = s.project_id
       LEFT JOIN pm_data_fields f ON f.system_id = s.id AND f.project_id = s.project_id
       WHERE s.project_id = $1
       GROUP BY s.id
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
         t.id, t.system_id, t.table_name, t.table_cn, t.table_group, t.data_layer, t.source_kind, t.description, t.caliber,
         count(DISTINCT f.id) AS field_count
       FROM pm_data_tables t
       LEFT JOIN pm_data_fields f ON f.table_id = t.id AND f.project_id = t.project_id
       WHERE t.project_id = $1
       ${systemFilter}
       GROUP BY t.id
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
      description: row.description ?? undefined,
      caliber: row.caliber ?? undefined,
      fieldCount: Number(row.field_count),
    }));
  }

  async listDictionaryFields(projectId: string, tableId: string): Promise<ProjectDictionaryFieldHit[]> {
    const result = await this.pg.query<FieldRow>(
      `SELECT
         f.id, f.system_id, s.name AS system_name, s.code AS system_code,
         f.table_id, t.table_name, t.table_cn,
         f.field_name, f.field_cn, f.field_type, f.field_length, f.format_pattern, f.description, f.acquire_logic, f.code_value, f.remark,
         cs.id AS code_set_id, cs.name AS code_set_name, COALESCE(ci.items, '[]'::json) AS code_items,
         f.mapped_table, f.mapped_field,
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
       ORDER BY f.field_name ASC, f.id ASC`,
      [projectId, tableId],
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
      description: row.description ?? undefined,
      acquireLogic: row.acquire_logic ?? undefined,
      codeValue: row.code_value ?? undefined,
      ...codeSetFromRow(row),
      mappedTable: row.mapped_table ?? undefined,
      mappedField: row.mapped_field ?? undefined,
      remark: row.remark ?? undefined,
      score: Number(row.score),
    }));
  }

  async resolveDictionaryFieldRefs(projectId: string, refs: string[]): Promise<ProjectDictionaryFieldHit[]> {
    const tokens = dictionaryRefTokens(refs);
    if (tokens.length === 0) return [];
    const result = await this.pg.query<FieldRow>(
      `SELECT
         f.id, f.system_id, s.name AS system_name, s.code AS system_code,
         f.table_id, t.table_name, t.table_cn,
         f.field_name, f.field_cn, f.field_type, f.field_length, f.format_pattern, f.description, f.acquire_logic, f.code_value, f.remark,
         cs.id AS code_set_id, cs.name AS code_set_name, COALESCE(ci.items, '[]'::json) AS code_items,
         f.mapped_table, f.mapped_field,
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
      description: row.description ?? undefined,
      acquireLogic: row.acquire_logic ?? undefined,
      codeValue: row.code_value ?? undefined,
      ...codeSetFromRow(row),
      mappedTable: row.mapped_table ?? undefined,
      mappedField: row.mapped_field ?? undefined,
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
         f.field_name, f.field_cn, f.field_type, f.field_length, f.format_pattern, f.description, f.acquire_logic, f.code_value, f.remark,
         cs.id AS code_set_id, cs.name AS code_set_name, COALESCE(ci.items, '[]'::json) AS code_items,
         f.mapped_table, f.mapped_field,
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
      description: row.description ?? undefined,
      acquireLogic: row.acquire_logic ?? undefined,
      codeValue: row.code_value ?? undefined,
      ...codeSetFromRow(row),
      mappedTable: row.mapped_table ?? undefined,
      mappedField: row.mapped_field ?? undefined,
      remark: row.remark ?? undefined,
      score: Number(row.score),
    }));
  }

  async getDictionaryField(projectId: string, fieldId: string): Promise<ProjectDictionaryFieldDetail | null> {
    const result = await this.pg.query<FieldDetailRow>(
      `SELECT
         f.id, f.system_id, s.name AS system_name, s.code AS system_code,
         f.table_id, t.table_name, t.table_cn,
         f.field_name, f.field_cn, f.field_type, f.field_length, f.format_pattern, f.nullable,
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
