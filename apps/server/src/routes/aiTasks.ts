import { Hono } from "hono";

export interface AiTaskRouteDeps {
  availability(): Promise<{ hermes: boolean; multica: boolean }>;
  publish(input: unknown): Promise<unknown>;
}

export function aiTaskRoutes(deps: AiTaskRouteDeps): Hono {
  const routes = new Hono();
  routes.get("/availability", async c => c.json(await deps.availability()));
  routes.post("/", async c => {
    const body = await c.req.json().catch(() => ({})) as { executor?: unknown };
    const availability = await deps.availability();
    if (body.executor !== "hermes" && body.executor !== "multica") return c.json({ error: "executor required" }, 400);
    if (!availability[body.executor]) return c.json({ error: `executor ${body.executor} is unavailable` }, 409);
    return c.json(await deps.publish(body), 201);
  });
  return routes;
}
