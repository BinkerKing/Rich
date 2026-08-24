import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { openPostgresPool, type PgPool } from "../src/db/postgres.js";

interface SourceSystem {
  id?: string;
  code?: string;
  name?: string;
  type?: string;
  assetLayer?: string;
  asset_layer?: string;
  owner?: string;
  description?: string;
  [key: string]: unknown;
}

interface SourceField {
  id?: string;
  systemId?: string;
  system_id?: string;
  database?: string;
  databaseName?: string;
  schema?: string;
  schemaName?: string;
  tableName?: string;
  tableCn?: string;
  tableGroup?: string;
  group?: string;
  category?: string;
  dataLayer?: string;
  tableLayer?: string;
  sourceKind?: string;
  sourceType?: string;
  fileType?: string;
  file_type?: string;
  tableDescription?: string;
  tableCaliber?: string;
  fieldName?: string;
  fieldCn?: string;
  fieldType?: string;
  fieldLength?: string;
  nullable?: unknown;
  primaryKey?: unknown;
  physicalPrimaryKey?: unknown;
  businessPrimaryKey?: unknown;
  required?: unknown;
  description?: string;
  acquireLogic?: string;
  validationRule?: string;
  validationRules?: unknown;
  codeValue?: string;
  mappedTable?: string;
  mappedField?: string;
  mappedFieldCn?: string;
  dataSource?: string;
  remark?: string;
  [key: string]: unknown;
}

interface NormalizedSource {
  systems: SourceSystem[];
  fields: SourceField[];
}

interface ImportArgs {
  source?: string;
  projectId: string;
  replace: boolean;
}

const POSTGRES_URL = process.env.DATABASE_URL ?? process.env.KE_DATABASE_URL ?? process.env.RICH_DB_URL;

async function main(): Promise<void> {
  const args = await parseArgs(process.argv.slice(2));

  if (!POSTGRES_URL) {
    throw new Error("Set DATABASE_URL, KE_DATABASE_URL, or RICH_DB_URL before importing project dictionary data.");
  }

  const sourcePath = args.source ?? await findDefaultSource();
  const source = await loadSource(sourcePath);
  const pg = openPostgresPool(POSTGRES_URL);
  await pg.ready;

  try {
    if (args.replace) await clearDictionary(pg, args.projectId);
    const result = await importDictionary(pg, args.projectId, source);
    console.log(JSON.stringify({ ok: true, projectId: args.projectId, source: sourcePath, replace: args.replace, ...result }, null, 2));
  } finally {
    await pg.pool.end();
  }
}

async function parseArgs(argv: string[]): Promise<ImportArgs> {
  const args: ImportArgs = { projectId: "riking-ybt", replace: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--source") args.source = argv[++i];
    else if (arg === "--project-id") args.projectId = argv[++i] ?? args.projectId;
    else if (arg === "--replace") args.replace = true;
    else if (arg === "--help" || arg === "-h") {
      console.log([
        "Usage:",
        "  pnpm --filter @ke/server pm:import:dictionary -- --project-id <id> --source <json> [--replace]",
        "",
        "Supported source formats:",
        "  1. { systems: [...], dictionaryFields: [...] }",
        "  2. [{ tableName, fieldName, ... }]",
      ].join("\n"));
      process.exit(0);
    }
  }
  return args;
}

async function findDefaultSource(): Promise<string> {
  const workspace = process.env.AI_WORKSPACE_DIR ?? join(homedir(), "Documents", "Ai-WorkSpace");
  const candidates = [
    join(workspace, "Tools", "数据映射治理平台", "public", "data", "njEbankMigration.json"),
    join(workspace, "Tools", "数据映射治理平台", "src", "data", "ybtMappingFields.json"),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Keep scanning candidates.
    }
  }
  throw new Error("No default dictionary source was found. Pass --source <json>.");
}

async function loadSource(sourcePath: string): Promise<NormalizedSource> {
  const raw = JSON.parse(await readFile(sourcePath, "utf8")) as unknown;
  if (Array.isArray(raw)) return { systems: [], fields: raw as SourceField[] };
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return {
      systems: Array.isArray(obj.systems) ? obj.systems as SourceSystem[] : [],
      fields: Array.isArray(obj.dictionaryFields) ? obj.dictionaryFields as SourceField[] : [],
    };
  }
  throw new Error("Unsupported source JSON format.");
}

async function clearDictionary(pg: PgPool, projectId: string): Promise<void> {
  await pg.query("DELETE FROM pm_search_index WHERE project_id=$1 AND module_key='dictionary'", [projectId]);
  await pg.query("DELETE FROM pm_data_fields WHERE project_id=$1", [projectId]);
  await pg.query("DELETE FROM pm_data_tables WHERE project_id=$1", [projectId]);
  await pg.query("DELETE FROM pm_data_systems WHERE project_id=$1", [projectId]);
}

async function importDictionary(pg: PgPool, projectId: string, source: NormalizedSource): Promise<Record<string, number>> {
  const now = new Date().toISOString();
  const fields = source.fields.filter(isImportableField);
  const systemByOriginalId = new Map<string, string>();
  const systems = normalizeSystems(projectId, { ...source, fields });

  for (const system of systems) {
    const systemId = stableId("pm-system", projectId, system.id ?? system.code ?? system.name ?? "system");
    if (system.id) systemByOriginalId.set(system.id, systemId);
    await pg.query(`
      INSERT INTO pm_data_systems (id, project_id, code, name, type, asset_layer, owner, description, extra, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$10)
      ON CONFLICT (id) DO UPDATE SET
        code=EXCLUDED.code,
        name=EXCLUDED.name,
        type=EXCLUDED.type,
        asset_layer=EXCLUDED.asset_layer,
        owner=EXCLUDED.owner,
        description=EXCLUDED.description,
        extra=EXCLUDED.extra,
        updated_at=EXCLUDED.updated_at
    `, [
      systemId,
      projectId,
      text(system.code),
      text(system.name) || text(system.code) || "Unknown system",
      optionalText(system.type),
      optionalText(system.assetLayer ?? system.asset_layer),
      optionalText(system.owner),
      optionalText(system.description),
      JSON.stringify({ sourceId: system.id ?? null, original: system }),
      now,
    ]);
    await upsertSearchIndex(pg, {
      id: `${systemId}:search`,
      projectId,
      moduleKey: "dictionary",
      entityType: "system",
      entityId: systemId,
      title: text(system.name) || text(system.code),
      subtitle: text(system.type),
      body: text(system.description),
      keywords: [system.code, system.assetLayer ?? system.asset_layer, system.owner].map(text).filter(Boolean).join(" "),
      now,
    });
  }

  const tableKeys = new Map<string, string>();
  for (const field of fields) {
    const systemId = systemIdForField(projectId, field, systemByOriginalId);
    const tableName = text(field.tableName) || "UNKNOWN_TABLE";
    const tableKey = [systemId, text(field.database ?? field.databaseName), text(field.schema ?? field.schemaName), tableName].join("|");
    if (tableKeys.has(tableKey)) continue;
    const tableId = stableId("pm-table", projectId, tableKey);
    tableKeys.set(tableKey, tableId);
    const tableFileType = normalizeFileType(field.fileType ?? field.file_type ?? tableName);
    const tableSourceKind = tableFileType ? "文件" : normalizeTableSourceKind(field.sourceKind ?? field.sourceType);
    await pg.query(`
      INSERT INTO pm_data_tables (
        id, project_id, system_id, database_name, schema_name, table_name, table_cn,
        table_group, data_layer, source_kind, file_type, description, caliber, extra, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$15)
      ON CONFLICT (id) DO UPDATE SET
        system_id=EXCLUDED.system_id,
        database_name=EXCLUDED.database_name,
        schema_name=EXCLUDED.schema_name,
        table_name=EXCLUDED.table_name,
        table_cn=EXCLUDED.table_cn,
        table_group=EXCLUDED.table_group,
        data_layer=EXCLUDED.data_layer,
        source_kind=EXCLUDED.source_kind,
        file_type=EXCLUDED.file_type,
        description=EXCLUDED.description,
        caliber=EXCLUDED.caliber,
        extra=EXCLUDED.extra,
        updated_at=EXCLUDED.updated_at
    `, [
      tableId,
      projectId,
      systemId,
      optionalText(field.database ?? field.databaseName),
      optionalText(field.schema ?? field.schemaName),
      tableName,
      optionalText(field.tableCn),
      optionalText(field.tableGroup ?? field.group ?? field.category),
      normalizeTableDataLayer(field.dataLayer ?? field.tableLayer),
      tableSourceKind,
      tableFileType,
      optionalText(field.tableDescription),
      optionalText(field.tableCaliber),
      JSON.stringify({ sourceTableKey: tableKey, ...(tableFileType ? { fileType: tableFileType } : {}) }),
      now,
    ]);
    await upsertSearchIndex(pg, {
      id: `${tableId}:search`,
      projectId,
      moduleKey: "dictionary",
      entityType: "table",
      entityId: tableId,
      title: tableName,
      subtitle: text(field.tableCn),
      body: [field.tableDescription, field.tableCaliber].map(text).filter(Boolean).join("\n"),
      keywords: [field.database, field.schema, field.tableGroup ?? field.group ?? field.category, field.dataLayer ?? field.tableLayer, field.sourceKind ?? field.sourceType].map(text).filter(Boolean).join(" "),
      now,
    });
  }

  let fieldCount = 0;
  for (const field of fields) {
    const systemId = systemIdForField(projectId, field, systemByOriginalId);
    const tableName = text(field.tableName) || "UNKNOWN_TABLE";
    const tableKey = [systemId, text(field.database ?? field.databaseName), text(field.schema ?? field.schemaName), tableName].join("|");
    const tableId = tableKeys.get(tableKey) ?? stableId("pm-table", projectId, tableKey);
    const fieldId = stableId("pm-field", projectId, field.id ?? `${tableKey}|${field.fieldName ?? field.fieldCn ?? fieldCount}`);
    const extra = {
      sourceId: field.id ?? null,
      reference: field.reference ?? "",
      validationRules: field.validationRules ?? [],
      formatPattern: field.formatPattern ?? "",
      physicalPrimaryKey: field.physicalPrimaryKey ?? "",
      businessPrimaryKey: field.businessPrimaryKey ?? "",
      original: field,
    };
    await pg.query(`
      INSERT INTO pm_data_fields (
        id, project_id, system_id, table_id, field_name, field_cn, field_type, field_length,
        format_pattern, nullable, primary_key, required, description, acquire_logic, validation_rule, code_value,
        mapped_table, mapped_field, mapped_field_cn, data_source, remark, extra, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,$23,$23)
      ON CONFLICT (id) DO UPDATE SET
        system_id=EXCLUDED.system_id,
        table_id=EXCLUDED.table_id,
        field_name=EXCLUDED.field_name,
        field_cn=EXCLUDED.field_cn,
        field_type=EXCLUDED.field_type,
        field_length=EXCLUDED.field_length,
        format_pattern=EXCLUDED.format_pattern,
        nullable=EXCLUDED.nullable,
        primary_key=EXCLUDED.primary_key,
        required=EXCLUDED.required,
        description=EXCLUDED.description,
        acquire_logic=EXCLUDED.acquire_logic,
        validation_rule=EXCLUDED.validation_rule,
        code_value=EXCLUDED.code_value,
        mapped_table=EXCLUDED.mapped_table,
        mapped_field=EXCLUDED.mapped_field,
        mapped_field_cn=EXCLUDED.mapped_field_cn,
        data_source=EXCLUDED.data_source,
        remark=EXCLUDED.remark,
        extra=EXCLUDED.extra,
        updated_at=EXCLUDED.updated_at
    `, [
      fieldId,
      projectId,
      systemId,
      tableId,
      text(field.fieldName) || text(field.fieldCn) || "UNKNOWN_FIELD",
      optionalText(field.fieldCn),
      optionalText(field.fieldType),
      optionalText(field.fieldLength),
      optionalText(field.formatPattern),
      optionalText(field.nullable),
      yes(field.primaryKey) || yes(field.physicalPrimaryKey) || yes(field.businessPrimaryKey),
      yes(field.required),
      optionalText(field.description),
      optionalText(field.acquireLogic),
      optionalText(field.validationRule),
      optionalText(field.codeValue),
      optionalText(field.mappedTable),
      optionalText(field.mappedField),
      optionalText(field.mappedFieldCn),
      optionalText(field.dataSource),
      optionalText(field.remark),
      JSON.stringify(extra),
      now,
    ]);
    await upsertSearchIndex(pg, {
      id: `${fieldId}:search`,
      projectId,
      moduleKey: "dictionary",
      entityType: "field",
      entityId: fieldId,
      title: [field.fieldName, field.fieldCn].map(text).filter(Boolean).join(" / "),
      subtitle: [field.tableName, field.tableCn].map(text).filter(Boolean).join(" / "),
      body: [field.description, field.acquireLogic, field.validationRule, field.codeValue, field.formatPattern, field.mappedTable, field.mappedField, field.remark]
        .map(text)
        .filter(Boolean)
        .join("\n"),
      keywords: [field.database, field.schema, field.dataSource, field.fieldType, field.fieldLength, field.formatPattern].map(text).filter(Boolean).join(" "),
      now,
    });
    fieldCount += 1;
  }

  return { systems: systems.length, tables: tableKeys.size, fields: fieldCount };
}

function isImportableField(field: SourceField): boolean {
  const fieldName = text(field.fieldName).toUpperCase();
  const fieldCn = text(field.fieldCn).toUpperCase();
  if (!fieldName && !fieldCn) return false;
  if (fieldName === "END" && (!fieldCn || fieldCn === "END")) return false;
  return true;
}

function normalizeSystems(projectId: string, source: NormalizedSource): SourceSystem[] {
  if (source.systems.length > 0) return source.systems;
  const systemIds = new Set(source.fields.map(field => text(field.systemId ?? field.system_id)).filter(Boolean));
  if (systemIds.size === 0) {
    return [{
      id: stableId("source-system", projectId, "default"),
      code: "YBT",
      name: "YBT Mapping",
      type: "target model",
      assetLayer: "mapping layer",
      description: "Imported dictionary fields without explicit source systems.",
    }];
  }
  return [...systemIds].map(systemId => ({
    id: systemId,
    code: systemId.replace(/^sys[-_]?/i, "").toUpperCase(),
    name: systemId,
    type: "source system",
    assetLayer: "source layer",
  }));
}

function systemIdForField(projectId: string, field: SourceField, systemByOriginalId: Map<string, string>): string {
  const rawSystemId = text(field.systemId ?? field.system_id);
  if (rawSystemId && systemByOriginalId.has(rawSystemId)) return systemByOriginalId.get(rawSystemId)!;
  if (rawSystemId) return stableId("pm-system", projectId, rawSystemId);
  return stableId("pm-system", projectId, "default");
}

async function upsertSearchIndex(pg: PgPool, input: {
  id: string;
  projectId: string;
  moduleKey: string;
  entityType: string;
  entityId: string;
  title: string;
  subtitle: string;
  body: string;
  keywords: string;
  now: string;
}): Promise<void> {
  const searchText = [input.title, input.subtitle, input.body, input.keywords].filter(Boolean).join("\n");
  await pg.query(`
    INSERT INTO pm_search_index (
      id, project_id, module_key, entity_type, entity_id, title, subtitle, body, keywords, search_text, updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (project_id, entity_type, entity_id) DO UPDATE SET
      title=EXCLUDED.title,
      subtitle=EXCLUDED.subtitle,
      body=EXCLUDED.body,
      keywords=EXCLUDED.keywords,
      search_text=EXCLUDED.search_text,
      updated_at=EXCLUDED.updated_at
  `, [
    input.id,
    input.projectId,
    input.moduleKey,
    input.entityType,
    input.entityId,
    input.title,
    input.subtitle || null,
    input.body,
    input.keywords,
    searchText,
    input.now,
  ]);
}

function stableId(prefix: string, ...parts: Array<string | undefined | null>): string {
  const raw = parts.map(part => part ?? "").join("|");
  const hash = createHash("sha1").update(raw).digest("hex").slice(0, 16);
  const hint = slug(parts.find(Boolean) ?? "");
  return hint ? `${prefix}-${hint}-${hash}` : `${prefix}-${hash}`;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function optionalText(value: unknown): string | null {
  const valueText = text(value);
  return valueText || null;
}

function normalizeTableDataLayer(value: unknown): string {
  const raw = text(value);
  if (!raw) return "源表层";
  if (/源|source/i.test(raw)) return "源表层";
  if (/中间|middle|tmp|temp|ods|dwd|dws/i.test(raw)) return "中间层";
  if (/报表|report|dm|mart/i.test(raw)) return "报表层";
  if (/报文|message|file|xml|json/i.test(raw)) return "报文层";
  return raw;
}

function normalizeTableSourceKind(value: unknown): string {
  const raw = text(value);
  if (!raw) return "数据库";
  if (/文件|file|txt|csv|excel|xlsx|xml|json/i.test(raw)) return "文件";
  if (/库|表|database|db|table|sql/i.test(raw)) return "数据库";
  return raw;
}

function normalizeFileType(value: unknown): string | null {
  const raw = text(value).toLowerCase();
  if (!raw) return null;
  if (/(^|\\.|\\s|_)txt$|text file|文本/.test(raw)) return "txt";
  if (/(^|\\.|\\s|_)csv$/.test(raw)) return "csv";
  if (/(^|\\.|\\s|_)xml$|xml/.test(raw)) return "xml";
  if (/(^|\\.|\\s|_)(xls|xlsx)$|excel|电子表格/.test(raw)) return "excel";
  return null;
}

function yes(value: unknown): boolean {
  const valueText = text(value).toLowerCase();
  return value === true || valueText === "true" || valueText === "yes" || valueText === "y" || valueText === "1" || valueText === "是";
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
