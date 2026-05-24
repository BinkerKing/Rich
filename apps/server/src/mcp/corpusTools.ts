import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  CorpusAccentSchema,
  CorpusTemplateSchema,
  CorpusToneSchema,
  DEFAULT_CORPUS_TEMPLATES,
  renderCorpusPromptFragment,
  type CorpusTemplate,
} from "../ai/corpus.js";
import type { CorpusRepo } from "../repos/CorpusRepo.js";

async function loadTemplates(repo: CorpusRepo): Promise<CorpusTemplate[]> {
  const existing = await repo.getAll();
  if (existing && existing.length > 0) return existing;
  await repo.putAll(DEFAULT_CORPUS_TEMPLATES);
  return DEFAULT_CORPUS_TEMPLATES;
}

function scoreTemplate(t: CorpusTemplate, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const haystack = [t.id, t.name, t.scene, t.intent, t.mustInclude, t.styleGuide].join("\n").toLowerCase();
  return q.split(/\s+/).reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
}

export function registerCorpusTools(server: McpServer, corpus: CorpusRepo, eventBus: import("../lib/eventBus.js").RichEventBus): void {
  const ok = (obj: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(obj) }] });
  const err = (msg: string) => ({ isError: true, content: [{ type: "text" as const, text: msg }] });
  const fire = (op: string, detail: Record<string, unknown>): void => {
    eventBus.publish("corpus.changed", { source: "mcp", detail: { op, ...detail } });
  };

  server.tool(
    "corpus_list",
    "List Rich AI 语料模板. Call this before writing style-sensitive replies for 大斌哥. Pick the template whose scene/intent matches the task, then call corpus_get or corpus_prompt. These templates are the user's evolving preferred reply style.",
    {
      query: z.string().optional().describe("Optional scene/task keywords, e.g. '系统运行情况', 'AI 早报', '信息汇报'."),
    },
    async ({ query }) => {
      let templates = await loadTemplates(corpus);
      if (query?.trim()) {
        templates = templates
          .map(t => ({ t, score: scoreTemplate(t, query) }))
          .filter(x => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .map(x => x.t);
      }
      return ok({
        count: templates.length,
        templates: templates.map(t => ({
          id: t.id,
          name: t.name,
          scene: t.scene,
          intent: t.intent,
          tone: t.tone,
          accent: t.accent,
          mustInclude: t.mustInclude,
          updatedAt: t.updatedAt,
        })),
      });
    },
  );

  server.tool(
    "corpus_get",
    "Get one AI 语料模板 by id, including template text, style rules, and sample. Use it as the style contract before composing a response.",
    { id: z.string().min(1) },
    async ({ id }) => {
      const template = (await loadTemplates(corpus)).find(t => t.id === id);
      if (!template) return err(`Corpus template ${id} not found`);
      return ok({ template });
    },
  );

  server.tool(
    "corpus_prompt",
    "Return a prompt-ready style fragment for one AI 语料模板. Paste this fragment into your reasoning context before drafting the final answer.",
    { id: z.string().min(1) },
    async ({ id }) => {
      const template = (await loadTemplates(corpus)).find(t => t.id === id);
      if (!template) return err(`Corpus template ${id} not found`);
      return ok({ id, prompt: renderCorpusPromptFragment(template) });
    },
  );

  server.tool(
    "corpus_upsert",
    "Create or update an AI 语料模板 after the user gives feedback about wording, structure, color, required fields, or preferred style. This is how Hermes continuously learns 大斌哥's style over time.",
    {
      id: z.string().min(1).max(120),
      name: z.string().min(1).max(160),
      scene: z.string().max(500).default(""),
      intent: z.string().max(1000).default(""),
      tone: CorpusToneSchema.default("concise"),
      accent: CorpusAccentSchema.default("teal"),
      mustInclude: z.string().max(1200).default(""),
      styleGuide: z.string().max(1600).default(""),
      template: z.string().max(6000).default(""),
      sample: z.string().max(6000).default(""),
    },
    async (input) => {
      const current = await loadTemplates(corpus);
      const parsed = CorpusTemplateSchema.safeParse({ ...input, updatedAt: new Date().toISOString() });
      if (!parsed.success) return err(parsed.error.message);
      const next = parsed.data;
      const exists = current.some(t => t.id === next.id);
      const templates = exists ? current.map(t => t.id === next.id ? next : t) : [next, ...current];
      await corpus.putAll(templates);
      fire(exists ? "update" : "create", { id: next.id });
      return ok({ ok: true, template: next });
    },
  );

  server.tool(
    "corpus_delete",
    "Delete an AI 语料模板. Use sparingly; prefer corpus_upsert to improve existing templates.",
    { id: z.string().min(1) },
    async ({ id }) => {
      const current = await loadTemplates(corpus);
      const templates = current.filter(t => t.id !== id);
      if (templates.length === current.length) return err(`Corpus template ${id} not found`);
      await corpus.putAll(templates);
      fire("delete", { id });
      return ok({ ok: true, id });
    },
  );
}
