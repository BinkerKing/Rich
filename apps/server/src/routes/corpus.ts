import { Hono } from "hono";
import { z } from "zod";
import {
  CorpusTemplateSchema,
  DEFAULT_CORPUS_TEMPLATES,
  normalizeCorpusTemplates,
  renderCorpusPromptFragment,
  type CorpusTemplate,
} from "../ai/corpus.js";
import type { CorpusRepo } from "../repos/CorpusRepo.js";
import { eventBus } from "../lib/eventBus.js";

const ListSchema = z.object({
  templates: z.array(CorpusTemplateSchema).max(200),
});

async function ensureTemplates(repo: CorpusRepo): Promise<CorpusTemplate[]> {
  const existing = await repo.getAll();
  if (existing && existing.length > 0) return existing;
  await repo.putAll(DEFAULT_CORPUS_TEMPLATES);
  return DEFAULT_CORPUS_TEMPLATES;
}

function stamp(template: CorpusTemplate): CorpusTemplate {
  return { ...template, updatedAt: new Date().toISOString() };
}

export function corpusRoutes(repo: CorpusRepo): Hono {
  const r = new Hono();

  r.get("/", async (c) => {
    return c.json({ templates: await ensureTemplates(repo) });
  });

  r.put("/", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const parsed = ListSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
    const templates = normalizeCorpusTemplates(parsed.data.templates).map(stamp);
    await repo.putAll(templates);
    eventBus.publish("corpus.changed", { detail: { op: "replace", count: templates.length } });
    return c.json({ ok: true, templates });
  });

  r.post("/reset", async (c) => {
    const templates = DEFAULT_CORPUS_TEMPLATES.map(stamp);
    await repo.putAll(templates);
    eventBus.publish("corpus.changed", { detail: { op: "reset", count: templates.length } });
    return c.json({ ok: true, templates });
  });

  r.get("/:id", async (c) => {
    const id = c.req.param("id");
    const template = (await ensureTemplates(repo)).find(t => t.id === id);
    if (!template) return c.json({ error: "not found" }, 404);
    return c.json({ template, prompt: renderCorpusPromptFragment(template) });
  });

  r.put("/:id", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const current = await ensureTemplates(repo);
    const existing = current.find(t => t.id === id);
    const parsed = CorpusTemplateSchema.safeParse({
      ...(existing ?? {}),
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    });
    if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
    const next = parsed.data;
    const templates = existing
      ? current.map(t => t.id === id ? next : t)
      : [next, ...current];
    await repo.putAll(templates);
    eventBus.publish("corpus.changed", { detail: { op: existing ? "update" : "create", id } });
    return c.json({ ok: true, template: next });
  });

  r.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const current = await ensureTemplates(repo);
    const templates = current.filter(t => t.id !== id);
    if (templates.length === current.length) return c.json({ error: "not found" }, 404);
    await repo.putAll(templates);
    eventBus.publish("corpus.changed", { detail: { op: "delete", id } });
    return c.json({ ok: true, templates });
  });

  return r;
}
