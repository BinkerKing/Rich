import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import { elementsRoutes } from "./routes/elements.js";
import { relationsRoutes } from "./routes/relations.js";
import { pathsRoutes } from "./routes/paths.js";
import { aiRoutes } from "./routes/ai.js";
import { JsonElementsRepo } from "./repos/JsonElementsRepo.js";
import { JsonRelationsRepo } from "./repos/JsonRelationsRepo.js";
import { JsonPathsRepo } from "./repos/JsonPathsRepo.js";
import { CachedElementsRepo } from "./repos/CachedElementsRepo.js";
import { CachedRelationsRepo } from "./repos/CachedRelationsRepo.js";
import { dataDir, aiDir } from "./lib/paths.js";
import { ClaudeAdapter } from "./ai/claude.js";
import { CodexAdapter } from "./ai/codex.js";
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
  const elements = new CachedElementsRepo(new JsonElementsRepo(root));
  const relations = new CachedRelationsRepo(new JsonRelationsRepo(root));
  const paths = new JsonPathsRepo(root);
  const ai = adapters ?? opts.adapters ?? [new ClaudeAdapter(), new CodexAdapter()];
  const log = logger ?? opts.logger ?? noopLogger;
  const manualsDir = opts.aiDir ?? aiDir();
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.header("access-control-allow-origin", "*");
    c.header("access-control-allow-headers", "content-type");
    if (c.req.method === "OPTIONS") return c.body(null, 204);
    await next();
  });
  app.route("/api/elements", elementsRoutes(elements));
  app.route("/api/relations", relationsRoutes(relations));
  app.route("/api/paths", pathsRoutes(paths));
  app.route("/api/ai", aiRoutes({ adapters: ai, elements, relations, paths, aiDir: manualsDir, logger: log }));

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
