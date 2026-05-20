import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import { elementsRoutes } from "./routes/elements.js";
import { relationsRoutes } from "./routes/relations.js";
import { pathsRoutes } from "./routes/paths.js";
import { signalsRoutes } from "./routes/signals.js";
import { stateRoutes } from "./routes/state.js";
import { aiRoutes } from "./routes/ai.js";
import { adminRoutes } from "./routes/admin.js";
import { join } from "node:path";
import { JsonElementsRepo } from "./repos/JsonElementsRepo.js";
import { JsonRelationsRepo } from "./repos/JsonRelationsRepo.js";
import { JsonPathsRepo } from "./repos/JsonPathsRepo.js";
import { JsonSignalsRepo } from "./repos/JsonSignalsRepo.js";
import { JsonQARepo } from "./repos/JsonQARepo.js";
import { JsonAnnotationsRepo } from "./repos/JsonAnnotationsRepo.js";
import { annotationsRoutes } from "./routes/annotations.js";
import { imagesRoutes } from "./routes/images.js";
import { JsonStateRepo } from "./repos/JsonStateRepo.js";
import { CachedElementsRepo } from "./repos/CachedElementsRepo.js";
import { CachedRelationsRepo } from "./repos/CachedRelationsRepo.js";
import { SqliteElementsRepo } from "./repos/SqliteElementsRepo.js";
import { SqliteRelationsRepo } from "./repos/SqliteRelationsRepo.js";
import { SqlitePathsRepo } from "./repos/SqlitePathsRepo.js";
import { SqliteSignalsRepo } from "./repos/SqliteSignalsRepo.js";
import { SqliteQARepo } from "./repos/SqliteQARepo.js";
import { SqliteAnnotationsRepo } from "./repos/SqliteAnnotationsRepo.js";
import { SqliteStateRepo } from "./repos/SqliteStateRepo.js";
import { openDb } from "./db/sqlite.js";
import type { ElementsRepo } from "./repos/ElementsRepo.js";
import type { RelationsRepo } from "./repos/RelationsRepo.js";
import type { PathsRepo } from "./repos/PathsRepo.js";
import type { SignalsRepo } from "./repos/SignalsRepo.js";
import type { QARepo } from "./repos/QARepo.js";
import type { AnnotationsRepo } from "./repos/AnnotationsRepo.js";
import type { StateRepo } from "./repos/StateRepo.js";
import { dataDir, aiDir } from "./lib/paths.js";
import { ClaudeAdapter } from "./ai/claude.js";
import { CodexAdapter } from "./ai/codex.js";
import { configureOpLog } from "./ai/aiOpLog.js";
import { imageQueue } from "./ai/imageQueue.js";
import type { AIAdapter } from "./ai/adapter.js";
import { createLogger, noopLogger, type Logger } from "./lib/logger.js";
import { installShutdownHandlers, childRegistry } from "./lib/childRegistry.js";

export interface BuildAppOptions {
  adapters?: AIAdapter[];
  logger?: Logger;
  /** Override the AI manuals directory. Defaults to monorepo's `ai/`. */
  aiDir?: string;
}

export function buildApp(root: string, adapters?: AIAdapter[], logger?: Logger, opts: BuildAppOptions = {}) {
  // Storage backend selection. SQLite by default; legacy JSON files via KE_STORAGE=json.
  const storage = (process.env.KE_STORAGE ?? "sqlite").toLowerCase();
  let elements: ElementsRepo;
  let relations: RelationsRepo;
  let paths: PathsRepo;
  let signals: SignalsRepo;
  let qa: QARepo;
  let annotations: AnnotationsRepo;
  let state: StateRepo;
  if (storage === "json") {
    elements = new CachedElementsRepo(new JsonElementsRepo(root));
    relations = new CachedRelationsRepo(new JsonRelationsRepo(root));
    paths = new JsonPathsRepo(root);
    signals = new JsonSignalsRepo(root);
    qa = new JsonQARepo(root);
    annotations = new JsonAnnotationsRepo(root);
    state = new JsonStateRepo(root);
  } else {
    const dbPath = process.env.KE_SQLITE_PATH ?? join(root, "ke.db");
    const db = openDb(dbPath);
    elements = new SqliteElementsRepo(db);
    relations = new SqliteRelationsRepo(db);
    paths = new SqlitePathsRepo(db);
    signals = new SqliteSignalsRepo(db);
    qa = new SqliteQARepo(db);
    annotations = new SqliteAnnotationsRepo(db);
    state = new SqliteStateRepo(db);
  }
  // Order matters: pickAdapter() returns adapters[0] when no preference is given.
  // Codex first because Claude SDK 401s when the server is launched inside a
  // Claude Code session (no OAuth refresh available in the subprocess).
  const ai = adapters ?? opts.adapters ?? [new CodexAdapter(), new ClaudeAdapter()];
  const log = logger ?? opts.logger ?? noopLogger;
  const manualsDir = opts.aiDir ?? aiDir();
  // Persist every AI op prompt + output to data/ai-ops.jsonl for the admin UI.
  configureOpLog(root);
  // Image generation runs in a separate AI op from text generation. The text
  // op emits image-placeholder blocks; this background queue processes them.
  // pickAdapter() returns adapters[0] when no preference — Codex first.
  imageQueue.configure(ai[0], elements, log);
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.header("access-control-allow-origin", "*");
    c.header("access-control-allow-headers", "content-type");
    if (c.req.method === "OPTIONS") return c.body(null, 204);
    await next();
  });
  app.route("/api/elements", elementsRoutes({ elements, relations, paths, qa, annotations, signals }));
  app.route("/api/relations", relationsRoutes(relations));
  app.route("/api/paths", pathsRoutes(paths));
  app.route("/api/signals", signalsRoutes(signals));
  app.route("/api/annotations", annotationsRoutes(annotations));
  app.route("/api/images", imagesRoutes());
  app.route("/api/state", stateRoutes(state, elements, signals));
  app.route("/api/ai", aiRoutes({
    adapters: ai, elements, relations, paths, signals, qa, annotations,
    aiDir: manualsDir, logger: log,
  }));
  app.route("/api/admin", adminRoutes({ signals, aiDir: manualsDir, adapters: ai }));

  app.get("/api/health", async (c) => {
    const adapterChecks = await Promise.all(ai.map(async (a) => ({
      name: a.name,
      available: await a.available(),
    })));
    const allAdaptersOk = adapterChecks.some(a => a.available);
    return c.json({
      ok: allAdaptersOk,
      adapters: adapterChecks,
      uptimeSec: Math.round(process.uptime()),
      childProcesses: childRegistry.size(),
      signals: await signals.count(),
    });
  });

  return app;
}

if (fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  const port = Number(process.env.PORT ?? 3001);
  const log = createLogger({ bound: { app: "ke-server" } });
  const app = buildApp(dataDir(), undefined, log);
  serve({ fetch: app.fetch, port });
  log.info("server.started", { port, url: `http://localhost:${port}` });
  installShutdownHandlers({
    onShutdown: () => log.info("server.shutdown", { childProcesses: childRegistry.size() }),
  });
}
