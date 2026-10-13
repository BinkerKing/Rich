import { randomUUID } from "node:crypto";
import type { PgPool } from "../db/postgres.js";
import {
  PROJECT_MANAGEMENT_MODULES,
  dictionaryTableMappingStatus,
  parseDictionaryCodeItems,
  projectDictionarySystemFromRow,
  type ProjectDictionaryMappingAction,
  type ProjectDictionaryMappingActionInput,
  type ProjectDictionaryMappingActionPatch,
  type ProjectDictionaryMappingRule,
  type ProjectDictionaryMappingScenario,
  type ProjectDictionaryMappingScenarioInput,
  type ProjectDictionaryMappingScenarioPatch,
  type ProjectDictionaryBusinessScenario,
  type ProjectDictionaryBusinessScenarioInput,
  type ProjectDictionaryBusinessScenarioPatch,
  type ProjectDictionaryBusinessScenarioLibrary,
  type ProjectDictionaryBusinessScenarioLibraryInput,
  type ProjectDictionaryMappingRulePatch,
  type ProjectDictionaryMappingSourceField,
  type ProjectDictionaryMappingSourceFieldInput,
  type ProjectDictionaryMappingTempField,
  type ProjectDictionaryMappingTempTable,
  type ProjectDictionaryMappingTempTableInput,
  type ProjectDictionaryMappingValidation,
  type ProjectDictionaryMappingValidationIssue,
  type ProjectDictionaryRectification,
  type ProjectDictionaryRectificationInput,
  type ProjectDictionaryRectificationPatch,
  type ProjectDictionaryFieldDetail,
  type ProjectDictionaryFieldPatch,
  type ProjectDictionaryFieldHit,
  type ProjectDictionarySystem,
  type ProjectDictionarySystemPatch,
  type ProjectDictionaryTable,
  type ProjectDictionaryTablePatch,
  type ProjectManagementModuleKey,
  type ProjectManagementRepo,
  type ProjectManagementSearchHit,
  type ProjectManagementSummary,
  type ProjectModuleItemInput,
  type ProjectModuleItemPatch,
  type ProjectModuleItem,
} from "./ProjectManagementRepo.js";
import {
  dictionaryFieldMatchesOwnContent,
  dictionaryTableMatchesOwnContent,
  dictionaryTableSearchScore,
  projectManagementSearchDestination,
} from "./projectManagementSearch.js";

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
  extra: Record<string, unknown> | null;
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
  verification_status: string | null;
  verification_remark: string | null;
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
  external_sql: string | null;
  remark: string | null;
  verification_status: string | null;
  verification_remark: string | null;
  sort_order: string | number;
  raw: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface MappingScenarioRow {
  id: string;
  project_id: string;
  table_id: string;
  title: string;
  caliber: string | null;
  caliber_external_sql: string | null;
  external_sql: string | null;
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

interface MappingTempTableRow {
  id: string;
  project_id: string;
  target_table_id: string;
  table_name: string;
  table_cn: string | null;
  logic_text: string | null;
  converted_sql: string | null;
  external_sql: string | null;
  remark: string | null;
  sort_order: string | number;
  raw: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface MappingTempFieldRow {
  id: string;
  project_id: string;
  temp_table_id: string;
  field_name: string;
  field_cn: string | null;
  field_type: string | null;
  field_length: string | null;
  logic_text: string | null;
  converted_sql: string | null;
  external_sql: string | null;
  remark: string | null;
  sort_order: string | number;
  raw: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface TableRow {
  id: string;
  system_id: string | null;
  table_name: string;
  table_cn: string | null;
  table_group: string | null;
  data_layer: string | null;
  table_type: string | null;
  source_kind: string | null;
  file_type: string | null;
  has_mapping: boolean;
  usage_status: string | null;
  verification_status: string | null;
  verification_remark: string | null;
  description: string | null;
  caliber: string | null;
  external_sql: string | null;
  extra: Record<string, unknown> | null;
  field_count: string | number;
  mapping_rule_count: string | number;
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
    // Dictionary entities are searched from their normalized tables below; legacy generic-index rows would duplicate them.
    const moduleHits = result.rows.filter(row => row.module_key !== "dictionary").map(row => ({
      id: row.id,
      moduleKey: row.module_key as ProjectManagementSearchHit["moduleKey"],
      entityType: row.entity_type,
      entityId: row.entity_id,
      title: row.title,
      subtitle: row.subtitle ?? undefined,
      excerpt: excerpt(row.body),
      score: Number(row.score),
      updatedAt: row.updated_at,
      destination: projectManagementSearchDestination({ moduleKey: row.module_key as ProjectManagementSearchHit["moduleKey"], entityType: row.entity_type, entityId: row.entity_id }),
    }));
    if (!q) return moduleHits;
    const tableHits = (await this.listDictionaryTables(projectId))
      .filter(table => dictionaryTableMatchesOwnContent(table, query))
      .map(table => ({
        id: `dictionary-table:${table.id}`,
        moduleKey: "dictionary" as const,
        entityType: "dictionaryTable",
        entityId: table.id,
        title: table.tableCn ? `${table.tableCn} · ${table.tableName}` : table.tableName,
        subtitle: [table.tableGroup, table.dataLayer, table.sourceKind].filter(Boolean).join(" / ") || undefined,
        excerpt: excerpt([table.description, table.caliber].filter(Boolean).join(" ")),
        score: dictionaryTableSearchScore(table, query),
        updatedAt: "",
        destination: projectManagementSearchDestination({ moduleKey: "dictionary", entityType: "dictionaryTable", entityId: table.id, systemId: table.systemId }),
      }));
    const matchedTableIds = new Set(tableHits.map(hit => hit.entityId));
    const dictionaryHits = (await this.searchDictionaryFields(projectId, query, boundedLimit))
      .filter(field => dictionaryFieldMatchesOwnContent(field, query) && !matchedTableIds.has(field.tableId ?? ""))
      .map(field => ({
      id: `dictionary-field:${field.id}`,
      moduleKey: "dictionary" as const,
      entityType: "dictionaryField",
      entityId: field.id,
      title: field.fieldCn ? `${field.fieldName} · ${field.fieldCn}` : field.fieldName,
      subtitle: [field.systemCode || field.systemName, field.tableCn || field.tableName].filter(Boolean).join(" / ") || undefined,
      excerpt: excerpt([field.description, field.codeValue, field.remark].filter(Boolean).join(" ")),
      score: field.fieldName.toLowerCase() === q.toLowerCase() ? 100 : field.fieldCn?.toLowerCase() === q.toLowerCase() ? 96 : Math.max(40, field.score),
      updatedAt: "",
      destination: projectManagementSearchDestination({ moduleKey: "dictionary", entityType: "dictionaryField", entityId: field.id, systemId: field.systemId, tableId: field.tableId }),
      }));
    return [...moduleHits, ...tableHits, ...dictionaryHits]
      .sort((left, right) => right.score - left.score || right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, boundedLimit);
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

  async listAllModuleItems(projectId: string, moduleKey: ProjectManagementModuleKey): Promise<ProjectModuleItem[]> {
    const result = await this.pg.query<ModuleItemRow>(
      `SELECT id, project_id, module_key, parent_id, title, subtitle, sort_order, content, created_at, updated_at
         FROM pm_module_items
        WHERE project_id = $1 AND module_key = $2
        ORDER BY sort_order ASC, updated_at DESC`,
      [projectId, moduleKey],
    );
    return result.rows.map(moduleItemFromRow);
  }

  async createModuleItem(projectId: string, input: ProjectModuleItemInput): Promise<ProjectModuleItem> {
    const now = new Date().toISOString();
    const id = `pm-item-${randomUUID()}`;
    const title = input.title.trim() || (input.moduleKey === "todos" ? "" : "未命名事项");
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
    const title = patch.title === undefined ? current.title : patch.title.trim() || (current.moduleKey === "todos" ? "" : "未命名事项");
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
         s.id, s.code, s.name, s.type, s.asset_layer, s.extra,
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
    return result.rows.map(row => projectDictionarySystemFromRow(row));
  }

  async updateDictionarySystem(projectId: string, systemId: string, patch: ProjectDictionarySystemPatch): Promise<ProjectDictionarySystem | null> {
    const current = await this.pg.query<SystemRow>(
      `SELECT id, code, name, type, asset_layer, extra, 0 AS table_count, 0 AS field_count
         FROM pm_data_systems
        WHERE project_id=$1 AND id=$2
        LIMIT 1`,
      [projectId, systemId],
    );
    const row = current.rows[0];
    if (!row) return null;
    const now = new Date().toISOString();
    const nextType = patch.type === undefined ? row.type : patch.type;
    const nextAssetLayer = patch.assetLayer === undefined ? row.asset_layer : patch.assetLayer;
    const nextExtra = patch.extra === undefined ? row.extra ?? {} : patch.extra ?? {};
    await this.pg.query(
      `UPDATE pm_data_systems
          SET type=$3, asset_layer=$4, extra=$5::jsonb, updated_at=$6
        WHERE project_id=$1 AND id=$2`,
      [projectId, systemId, nextType, nextAssetLayer, JSON.stringify(nextExtra), now],
    );
    const systems = await this.listDictionarySystems(projectId);
    return systems.find(system => system.id === systemId) ?? null;
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
         t.id, t.system_id, t.table_name, t.table_cn, t.table_group, t.data_layer, t.table_type, t.source_kind, t.file_type, t.has_mapping, t.usage_status, t.verification_status, t.verification_remark, t.description, t.caliber, t.external_sql, t.extra,
         COALESCE(fc.field_count, 0) AS field_count,
         COALESCE(mc.mapping_rule_count, 0) AS mapping_rule_count
       FROM pm_data_tables t
       LEFT JOIN (
         SELECT table_id, count(*) AS field_count
         FROM pm_data_fields
         WHERE project_id = $1
         GROUP BY table_id
       ) fc ON fc.table_id = t.id
       LEFT JOIN (
         SELECT table_id, count(*) AS mapping_rule_count
         FROM pm_mapping_rules
         WHERE project_id = $1
           AND status NOT IN ('cancelled', 'archived')
           AND NULLIF(btrim(logic_text), '') IS NOT NULL
         GROUP BY table_id
       ) mc ON mc.table_id = t.id
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
      tableType: row.table_type ?? undefined,
      sourceKind: row.source_kind ?? undefined,
      fileType: row.file_type ?? undefined,
      hasMapping: row.has_mapping,
      mappingStatus: dictionaryTableMappingStatus(row.has_mapping, Number(row.mapping_rule_count)),
      usageStatus: row.usage_status ?? undefined,
      verificationStatus: verificationStatus(row.verification_status),
      verificationRemark: row.verification_remark ?? undefined,
      description: row.description ?? undefined,
      caliber: row.caliber ?? undefined,
      externalSql: row.external_sql ?? (typeof row.extra?.externalSql === "string" ? row.extra.externalSql : undefined),
      extra: row.extra ?? undefined,
      fieldCount: Number(row.field_count),
    }));
  }

  async updateDictionaryTable(projectId: string, tableId: string, patch: ProjectDictionaryTablePatch): Promise<ProjectDictionaryTable | null> {
    const current = (await this.listDictionaryTables(projectId)).find(table => table.id === tableId);
    if (!current) return null;
    await this.pg.query(
      `UPDATE pm_data_tables
       SET system_id=$3, table_name=$4, table_cn=$5, table_group=$6, data_layer=$7, table_type=$8,
           source_kind=$9, file_type=$10, has_mapping=$11, usage_status=$12, verification_status=$13, verification_remark=$14, description=$15,
           caliber=$16, external_sql=$17, extra=$18::jsonb, updated_at=$19
       WHERE project_id=$1 AND id=$2`,
      [
        projectId,
        tableId,
        patch.systemId === undefined ? current.systemId ?? null : patch.systemId,
        patch.tableName ?? current.tableName,
        patch.tableCn === undefined ? current.tableCn ?? null : patch.tableCn,
        patch.tableGroup === undefined ? current.tableGroup ?? null : patch.tableGroup,
        patch.dataLayer === undefined ? current.dataLayer ?? null : patch.dataLayer,
        patch.tableType === undefined ? current.tableType ?? null : patch.tableType,
        patch.sourceKind === undefined ? current.sourceKind ?? null : patch.sourceKind,
        patch.fileType === undefined ? current.fileType ?? null : patch.fileType,
        patch.hasMapping ?? current.hasMapping,
        patch.usageStatus === undefined ? current.usageStatus ?? null : patch.usageStatus,
        patch.verificationStatus === undefined ? current.verificationStatus ?? "未验证" : patch.verificationStatus,
        patch.verificationRemark === undefined ? current.verificationRemark ?? null : patch.verificationRemark,
        patch.description === undefined ? current.description ?? null : patch.description,
        patch.caliber === undefined ? current.caliber ?? null : patch.caliber,
        patch.externalSql === undefined ? current.externalSql ?? null : patch.externalSql,
        JSON.stringify(patch.extra === undefined ? current.extra ?? {} : { ...current.extra, ...patch.extra }),
        new Date().toISOString(),
      ],
    );
    return (await this.listDictionaryTables(projectId)).find(table => table.id === tableId) ?? null;
  }

  async listDictionaryFields(projectId: string, tableId: string): Promise<ProjectDictionaryFieldHit[]> {
    const result = await this.pg.query<FieldRow>(
      `SELECT
         f.id, f.system_id, s.name AS system_name, s.code AS system_code,
         f.table_id, t.table_name, t.table_cn,
         f.field_name, f.field_cn, f.field_type, f.field_length, f.format_pattern, f.carrier_kind, f.field_order, f.source_field_order, f.description, f.acquire_logic, f.code_value, f.remark, f.verification_status, f.verification_remark, f.extra,
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
      acquireLogic: mappingSnippets.get(row.id) ?? (row.acquire_logic?.trim() ? row.acquire_logic : undefined),
      codeValue: row.code_value ?? undefined,
      ...codeSetFromRow(row),
      mappedTable: row.mapped_table ?? undefined,
      mappedField: row.mapped_field ?? undefined,
      mappedFieldCn: row.mapped_field_cn ?? undefined,
      remark: row.remark ?? undefined,
      verificationStatus: verificationStatus(row.verification_status),
      verificationRemark: row.verification_remark ?? undefined,
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
         f.data_source, f.remark, f.verification_status, f.verification_remark, f.extra,
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
      verificationStatus: verificationStatus(row.verification_status),
      verificationRemark: row.verification_remark ?? undefined,
      extra: row.extra ?? undefined,
      score: Number(row.score),
    };
  }

  async updateDictionaryField(projectId: string, fieldId: string, patch: ProjectDictionaryFieldPatch): Promise<ProjectDictionaryFieldDetail | null> {
    const current = await this.getDictionaryField(projectId, fieldId);
    if (!current) return null;
    const now = new Date().toISOString();
    await this.pg.query(
      `UPDATE pm_data_fields SET
         field_cn=$3, field_type=$4, field_length=$5, format_pattern=$6, nullable=$7,
         primary_key=$8, required=$9, description=$10, acquire_logic=$11, validation_rule=$12,
         code_value=$13, mapped_table=$14, mapped_field=$15, mapped_field_cn=$16,
         data_source=$17, remark=$18, verification_status=$19, verification_remark=$20, extra=$21::jsonb, updated_at=$22
       WHERE project_id=$1 AND id=$2`,
      [projectId, fieldId,
        patch.fieldCn === undefined ? current.fieldCn ?? null : patch.fieldCn,
        patch.fieldType === undefined ? current.fieldType ?? null : patch.fieldType,
        patch.fieldLength === undefined ? current.fieldLength ?? null : patch.fieldLength,
        patch.formatPattern === undefined ? current.formatPattern ?? null : patch.formatPattern,
        patch.nullable === undefined ? current.nullable ?? null : patch.nullable,
        patch.primaryKey ?? current.primaryKey, patch.required ?? current.required,
        patch.description === undefined ? current.description ?? null : patch.description,
        patch.acquireLogic === undefined ? current.acquireLogic ?? null : patch.acquireLogic,
        patch.validationRule === undefined ? current.validationRule ?? null : patch.validationRule,
        patch.codeValue === undefined ? current.codeValue ?? null : patch.codeValue,
        patch.mappedTable === undefined ? current.mappedTable ?? null : patch.mappedTable,
        patch.mappedField === undefined ? current.mappedField ?? null : patch.mappedField,
        patch.mappedFieldCn === undefined ? current.mappedFieldCn ?? null : patch.mappedFieldCn,
        patch.dataSource === undefined ? current.dataSource ?? null : patch.dataSource,
        patch.remark === undefined ? current.remark ?? null : patch.remark,
        patch.verificationStatus === undefined ? current.verificationStatus ?? "未验证" : patch.verificationStatus,
        patch.verificationRemark === undefined ? current.verificationRemark ?? null : patch.verificationRemark,
        JSON.stringify(patch.extra === undefined ? current.extra ?? {} : patch.extra), now],
    );
    return await this.getDictionaryField(projectId, fieldId);
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
              logic_text, converted_sql, external_sql, remark, verification_status, verification_remark, sort_order, raw, created_at, updated_at
         FROM pm_mapping_rules
        WHERE project_id = $1 AND table_id = $2
        ORDER BY sort_order ASC, id ASC`,
      [projectId, tableId],
    );
    return await this.hydrateMappingRules(projectId, result.rows);
  }

  async listDictionaryMappingScenarios(projectId: string, tableId: string): Promise<ProjectDictionaryMappingScenario[]> {
    const result = await this.pg.query<MappingScenarioRow>(
      `SELECT id, project_id, table_id, title, caliber, caliber_external_sql, external_sql, remark, sort_order, raw, created_at, updated_at
         FROM pm_mapping_scenarios WHERE project_id=$1 AND table_id=$2 ORDER BY sort_order, id`,
      [projectId, tableId],
    );
    return result.rows.map(row => ({ id: row.id, projectId: row.project_id, tableId: row.table_id, title: row.title, caliber: row.caliber ?? undefined, caliberExternalSql: row.caliber_external_sql ?? undefined, externalSql: row.external_sql ?? (typeof row.raw?.externalSql === "string" ? row.raw.externalSql : undefined), remark: row.remark ?? undefined, sortOrder: Number(row.sort_order), raw: row.raw ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at }));
  }

  async listDictionaryBusinessScenarios(projectId: string, libraryId?: string): Promise<ProjectDictionaryBusinessScenario[]> {
    const result = await this.pg.query(`SELECT * FROM pm_business_scenarios WHERE project_id=$1${libraryId ? " AND library_id=$2" : ""} ORDER BY sort_order,id`, libraryId ? [projectId, libraryId] : [projectId]);
    return Promise.all(result.rows.map(row => this.businessScenarioFromRow(row)));
  }
  async listDictionaryBusinessScenarioLibraries(projectId: string): Promise<ProjectDictionaryBusinessScenarioLibrary[]> { const result=await this.pg.query(`SELECT * FROM pm_business_scenario_libraries WHERE project_id=$1 ORDER BY name`,[projectId]); return result.rows.map((row:any)=>({id:row.id,projectId:row.project_id,name:row.name,dbType:row.db_type??undefined,sqlDialect:row.sql_dialect??undefined,connection:row.connection??undefined,createdAt:row.created_at,updatedAt:row.updated_at})); }
  async createDictionaryBusinessScenarioLibrary(projectId: string, input: ProjectDictionaryBusinessScenarioLibraryInput): Promise<ProjectDictionaryBusinessScenarioLibrary> { const id=input.id??`pm-business-library-${randomUUID()}`,now=new Date().toISOString(); await this.pg.query(`INSERT INTO pm_business_scenario_libraries (id,project_id,name,db_type,sql_dialect,connection,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$7)`,[id,projectId,input.name,input.dbType??null,input.sqlDialect??null,JSON.stringify(input.connection??{}),now]); return {id,projectId,name:input.name,dbType:input.dbType,sqlDialect:input.sqlDialect,connection:input.connection,createdAt:now,updatedAt:now}; }
  async updateDictionaryBusinessScenarioLibrary(projectId: string, libraryId: string, patch: Partial<ProjectDictionaryBusinessScenarioLibraryInput>): Promise<ProjectDictionaryBusinessScenarioLibrary | null> { const row=(await this.pg.query(`SELECT * FROM pm_business_scenario_libraries WHERE project_id=$1 AND id=$2`,[projectId,libraryId])).rows[0] as any; if(!row)return null; const now=new Date().toISOString(), connection=patch.connection??row.connection??{}; await this.pg.query(`UPDATE pm_business_scenario_libraries SET name=$3,db_type=$4,sql_dialect=$5,connection=$6::jsonb,updated_at=$7 WHERE project_id=$1 AND id=$2`,[projectId,libraryId,patch.name??row.name,patch.dbType===undefined?row.db_type:patch.dbType,patch.sqlDialect===undefined?row.sql_dialect:patch.sqlDialect,JSON.stringify(connection),now]); return {id:row.id,projectId,name:patch.name??row.name,dbType:patch.dbType===undefined?row.db_type??undefined:patch.dbType,sqlDialect:patch.sqlDialect===undefined?row.sql_dialect??undefined:patch.sqlDialect,connection,createdAt:row.created_at,updatedAt:now}; }
  async listDictionaryBusinessScenariosForTable(projectId: string, tableId: string): Promise<ProjectDictionaryBusinessScenario[]> {
    const result = await this.pg.query(`SELECT scenario.* FROM pm_business_scenarios scenario JOIN pm_business_scenario_tables relation ON relation.scenario_id=scenario.id WHERE scenario.project_id=$1 AND relation.table_id=$2 ORDER BY scenario.sort_order,scenario.id`, [projectId, tableId]);
    return Promise.all(result.rows.map(row => this.businessScenarioFromRow(row)));
  }
  async createDictionaryBusinessScenario(projectId: string, input: ProjectDictionaryBusinessScenarioInput): Promise<ProjectDictionaryBusinessScenario> {
    const id = input.id ?? `pm-business-scenario-${randomUUID()}`; const now = new Date().toISOString();
    await this.pg.query(`INSERT INTO pm_business_scenarios (id,project_id,library_id,title,procedure_name,external_location,sql_text,remark,sort_order,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`, [id,projectId,input.libraryId,input.title,input.procedureName,input.externalLocation ?? null,input.sqlText,input.remark ?? null,input.sortOrder ?? 0,now]);
    for (const [sortOrder, tableId] of input.tableIds.entries()) await this.pg.query(`INSERT INTO pm_business_scenario_tables (project_id,scenario_id,table_id,sort_order) VALUES ($1,$2,$3,$4)`, [projectId,id,tableId,sortOrder]);
    return (await this.listDictionaryBusinessScenarios(projectId)).find(item => item.id === id)!;
  }
  async updateDictionaryBusinessScenario(projectId: string, scenarioId: string, patch: ProjectDictionaryBusinessScenarioPatch): Promise<ProjectDictionaryBusinessScenario | null> { const current=(await this.pg.query(`SELECT * FROM pm_business_scenarios WHERE project_id=$1 AND id=$2`,[projectId,scenarioId])).rows[0]; if(!current)return null; const sqlChanged=patch.sqlText!==undefined&&patch.sqlText!==current.sql_text; const now=new Date().toISOString(); await this.pg.query(`UPDATE pm_business_scenarios SET title=$3,procedure_name=$4,external_location=$5,sql_text=$6,remark=$7,sort_order=$8,validation_status=$9,validation_sql_fingerprint=$10,validation_message=$11,validated_at=$12,updated_at=$13 WHERE project_id=$1 AND id=$2`,[projectId,scenarioId,patch.title??current.title,patch.procedureName??current.procedure_name,patch.externalLocation===undefined?current.external_location:patch.externalLocation,patch.sqlText??current.sql_text,patch.remark===undefined?current.remark:patch.remark,patch.sortOrder??current.sort_order,sqlChanged?"pending":patch.validationStatus??current.validation_status,sqlChanged?null:patch.validationSqlFingerprint===undefined?current.validation_sql_fingerprint:patch.validationSqlFingerprint,sqlChanged?null:patch.validationMessage===undefined?current.validation_message:patch.validationMessage,sqlChanged?null:patch.validatedAt===undefined?current.validated_at:patch.validatedAt,now]); if(patch.tableIds){await this.pg.query(`DELETE FROM pm_business_scenario_tables WHERE scenario_id=$1`,[scenarioId]);for(const [sortOrder,tableId] of patch.tableIds.entries())await this.pg.query(`INSERT INTO pm_business_scenario_tables (project_id,scenario_id,table_id,sort_order) VALUES ($1,$2,$3,$4)`,[projectId,scenarioId,tableId,sortOrder]);} return (await this.listDictionaryBusinessScenarios(projectId)).find(item=>item.id===scenarioId)??null; }
  async deleteDictionaryBusinessScenario(projectId: string, scenarioId: string): Promise<boolean> { return ((await this.pg.query(`DELETE FROM pm_business_scenarios WHERE project_id=$1 AND id=$2`,[projectId,scenarioId])).rowCount??0)>0; }
  private async businessScenarioFromRow(row: any): Promise<ProjectDictionaryBusinessScenario> { const relations=await this.pg.query(`SELECT table_id FROM pm_business_scenario_tables WHERE scenario_id=$1 ORDER BY sort_order`,[row.id]); return {id:row.id,projectId:row.project_id,libraryId:row.library_id,title:row.title,procedureName:row.procedure_name,externalLocation:row.external_location??undefined,sqlText:row.sql_text,remark:row.remark??undefined,sortOrder:Number(row.sort_order),tableIds:relations.rows.map((item:any)=>item.table_id),validationStatus:row.validation_status,validationSqlFingerprint:row.validation_sql_fingerprint??undefined,validationMessage:row.validation_message??undefined,validatedAt:row.validated_at??undefined,createdAt:row.created_at,updatedAt:row.updated_at}; }

  async createDictionaryMappingScenario(projectId: string, input: ProjectDictionaryMappingScenarioInput): Promise<ProjectDictionaryMappingScenario> {
    const now = new Date().toISOString();
    const id = input.id ?? `pm-map-scenario-${randomUUID()}`;
    const result = await this.pg.query<MappingScenarioRow>(
      `INSERT INTO pm_mapping_scenarios (id, project_id, table_id, title, caliber, remark, sort_order, raw, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$9)
       RETURNING id, project_id, table_id, title, caliber, caliber_external_sql, external_sql, remark, sort_order, raw, created_at, updated_at`,
      [id, projectId, input.tableId, input.title, input.caliber ?? null, input.remark ?? null, input.sortOrder ?? 0, JSON.stringify(input.raw ?? {}), now],
    );
    const row = result.rows[0];
    return { id: row.id, projectId: row.project_id, tableId: row.table_id, title: row.title, caliber: row.caliber ?? undefined, caliberExternalSql: row.caliber_external_sql ?? undefined, externalSql: row.external_sql ?? undefined, remark: row.remark ?? undefined, sortOrder: Number(row.sort_order), raw: row.raw ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at };
  }

  async updateDictionaryMappingScenario(projectId: string, scenarioId: string, patch: ProjectDictionaryMappingScenarioPatch): Promise<ProjectDictionaryMappingScenario | null> {
    const existing = await this.pg.query<MappingScenarioRow>(`SELECT id, project_id, table_id, title, caliber, caliber_external_sql, external_sql, remark, sort_order, raw, created_at, updated_at FROM pm_mapping_scenarios WHERE project_id=$1 AND id=$2`, [projectId, scenarioId]);
    const current = existing.rows[0];
    if (!current) return null;
    const result = await this.pg.query<MappingScenarioRow>(
      `UPDATE pm_mapping_scenarios SET title=$3, caliber=$4, caliber_external_sql=$5, external_sql=$6, remark=$7, sort_order=$8, raw=$9::jsonb, updated_at=$10
        WHERE project_id=$1 AND id=$2
        RETURNING id, project_id, table_id, title, caliber, caliber_external_sql, external_sql, remark, sort_order, raw, created_at, updated_at`,
      [projectId, scenarioId, patch.title ?? current.title, patch.caliber === undefined ? current.caliber : patch.caliber, patch.caliberExternalSql === undefined ? current.caliber_external_sql : patch.caliberExternalSql, patch.externalSql === undefined ? current.external_sql : patch.externalSql, patch.remark === undefined ? current.remark : patch.remark, patch.sortOrder ?? current.sort_order, JSON.stringify({ ...(current.raw ?? {}), ...(patch.raw ?? {}) }), new Date().toISOString()],
    );
    const row = result.rows[0];
    return row ? { id: row.id, projectId: row.project_id, tableId: row.table_id, title: row.title, caliber: row.caliber ?? undefined, caliberExternalSql: row.caliber_external_sql ?? undefined, externalSql: row.external_sql ?? undefined, remark: row.remark ?? undefined, sortOrder: Number(row.sort_order), raw: row.raw ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at } : null;
  }

  async deleteDictionaryMappingScenario(projectId: string, scenarioId: string): Promise<boolean> {
    await this.pg.query(`UPDATE pm_mapping_rules SET scenario_id=NULL WHERE project_id=$1 AND scenario_id=$2`, [projectId, scenarioId]);
    const result = await this.pg.query(`DELETE FROM pm_mapping_scenarios WHERE project_id=$1 AND id=$2`, [projectId, scenarioId]);
    return (result.rowCount ?? 0) > 0;
  }

  async getDictionaryMappingRule(projectId: string, mappingRuleId: string): Promise<ProjectDictionaryMappingRule | null> {
    const result = await this.pg.query<MappingRuleRow>(
      `SELECT id, project_id, scenario_id, system_id, table_id, field_id, status,
              logic_text, converted_sql, external_sql, remark, verification_status, verification_remark, sort_order, raw, created_at, updated_at
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
              logic_text, converted_sql, external_sql, remark, verification_status, verification_remark, sort_order, raw, created_at, updated_at
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
              logic_text = $8, converted_sql = $9, external_sql = $10, remark = $11, verification_status = $12, verification_remark = $13, sort_order = $14,
              raw = $15::jsonb, updated_at = $16
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
        patch.externalSql === undefined ? current.external_sql : patch.externalSql,
        patch.remark === undefined ? current.remark : patch.remark,
        patch.verificationStatus === undefined ? current.verification_status ?? "未验证" : patch.verificationStatus,
        patch.verificationRemark === undefined ? current.verification_remark : patch.verificationRemark,
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

  async listDictionaryMappingTempTables(projectId: string, targetTableId: string): Promise<ProjectDictionaryMappingTempTable[]> {
    const result = await this.pg.query<MappingTempTableRow>(
      `SELECT id, project_id, target_table_id, table_name, table_cn, logic_text, converted_sql, external_sql,
              remark, sort_order, raw, created_at, updated_at
         FROM pm_mapping_temp_tables
        WHERE project_id = $1 AND target_table_id = $2
        ORDER BY sort_order ASC, id ASC`,
      [projectId, targetTableId],
    );
    return await this.hydrateMappingTempTables(projectId, result.rows);
  }

  async replaceDictionaryMappingTempTables(
    projectId: string,
    targetTableId: string,
    tempTables: ProjectDictionaryMappingTempTableInput[],
  ): Promise<ProjectDictionaryMappingTempTable[]> {
    const now = new Date().toISOString();
    await this.pg.query(`DELETE FROM pm_mapping_temp_tables WHERE project_id = $1 AND target_table_id = $2`, [projectId, targetTableId]);
    for (let tableIndex = 0; tableIndex < tempTables.length; tableIndex += 1) {
      const tempTable = tempTables[tableIndex];
      const tableId = tempTable.id ?? `pm-map-temp-table-${randomUUID()}`;
      await this.pg.query(
        `INSERT INTO pm_mapping_temp_tables (
           id, project_id, target_table_id, table_name, table_cn, logic_text, converted_sql, external_sql,
           remark, sort_order, raw, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$12)`,
        [
          tableId,
          projectId,
          targetTableId,
          tempTable.tableName,
          tempTable.tableCn ?? null,
          tempTable.logicText ?? null,
          tempTable.convertedSql ?? null,
          tempTable.externalSql ?? null,
          tempTable.remark ?? null,
          tempTable.sortOrder ?? tableIndex,
          JSON.stringify(tempTable.raw ?? {}),
          now,
        ],
      );
      for (let fieldIndex = 0; fieldIndex < (tempTable.fields ?? []).length; fieldIndex += 1) {
        const field = tempTable.fields?.[fieldIndex];
        if (!field) continue;
        await this.pg.query(
          `INSERT INTO pm_mapping_temp_fields (
             id, project_id, temp_table_id, field_name, field_cn, field_type, field_length,
             logic_text, converted_sql, external_sql, remark, sort_order, raw, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$14)`,
          [
            field.id ?? `pm-map-temp-field-${randomUUID()}`,
            projectId,
            tableId,
            field.fieldName,
            field.fieldCn ?? null,
            field.fieldType ?? null,
            field.fieldLength ?? null,
            field.logicText ?? null,
            field.convertedSql ?? null,
            field.externalSql ?? null,
            field.remark ?? null,
            field.sortOrder ?? fieldIndex,
            JSON.stringify(field.raw ?? {}),
            now,
          ],
        );
      }
    }
    return await this.listDictionaryMappingTempTables(projectId, targetTableId);
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

  private async hydrateMappingTempTables(projectId: string, rows: MappingTempTableRow[]): Promise<ProjectDictionaryMappingTempTable[]> {
    if (rows.length === 0) return [];
    const ids = rows.map(row => row.id);
    const fieldResult = await this.pg.query<MappingTempFieldRow>(
      `SELECT id, project_id, temp_table_id, field_name, field_cn, field_type, field_length,
              logic_text, converted_sql, external_sql, remark, sort_order, raw, created_at, updated_at
         FROM pm_mapping_temp_fields
        WHERE project_id = $1 AND temp_table_id = ANY($2::text[])
        ORDER BY sort_order ASC, id ASC`,
      [projectId, ids],
    );
    const fieldsByTable = groupBy(fieldResult.rows.map(mappingTempFieldFromRow), field => field.tempTableId);
    return rows.map(row => mappingTempTableFromRow(row, fieldsByTable.get(row.id) ?? []));
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
    externalSql: row.external_sql ?? (typeof row.raw?.externalSql === "string" ? row.raw.externalSql : undefined),
    remark: row.remark ?? undefined,
    verificationStatus: verificationStatus(row.verification_status),
    verificationRemark: row.verification_remark ?? undefined,
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

function mappingTempTableFromRow(row: MappingTempTableRow, fields: ProjectDictionaryMappingTempField[]): ProjectDictionaryMappingTempTable {
  return {
    id: row.id,
    projectId: row.project_id,
    targetTableId: row.target_table_id,
    tableName: row.table_name,
    tableCn: row.table_cn ?? undefined,
    logicText: row.logic_text ?? undefined,
    convertedSql: row.converted_sql ?? undefined,
    externalSql: row.external_sql ?? (typeof row.raw?.externalSql === "string" ? row.raw.externalSql : undefined),
    remark: row.remark ?? undefined,
    sortOrder: Number(row.sort_order),
    raw: row.raw ?? undefined,
    fields,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mappingTempFieldFromRow(row: MappingTempFieldRow): ProjectDictionaryMappingTempField {
  return {
    id: row.id,
    projectId: row.project_id,
    tempTableId: row.temp_table_id,
    fieldName: row.field_name,
    fieldCn: row.field_cn ?? undefined,
    fieldType: row.field_type ?? undefined,
    fieldLength: row.field_length ?? undefined,
    logicText: row.logic_text ?? undefined,
    convertedSql: row.converted_sql ?? undefined,
    externalSql: row.external_sql ?? (typeof row.raw?.externalSql === "string" ? row.raw.externalSql : undefined),
    remark: row.remark ?? undefined,
    sortOrder: Number(row.sort_order),
    raw: row.raw ?? undefined,
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

function verificationStatus(value?: string | null): "未验证" | "已验证" | "待整改" | "外部SQL验证无误" | "Mapping逻辑核对一致" | "双跑核对无误" {
  return value === "已验证" || value === "待整改" || value === "外部SQL验证无误" || value === "Mapping逻辑核对一致" || value === "双跑核对无误" ? value : "未验证";
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
