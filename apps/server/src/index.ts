import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { elementsRoutes } from "./routes/elements.js";
import { aiRoutes } from "./routes/ai.js";
import { JsonElementsRepo } from "./repos/JsonElementsRepo.js";
import { dataDir } from "./lib/paths.js";

export function buildApp(root: string) {
  const repo = new JsonElementsRepo(root);
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.header("access-control-allow-origin", "*");
    c.header("access-control-allow-headers", "content-type");
    if (c.req.method === "OPTIONS") return c.body(null, 204);
    await next();
  });
  app.route("/api/elements", elementsRoutes(repo));
  app.route("/api/ai", aiRoutes(root));
  app.get("/api/health", (c) => c.json({ ok: true }));
  return app;
}

const isMain = fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
if (isMain) {
  const port = Number(process.env.PORT ?? 3001);
  const app = buildApp(dataDir());
  serve({ fetch: app.fetch, port });
  console.log(`Know Everything server: http://localhost:${port}`);
}
