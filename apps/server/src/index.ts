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
import { dataDir } from "./lib/paths.js";
import { ClaudeAdapter } from "./ai/claude.js";
import { CodexAdapter } from "./ai/codex.js";
import type { AIAdapter } from "./ai/adapter.js";

export function buildApp(root: string, adapters?: AIAdapter[]) {
  const elements = new CachedElementsRepo(new JsonElementsRepo(root));
  const relations = new CachedRelationsRepo(new JsonRelationsRepo(root));
  const paths = new JsonPathsRepo(root);
  const ai = adapters ?? [new ClaudeAdapter(), new CodexAdapter()];
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
  app.route("/api/ai", aiRoutes({ adapters: ai, elements, relations, paths }));
  app.get("/api/health", (c) => c.json({ ok: true }));
  return app;
}

if (fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  const port = Number(process.env.PORT ?? 3001);
  const app = buildApp(dataDir());
  serve({ fetch: app.fetch, port });
  console.log(`Know Everything server: http://localhost:${port}`);
}
