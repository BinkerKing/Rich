import { Hono, type Context } from "hono";
import type { DeepMindMapCreateInput, DeepMindMapUpdateInput, DeepMindMapsRepo } from "../repos/DeepMindMapsRepo.js";

const unavailable = (c: Context) => c.json({ error: "DeepMindMap requires Postgres" }, 503);
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const createInput = (value: unknown): DeepMindMapCreateInput | null => {
  if (!object(value) || typeof value.title !== "string" || !value.title.trim() || !object(value.map)) return null;
  return { title: value.title.trim(), map: value.map, ...(typeof value.id === "string" ? { id: value.id } : {}), ...(value.importOnly === true ? { importOnly: true } : {}) };
};
const updateInput = (value: unknown): DeepMindMapUpdateInput | null => {
  const input = createInput(value);
  return input && object(value) && typeof value.expectedUpdatedAt === "string" ? { title: input.title, map: input.map, expectedUpdatedAt: value.expectedUpdatedAt } : null;
};

export function deepMindMapsRoutes(repo: DeepMindMapsRepo | null): Hono {
  const route = new Hono();
  route.get("/", async c => repo ? c.json(await repo.list()) : unavailable(c));
  route.get("/:id", async c => { if (!repo) return unavailable(c); const item = await repo.get(c.req.param("id")); return item ? c.json(item) : c.json({ error: "DeepMindMap not found" }, 404); });
  route.post("/", async c => { if (!repo) return unavailable(c); const input = createInput(await c.req.json().catch(() => null)); return input ? c.json(await repo.create(input), 201) : c.json({ error: "title and map are required" }, 400); });
  route.put("/:id", async c => { if (!repo) return unavailable(c); const input = updateInput(await c.req.json().catch(() => null)); if (!input) return c.json({ error: "title, map and expectedUpdatedAt are required" }, 400); const item = await repo.update(c.req.param("id"), input); return item === "conflict" ? c.json({ error: "DeepMindMap changed on the server" }, 409) : item ? c.json(item) : c.json({ error: "DeepMindMap not found" }, 404); });
  route.delete("/:id", async c => { if (!repo) return unavailable(c); return await repo.remove(c.req.param("id")) ? c.body(null, 204) : c.json({ error: "DeepMindMap not found" }, 404); });
  return route;
}
