import { Hono } from "hono";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { SignalsRepo } from "../repos/SignalsRepo.js";
import type { Signal } from "@ke/domain";
import { readAllOpRecords, reduceToFinal } from "../ai/aiOpLog.js";
import type { AIAdapter } from "../ai/adapter.js";
import { childRegistry } from "../lib/childRegistry.js";
import { currentAIEngineSettings, writeAIEngineSettings } from "../ai/engineSettings.js";
import { describeModelRouting, listAIScenarios, normalizeAdapterName, normalizeScenario, type AIScenario, type AdapterName } from "../ai/modelRouter.js";
import { listAIContextPolicies } from "../ai/contextPolicy.js";
import type { CorpusRepo } from "../repos/CorpusRepo.js";
import type { ChatConversationsRepo } from "../repos/ChatConversationsRepo.js";
import { corpusRoutes } from "./corpus.js";

export interface AdminRoutesDeps {
  signals: SignalsRepo;
  aiDir: string;
  adapters: AIAdapter[];
  corpus: CorpusRepo;
  chatConversations?: ChatConversationsRepo | null;
}

/**
 * Backstage routes used by the admin UI.
 * - /ops          → list AI op log records (newest first), filterable
 * - /ops/:id      → full record (prompt + output)
 * - /signals      → pass-through to SignalsRepo with stable shape
 * - /manuals      → list manual files + content
 * - /manuals/:name → content + meta of one manual
 */
export function adminRoutes(deps: AdminRoutesDeps): Hono {
  const r = new Hono();

  r.route("/corpus", corpusRoutes(deps.corpus));

  // -- AI op log --
  r.get("/ops", async (c) => {
    const op = c.req.query("op");
    const status = c.req.query("status");
    const elementId = c.req.query("elementId");
    const limit = c.req.query("limit") ? Math.min(500, Math.max(1, Number(c.req.query("limit")))) : 100;
    const raw = await readAllOpRecords();
    const reduced = reduceToFinal(raw);
    let filtered = reduced;
    if (op) filtered = filtered.filter(r => r.op === op);
    if (status) filtered = filtered.filter(r => r.status === status);
    if (elementId) filtered = filtered.filter(r => r.elementId === elementId);
    // For the list view we strip the prompt + output to keep payload small.
    const list = filtered.slice(0, limit).map(({ prompt, output, ...rest }) => ({
      ...rest,
      promptPreview: prompt ? prompt.slice(0, 200) : "",
      outputPreview: output ? output.slice(0, 200) : "",
      promptLen: prompt?.length ?? 0,
      outputLen: output?.length ?? 0,
    }));
    return c.json({ total: filtered.length, items: list });
  });

  r.get("/ops/:id", async (c) => {
    const id = c.req.param("id");
    const raw = await readAllOpRecords();
    // Walk back to find the latest entry for this id.
    const matches = raw.filter(r => r.id === id);
    if (matches.length === 0) return c.json({ error: "not found" }, 404);
    return c.json(matches[matches.length - 1]);
  });

  // -- Signals (admin view: full records, no filtering shortcuts) --
  r.get("/signals", async (c) => {
    const type = c.req.query("type") as Signal["type"] | undefined;
    const elementId = c.req.query("elementId");
    const since = c.req.query("since");
    const limit = c.req.query("limit") ? Number(c.req.query("limit")) : 200;
    const items = await deps.signals.list({ type, elementId, since, limit });
    // Newest first by ts.
    items.sort((a, b) => b.ts.localeCompare(a.ts));
    return c.json({ items });
  });

  // -- Manuals --
  r.get("/manuals", async (c) => {
    let files: string[] = [];
    try {
      files = (await readdir(deps.aiDir)).filter(f => f.endsWith(".md"));
    } catch {
      return c.json({ items: [] });
    }
    const items = await Promise.all(files.map(async (file) => {
      const name = file.replace(/\.md$/, "");
      const content = await readFile(join(deps.aiDir, file), "utf8").catch(() => "");
      return { name, file, length: content.length, content };
    }));
    return c.json({ items });
  });

  r.get("/manuals/:name", async (c) => {
    const name = c.req.param("name");
    if (!/^[\w-]+$/.test(name)) return c.json({ error: "bad name" }, 400);
    try {
      const content = await readFile(join(deps.aiDir, `${name}.md`), "utf8");
      return c.json({ name, content, length: content.length });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return c.json({ error: "not found" }, 404);
      throw e;
    }
  });

  // -- AI engine monitoring --
  r.get("/engine", async (_c) => {
    const adapterChecks = await Promise.all(deps.adapters.map(async (a) => ({
      name: a.name,
      available: await a.available(),
    })));
    const records = reduceToFinal(await readAllOpRecords());
    const now = Date.now();
    const window1h = now - 60 * 60 * 1000;
    const window24h = now - 24 * 60 * 60 * 1000;
    const isWithin = (iso: string, since: number) => new Date(iso).getTime() >= since;
    function statsOver(since: number) {
      const xs = records.filter(r => isWithin(r.ts, since));
      const total = xs.length;
      const done = xs.filter(r => r.status === "done");
      const errored = xs.filter(r => r.status === "error");
      const running = xs.filter(r => r.status === "running");
      const durations = done
        .map(r => r.durationMs)
        .filter((d): d is number => typeof d === "number" && d > 0);
      const avgDurationMs = durations.length === 0
        ? 0
        : Math.round(durations.reduce((s, d) => s + d, 0) / durations.length);
      const maxDurationMs = durations.length === 0 ? 0 : Math.max(...durations);
      const byOp = new Map<string, number>();
      for (const r of xs) byOp.set(r.op, (byOp.get(r.op) ?? 0) + 1);
      return {
        total,
        done: done.length,
        errored: errored.length,
        running: running.length,
        successRate: total === 0 ? null : Math.round((done.length / total) * 1000) / 10,
        avgDurationMs,
        maxDurationMs,
        byOp: Array.from(byOp.entries()).map(([op, n]) => ({ op, count: n })).sort((a, b) => b.count - a.count),
      };
    }
    const chatConversations = deps.chatConversations
      ? await deps.chatConversations.listConversations(8)
      : [];
    const chatContext = await Promise.all(chatConversations.map(async (conversation) => {
      const [summary, messageCount] = await Promise.all([
        deps.chatConversations!.getSummary(conversation.id),
        deps.chatConversations!.countMessages(conversation.id),
      ]);
      return {
        conversationId: conversation.id,
        title: conversation.title,
        surface: conversation.surface,
        lastMessageAt: conversation.lastMessageAt,
        messageCount,
        summaryUpdatedAt: summary?.updatedAt,
        summaryMessageCount: summary?.messageCount ?? 0,
        hasSummary: Boolean(summary?.summary?.trim()),
      };
    }));
    return _c.json({
      ts: new Date().toISOString(),
      adapters: adapterChecks,
      routing: await describeModelRouting(deps.adapters),
      contextPolicies: listAIContextPolicies(),
      chatContext,
      settings: currentAIEngineSettings(),
      uptimeSec: Math.round(process.uptime()),
      childProcesses: childRegistry.size(),
      signalsTotal: await deps.signals.count(),
      stats: {
        lastHour: statsOver(window1h),
        last24h: statsOver(window24h),
        allTime: statsOver(0),
      },
      // Latest 10 errors for quick triage.
      recentErrors: records
        .filter(r => r.status === "error")
        .slice(0, 10)
        .map(r => ({ id: r.id, ts: r.ts, op: r.op, elementId: r.elementId, error: r.error })),
    });
  });

  r.get("/engine/settings", async (c) => {
    return c.json({
      scenarios: listAIScenarios(),
      adapters: deps.adapters.map(adapter => adapter.name),
      settings: currentAIEngineSettings(),
    });
  });

  r.put("/engine/settings", async (c) => {
    const raw = await c.req.json().catch(() => null) as { routes?: Record<string, unknown> } | null;
    const routes: Partial<Record<AIScenario, AdapterName>> = {};
    const availableAdapters = new Set(deps.adapters.map(adapter => adapter.name));
    for (const [scenarioValue, adapterValue] of Object.entries(raw?.routes ?? {})) {
      const scenario = normalizeScenario(scenarioValue);
      const adapter = normalizeAdapterName(adapterValue);
      if (!scenario || !adapter || !availableAdapters.has(adapter)) continue;
      routes[scenario] = adapter;
    }
    return c.json({
      scenarios: listAIScenarios(),
      adapters: deps.adapters.map(adapter => adapter.name),
      settings: writeAIEngineSettings(routes),
    });
  });

  return r;
}
