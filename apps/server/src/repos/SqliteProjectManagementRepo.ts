import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
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
  description: string | null;
  acquire_logic: string | null;
  code_value: string | null;
  remark: string | null;
  mapped_table: string | null;
  mapped_field: string | null;
  score: number;
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
  description: string | null;
  caliber: string | null;
  field_count: number;
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
    return rows.map(row => ({
      id: row.id,
      moduleKey: row.module_key as ProjectManagementSearchHit["moduleKey"],
      entityType: row.entity_type,
      entityId: row.entity_id,
      title: row.title,
      subtitle: row.subtitle ?? undefined,
      excerpt: excerpt(row.body),
      score: row.score,
      updatedAt: row.updated_at,
    }));
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

  async createModuleItem(projectId: string, input: ProjectModuleItemInput): Promise<ProjectModuleItem> {
    const now = new Date().toISOString();
    const id = `pm-item-${randomUUID()}`;
    const title = input.title.trim() || "未命名事项";
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
    const title = patch.title === undefined ? current.title : patch.title.trim() || "未命名事项";
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
         s.id, s.code, s.name, s.type, s.asset_layer,
         count(DISTINCT t.id) AS table_count,
         count(DISTINCT f.id) AS field_count
       FROM pm_data_systems s
       LEFT JOIN pm_data_tables t ON t.system_id = s.id AND t.project_id = s.project_id
       LEFT JOIN pm_data_fields f ON f.system_id = s.id AND f.project_id = s.project_id
       WHERE s.project_id = ?
       GROUP BY s.id
       ORDER BY s.name ASC`,
    ).all(projectId) as SystemRow[];
    return rows.map(row => ({
      id: row.id,
      code: row.code ?? "",
      name: row.name,
      type: row.type ?? undefined,
      assetLayer: row.asset_layer ?? undefined,
      tableCount: row.table_count,
      fieldCount: row.field_count,
    }));
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
         t.id, t.system_id, t.table_name, t.table_cn, t.table_group, t.data_layer, t.source_kind, t.file_type, t.description, t.caliber,
         count(DISTINCT f.id) AS field_count
       FROM pm_data_tables t
       LEFT JOIN pm_data_fields f ON f.table_id = t.id AND f.project_id = t.project_id
       WHERE t.project_id = ?
       ${systemId ? "AND t.system_id = ?" : ""}
       GROUP BY t.id
       ORDER BY coalesce(t.table_cn, t.table_name) ASC, t.table_name ASC`,
    ).all(...(systemId ? [projectId, systemId] : [projectId])) as TableRow[];
    return rows.map(row => ({
      id: row.id,
      systemId: row.system_id ?? undefined,
      tableName: row.table_name,
      tableCn: row.table_cn ?? undefined,
      tableGroup: row.table_group ?? undefined,
      dataLayer: row.data_layer ?? undefined,
      sourceKind: row.source_kind ?? undefined,
      fileType: row.file_type ?? undefined,
      description: row.description ?? undefined,
      caliber: row.caliber ?? undefined,
      fieldCount: row.field_count,
    }));
  }

  async listDictionaryFields(projectId: string, tableId: string): Promise<ProjectDictionaryFieldHit[]> {
    const rows = this.db.prepare(
      `SELECT
         f.id, f.system_id, s.name AS system_name, s.code AS system_code,
         f.table_id, t.table_name, t.table_cn,
         f.field_name, f.field_cn, f.field_type, f.field_length, f.format_pattern, f.description, f.acquire_logic, f.code_value, f.remark,
         f.mapped_table, f.mapped_field,
         50 AS score
       FROM pm_data_fields f
       LEFT JOIN pm_data_systems s ON s.id = f.system_id
       LEFT JOIN pm_data_tables t ON t.id = f.table_id
       WHERE f.project_id = ? AND f.table_id = ?
       ORDER BY f.field_name ASC, f.id ASC`,
    ).all(projectId, tableId) as FieldRow[];
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
      description: row.description ?? undefined,
      acquireLogic: row.acquire_logic ?? undefined,
      codeValue: row.code_value ?? undefined,
      ...codeSetFromRow(row),
      mappedTable: row.mapped_table ?? undefined,
      mappedField: row.mapped_field ?? undefined,
      remark: row.remark ?? undefined,
      score: row.score,
    }));
  }

  async resolveDictionaryFieldRefs(projectId: string, refs: string[]): Promise<ProjectDictionaryFieldHit[]> {
    const tokens = dictionaryRefTokens(refs);
    if (tokens.length === 0) return [];
    const placeholders = tokens.map(() => "?").join(",");
    const rows = this.db.prepare(
      `SELECT
         f.id, f.system_id, s.name AS system_name, s.code AS system_code,
         f.table_id, t.table_name, t.table_cn,
         f.field_name, f.field_cn, f.field_type, f.field_length, f.format_pattern, f.description, f.acquire_logic, f.code_value, f.remark,
         f.mapped_table, f.mapped_field,
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
         )
       ORDER BY f.updated_at DESC
       LIMIT 500`,
    ).all(projectId, ...tokens, ...tokens, ...tokens, ...tokens) as FieldRow[];
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
      description: row.description ?? undefined,
      acquireLogic: row.acquire_logic ?? undefined,
      codeValue: row.code_value ?? undefined,
      ...codeSetFromRow(row),
      mappedTable: row.mapped_table ?? undefined,
      mappedField: row.mapped_field ?? undefined,
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
         f.field_name, f.field_cn, f.field_type, f.field_length, f.format_pattern, f.description, f.acquire_logic, f.code_value, f.remark,
         f.mapped_table, f.mapped_field,
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
      description: row.description ?? undefined,
      acquireLogic: row.acquire_logic ?? undefined,
      codeValue: row.code_value ?? undefined,
      ...codeSetFromRow(row),
      mappedTable: row.mapped_table ?? undefined,
      mappedField: row.mapped_field ?? undefined,
      remark: row.remark ?? undefined,
      score: row.score,
    }));
  }

  async getDictionaryField(projectId: string, fieldId: string): Promise<ProjectDictionaryFieldDetail | null> {
    const row = this.db.prepare(
      `SELECT
         f.id, f.system_id, s.name AS system_name, s.code AS system_code,
         f.table_id, t.table_name, t.table_cn,
         f.field_name, f.field_cn, f.field_type, f.field_length, f.format_pattern, f.nullable,
         f.primary_key, f.required, f.description, f.acquire_logic, f.validation_rule,
         f.code_value, f.mapped_table, f.mapped_field, f.mapped_field_cn,
         f.data_source, f.remark, f.extra,
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
      extra: parseJsonObject(row.extra),
      score: row.score,
    };
  }
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
