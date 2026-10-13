import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
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
  type ProjectDictionaryFieldHit,
  type ProjectDictionaryFieldPatch,
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
  count: number;
}

interface DictionaryCountsRow {
  systems: number;
  tables: number;
  fields: number;
}

interface SearchRow {
  id: string;
  module_key: string;
  entity_type: string;
  entity_id: string;
  title: string;
  subtitle: string | null;
  body: string | null;
  score: number;
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
  content: string | null;
  created_at: string;
  updated_at: string;
}

interface SystemRow {
  id: string;
  code: string | null;
  name: string;
  type: string | null;
  asset_layer: string | null;
  extra: string | null;
  field_count: number;
  table_count: number;
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
  field_order: number | null;
  source_field_order: number | null;
  description: string | null;
  acquire_logic: string | null;
  code_value: string | null;
  remark: string | null;
  verification_status: string | null;
  verification_remark: string | null;
  mapped_table: string | null;
  mapped_field: string | null;
  mapped_field_cn?: string | null;
  extra?: string | null;
  score: number;
}

interface MappingDisplayRow {
  field_id: string | null;
  scenario: string | null;
  condition: string | null;
  logic_text: string | null;
  converted_sql: string | null;
  external_sql: string | null;
  standard_logic: string | null;
  remark: string | null;
  refs: string | null;
  sort_order: number;
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
  sort_order: number;
  raw: string | null;
  created_at: string;
  updated_at: string;
}

interface MappingScenarioRow {
  id: string; project_id: string; table_id: string; title: string; caliber: string | null; caliber_external_sql: string | null; external_sql: string | null; remark: string | null;
  sort_order: number; raw: string | null; created_at: string; updated_at: string;
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
  sort_order: number;
  raw: string | null;
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
  sort_order: number;
  raw: string | null;
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
  sort_order: number;
  raw: string | null;
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
  sort_order: number;
  raw: string | null;
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
  has_mapping: number;
  usage_status: string | null;
  verification_status: string | null;
  verification_remark: string | null;
  description: string | null;
  caliber: string | null;
  external_sql: string | null;
  extra: string | null;
  field_count: number;
  mapping_rule_count: number;
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
  primary_key: number | null;
  required: number | null;
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
  extra: string | null;
}

export class SqliteProjectManagementRepo implements ProjectManagementRepo {
  constructor(private readonly db: Database.Database) {}

  async getSummary(projectId: string): Promise<ProjectManagementSummary> {
    const moduleCounts = this.db.prepare(
      `SELECT module_key AS key, count(*) AS count
         FROM pm_module_items
        WHERE project_id = ?
        GROUP BY module_key`,
    ).all(projectId) as CountRow[];
    const dictionary = this.db.prepare(
      `SELECT
         (SELECT count(*) FROM pm_data_systems WHERE project_id = ?) AS systems,
         (SELECT count(*) FROM pm_data_tables WHERE project_id = ?) AS tables,
         (SELECT count(*) FROM pm_data_fields WHERE project_id = ?) AS fields`,
    ).get(projectId, projectId, projectId) as DictionaryCountsRow | undefined;
    const counts = new Map(moduleCounts.map(row => [row.key, row.count]));
    const d = dictionary ?? { systems: 0, tables: 0, fields: 0 };
    return {
      projectId,
      modules: PROJECT_MANAGEMENT_MODULES.map(module => ({
        ...module,
        count: module.key === "dictionary" ? d.fields : counts.get(module.key) ?? 0,
      })),
      dictionary: d,
    };
  }

  async searchAll(projectId: string, query: string, limit: number): Promise<ProjectManagementSearchHit[]> {
    const q = query.trim().toLowerCase();
    const like = `%${q}%`;
    const boundedLimit = Math.max(1, Math.min(limit, 80));
    const rows = this.db.prepare(
      `SELECT
         id, module_key, entity_type, entity_id, title, subtitle, body, updated_at,
         CASE
           WHEN lower(title) = ? THEN 100
           WHEN lower(coalesce(subtitle, '')) = ? THEN 82
           WHEN lower(title) LIKE ? THEN 70
           ELSE 30
         END AS score
       FROM pm_search_index
       WHERE project_id = ?
       ${q ? "AND lower(search_text) LIKE ?" : ""}
       ORDER BY score DESC, updated_at DESC
       LIMIT ?`,
    ).all(...(q ? [q, q, like, projectId, like, boundedLimit] : ["", "", "", projectId, boundedLimit])) as SearchRow[];
    // Dictionary entities are searched from their normalized tables below; legacy generic-index rows would duplicate them.
    const moduleHits = rows.filter(row => row.module_key !== "dictionary").map(row => ({
      id: row.id,
      moduleKey: row.module_key as ProjectManagementSearchHit["moduleKey"],
      entityType: row.entity_type,
      entityId: row.entity_id,
      title: row.title,
      subtitle: row.subtitle ?? undefined,
      excerpt: excerpt(row.body),
      score: row.score,
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
      score: field.fieldName.toLowerCase() === q ? 100 : field.fieldCn?.toLowerCase() === q ? 96 : Math.max(40, field.score),
      updatedAt: "",
      destination: projectManagementSearchDestination({ moduleKey: "dictionary", entityType: "dictionaryField", entityId: field.id, systemId: field.systemId, tableId: field.tableId }),
      }));
    return [...moduleHits, ...tableHits, ...dictionaryHits]
      .sort((left, right) => right.score - left.score || right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, boundedLimit);
  }

  async listModuleItems(projectId: string, moduleKey: ProjectManagementModuleKey, parentId?: string): Promise<ProjectModuleItem[]> {
    const rows = this.db.prepare(
      `SELECT id, project_id, module_key, parent_id, title, subtitle, sort_order, content, created_at, updated_at
         FROM pm_module_items
        WHERE project_id = ? AND module_key = ?
          ${parentId ? "AND parent_id = ?" : "AND parent_id IS NULL"}
        ORDER BY sort_order ASC, updated_at DESC`,
    ).all(...(parentId ? [projectId, moduleKey, parentId] : [projectId, moduleKey])) as ModuleItemRow[];
    return rows.map(moduleItemFromRow);
  }

  async listAllModuleItems(projectId: string, moduleKey: ProjectManagementModuleKey): Promise<ProjectModuleItem[]> {
    const rows = this.db.prepare(
      `SELECT id, project_id, module_key, parent_id, title, subtitle, sort_order, content, created_at, updated_at
         FROM pm_module_items
        WHERE project_id = ? AND module_key = ?
        ORDER BY sort_order ASC, updated_at DESC`,
    ).all(projectId, moduleKey) as ModuleItemRow[];
    return rows.map(moduleItemFromRow);
  }

  async createModuleItem(projectId: string, input: ProjectModuleItemInput): Promise<ProjectModuleItem> {
    const now = new Date().toISOString();
    const id = `pm-item-${randomUUID()}`;
    const title = input.title.trim() || (input.moduleKey === "todos" ? "" : "未命名事项");
    const content = input.content ?? {};
    this.db.prepare(
      `INSERT INTO pm_module_items (id, project_id, module_key, parent_id, title, subtitle, sort_order, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, projectId, input.moduleKey, input.parentId ?? null, title, input.subtitle ?? null, input.sortOrder ?? 0, JSON.stringify(content), now, now);
    this.upsertModuleItemSearch({ id, projectId, moduleKey: input.moduleKey, title, subtitle: input.subtitle ?? "", content, now });
    const item = this.getModuleItem(projectId, id);
    if (!item) throw new Error("created module item not found");
    return item;
  }

  async updateModuleItem(projectId: string, itemId: string, patch: ProjectModuleItemPatch): Promise<ProjectModuleItem | null> {
    const current = this.getModuleItem(projectId, itemId);
    if (!current) return null;
    const now = new Date().toISOString();
    const title = patch.title === undefined ? current.title : patch.title.trim() || (current.moduleKey === "todos" ? "" : "未命名事项");
    const subtitle = patch.subtitle === undefined ? current.subtitle ?? null : patch.subtitle ?? null;
    const parentId = patch.parentId === undefined ? current.parentId ?? null : patch.parentId ?? null;
    const sortOrder = patch.sortOrder === undefined ? current.sortOrder : patch.sortOrder;
    const content = patch.content ?? current.content;
    this.db.prepare(
      `UPDATE pm_module_items
          SET parent_id=?, title=?, subtitle=?, sort_order=?, content=?, updated_at=?
        WHERE project_id=? AND id=?`,
    ).run(parentId, title, subtitle, sortOrder, JSON.stringify(content), now, projectId, itemId);
    this.upsertModuleItemSearch({ id: itemId, projectId, moduleKey: current.moduleKey, title, subtitle: subtitle ?? "", content, now });
    return this.getModuleItem(projectId, itemId);
  }

  async deleteModuleItem(projectId: string, itemId: string): Promise<boolean> {
    const result = this.db.prepare(
      `DELETE FROM pm_module_items WHERE project_id=? AND id=?`,
    ).run(projectId, itemId);
    this.db.prepare(
      `DELETE FROM pm_search_index WHERE project_id=? AND entity_type='moduleItem' AND entity_id=?`,
    ).run(projectId, itemId);
    return result.changes > 0;
  }

  async reorderModuleItems(projectId: string, moduleKey: ProjectManagementModuleKey, itemIds: string[]): Promise<void> {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(
      `UPDATE pm_module_items
          SET sort_order=?, updated_at=?
        WHERE project_id=? AND module_key=? AND id=?`,
    );
    const tx = this.db.transaction((ids: string[]) => {
      ids.forEach((id, index) => stmt.run(index, now, projectId, moduleKey, id));
    });
    tx(itemIds);
  }

  async listDictionarySystems(projectId: string): Promise<ProjectDictionarySystem[]> {
    const rows = this.db.prepare(
      `SELECT
         s.id, s.code, s.name, s.type, s.asset_layer, s.extra,
         coalesce(tc.table_count, 0) AS table_count,
         coalesce(fc.field_count, 0) AS field_count
       FROM pm_data_systems s
       LEFT JOIN (
         SELECT system_id, count(*) AS table_count
         FROM pm_data_tables
         WHERE project_id = ?
         GROUP BY system_id
       ) tc ON tc.system_id = s.id
       LEFT JOIN (
         SELECT system_id, count(*) AS field_count
         FROM pm_data_fields
         WHERE project_id = ?
         GROUP BY system_id
       ) fc ON fc.system_id = s.id
       WHERE s.project_id = ?
      ORDER BY s.name ASC`,
    ).all(projectId, projectId, projectId) as SystemRow[];
    return rows.map(row => projectDictionarySystemFromRow(row));
  }

  async updateDictionarySystem(projectId: string, systemId: string, patch: ProjectDictionarySystemPatch): Promise<ProjectDictionarySystem | null> {
    const current = this.db.prepare(
      `SELECT id, code, name, type, asset_layer, extra, 0 AS table_count, 0 AS field_count
         FROM pm_data_systems
        WHERE project_id=? AND id=?
        LIMIT 1`,
    ).get(projectId, systemId) as SystemRow | undefined;
    if (!current) return null;
    const now = new Date().toISOString();
    const nextType = patch.type === undefined ? current.type : patch.type;
    const nextAssetLayer = patch.assetLayer === undefined ? current.asset_layer : patch.assetLayer;
    const nextExtra = patch.extra === undefined ? current.extra : JSON.stringify(patch.extra ?? {});
    this.db.prepare(
      `UPDATE pm_data_systems
          SET type=?, asset_layer=?, extra=?, updated_at=?
        WHERE project_id=? AND id=?`,
    ).run(nextType, nextAssetLayer, nextExtra, now, projectId, systemId);
    const systems = await this.listDictionarySystems(projectId);
    return systems.find(system => system.id === systemId) ?? null;
  }

  private getModuleItem(projectId: string, itemId: string): ProjectModuleItem | null {
    const row = this.db.prepare(
      `SELECT id, project_id, module_key, parent_id, title, subtitle, sort_order, content, created_at, updated_at
         FROM pm_module_items
        WHERE project_id=? AND id=?
        LIMIT 1`,
    ).get(projectId, itemId) as ModuleItemRow | undefined;
    return row ? moduleItemFromRow(row) : null;
  }

  private upsertModuleItemSearch(input: {
    id: string;
    projectId: string;
    moduleKey: ProjectManagementModuleKey;
    title: string;
    subtitle?: string;
    content: Record<string, unknown>;
    now: string;
  }): void {
    const body = flattenText(input.content).slice(0, 4000);
    const searchText = [input.title, input.subtitle, body].filter(Boolean).join("\n");
    this.db.prepare(
      `INSERT INTO pm_search_index (id, project_id, module_key, entity_type, entity_id, title, subtitle, body, keywords, search_text, updated_at)
       VALUES (?, ?, ?, 'moduleItem', ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id, entity_type, entity_id) DO UPDATE SET
         title=excluded.title,
         subtitle=excluded.subtitle,
         body=excluded.body,
         keywords=excluded.keywords,
         search_text=excluded.search_text,
         updated_at=excluded.updated_at`,
    ).run(`${input.id}:search`, input.projectId, input.moduleKey, input.id, input.title, input.subtitle ?? null, body, input.moduleKey, searchText, input.now);
  }

  async listDictionaryTables(projectId: string, systemId?: string): Promise<ProjectDictionaryTable[]> {
    const rows = this.db.prepare(
      `SELECT
         t.id, t.system_id, t.table_name, t.table_cn, t.table_group, t.data_layer, t.table_type, t.source_kind, t.file_type, t.has_mapping, t.usage_status, t.verification_status, t.verification_remark, t.description, t.caliber, t.external_sql, t.extra,
         coalesce(fc.field_count, 0) AS field_count,
         coalesce(mc.mapping_rule_count, 0) AS mapping_rule_count
       FROM pm_data_tables t
       LEFT JOIN (
         SELECT table_id, count(*) AS field_count
         FROM pm_data_fields
         WHERE project_id = ?
         GROUP BY table_id
       ) fc ON fc.table_id = t.id
       LEFT JOIN (
         SELECT table_id, count(*) AS mapping_rule_count
         FROM pm_mapping_rules
         WHERE project_id = ?
           AND status NOT IN ('cancelled', 'archived')
           AND nullif(trim(logic_text), '') IS NOT NULL
         GROUP BY table_id
       ) mc ON mc.table_id = t.id
       WHERE t.project_id = ?
       ${systemId ? "AND t.system_id = ?" : ""}
       ORDER BY coalesce(t.table_cn, t.table_name) ASC, t.table_name ASC`,
    ).all(...(systemId ? [projectId, projectId, projectId, systemId] : [projectId, projectId, projectId])) as TableRow[];
    return rows.map(row => ({
      id: row.id,
      systemId: row.system_id ?? undefined,
      tableName: row.table_name,
      tableCn: row.table_cn ?? undefined,
      tableGroup: row.table_group ?? undefined,
      dataLayer: row.data_layer ?? undefined,
      tableType: row.table_type ?? undefined,
      sourceKind: row.source_kind ?? undefined,
      fileType: row.file_type ?? undefined,
      hasMapping: Boolean(row.has_mapping),
      mappingStatus: dictionaryTableMappingStatus(Boolean(row.has_mapping), Number(row.mapping_rule_count)),
      usageStatus: row.usage_status ?? undefined,
      verificationStatus: verificationStatus(row.verification_status),
      verificationRemark: row.verification_remark ?? undefined,
      description: row.description ?? undefined,
      caliber: row.caliber ?? undefined,
      externalSql: row.external_sql ?? (typeof parseJsonObject(row.extra)?.externalSql === "string" ? parseJsonObject(row.extra)?.externalSql as string : undefined),
      extra: parseJsonObject(row.extra),
      fieldCount: row.field_count,
    }));
  }

  async updateDictionaryTable(projectId: string, tableId: string, patch: ProjectDictionaryTablePatch): Promise<ProjectDictionaryTable | null> {
    const current = (await this.listDictionaryTables(projectId)).find(table => table.id === tableId);
    if (!current) return null;
    this.db.prepare(
      `UPDATE pm_data_tables SET
         system_id=?, table_name=?, table_cn=?, table_group=?, data_layer=?, table_type=?,
         source_kind=?, file_type=?, has_mapping=?, usage_status=?, verification_status=?, verification_remark=?, description=?, caliber=?, external_sql=?,
         extra=?, updated_at=?
       WHERE project_id=? AND id=?`,
    ).run(
      patch.systemId === undefined ? current.systemId ?? null : patch.systemId,
      patch.tableName ?? current.tableName,
      patch.tableCn === undefined ? current.tableCn ?? null : patch.tableCn,
      patch.tableGroup === undefined ? current.tableGroup ?? null : patch.tableGroup,
      patch.dataLayer === undefined ? current.dataLayer ?? null : patch.dataLayer,
      patch.tableType === undefined ? current.tableType ?? null : patch.tableType,
      patch.sourceKind === undefined ? current.sourceKind ?? null : patch.sourceKind,
      patch.fileType === undefined ? current.fileType ?? null : patch.fileType,
      Number(patch.hasMapping ?? current.hasMapping),
      patch.usageStatus === undefined ? current.usageStatus ?? null : patch.usageStatus,
      patch.verificationStatus === undefined ? current.verificationStatus ?? "未验证" : patch.verificationStatus,
      patch.verificationRemark === undefined ? current.verificationRemark ?? null : patch.verificationRemark,
      patch.description === undefined ? current.description ?? null : patch.description,
      patch.caliber === undefined ? current.caliber ?? null : patch.caliber,
      patch.externalSql === undefined ? current.externalSql ?? null : patch.externalSql,
      JSON.stringify(patch.extra === undefined ? current.extra ?? {} : { ...current.extra, ...patch.extra }),
      new Date().toISOString(),
      projectId,
      tableId,
    );
    return (await this.listDictionaryTables(projectId)).find(table => table.id === tableId) ?? null;
  }

  async listDictionaryFields(projectId: string, tableId: string): Promise<ProjectDictionaryFieldHit[]> {
    const rows = this.db.prepare(
      `SELECT
         f.id, f.system_id, s.name AS system_name, s.code AS system_code,
         f.table_id, t.table_name, t.table_cn,
         f.field_name, f.field_cn, f.field_type, f.field_length, f.format_pattern, f.carrier_kind, f.field_order, f.source_field_order, f.description, f.acquire_logic, f.code_value, f.remark, f.verification_status, f.verification_remark, f.extra,
         f.mapped_table, f.mapped_field, f.mapped_field_cn,
         50 AS score
       FROM pm_data_fields f
       LEFT JOIN pm_data_systems s ON s.id = f.system_id
       LEFT JOIN pm_data_tables t ON t.id = f.table_id
       WHERE f.project_id = ? AND f.table_id = ?
       ORDER BY
         CASE WHEN s.code = 'SAFE_SOURCE' THEN COALESCE(f.source_field_order, 2147483647) ELSE COALESCE(f.field_order, 2147483647) END ASC,
         f.created_at ASC,
         f.id ASC`,
    ).all(projectId, tableId) as FieldRow[];
    const mappingSnippets = this.dictionaryMappingSnippetsByField(projectId, tableId);
    return rows.map(row => ({
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
      fieldOrder: row.field_order ?? undefined,
      sourceFieldOrder: row.source_field_order ?? undefined,
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
      extra: parseJsonObject(row.extra),
      score: row.score,
    }));
  }

  private dictionaryMappingSnippetsByField(projectId: string, tableId: string): Map<string, string> {
    const rows = this.db.prepare(
      `SELECT
         mr.field_id,
         json_extract(mr.raw, '$.scenario') AS scenario,
         json_extract(mr.raw, '$.condition') AS condition,
         mr.logic_text,
         mr.converted_sql,
         json_extract(mr.raw, '$.standardLogic') AS standard_logic,
         mr.remark,
         COALESCE(group_concat(msf.ref_path, '、'), '') AS refs,
         mr.sort_order
       FROM pm_mapping_rules mr
       LEFT JOIN pm_mapping_source_fields msf ON msf.project_id = mr.project_id AND msf.mapping_rule_id = mr.id
       WHERE mr.project_id = ? AND mr.table_id = ? AND mr.field_id IS NOT NULL
       GROUP BY mr.id, mr.field_id, mr.raw, mr.logic_text, mr.converted_sql, mr.remark, mr.sort_order
       ORDER BY mr.sort_order, mr.id`,
    ).all(projectId, tableId) as MappingDisplayRow[];
    return mappingRowsToFieldSnippets(rows);
  }

  async resolveDictionaryFieldRefs(projectId: string, refs: string[]): Promise<ProjectDictionaryFieldHit[]> {
    const tokens = dictionaryRefTokens(refs);
    if (tokens.length === 0) return [];
    const placeholders = tokens.map(() => "?").join(",");
    const rows = this.db.prepare(
      `SELECT
         f.id, f.system_id, s.name AS system_name, s.code AS system_code,
         f.table_id, t.table_name, t.table_cn,
         f.field_name, f.field_cn, f.field_type, f.field_length, f.format_pattern, f.carrier_kind, f.description, f.acquire_logic, f.code_value, f.remark,
         f.mapped_table, f.mapped_field, f.mapped_field_cn,
         70 AS score
       FROM pm_data_fields f
       LEFT JOIN pm_data_systems s ON s.id = f.system_id
       LEFT JOIN pm_data_tables t ON t.id = f.table_id
       WHERE f.project_id = ?
         AND (
           lower(f.field_name) IN (${placeholders})
           OR lower(coalesce(f.field_cn, '')) IN (${placeholders})
           OR lower(coalesce(t.table_name, '')) IN (${placeholders})
           OR lower(coalesce(t.table_cn, '')) IN (${placeholders})
           OR lower(coalesce(t.table_name, '') || '.' || f.field_name) IN (${placeholders})
           OR lower(coalesce(t.table_cn, '') || '.' || f.field_name) IN (${placeholders})
           OR lower(coalesce(t.table_name, '') || '.' || coalesce(f.mapped_field, '')) IN (${placeholders})
           OR lower(coalesce(t.table_cn, '') || '.' || coalesce(f.mapped_field, '')) IN (${placeholders})
           OR lower(coalesce(s.code, '') || '.' || coalesce(t.table_name, '') || '.' || f.field_name) IN (${placeholders})
           OR lower(coalesce(s.code, '') || '.' || coalesce(t.table_name, '') || '.' || coalesce(f.mapped_field, '')) IN (${placeholders})
         )
       ORDER BY f.updated_at DESC
       LIMIT 500`,
    ).all(projectId, ...tokens, ...tokens, ...tokens, ...tokens, ...tokens, ...tokens, ...tokens, ...tokens, ...tokens, ...tokens) as FieldRow[];
    return rows.map(row => ({
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
      score: row.score,
    }));
  }

  async searchDictionaryFields(projectId: string, query: string, limit: number): Promise<ProjectDictionaryFieldHit[]> {
    const q = query.trim().toLowerCase();
    const like = `%${q}%`;
    const boundedLimit = Math.max(1, Math.min(limit, 100));
    const where = q
      ? `AND (
          lower(f.field_name) LIKE ? OR lower(coalesce(f.field_cn, '')) LIKE ? OR
          lower(coalesce(t.table_name, '')) LIKE ? OR lower(coalesce(t.table_cn, '')) LIKE ? OR
          lower(coalesce(s.name, '')) LIKE ? OR lower(coalesce(s.code, '')) LIKE ? OR
          lower(coalesce(t.data_layer, '')) LIKE ? OR lower(coalesce(t.source_kind, '')) LIKE ? OR
          lower(coalesce(f.format_pattern, '')) LIKE ? OR lower(coalesce(f.description, '')) LIKE ? OR lower(coalesce(f.acquire_logic, '')) LIKE ? OR
          lower(coalesce(f.validation_rule, '')) LIKE ? OR lower(coalesce(f.code_value, '')) LIKE ? OR
          lower(coalesce(f.remark, '')) LIKE ?
        )`
      : "";
    const exactParams: unknown[] = [q, q, q, q];
    const filterParams: unknown[] = q ? Array.from({ length: 14 }, () => like) : [];
    const rows = this.db.prepare(
      `SELECT
         f.id, f.system_id, s.name AS system_name, s.code AS system_code,
         f.table_id, t.table_name, t.table_cn,
         f.field_name, f.field_cn, f.field_type, f.field_length, f.format_pattern, f.carrier_kind, f.description, f.acquire_logic, f.code_value, f.remark,
         f.mapped_table, f.mapped_field, f.mapped_field_cn,
         CASE
           WHEN lower(f.field_name) = ? THEN 100
           WHEN lower(coalesce(f.field_cn, '')) = ? THEN 92
           WHEN lower(coalesce(t.table_name, '')) = ? THEN 78
           WHEN lower(coalesce(s.code, '')) = ? THEN 70
           ELSE 20
         END AS score
       FROM pm_data_fields f
       LEFT JOIN pm_data_systems s ON s.id = f.system_id
       LEFT JOIN pm_data_tables t ON t.id = f.table_id
       WHERE f.project_id = ?
       ${where}
       ORDER BY score DESC, f.updated_at DESC
       LIMIT ?`,
    ).all(...exactParams, projectId, ...filterParams, boundedLimit) as FieldRow[];
    return rows.map(row => ({
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
      score: row.score,
    }));
  }

  async getDictionaryField(projectId: string, fieldId: string): Promise<ProjectDictionaryFieldDetail | null> {
    const row = this.db.prepare(
      `SELECT
         f.id, f.system_id, s.name AS system_name, s.code AS system_code,
         f.table_id, t.table_name, t.table_cn,
         f.field_name, f.field_cn, f.field_type, f.field_length, f.format_pattern, f.carrier_kind, f.nullable,
         f.primary_key, f.required, f.description, f.acquire_logic, f.validation_rule,
         f.code_value, f.mapped_table, f.mapped_field, f.mapped_field_cn,
         f.data_source, f.remark, f.verification_status, f.verification_remark, f.extra,
         t.description AS table_description, t.caliber AS table_caliber,
         t.data_layer AS table_data_layer, t.source_kind AS table_source_kind,
         s.type AS system_type, s.asset_layer AS system_asset_layer, s.description AS system_description,
         100 AS score
       FROM pm_data_fields f
       LEFT JOIN pm_data_systems s ON s.id = f.system_id
       LEFT JOIN pm_data_tables t ON t.id = f.table_id
       WHERE f.project_id = ? AND f.id = ?
       LIMIT 1`,
    ).get(projectId, fieldId) as FieldDetailRow | undefined;
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
      extra: parseJsonObject(row.extra),
      score: row.score,
    };
  }

  async updateDictionaryField(projectId: string, fieldId: string, patch: ProjectDictionaryFieldPatch): Promise<ProjectDictionaryFieldDetail | null> {
    const current = await this.getDictionaryField(projectId, fieldId);
    if (!current) return null;
    this.db.prepare(
      `UPDATE pm_data_fields SET
         field_cn=?, field_type=?, field_length=?, format_pattern=?, nullable=?,
         primary_key=?, required=?, description=?, acquire_logic=?, validation_rule=?,
         code_value=?, mapped_table=?, mapped_field=?, mapped_field_cn=?,
         data_source=?, remark=?, verification_status=?, verification_remark=?, extra=?, updated_at=?
       WHERE project_id=? AND id=?`,
    ).run(
      patch.fieldCn === undefined ? current.fieldCn ?? null : patch.fieldCn,
      patch.fieldType === undefined ? current.fieldType ?? null : patch.fieldType,
      patch.fieldLength === undefined ? current.fieldLength ?? null : patch.fieldLength,
      patch.formatPattern === undefined ? current.formatPattern ?? null : patch.formatPattern,
      patch.nullable === undefined ? current.nullable ?? null : patch.nullable,
      Number(patch.primaryKey ?? current.primaryKey), Number(patch.required ?? current.required),
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
      JSON.stringify(patch.extra === undefined ? current.extra ?? {} : patch.extra), new Date().toISOString(),
      projectId, fieldId,
    );
    return this.getDictionaryField(projectId, fieldId);
  }

  async listDictionaryRectifications(projectId: string): Promise<ProjectDictionaryRectification[]> {
    const rows = this.db.prepare(
      `SELECT id, project_id, entity_type, entity_id, property_key, requirement, status,
              resolution_note, created_by, resolved_by, created_at, updated_at, resolved_at
         FROM pm_dictionary_rectifications
        WHERE project_id = ?
        ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'fixed' THEN 1 WHEN 'verified' THEN 2 ELSE 3 END,
                 updated_at DESC`,
    ).all(projectId) as DictionaryRectificationRow[];
    return rows.map(dictionaryRectificationFromRow);
  }

  async createDictionaryRectification(
    projectId: string,
    input: ProjectDictionaryRectificationInput,
  ): Promise<ProjectDictionaryRectification> {
    const now = new Date().toISOString();
    const row: DictionaryRectificationRow = {
      id: `pm-dict-rect-${randomUUID()}`,
      project_id: projectId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      property_key: input.propertyKey,
      requirement: input.requirement,
      status: "open",
      resolution_note: null,
      created_by: input.createdBy ?? null,
      resolved_by: null,
      created_at: now,
      updated_at: now,
      resolved_at: null,
    };
    this.db.prepare(
      `INSERT INTO pm_dictionary_rectifications (
         id, project_id, entity_type, entity_id, property_key, requirement, status,
         resolution_note, created_by, resolved_by, created_at, updated_at, resolved_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      row.id, row.project_id, row.entity_type, row.entity_id, row.property_key, row.requirement,
      row.status, row.resolution_note, row.created_by, row.resolved_by, row.created_at, row.updated_at, row.resolved_at,
    );
    return dictionaryRectificationFromRow(row);
  }

  async updateDictionaryRectification(
    projectId: string,
    rectificationId: string,
    patch: ProjectDictionaryRectificationPatch,
  ): Promise<ProjectDictionaryRectification | null> {
    const current = this.db.prepare(
      `SELECT id, project_id, entity_type, entity_id, property_key, requirement, status,
              resolution_note, created_by, resolved_by, created_at, updated_at, resolved_at
         FROM pm_dictionary_rectifications
        WHERE project_id = ? AND id = ?`,
    ).get(projectId, rectificationId) as DictionaryRectificationRow | undefined;
    if (!current) return null;
    const status = patch.status ?? current.status;
    const resolved = status === "fixed" || status === "verified" || status === "cancelled";
    const now = new Date().toISOString();
    const next: DictionaryRectificationRow = {
      ...current,
      status,
      resolution_note: patch.resolutionNote === undefined ? current.resolution_note : patch.resolutionNote,
      resolved_by: patch.resolvedBy === undefined ? current.resolved_by : patch.resolvedBy,
      resolved_at: resolved ? current.resolved_at ?? now : null,
      updated_at: now,
    };
    this.db.prepare(
      `UPDATE pm_dictionary_rectifications
          SET status = ?, resolution_note = ?, resolved_by = ?, resolved_at = ?, updated_at = ?
        WHERE project_id = ? AND id = ?`,
    ).run(next.status, next.resolution_note, next.resolved_by, next.resolved_at, next.updated_at, projectId, rectificationId);
    return dictionaryRectificationFromRow(next);
  }

  async listDictionaryMappingRules(projectId: string, tableId: string): Promise<ProjectDictionaryMappingRule[]> {
    const rows = this.db.prepare(
      `SELECT id, project_id, scenario_id, system_id, table_id, field_id, status,
              logic_text, converted_sql, external_sql, remark, verification_status, verification_remark, sort_order, raw, created_at, updated_at
         FROM pm_mapping_rules
        WHERE project_id = ? AND table_id = ?
        ORDER BY sort_order ASC, id ASC`,
    ).all(projectId, tableId) as MappingRuleRow[];
    return this.hydrateMappingRules(projectId, rows);
  }

  async listDictionaryMappingScenarios(projectId: string, tableId: string): Promise<ProjectDictionaryMappingScenario[]> {
    const rows = this.db.prepare(`SELECT id, project_id, table_id, title, caliber, caliber_external_sql, external_sql, remark, sort_order, raw, created_at, updated_at FROM pm_mapping_scenarios WHERE project_id=? AND table_id=? ORDER BY sort_order, id`).all(projectId, tableId) as MappingScenarioRow[];
    return rows.map(row => { const raw = parseJsonObject(row.raw) ?? {}; return { id: row.id, projectId: row.project_id, tableId: row.table_id, title: row.title, caliber: row.caliber ?? undefined, caliberExternalSql: row.caliber_external_sql ?? undefined, externalSql: row.external_sql ?? (typeof raw.externalSql === "string" ? raw.externalSql : undefined), remark: row.remark ?? undefined, sortOrder: row.sort_order, raw, createdAt: row.created_at, updatedAt: row.updated_at }; });
  }

  async listDictionaryBusinessScenarios(projectId: string, libraryId?: string): Promise<ProjectDictionaryBusinessScenario[]> {
    const rows = this.db.prepare(`SELECT * FROM pm_business_scenarios WHERE project_id=?${libraryId ? " AND library_id=?" : ""} ORDER BY sort_order,id`).all(...(libraryId ? [projectId, libraryId] : [projectId])) as any[];
    return rows.map(row => this.businessScenarioFromRow(row));
  }
  async listDictionaryBusinessScenarioLibraries(projectId: string): Promise<ProjectDictionaryBusinessScenarioLibrary[]> { return (this.db.prepare(`SELECT * FROM pm_business_scenario_libraries WHERE project_id=? ORDER BY name`).all(projectId) as any[]).map(row => ({ id: row.id, projectId: row.project_id, name: row.name, dbType: row.db_type ?? undefined, sqlDialect: row.sql_dialect ?? undefined, connection: parseJsonObject(row.connection) ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at })); }
  async createDictionaryBusinessScenarioLibrary(projectId: string, input: ProjectDictionaryBusinessScenarioLibraryInput): Promise<ProjectDictionaryBusinessScenarioLibrary> { const id=input.id??`pm-business-library-${randomUUID()}`, now=new Date().toISOString(); this.db.prepare(`INSERT INTO pm_business_scenario_libraries (id,project_id,name,db_type,sql_dialect,connection,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`).run(id,projectId,input.name,input.dbType??null,input.sqlDialect??null,JSON.stringify(input.connection??{}),now,now); return {id,projectId,name:input.name,dbType:input.dbType,sqlDialect:input.sqlDialect,connection:input.connection,createdAt:now,updatedAt:now}; }
  async updateDictionaryBusinessScenarioLibrary(projectId: string, libraryId: string, patch: Partial<ProjectDictionaryBusinessScenarioLibraryInput>): Promise<ProjectDictionaryBusinessScenarioLibrary | null> { const row=this.db.prepare(`SELECT * FROM pm_business_scenario_libraries WHERE project_id=? AND id=?`).get(projectId,libraryId) as any; if(!row)return null; const now=new Date().toISOString(), connection=patch.connection??parseJsonObject(row.connection)??{}; this.db.prepare(`UPDATE pm_business_scenario_libraries SET name=?,db_type=?,sql_dialect=?,connection=?,updated_at=? WHERE project_id=? AND id=?`).run(patch.name??row.name,patch.dbType===undefined?row.db_type:patch.dbType,patch.sqlDialect===undefined?row.sql_dialect:patch.sqlDialect,JSON.stringify(connection),now,projectId,libraryId); return {id:row.id,projectId,name:patch.name??row.name,dbType:patch.dbType===undefined?row.db_type??undefined:patch.dbType,sqlDialect:patch.sqlDialect===undefined?row.sql_dialect??undefined:patch.sqlDialect,connection,createdAt:row.created_at,updatedAt:now}; }
  async listDictionaryBusinessScenariosForTable(projectId: string, tableId: string): Promise<ProjectDictionaryBusinessScenario[]> {
    const rows = this.db.prepare(`SELECT scenario.* FROM pm_business_scenarios scenario JOIN pm_business_scenario_tables relation ON relation.scenario_id=scenario.id WHERE scenario.project_id=? AND relation.table_id=? ORDER BY scenario.sort_order,scenario.id`).all(projectId, tableId) as any[];
    return rows.map(row => this.businessScenarioFromRow(row));
  }
  async createDictionaryBusinessScenario(projectId: string, input: ProjectDictionaryBusinessScenarioInput): Promise<ProjectDictionaryBusinessScenario> {
    const id = input.id ?? `pm-business-scenario-${randomUUID()}`; const now = new Date().toISOString();
    const transaction = this.db.transaction(() => {
    this.db.prepare(`INSERT INTO pm_business_scenarios (id,project_id,library_id,title,procedure_name,external_location,sql_text,remark,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(id,projectId,input.libraryId,input.title,input.procedureName,input.externalLocation ?? null,input.sqlText,input.remark ?? null,input.sortOrder ?? 0,now,now);
      input.tableIds.forEach((tableId, sortOrder) => this.db.prepare(`INSERT INTO pm_business_scenario_tables (project_id,scenario_id,table_id,sort_order) VALUES (?,?,?,?)`).run(projectId,id,tableId,sortOrder));
    }); transaction();
    return (await this.listDictionaryBusinessScenarios(projectId)).find(item => item.id === id)!;
  }
  async updateDictionaryBusinessScenario(projectId: string, scenarioId: string, patch: ProjectDictionaryBusinessScenarioPatch): Promise<ProjectDictionaryBusinessScenario | null> {
    const current = this.db.prepare(`SELECT * FROM pm_business_scenarios WHERE project_id=? AND id=?`).get(projectId, scenarioId) as any; if (!current) return null;
    const sqlChanged = patch.sqlText !== undefined && patch.sqlText !== current.sql_text; const now = new Date().toISOString();
    const status = sqlChanged ? "pending" : patch.validationStatus ?? current.validation_status;
    this.db.prepare(`UPDATE pm_business_scenarios SET title=?,procedure_name=?,external_location=?,sql_text=?,remark=?,sort_order=?,validation_status=?,validation_sql_fingerprint=?,validation_message=?,validated_at=?,updated_at=? WHERE project_id=? AND id=?`).run(patch.title ?? current.title,patch.procedureName ?? current.procedure_name,patch.externalLocation === undefined ? current.external_location : patch.externalLocation,patch.sqlText ?? current.sql_text,patch.remark === undefined ? current.remark : patch.remark,patch.sortOrder ?? current.sort_order,status,sqlChanged ? null : patch.validationSqlFingerprint === undefined ? current.validation_sql_fingerprint : patch.validationSqlFingerprint,sqlChanged ? null : patch.validationMessage === undefined ? current.validation_message : patch.validationMessage,sqlChanged ? null : patch.validatedAt === undefined ? current.validated_at : patch.validatedAt,now,projectId,scenarioId);
    if (patch.tableIds) { const replace = this.db.transaction(() => { this.db.prepare(`DELETE FROM pm_business_scenario_tables WHERE scenario_id=?`).run(scenarioId); patch.tableIds!.forEach((tableId, sortOrder) => this.db.prepare(`INSERT INTO pm_business_scenario_tables (project_id,scenario_id,table_id,sort_order) VALUES (?,?,?,?)`).run(projectId,scenarioId,tableId,sortOrder)); }); replace(); }
    return (await this.listDictionaryBusinessScenarios(projectId)).find(item => item.id === scenarioId) ?? null;
  }
  async deleteDictionaryBusinessScenario(projectId: string, scenarioId: string): Promise<boolean> { return this.db.prepare(`DELETE FROM pm_business_scenarios WHERE project_id=? AND id=?`).run(projectId,scenarioId).changes > 0; }
  private businessScenarioFromRow(row: any): ProjectDictionaryBusinessScenario { const tableIds = (this.db.prepare(`SELECT table_id FROM pm_business_scenario_tables WHERE scenario_id=? ORDER BY sort_order`).all(row.id) as any[]).map(item => item.table_id); return { id: row.id, projectId: row.project_id, libraryId: row.library_id, title: row.title, procedureName: row.procedure_name, externalLocation: row.external_location ?? undefined, sqlText: row.sql_text, remark: row.remark ?? undefined, sortOrder: row.sort_order, tableIds, validationStatus: row.validation_status, validationSqlFingerprint: row.validation_sql_fingerprint ?? undefined, validationMessage: row.validation_message ?? undefined, validatedAt: row.validated_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at }; }

  async createDictionaryMappingScenario(projectId: string, input: ProjectDictionaryMappingScenarioInput): Promise<ProjectDictionaryMappingScenario> {
    const now = new Date().toISOString();
    const id = input.id ?? `pm-map-scenario-${randomUUID()}`;
    this.db.prepare(`INSERT INTO pm_mapping_scenarios (id, project_id, table_id, title, caliber, remark, sort_order, raw, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id, projectId, input.tableId, input.title, input.caliber ?? null, input.remark ?? null, input.sortOrder ?? 0, JSON.stringify(input.raw ?? {}), now, now);
    return { id, projectId, tableId: input.tableId, title: input.title, caliber: input.caliber ?? undefined, remark: input.remark ?? undefined, sortOrder: input.sortOrder ?? 0, raw: input.raw, createdAt: now, updatedAt: now };
  }

  async updateDictionaryMappingScenario(projectId: string, scenarioId: string, patch: ProjectDictionaryMappingScenarioPatch): Promise<ProjectDictionaryMappingScenario | null> {
    const current = this.db.prepare(`SELECT id, project_id, table_id, title, caliber, caliber_external_sql, external_sql, remark, sort_order, raw, created_at, updated_at FROM pm_mapping_scenarios WHERE project_id=? AND id=?`).get(projectId, scenarioId) as MappingScenarioRow | undefined;
    if (!current) return null;
    const raw = { ...(parseJsonObject(current.raw) ?? {}), ...(patch.raw ?? {}) };
    const now = new Date().toISOString();
    this.db.prepare(`UPDATE pm_mapping_scenarios SET title=?, caliber=?, caliber_external_sql=?, external_sql=?, remark=?, sort_order=?, raw=?, updated_at=? WHERE project_id=? AND id=?`).run(patch.title ?? current.title, patch.caliber === undefined ? current.caliber : patch.caliber, patch.caliberExternalSql === undefined ? current.caliber_external_sql : patch.caliberExternalSql, patch.externalSql === undefined ? current.external_sql : patch.externalSql, patch.remark === undefined ? current.remark : patch.remark, patch.sortOrder ?? current.sort_order, JSON.stringify(raw), now, projectId, scenarioId);
    return { id: current.id, projectId: current.project_id, tableId: current.table_id, title: patch.title ?? current.title, caliber: patch.caliber === undefined ? current.caliber ?? undefined : patch.caliber ?? undefined, caliberExternalSql: patch.caliberExternalSql === undefined ? current.caliber_external_sql ?? undefined : patch.caliberExternalSql ?? undefined, externalSql: patch.externalSql === undefined ? current.external_sql ?? undefined : patch.externalSql ?? undefined, remark: patch.remark === undefined ? current.remark ?? undefined : patch.remark ?? undefined, sortOrder: patch.sortOrder ?? current.sort_order, raw, createdAt: current.created_at, updatedAt: now };
  }

  async deleteDictionaryMappingScenario(projectId: string, scenarioId: string): Promise<boolean> {
    const transaction = this.db.transaction(() => {
      this.db.prepare(`UPDATE pm_mapping_rules SET scenario_id=NULL WHERE project_id=? AND scenario_id=?`).run(projectId, scenarioId);
      return this.db.prepare(`DELETE FROM pm_mapping_scenarios WHERE project_id=? AND id=?`).run(projectId, scenarioId).changes > 0;
    });
    return transaction();
  }

  async getDictionaryMappingRule(projectId: string, mappingRuleId: string): Promise<ProjectDictionaryMappingRule | null> {
    const row = this.db.prepare(
      `SELECT id, project_id, scenario_id, system_id, table_id, field_id, status,
              logic_text, converted_sql, external_sql, remark, verification_status, verification_remark, sort_order, raw, created_at, updated_at
         FROM pm_mapping_rules
        WHERE project_id = ? AND id = ?
        LIMIT 1`,
    ).get(projectId, mappingRuleId) as MappingRuleRow | undefined;
    if (!row) return null;
    return this.hydrateMappingRules(projectId, [row])[0] ?? null;
  }

  async updateDictionaryMappingRule(
    projectId: string,
    mappingRuleId: string,
    patch: ProjectDictionaryMappingRulePatch,
  ): Promise<ProjectDictionaryMappingRule | null> {
    const current = this.db.prepare(
      `SELECT id, project_id, scenario_id, system_id, table_id, field_id, status,
              logic_text, converted_sql, external_sql, remark, verification_status, verification_remark, sort_order, raw, created_at, updated_at
         FROM pm_mapping_rules
        WHERE project_id = ? AND id = ?
        LIMIT 1`,
    ).get(projectId, mappingRuleId) as MappingRuleRow | undefined;
    if (!current) return null;
    const now = new Date().toISOString();
    this.db.prepare(
      `UPDATE pm_mapping_rules
          SET scenario_id = ?, system_id = ?, table_id = ?, field_id = ?, status = ?,
              logic_text = ?, converted_sql = ?, external_sql = ?, remark = ?, verification_status = ?, verification_remark = ?, sort_order = ?, raw = ?, updated_at = ?
        WHERE project_id = ? AND id = ?`,
    ).run(
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
      patch.sortOrder ?? current.sort_order,
      patch.raw === undefined ? current.raw : JSON.stringify(patch.raw),
      now,
      projectId,
      mappingRuleId,
    );
    return this.getDictionaryMappingRule(projectId, mappingRuleId);
  }

  async updateDictionaryMappingAction(
    projectId: string,
    actionId: string,
    patch: ProjectDictionaryMappingActionPatch,
  ): Promise<ProjectDictionaryMappingAction | null> {
    const current = this.db.prepare(
      `SELECT id, project_id, mapping_rule_id, action_type, condition_text, expression_text,
              result_text, remark, sort_order, raw, created_at, updated_at
         FROM pm_mapping_actions
        WHERE project_id = ? AND id = ?
        LIMIT 1`,
    ).get(projectId, actionId) as MappingActionRow | undefined;
    if (!current) return null;
    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.db.prepare(
        `UPDATE pm_mapping_actions
            SET action_type = ?, condition_text = ?, expression_text = ?, result_text = ?,
                remark = ?, sort_order = ?, raw = ?, updated_at = ?
          WHERE project_id = ? AND id = ?`,
      ).run(
        patch.actionType ?? current.action_type,
        patch.conditionText === undefined ? current.condition_text : patch.conditionText,
        patch.expressionText === undefined ? current.expression_text : patch.expressionText,
        patch.resultText === undefined ? current.result_text : patch.resultText,
        patch.remark === undefined ? current.remark : patch.remark,
        patch.sortOrder ?? current.sort_order,
        patch.raw === undefined ? current.raw : JSON.stringify(patch.raw),
        now,
        projectId,
        actionId,
      );
      if (patch.sourceFieldIds) {
        this.db.prepare(`DELETE FROM pm_mapping_action_source_fields WHERE project_id = ? AND action_id = ?`).run(projectId, actionId);
        const insert = this.db.prepare(
          `INSERT INTO pm_mapping_action_source_fields (project_id, action_id, source_field_id, relation_kind, created_at)
           VALUES (?, ?, ?, 'uses', ?)`,
        );
        patch.sourceFieldIds.forEach(sourceFieldId => insert.run(projectId, actionId, sourceFieldId, now));
      }
    });
    tx();
    return this.getMappingAction(projectId, actionId);
  }

  async replaceDictionaryMappingActions(
    projectId: string,
    mappingRuleId: string,
    actions: ProjectDictionaryMappingActionInput[],
  ): Promise<ProjectDictionaryMappingRule | null> {
    const current = await this.getDictionaryMappingRule(projectId, mappingRuleId);
    if (!current) return null;
    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.db.prepare(`DELETE FROM pm_mapping_action_source_fields WHERE project_id = ? AND action_id IN (SELECT id FROM pm_mapping_actions WHERE project_id = ? AND mapping_rule_id = ?)`).run(projectId, projectId, mappingRuleId);
      this.db.prepare(`DELETE FROM pm_mapping_actions WHERE project_id = ? AND mapping_rule_id = ?`).run(projectId, mappingRuleId);
      const insertAction = this.db.prepare(
        `INSERT INTO pm_mapping_actions (
           id, project_id, mapping_rule_id, action_type, condition_text, expression_text,
           result_text, remark, sort_order, raw, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const insertLink = this.db.prepare(
        `INSERT INTO pm_mapping_action_source_fields (project_id, action_id, source_field_id, relation_kind, created_at)
         VALUES (?, ?, ?, 'uses', ?)`,
      );
      actions.forEach((action, index) => {
        const id = action.id ?? `pm-map-action-${randomUUID()}`;
        insertAction.run(
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
          now,
        );
        (action.sourceFieldIds ?? []).forEach(sourceFieldId => insertLink.run(projectId, id, sourceFieldId, now));
      });
    });
    tx();
    return this.getDictionaryMappingRule(projectId, mappingRuleId);
  }

  async replaceDictionaryMappingSourceFields(
    projectId: string,
    mappingRuleId: string,
    sourceFields: ProjectDictionaryMappingSourceFieldInput[],
  ): Promise<ProjectDictionaryMappingRule | null> {
    const current = await this.getDictionaryMappingRule(projectId, mappingRuleId);
    if (!current) return null;
    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.db.prepare(`DELETE FROM pm_mapping_action_source_fields WHERE project_id = ? AND source_field_id IN (SELECT id FROM pm_mapping_source_fields WHERE project_id = ? AND mapping_rule_id = ?)`).run(projectId, projectId, mappingRuleId);
      this.db.prepare(`DELETE FROM pm_mapping_source_fields WHERE project_id = ? AND mapping_rule_id = ?`).run(projectId, mappingRuleId);
      const insert = this.db.prepare(
        `INSERT INTO pm_mapping_source_fields (
           id, project_id, mapping_rule_id, field_id, ref_path, alias, role, remark,
           sort_order, raw, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      sourceFields.forEach((sourceField, index) => {
        insert.run(
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
          now,
        );
      });
    });
    tx();
    return this.getDictionaryMappingRule(projectId, mappingRuleId);
  }

  async validateDictionaryMappingTable(projectId: string, tableId: string): Promise<ProjectDictionaryMappingValidation> {
    return validateMappingRules(projectId, tableId, await this.listDictionaryMappingRules(projectId, tableId));
  }

  async listDictionaryMappingTempTables(projectId: string, targetTableId: string): Promise<ProjectDictionaryMappingTempTable[]> {
    const rows = this.db.prepare(
      `SELECT id, project_id, target_table_id, table_name, table_cn, logic_text, converted_sql, external_sql,
              remark, sort_order, raw, created_at, updated_at
         FROM pm_mapping_temp_tables
        WHERE project_id = ? AND target_table_id = ?
        ORDER BY sort_order ASC, id ASC`,
    ).all(projectId, targetTableId) as MappingTempTableRow[];
    return this.hydrateMappingTempTables(projectId, rows);
  }

  async replaceDictionaryMappingTempTables(
    projectId: string,
    targetTableId: string,
    tempTables: ProjectDictionaryMappingTempTableInput[],
  ): Promise<ProjectDictionaryMappingTempTable[]> {
    const now = new Date().toISOString();
    const tx = this.db.transaction(() => {
      this.db.prepare(`DELETE FROM pm_mapping_temp_tables WHERE project_id = ? AND target_table_id = ?`).run(projectId, targetTableId);
      const insertTable = this.db.prepare(
        `INSERT INTO pm_mapping_temp_tables (
           id, project_id, target_table_id, table_name, table_cn, logic_text, converted_sql, external_sql,
           remark, sort_order, raw, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const insertField = this.db.prepare(
        `INSERT INTO pm_mapping_temp_fields (
           id, project_id, temp_table_id, field_name, field_cn, field_type, field_length,
             logic_text, converted_sql, external_sql, remark, sort_order, raw, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      tempTables.forEach((tempTable, tableIndex) => {
        const tableId = tempTable.id ?? `pm-map-temp-table-${randomUUID()}`;
        insertTable.run(
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
          now,
        );
        (tempTable.fields ?? []).forEach((field, fieldIndex) => {
          insertField.run(
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
            now,
          );
        });
      });
    });
    tx();
    return this.listDictionaryMappingTempTables(projectId, targetTableId);
  }

  private hydrateMappingRules(projectId: string, rows: MappingRuleRow[]): ProjectDictionaryMappingRule[] {
    if (rows.length === 0) return [];
    const ids = rows.map(row => row.id);
    const placeholders = ids.map(() => "?").join(",");
    const sourceRows = this.db.prepare(
      `SELECT id, project_id, mapping_rule_id, field_id, ref_path, alias, role, remark,
              sort_order, raw, created_at, updated_at
         FROM pm_mapping_source_fields
        WHERE project_id = ? AND mapping_rule_id IN (${placeholders})
        ORDER BY sort_order ASC, id ASC`,
    ).all(projectId, ...ids) as MappingSourceFieldRow[];
    const actionRows = this.db.prepare(
      `SELECT id, project_id, mapping_rule_id, action_type, condition_text, expression_text,
              result_text, remark, sort_order, raw, created_at, updated_at
         FROM pm_mapping_actions
        WHERE project_id = ? AND mapping_rule_id IN (${placeholders})
        ORDER BY sort_order ASC, id ASC`,
    ).all(projectId, ...ids) as MappingActionRow[];
    const actionIds = actionRows.map(row => row.id);
    const linkRows = actionIds.length
      ? this.db.prepare(
        `SELECT action_id, source_field_id
           FROM pm_mapping_action_source_fields
          WHERE project_id = ? AND action_id IN (${actionIds.map(() => "?").join(",")})`,
      ).all(projectId, ...actionIds) as MappingActionSourceFieldRow[]
      : [];
    const sourcesByRule = groupBy(sourceRows.map(mappingSourceFieldFromRow), source => source.mappingRuleId);
    const sourceIdsByAction = groupBy(linkRows, row => row.action_id);
    const actionsByRule = groupBy(
      actionRows.map(row => mappingActionFromRow(row, sourceIdsByAction.get(row.id)?.map(link => link.source_field_id) ?? [])),
      action => action.mappingRuleId,
    );
    return rows.map(row => mappingRuleFromRow(row, sourcesByRule.get(row.id) ?? [], actionsByRule.get(row.id) ?? []));
  }

  private getMappingAction(projectId: string, actionId: string): ProjectDictionaryMappingAction | null {
    const row = this.db.prepare(
      `SELECT id, project_id, mapping_rule_id, action_type, condition_text, expression_text,
              result_text, remark, sort_order, raw, created_at, updated_at
         FROM pm_mapping_actions
        WHERE project_id = ? AND id = ?
        LIMIT 1`,
    ).get(projectId, actionId) as MappingActionRow | undefined;
    if (!row) return null;
    const links = this.db.prepare(
      `SELECT action_id, source_field_id FROM pm_mapping_action_source_fields WHERE project_id = ? AND action_id = ?`,
    ).all(projectId, actionId) as MappingActionSourceFieldRow[];
    return mappingActionFromRow(row, links.map(link => link.source_field_id));
  }

  private hydrateMappingTempTables(projectId: string, rows: MappingTempTableRow[]): ProjectDictionaryMappingTempTable[] {
    if (rows.length === 0) return [];
    const ids = rows.map(row => row.id);
    const fieldRows = this.db.prepare(
      `SELECT id, project_id, temp_table_id, field_name, field_cn, field_type, field_length,
              logic_text, converted_sql, external_sql, remark, sort_order, raw, created_at, updated_at
         FROM pm_mapping_temp_fields
        WHERE project_id = ? AND temp_table_id IN (${ids.map(() => "?").join(",")})
        ORDER BY sort_order ASC, id ASC`,
    ).all(projectId, ...ids) as MappingTempFieldRow[];
    const fieldsByTable = groupBy(fieldRows.map(mappingTempFieldFromRow), field => field.tempTableId);
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
    externalSql: row.external_sql ?? (typeof (parseJsonObject(row.raw) ?? {}).externalSql === "string" ? (parseJsonObject(row.raw) ?? {}).externalSql as string : undefined),
    remark: row.remark ?? undefined,
    verificationStatus: verificationStatus(row.verification_status),
    verificationRemark: row.verification_remark ?? undefined,
    sortOrder: row.sort_order,
    raw: parseJsonObject(row.raw),
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
    sortOrder: row.sort_order,
    raw: parseJsonObject(row.raw),
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
    sortOrder: row.sort_order,
    raw: parseJsonObject(row.raw),
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
    externalSql: row.external_sql ?? (typeof (parseJsonObject(row.raw) ?? {}).externalSql === "string" ? (parseJsonObject(row.raw) ?? {}).externalSql as string : undefined),
    remark: row.remark ?? undefined,
    sortOrder: row.sort_order,
    raw: parseJsonObject(row.raw),
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
    externalSql: row.external_sql ?? (typeof (parseJsonObject(row.raw) ?? {}).externalSql === "string" ? (parseJsonObject(row.raw) ?? {}).externalSql as string : undefined),
    remark: row.remark ?? undefined,
    sortOrder: row.sort_order,
    raw: parseJsonObject(row.raw),
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

function parseJsonObject(value?: string | null): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

function codeSetFromRow(row: FieldRow): Pick<ProjectDictionaryFieldHit, "codeItems"> {
  const codeItems = parseDictionaryCodeItems(row.code_value);
  return codeItems.length ? { codeItems } : {};
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

function excerpt(value?: string | null): string | undefined {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  return text.length > 160 ? `${text.slice(0, 160)}...` : text;
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
    content: parseJsonObject(row.content) ?? {},
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
