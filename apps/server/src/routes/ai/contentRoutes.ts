import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Element } from "@ke/domain";
import type { AIAdapter } from "../../ai/adapter.js";
import { generateDailyNews } from "../../ai/content/operations.js";
import { imageQueue } from "../../ai/imageQueue.js";
import { pickScenarioAdapter } from "../../ai/pickAdapter.js";
import { recordSignal } from "../../ai/signalRecorder.js";
import type { ElementsRepo } from "../../repos/ElementsRepo.js";
import type { RelationsRepo } from "../../repos/RelationsRepo.js";
import type { SignalsRepo } from "../../repos/SignalsRepo.js";
import { noopLogger, type Logger } from "../../lib/logger.js";

export interface ContentRoutesDeps { adapters: AIAdapter[]; elements: ElementsRepo; relations: RelationsRepo; signals: SignalsRepo; logger?: Logger; }
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || `n${Date.now().toString(36).slice(-6)}`;

export function contentRoutes(deps: ContentRoutesDeps): Hono {
  const r = new Hono(); const log = deps.logger ?? noopLogger;
  r.post("/news/generate-daily", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const raw = typeof body.date === "string" ? body.date.trim() : "";
    const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : new Date().toISOString().slice(0, 10);
    const parent = await deps.elements.get("ai-news");
    if (!parent) return c.json({ error: "ai-news topic not found; create it first" }, 404);
    const adapter = pickScenarioAdapter(deps.adapters, "content", body.model as "claude-code" | "codex" | undefined);
    const startedAt = Date.now(); const roundupId = `ai-news.${date}`;
    return streamSSE(c, async (stream) => {
      let deltas = 0;
      try { for await (const ev of generateDailyNews(adapter, { date, signal: c.req.raw.signal })) {
        if (ev.type === "delta") deltas++;
        if (ev.type === "error") await recordSignal(deps.signals, { ts: new Date().toISOString(), type: "op.failed", manual: "knowledge", op: "generate-daily-news", adapter: adapter.name, data: { date, durationMs: Date.now() - startedAt, message: ev.message } });
        await stream.writeSSE({ event: ev.type, data: JSON.stringify(ev) });
        if (ev.type !== "done") continue;
        const now = new Date().toISOString();
        const roundup: Element = { id: roundupId, type: "report", title: `${date} AI 早报`, subtitle: ev.result.editorNote.split(/[\n。]/).find(s => s.trim()) ?? `${date} 当日 AI 进展速览`, tags: ["ai-news", `date:${date}`, "daily-roundup"], content: { sections: [{ id: "editor-note", title: "编辑按语", blocks: [{ style: "prose", text: ev.result.editorNote }] }] }, metadata: { createdAt: now, updatedAt: now, generatedBy: "ai", aiModel: adapter.name, richness: 2 } };
        await deps.elements.put(roundup); await deps.relations.append([{ id: `rel.ai-news-child-${roundupId}`, kind: "child", from: "ai-news", to: roundupId, createdAt: now }]);
        const relations = [] as Array<{ id: string; kind: "child"; from: string; to: string; createdAt: string }>;
        for (const [index, item] of ev.result.items.entries()) { const childId = `${roundupId}.${slugify(item.title) || `item-${index + 1}`}`; await deps.elements.put({ id: childId, type: "report", title: item.title, subtitle: item.subtitle, tags: ["ai-news", `category:${item.category}`, `impact:${item.impact}`, `date:${date}`], content: { sections: item.sections }, metadata: { createdAt: now, updatedAt: now, generatedBy: "ai", aiModel: adapter.name, richness: 2 } }); relations.push({ id: `rel.${roundupId}-child-${childId}`, kind: "child", from: roundupId, to: childId, createdAt: now }); void imageQueue.scheduleForElement(childId); }
        await deps.relations.append(relations); log.info("ai.op.done", { op: "generate-daily-news", durationMs: Date.now() - startedAt, deltas, items: ev.result.items.length }); await recordSignal(deps.signals, { ts: new Date().toISOString(), type: "op.completed", manual: "knowledge", op: "generate-daily-news", adapter: adapter.name, elementId: roundupId, data: { date, durationMs: Date.now() - startedAt, itemCount: ev.result.items.length } }); await stream.writeSSE({ event: "materialized", data: JSON.stringify({ roundupId, itemCount: ev.result.items.length }) });
      }} catch (error) { const message = error instanceof Error ? error.message : String(error); log.error("ai.op.error", { op: "generate-daily-news", durationMs: Date.now() - startedAt, message }); await stream.writeSSE({ event: "error", data: JSON.stringify({ type: "error", message }) }); }
    });
  }); return r;
}
