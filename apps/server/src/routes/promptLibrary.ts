import { Hono } from "hono";
import { PROMPT_MIGRATION_CATALOG, type PromptLibraryService, type PromptTemplateUpdate } from "../prompt-library/PromptLibraryService.js";

export function promptLibraryRoutes(prompts: PromptLibraryService): Hono {
  const route = new Hono();
  route.get("/templates", async c => c.json({ templates: await prompts.list(), migrationCatalog: PROMPT_MIGRATION_CATALOG }));
  route.put("/templates/:key", async c => {
    const body = await c.req.json().catch(() => null) as PromptTemplateUpdate | null;
    if (!body) return c.json({ error: "A template patch is required." }, 400);
    const template = await prompts.update(c.req.param("key"), body);
    return template ? c.json({ template }) : c.json({ error: "Prompt template not found." }, 404);
  });
  route.post("/preview", async c => {
    const body = await c.req.json().catch(() => null) as { key?: unknown; variables?: unknown } | null;
    if (!body || typeof body.key !== "string") return c.json({ error: "A scene key is required." }, 400);
    const variables = body.variables && typeof body.variables === "object" && !Array.isArray(body.variables)
      ? Object.fromEntries(Object.entries(body.variables).filter((entry): entry is [string, string] => typeof entry[1] === "string")) : {};
    try { return c.json(await prompts.render(body.key, variables)); }
    catch (error) { return c.json({ error: error instanceof Error ? error.message : String(error) }, 400); }
  });
  return route;
}
