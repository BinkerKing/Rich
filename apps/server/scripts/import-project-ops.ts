import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { openPostgresPool, type PgPool } from "../src/db/postgres.js";
import type { ProjectManagementModuleKey } from "../src/repos/ProjectManagementRepo.js";

type AnyRecord = Record<string, unknown>;

interface ImportArgs {
  source?: string;
  projectId: string;
  replace: boolean;
  modules?: ProjectManagementModuleKey[];
}

const POSTGRES_URL = process.env.DATABASE_URL ?? process.env.KE_DATABASE_URL ?? process.env.RICH_DB_URL;

const SECTION_MAP: Array<{ sourceKey: string; moduleKey: ProjectManagementModuleKey; label: string }> = [
  { sourceKey: "operationFlow", moduleKey: "workflow", label: "作业流程" },
  { sourceKey: "scenarioGroups", moduleKey: "scenarios", label: "场景手册" },
  { sourceKey: "environments", moduleKey: "environments", label: "环境配置" },
  { sourceKey: "deploymentSteps", moduleKey: "deploymentSteps", label: "部署步骤" },
  { sourceKey: "monitoringSections", moduleKey: "monitoring", label: "监控预警" },
  { sourceKey: "codeApps", moduleKey: "codeVersions", label: "代码版本" },
  { sourceKey: "todos", moduleKey: "todos", label: "项目代办" },
];

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!POSTGRES_URL) throw new Error("Set DATABASE_URL, KE_DATABASE_URL, or RICH_DB_URL before importing project ops data.");
  const sourcePath = args.source ?? join(homedir(), "Documents", "Ai-WorkSpace", "Tools", "数据映射治理平台", "src", "data", "opsManual.json");
  const source = JSON.parse(await readFile(sourcePath, "utf8")) as AnyRecord;
  const project = (Array.isArray(source.projects) ? source.projects[0] : source) as AnyRecord;
  const pg = openPostgresPool(POSTGRES_URL);
  await pg.ready;
  try {
    const sections = args.modules?.length
      ? SECTION_MAP.filter(section => args.modules?.includes(section.moduleKey))
      : SECTION_MAP;
    if (args.replace) await clearModules(pg, args.projectId, sections);
    const imported = await importModules(pg, args.projectId, project, sections);
    console.log(JSON.stringify({ ok: true, projectId: args.projectId, source: sourcePath, replace: args.replace, imported }, null, 2));
  } finally {
    await pg.pool.end();
  }
}

function parseArgs(argv: string[]): ImportArgs {
  const args: ImportArgs = { projectId: "riking-ybt", replace: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--source") args.source = argv[++i];
    else if (arg === "--project-id") args.projectId = argv[++i] ?? args.projectId;
    else if (arg === "--replace") args.replace = true;
    else if (arg === "--modules") {
      const raw = argv[++i] ?? "";
      const moduleKeys = new Set(SECTION_MAP.map(section => section.moduleKey));
      args.modules = raw
        .split(",")
        .map(value => value.trim())
        .filter((value): value is ProjectManagementModuleKey => moduleKeys.has(value as ProjectManagementModuleKey));
    }
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: pnpm --filter @ke/server pm:import:ops -- --project-id <id> --source <opsManual.json> [--replace] [--modules scenarios,workflow]");
      process.exit(0);
    }
  }
  return args;
}

async function clearModules(pg: PgPool, projectId: string, sections: typeof SECTION_MAP): Promise<void> {
  const moduleKeys = sections.map(section => section.moduleKey);
  await pg.query("DELETE FROM pm_search_index WHERE project_id=$1 AND module_key = ANY($2::text[])", [projectId, moduleKeys]);
  await pg.query("DELETE FROM pm_module_items WHERE project_id=$1 AND module_key = ANY($2::text[])", [projectId, moduleKeys]);
}

async function importModules(pg: PgPool, projectId: string, project: AnyRecord, sections = SECTION_MAP): Promise<Record<string, number>> {
  const now = new Date().toISOString();
  const imported: Record<string, number> = {};
  for (const section of sections) {
    const rows = Array.isArray(project[section.sourceKey]) ? project[section.sourceKey] as AnyRecord[] : [];
    imported[section.moduleKey] = rows.length;
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const itemId = stableId("pm-item", projectId, section.moduleKey, text(row.id) || String(index));
      const title = text(row.title) || text(row.name) || text(row.version) || `${section.label} ${index + 1}`;
      const subtitle = text(row.lane) || text(row.phase) || text(row.category) || text(row.status);
      await pg.query(`
        INSERT INTO pm_module_items (id, project_id, module_key, parent_id, title, subtitle, sort_order, content, created_at, updated_at)
        VALUES ($1,$2,$3,NULL,$4,$5,$6,$7::jsonb,$8,$8)
        ON CONFLICT (id) DO UPDATE SET
          title=EXCLUDED.title,
          subtitle=EXCLUDED.subtitle,
          sort_order=EXCLUDED.sort_order,
          content=EXCLUDED.content,
          updated_at=EXCLUDED.updated_at
      `, [itemId, projectId, section.moduleKey, title, subtitle || null, index, JSON.stringify({ sourceKey: section.sourceKey, original: row }), now]);
      await upsertSearchIndex(pg, {
        id: `${itemId}:search`,
        projectId,
        moduleKey: section.moduleKey,
        entityType: "moduleItem",
        entityId: itemId,
        title,
        subtitle: subtitle || section.label,
        body: flattenText(row).slice(0, 4000),
        keywords: [section.label, section.sourceKey, text(row.id)].filter(Boolean).join(" "),
        now,
      });
    }
  }
  return imported;
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
    INSERT INTO pm_search_index (id, project_id, module_key, entity_type, entity_id, title, subtitle, body, keywords, search_text, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    ON CONFLICT (project_id, entity_type, entity_id) DO UPDATE SET
      title=EXCLUDED.title,
      subtitle=EXCLUDED.subtitle,
      body=EXCLUDED.body,
      keywords=EXCLUDED.keywords,
      search_text=EXCLUDED.search_text,
      updated_at=EXCLUDED.updated_at
  `, [input.id, input.projectId, input.moduleKey, input.entityType, input.entityId, input.title, input.subtitle, input.body, input.keywords, searchText, input.now]);
}

function stableId(prefix: string, ...parts: Array<string | undefined | null>): string {
  const raw = parts.map(part => part ?? "").join("|");
  const hash = createHash("sha1").update(raw).digest("hex").slice(0, 16);
  return `${prefix}-${hash}`;
}

function flattenText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(flattenText).filter(Boolean).join("\n");
  if (typeof value === "object") return Object.values(value as AnyRecord).map(flattenText).filter(Boolean).join("\n");
  return "";
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
