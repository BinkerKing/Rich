import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import {
  PROJECT_MANAGEMENT_MODULES,
  normalizeDictionaryDatabaseConfig,
  type ProjectDictionaryFieldDetail,
  type ProjectDictionaryMappingRule,
  type ProjectDictionaryMappingTempTableInput,
  type ProjectDictionaryRectificationInput,
  type ProjectDictionaryRectificationPatch,
  type ProjectDictionarySystem,
  type ProjectDictionaryTable,
  type ProjectManagementModuleKey,
  type ProjectManagementRepo,
} from "../repos/ProjectManagementRepo.js";
import {
  createDictionaryEntityTable,
  extractDictionaryEntityTestData,
  inspectDictionaryEntitySchema,
  prepareDictionaryEntityExtractionSql,
  queryDictionaryEntityTestData,
  testDictionaryEntityConnection,
  validateDictionaryMappingSql,
  type DictionaryEntitySyncResult,
  writeDictionaryEntityTestData,
} from "../modules/project-dictionary/application/entityService.js";
import {
  InMemoryDictionaryExecutionJobStore,
  type DictionaryExecutionJobStore,
  type DictionaryExecutionJob,
} from "../modules/project-dictionary/index.js";

const ASSET_MIMES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

type DictionaryEntityExtractionJob = DictionaryExecutionJob<DictionaryEntitySyncResult>;

const dictionaryEntityExtractionJobs = new InMemoryDictionaryExecutionJobStore<DictionaryEntitySyncResult>();

type ProjectManagementRouteOptions = {
  executionJobs?: DictionaryExecutionJobStore<DictionaryEntitySyncResult>;
};

const workspaceDir = process.env.RICH_WORKSPACE_DIR
  ? resolve(process.env.RICH_WORKSPACE_DIR)
  : resolve(process.env.HOME ?? process.cwd(), "Documents/Ai-WorkSpace");

const scenarioImageRoot = resolve(
  workspaceDir,
  "Tools",
  "数据映射治理平台",
  "public",
  "ops-manual-app",
  "data",
  "images",
);

export function projectManagementRoutes(repo: ProjectManagementRepo, options: ProjectManagementRouteOptions = {}): Hono {
  const r = new Hono();
  const executionJobs = options.executionJobs ?? dictionaryEntityExtractionJobs;

  r.use("/:projectId/dictionary/*", async (c, next) => {
    c.header("cache-control", "no-store");
    await next();
  });

  r.get("/:projectId/summary", async c => {
    const projectId = c.req.param("projectId");
    return c.json(await repo.getSummary(projectId));
  });

  r.get("/:projectId/search", async c => {
    const projectId = c.req.param("projectId");
    const q = c.req.query("q") ?? "";
    const limit = Number(c.req.query("limit") ?? 30);
    return c.json({
      query: q,
      results: await repo.searchAll(projectId, q, Number.isFinite(limit) ? limit : 30),
    });
  });

  r.get("/:projectId/modules/:moduleKey/items", async c => {
    const projectId = c.req.param("projectId");
    const moduleKey = c.req.param("moduleKey") as ProjectManagementModuleKey;
    const parentId = c.req.query("parentId") || undefined;
    if (!PROJECT_MANAGEMENT_MODULES.some(module => module.key === moduleKey)) {
      return c.json({ error: "unknown module" }, 404);
    }
    return c.json(await repo.listModuleItems(projectId, moduleKey, parentId));
  });

  r.get("/:projectId/assets/scenario-images/:filename", async c => {
    const filename = c.req.param("filename");
    const target = resolve(scenarioImageRoot, filename);
    if (!target.startsWith(`${scenarioImageRoot}/`) || !existsSync(target)) return c.notFound();
    const buf = await readFile(target);
    return c.body(new Uint8Array(buf), 200, {
      "content-type": ASSET_MIMES[extname(target).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "private, max-age=3600",
    });
  });

  r.post("/:projectId/modules/:moduleKey/items", async c => {
    const projectId = c.req.param("projectId");
    const moduleKey = c.req.param("moduleKey") as ProjectManagementModuleKey;
    if (!PROJECT_MANAGEMENT_MODULES.some(module => module.key === moduleKey)) {
      return c.json({ error: "unknown module" }, 404);
    }
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return c.json({ error: "title required" }, 400);
    const content = body.content && typeof body.content === "object" && !Array.isArray(body.content)
      ? body.content as Record<string, unknown>
      : {};
    return c.json(await repo.createModuleItem(projectId, {
      moduleKey,
      parentId: typeof body.parentId === "string" ? body.parentId : null,
      title,
      subtitle: typeof body.subtitle === "string" ? body.subtitle : null,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
      content,
    }), 201);
  });

  r.patch("/:projectId/modules/items/:itemId", async c => {
    const projectId = c.req.param("projectId");
    const itemId = c.req.param("itemId");
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const content = body.content && typeof body.content === "object" && !Array.isArray(body.content)
      ? body.content as Record<string, unknown>
      : undefined;
    const item = await repo.updateModuleItem(projectId, itemId, {
      parentId: body.parentId === null || typeof body.parentId === "string" ? body.parentId : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      subtitle: body.subtitle === null || typeof body.subtitle === "string" ? body.subtitle : undefined,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
      content,
    });
    if (!item) return c.json({ error: "item not found" }, 404);
    return c.json(item);
  });

  r.delete("/:projectId/modules/items/:itemId", async c => {
    const projectId = c.req.param("projectId");
    const itemId = c.req.param("itemId");
    const ok = await repo.deleteModuleItem(projectId, itemId);
    if (!ok) return c.json({ error: "item not found" }, 404);
    return c.json({ ok: true });
  });

  r.post("/:projectId/modules/:moduleKey/reorder", async c => {
    const projectId = c.req.param("projectId");
    const moduleKey = c.req.param("moduleKey") as ProjectManagementModuleKey;
    if (!PROJECT_MANAGEMENT_MODULES.some(module => module.key === moduleKey)) {
      return c.json({ error: "unknown module" }, 404);
    }
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const itemIds = Array.isArray(body.itemIds) ? body.itemIds.filter((id): id is string => typeof id === "string") : [];
    await repo.reorderModuleItems(projectId, moduleKey, itemIds);
    return c.json({ ok: true });
  });

  r.get("/:projectId/dictionary/systems", async c => {
    const projectId = c.req.param("projectId");
    return c.json(await repo.listDictionarySystems(projectId));
  });

  r.patch("/:projectId/dictionary/systems/:systemId", async c => {
    const projectId = c.req.param("projectId");
    const systemId = c.req.param("systemId");
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const patch = {
      type: typeof body.type === "string" || body.type === null ? body.type : undefined,
      assetLayer: typeof body.assetLayer === "string" || body.assetLayer === null ? body.assetLayer : undefined,
      extra: body.extra && typeof body.extra === "object" && !Array.isArray(body.extra)
        ? body.extra as Record<string, unknown>
        : undefined,
    };
    const updated = await repo.updateDictionarySystem(projectId, systemId, patch);
    if (!updated) return c.json({ error: "system not found" }, 404);
    return c.json(updated);
  });

  r.post("/:projectId/dictionary/systems/:systemId/entity/test-connection", async c => {
    const projectId = c.req.param("projectId");
    const systemId = c.req.param("systemId");
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const extra = body.extra && typeof body.extra === "object" && !Array.isArray(body.extra)
      ? body.extra as Record<string, unknown>
      : undefined;
    try {
      const systems = await repo.listDictionarySystems(projectId);
      const system = systems.find(candidate => candidate.id === systemId);
      if (!system) return c.json({ error: "system not found" }, 404);
      const testSystem = mergeDictionarySystemExtraForTest(system, extra);
      const result = await testDictionaryEntityConnection(testSystem);
      return c.json(result);
    } catch (errorValue) {
      return c.json({ error: errorValue instanceof Error ? errorValue.message : String(errorValue) }, 400);
    }
  });

  r.get("/:projectId/dictionary/tables", async c => {
    const projectId = c.req.param("projectId");
    const systemId = c.req.query("systemId") || undefined;
    return c.json(await repo.listDictionaryTables(projectId, systemId));
  });

  r.get("/:projectId/dictionary/tables/:tableId/fields", async c => {
    const projectId = c.req.param("projectId");
    const tableId = c.req.param("tableId");
    return c.json(await repo.listDictionaryFields(projectId, tableId));
  });

  r.get("/:projectId/dictionary/tables/:tableId/mapping/temp-tables", async c => {
    const projectId = c.req.param("projectId");
    const tableId = c.req.param("tableId");
    return c.json(await repo.listDictionaryMappingTempTables(projectId, tableId));
  });

  r.put("/:projectId/dictionary/tables/:tableId/mapping/temp-tables", async c => {
    const projectId = c.req.param("projectId");
    const tableId = c.req.param("tableId");
    const body = await c.req.json().catch(() => ({})) as { tempTables?: unknown };
    const tempTables = Array.isArray(body.tempTables) ? body.tempTables : [];
    return c.json(await repo.replaceDictionaryMappingTempTables(projectId, tableId, tempTables as ProjectDictionaryMappingTempTableInput[]));
  });

  r.post("/:projectId/dictionary/tables/:tableId/entity/create", async c => {
    const projectId = c.req.param("projectId");
    const tableId = c.req.param("tableId");
    try {
      const target = await loadDictionaryEntityTarget(repo, projectId, tableId);
      const result = await createDictionaryEntityTable(target);
      return c.json(result);
    } catch (errorValue) {
      return c.json({ error: errorValue instanceof Error ? errorValue.message : String(errorValue) }, 400);
    }
  });

  r.post("/:projectId/dictionary/tables/:tableId/entity/schema", async c => {
    const projectId = c.req.param("projectId");
    const tableId = c.req.param("tableId");
    try {
      const target = await loadDictionaryEntityTarget(repo, projectId, tableId);
      const result = await inspectDictionaryEntitySchema(target);
      return c.json(result);
    } catch (errorValue) {
      return c.json({ error: errorValue instanceof Error ? errorValue.message : String(errorValue) }, 400);
    }
  });

  r.post("/:projectId/dictionary/tables/:tableId/entity/test-data", async c => {
    const projectId = c.req.param("projectId");
    const tableId = c.req.param("tableId");
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const rows = Array.isArray(body.rows)
      ? body.rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row))
      : [];
    try {
      const target = await loadDictionaryEntityTarget(repo, projectId, tableId);
      const result = await writeDictionaryEntityTestData({ ...target, rows: rows.slice(0, 1000) });
      return c.json(result);
    } catch (errorValue) {
      return c.json({ error: errorValue instanceof Error ? errorValue.message : String(errorValue) }, 400);
    }
  });

  r.post("/:projectId/dictionary/tables/:tableId/entity/query", async c => {
    const projectId = c.req.param("projectId");
    const tableId = c.req.param("tableId");
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    try {
      const target = await loadDictionaryEntityTarget(repo, projectId, tableId);
      const result = await queryDictionaryEntityTestData({
        ...target,
        page: typeof body.page === "number" ? body.page : Number(body.page),
        pageSize: typeof body.pageSize === "number" ? body.pageSize : Number(body.pageSize),
        searchFieldId: typeof body.searchFieldId === "string" ? body.searchFieldId : undefined,
        search: typeof body.search === "string" ? body.search : undefined,
      });
      return c.json(result);
    } catch (errorValue) {
      return c.json({ error: errorValue instanceof Error ? errorValue.message : String(errorValue) }, 400);
    }
  });

  r.post("/:projectId/dictionary/tables/:tableId/mapping/sql-validate", async c => {
    const projectId = c.req.param("projectId");
    const tableId = c.req.param("tableId");
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    try {
      const target = await loadDictionaryEntityTarget(repo, projectId, tableId);
      const fieldRules = Array.isArray(body.fieldRules)
        ? body.fieldRules.flatMap(item => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return [];
          const record = item as Record<string, unknown>;
          return typeof record.fieldId === "string" && typeof record.logic === "string"
            ? [{ fieldId: record.fieldId, logic: record.logic }]
            : [];
        })
        : undefined;
      const result = await validateDictionaryMappingSql({
        ...target,
        projectId,
        repo,
        caliber: typeof body.caliber === "string" ? body.caliber : undefined,
        fieldRules,
        runtimeParams: body.runtimeParams && typeof body.runtimeParams === "object" && !Array.isArray(body.runtimeParams)
          ? body.runtimeParams as Record<string, unknown>
          : undefined,
      });
      return c.json(result);
    } catch (errorValue) {
      return c.json({ error: errorValue instanceof Error ? errorValue.message : String(errorValue) }, 400);
    }
  });

  r.post("/:projectId/dictionary/tables/:tableId/entity/extract", async c => {
    const projectId = c.req.param("projectId");
    const tableId = c.req.param("tableId");
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const jobId = randomUUID();
    const startedAt = new Date().toISOString();
    const job: DictionaryEntityExtractionJob = {
      ok: true,
      id: jobId,
      projectId,
      tableId,
      status: "running",
      message: "后台抽取任务已启动",
      startedAt,
    };
    await executionJobs.create(job);
    void (async () => {
      try {
        const target = await loadDictionaryEntityTarget(repo, projectId, tableId);
        const result = await extractDictionaryEntityTestData({
          ...target,
          projectId,
          repo,
          limit: typeof body.limit === "number" ? body.limit : Number(body.limit),
          runtimeParams: body.runtimeParams && typeof body.runtimeParams === "object" && !Array.isArray(body.runtimeParams)
            ? body.runtimeParams as Record<string, unknown>
            : undefined,
        });
        await executionJobs.update(jobId, {
          status: "success",
          message: result.message,
          finishedAt: new Date().toISOString(),
          result,
        });
      } catch (errorValue) {
        await executionJobs.update(jobId, {
          status: "error",
          message: errorValue instanceof Error ? errorValue.message : String(errorValue),
          finishedAt: new Date().toISOString(),
          error: errorValue instanceof Error ? errorValue.message : String(errorValue),
        });
      }
    })();
    return c.json(job);
  });

  r.post("/:projectId/dictionary/tables/:tableId/entity/extract/prepare", async c => {
    const projectId = c.req.param("projectId");
    const tableId = c.req.param("tableId");
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    try {
      const target = await loadDictionaryEntityTarget(repo, projectId, tableId);
      const result = await prepareDictionaryEntityExtractionSql({
        ...target,
        projectId,
        repo,
        limit: typeof body.limit === "number" ? body.limit : Number(body.limit),
        runtimeParams: body.runtimeParams && typeof body.runtimeParams === "object" && !Array.isArray(body.runtimeParams)
          ? body.runtimeParams as Record<string, unknown>
          : undefined,
      });
      return c.json(result);
    } catch (errorValue) {
      return c.json({ error: errorValue instanceof Error ? errorValue.message : String(errorValue) }, 400);
    }
  });

  r.get("/:projectId/dictionary/tables/:tableId/entity/extract/:jobId", async c => {
    const projectId = c.req.param("projectId");
    const tableId = c.req.param("tableId");
    const jobId = c.req.param("jobId");
    const job = await executionJobs.get(projectId, tableId, jobId);
    if (!job) return c.json({ error: "抽取任务不存在或已过期" }, 404);
    return c.json(job);
  });

  r.post("/:projectId/dictionary/fields/resolve", async c => {
    const projectId = c.req.param("projectId");
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const refs = Array.isArray(body.refs) ? body.refs.filter((ref): ref is string => typeof ref === "string") : [];
    return c.json({ results: await repo.resolveDictionaryFieldRefs(projectId, refs) });
  });

  r.get("/:projectId/dictionary/fields/search", async c => {
    const projectId = c.req.param("projectId");
    const q = c.req.query("q") ?? "";
    const limit = Number(c.req.query("limit") ?? 30);
    return c.json({
      query: q,
      results: await repo.searchDictionaryFields(projectId, q, Number.isFinite(limit) ? limit : 30),
    });
  });

  r.get("/:projectId/dictionary/fields/:fieldId", async c => {
    const projectId = c.req.param("projectId");
    const fieldId = c.req.param("fieldId");
    const field = await repo.getDictionaryField(projectId, fieldId);
    if (!field) return c.json({ error: "field not found" }, 404);
    return c.json(field);
  });

  r.get("/:projectId/dictionary/rectifications", async c => {
    return c.json(await repo.listDictionaryRectifications(c.req.param("projectId")));
  });

  r.post("/:projectId/dictionary/rectifications", async c => {
    const projectId = c.req.param("projectId");
    const body = await c.req.json().catch(() => ({})) as Partial<ProjectDictionaryRectificationInput>;
    const entityTypes = new Set(["library", "table", "field", "codeSet", "mapping"]);
    if (!body.entityType || !entityTypes.has(body.entityType) || !body.entityId?.trim() || !body.propertyKey?.trim() || !body.requirement?.trim()) {
      return c.json({ error: "entityType, entityId, propertyKey and requirement are required" }, 400);
    }
    return c.json(await repo.createDictionaryRectification(projectId, {
      entityType: body.entityType,
      entityId: body.entityId.trim(),
      propertyKey: body.propertyKey.trim(),
      requirement: body.requirement.trim(),
      createdBy: body.createdBy?.trim() || undefined,
    }));
  });

  r.patch("/:projectId/dictionary/rectifications/:rectificationId", async c => {
    const projectId = c.req.param("projectId");
    const body = await c.req.json().catch(() => ({})) as ProjectDictionaryRectificationPatch;
    const validStatuses = new Set(["open", "fixed", "verified", "cancelled"]);
    if (body.status && !validStatuses.has(body.status)) return c.json({ error: "invalid rectification status" }, 400);
    const record = await repo.updateDictionaryRectification(projectId, c.req.param("rectificationId"), body);
    if (!record) return c.json({ error: "rectification not found" }, 404);
    return c.json(record);
  });

  return r;
}

function mergeDictionarySystemExtraForTest(system: ProjectDictionarySystem, extra?: Record<string, unknown>): ProjectDictionarySystem {
  if (!extra) return system;
  const dbConfig = normalizeDictionaryDatabaseConfig(extra);
  return {
    ...system,
    extra,
    dbType: dbConfig.dbType,
    sqlDialect: dbConfig.sqlDialect,
    connection: dbConfig.connection,
    entitySyncPolicy: dbConfig.entitySyncPolicy,
  };
}

async function loadDictionaryEntityTarget(repo: ProjectManagementRepo, projectId: string, tableId: string) {
  const tables = await repo.listDictionaryTables(projectId);
  const table = tables.find(item => item.id === tableId);
  if (!table) throw new Error("表元不存在");
  const systems = await repo.listDictionarySystems(projectId);
  const system = systems.find(item => item.id === table.systemId);
  if (!system) throw new Error("当前表未绑定库元");
  const fieldHits = await repo.listDictionaryFields(projectId, tableId);
  const fields = (await Promise.all(fieldHits.map(field => repo.getDictionaryField(projectId, field.id))))
    .filter((field): field is NonNullable<typeof field> => Boolean(field));
  const mappingRules = await repo.listDictionaryMappingRules(projectId, tableId);
  const tableMappingRules = mappingRules.filter(rule => !rule.fieldId);
  const derivedTableMappingRules = deriveDictionaryTableMappingRulesFromFieldRules(mappingRules);
  const tableWithMapping = applyDictionaryTableMappingRules(
    table,
    mergeDictionaryTableMappingRules(tableMappingRules, derivedTableMappingRules),
  );
  const mappingByFieldId = new Map<string, ProjectDictionaryMappingRule[]>();
  for (const rule of mappingRules.filter(rule => rule.fieldId)) {
    const rules = mappingByFieldId.get(rule.fieldId!) ?? [];
    rules.push(rule);
    mappingByFieldId.set(rule.fieldId!, rules);
  }
  const fieldsWithMapping = fields.map((field): ProjectDictionaryFieldDetail => {
    const rules = (mappingByFieldId.get(field.id) ?? []).sort((left, right) => left.sortOrder - right.sortOrder);
    if (rules.length === 0) return field;
    if (rules.length === 1) {
      const rule = rules[0]!;
      return {
        ...field,
        acquireLogic: rule.logicText?.trim() || field.acquireLogic,
        remark: rule.remark ?? field.remark,
        extra: {
          ...(field.extra ?? {}),
          mappingRuleId: rule.id,
        },
      };
    }
    return {
      ...field,
      acquireLogic: rules.map((rule, index) => formatDictionaryScenarioMappingRule(rule, index, "逻辑")).join("\n\n"),
      remark: rules.map(rule => rule.remark).find(remark => remark !== undefined) ?? field.remark,
      extra: {
        ...(field.extra ?? {}),
        mappingRuleId: rules[0]?.id,
      },
    };
  });
  return { system, table: tableWithMapping, fields: fieldsWithMapping };
}

function applyDictionaryTableMappingRules(
  table: ProjectDictionaryTable,
  rules: ProjectDictionaryMappingRule[],
): ProjectDictionaryTable {
  const sortedRules = [...rules].sort((left, right) => left.sortOrder - right.sortOrder);
  if (sortedRules.length === 0) return table;
  return {
    ...table,
    caliber: sortedRules.map((rule, index) => formatDictionaryScenarioMappingRule(rule, index, "口径")).join("\n\n"),
  };
}

function mergeDictionaryTableMappingRules(
  tableRules: ProjectDictionaryMappingRule[],
  derivedRules: ProjectDictionaryMappingRule[],
): ProjectDictionaryMappingRule[] {
  if (tableRules.length === 0) return derivedRules;
  if (derivedRules.length === 0) return tableRules;

  const merged = new Map<string, ProjectDictionaryMappingRule>();
  tableRules.forEach((rule, index) => {
    merged.set(dictionaryMappingRuleScenarioKey(rule, index), rule);
  });
  derivedRules.forEach((rule, index) => {
    const key = dictionaryMappingRuleScenarioKey(rule, index);
    const existing = merged.get(key);
    if (!existing || !dictionaryMappingRuleHasCaliberJson(existing)) {
      merged.set(key, rule);
    }
  });
  return Array.from(merged.values()).sort((left, right) => left.sortOrder - right.sortOrder);
}

function deriveDictionaryTableMappingRulesFromFieldRules(rules: ProjectDictionaryMappingRule[]): ProjectDictionaryMappingRule[] {
  const derived = new Map<string, ProjectDictionaryMappingRule>();
  const sortedRules = rules
    .filter(rule => rule.fieldId)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  for (const rule of sortedRules) {
    const condition = dictionaryMappingRuleRawCondition(rule);
    if (!condition) continue;
    const scenarioTitle = dictionaryMappingRuleRawScenarioTitle(rule);
    const key = scenarioTitle ? dictionaryMappingScenarioTitleKey(scenarioTitle) : `rule_${rule.sortOrder}`;
    if (derived.has(key)) continue;
    derived.set(key, {
      ...rule,
      id: `derived-table-caliber-${rule.id}`,
      fieldId: undefined,
      logicText: condition,
      convertedSql: undefined,
      remark: undefined,
      sourceFields: [],
      actions: [],
      raw: {
        ...(rule.raw ?? {}),
        scenarioName: scenarioTitle || undefined,
      },
    });
  }
  return Array.from(derived.values());
}

function dictionaryMappingRuleScenarioKey(rule: ProjectDictionaryMappingRule, index: number): string {
  const title = dictionaryMappingRuleRawScenarioTitle(rule);
  if (title) return dictionaryMappingScenarioTitleKey(title);
  const displayTitle = dictionaryMappingRuleScenarioTitle(rule, index);
  return dictionaryMappingScenarioTitleKey(displayTitle) || `rule_${rule.sortOrder}`;
}

function dictionaryMappingScenarioTitleKey(title: string): string {
  const normalized = title.replace(/\s+/g, "").toLowerCase();
  const match = normalized.match(/^场景(\d+)/);
  return match ? `scenario_${Number(match[1])}` : normalized;
}

function dictionaryMappingRuleHasCaliberJson(rule: ProjectDictionaryMappingRule): boolean {
  return dictionaryMappingTextLooksLikeCaliberJson(rule.logicText)
    || dictionaryMappingTextLooksLikeCaliberJson(dictionaryMappingRuleRawCondition(rule));
}

function dictionaryMappingTextLooksLikeCaliberJson(value: unknown): boolean {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(text) as { op?: unknown };
    const op = typeof parsed.op === "string" ? parsed.op.trim().toLowerCase() : "";
    return ["dataset", "full_extract", "query_scope", "scope"].includes(op);
  } catch {
    return false;
  }
}

function formatDictionaryScenarioMappingRule(rule: ProjectDictionaryMappingRule, index: number, logicLabel: "逻辑" | "口径"): string {
  const lines = [dictionaryMappingRuleScenarioTitle(rule, index)];
  const logicText = rule.logicText?.trim();
  if (logicText) lines.push(`${logicLabel}：${logicText}`);
  const remark = rule.remark?.trim();
  if (remark) lines.push(`备注：${remark}`);
  return lines.join("\n");
}

function dictionaryMappingRuleRawCondition(rule: ProjectDictionaryMappingRule): string {
  const rawCondition = rule.raw?.condition;
  if (typeof rawCondition === "string") return rawCondition.trim();
  if (rawCondition && typeof rawCondition === "object" && !Array.isArray(rawCondition)) {
    return JSON.stringify(rawCondition);
  }
  return "";
}

function dictionaryMappingRuleRawScenarioTitle(rule: ProjectDictionaryMappingRule): string {
  const raw = rule.raw ?? {};
  return [
    raw.scenarioName,
    raw.sceneName,
    raw.scenario,
    raw.scene,
    raw.title,
    raw.name,
  ].map(value => typeof value === "string" ? value.trim() : "").find(Boolean) || "";
}

function dictionaryMappingRuleScenarioTitle(rule: ProjectDictionaryMappingRule, index: number): string {
  const rawTitle = dictionaryMappingRuleRawScenarioTitle(rule);
  const fallback = `场景${index + 1}`;
  if (!rawTitle) return fallback;
  return /^场景\s*\d+/.test(rawTitle) ? rawTitle : `${fallback} ${rawTitle}`;
}
