import { Hono } from "hono";
import type { Annotation } from "@ke/domain";
import type { AnnotationsRepo } from "../repos/AnnotationsRepo.js";

export function annotationsRoutes(repo: AnnotationsRepo): Hono {
  const r = new Hono();

  r.get("/", async (c) => {
    const elementId = c.req.query("elementId");
    if (!elementId) return c.json({ error: "elementId required" }, 400);
    return c.json(await repo.listForElement(elementId));
  });

  r.post("/", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const elementId = String(body.elementId ?? "");
    const kind = body.kind === "underline" ? "underline" : "highlight";
    const text = String(body.text ?? "").trim();
    if (!elementId || !text) return c.json({ error: "elementId + text required" }, 400);
    const a: Annotation = {
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      elementId,
      kind,
      text,
      contextBefore: typeof body.contextBefore === "string" ? body.contextBefore : undefined,
      contextAfter: typeof body.contextAfter === "string" ? body.contextAfter : undefined,
      note: typeof body.note === "string" ? body.note : undefined,
      createdAt: new Date().toISOString(),
    };
    await repo.append(a);
    return c.json(a, 201);
  });

  r.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const ok = await repo.remove(id);
    if (!ok) return c.json({ error: "not found" }, 404);
    return c.body(null, 204);
  });

  return r;
}
