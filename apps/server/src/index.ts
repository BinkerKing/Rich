import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { fileURLToPath } from "node:url";
import { existsSync, realpathSync } from "node:fs";
import { spawn } from "node:child_process";
import { elementsRoutes } from "./routes/elements.js";
import { relationsRoutes } from "./routes/relations.js";
import { pathsRoutes } from "./routes/paths.js";
import { signalsRoutes } from "./routes/signals.js";
import { stateRoutes } from "./routes/state.js";
import { corpusRoutes } from "./routes/corpus.js";
import { aiRoutes } from "./routes/ai.js";
import { adminRoutes } from "./routes/admin.js";
import { join, resolve as pathResolve, join as pathJoin, extname as pathExtname } from "node:path";
import { readFile as fsReadFile, stat as fsStat } from "node:fs/promises";

const STATIC_MIMES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico":  "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

type MiniProgramTone = "cyan" | "blue" | "gold" | "green" | "violet" | "slate";

interface MiniProgramDefinition {
  id: string;
  label: string;
  desc: string;
  category: string;
  icon: string;
  tone: MiniProgramTone;
  candidates: string[];
}

const richWorkspaceDir = process.env.RICH_WORKSPACE_DIR
  ? pathResolve(process.env.RICH_WORKSPACE_DIR)
  : pathResolve(process.env.HOME ?? process.cwd(), "Documents/Ai-WorkSpace");

function inWorkspace(...segments: string[]) {
  return pathResolve(richWorkspaceDir, ...segments);
}

const MINI_PROGRAMS: MiniProgramDefinition[] = [
  {
    id: "riking-ybt-ops-manual",
    label: "Riking-YBT-OpsManual",
    desc: "打开【首都银行】一表通独立运维手册",
    category: "Script",
    icon: "book",
    tone: "cyan",
    candidates: [
      inWorkspace("Tools/Riking-YBT-OpsManual/index.html"),
      inWorkspace("Script/Riking-YBT-OpsManual/index.html"),
    ],
  },
  {
    id: "file-compare",
    label: "对比文件工具",
    desc: "打开中间层数据文件对比工具",
    category: "tools",
    icon: "card",
    tone: "gold",
    candidates: [
      inWorkspace("Tools/对比文件脚本/web/compare.html"),
      inWorkspace("Tools/对比文件脚本/dist/中间层数据文件对比工具/首页.html"),
      inWorkspace("Script/对比文件脚本/web/compare.html"),
      inWorkspace("Script/对比文件脚本/dist/中间层数据文件对比工具/首页.html"),
    ],
  },
  {
    id: "speech-script-presenter",
    label: "演讲稿",
    desc: "适合演讲现场查看和编辑节点、重点、提示的讲稿小程序",
    category: "Tools",
    icon: "chat",
    tone: "blue",
    candidates: [
      inWorkspace("Tools/SpeechScriptPresenter/index.html"),
    ],
  },
];

function resolveMiniProgramTarget(program: MiniProgramDefinition): string | null {
  return program.candidates.find(candidate => existsSync(candidate)) ?? null;
}

function findOpsManualIndex(): string | null {
  const external = MINI_PROGRAMS.find(program => program.id === "riking-ybt-ops-manual");
  return external ? resolveMiniProgramTarget(external) : null;
}

function openLocalFile(target: string) {
  const command = process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "cmd"
      : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", target] : [target];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}
import { JsonElementsRepo } from "./repos/JsonElementsRepo.js";
import { JsonRelationsRepo } from "./repos/JsonRelationsRepo.js";
import { JsonPathsRepo } from "./repos/JsonPathsRepo.js";
import { JsonSignalsRepo } from "./repos/JsonSignalsRepo.js";
import { JsonQARepo } from "./repos/JsonQARepo.js";
import { JsonAnnotationsRepo } from "./repos/JsonAnnotationsRepo.js";
import { annotationsRoutes } from "./routes/annotations.js";
import { imagesRoutes } from "./routes/images.js";
import { attachmentsRoutes } from "./routes/attachments.js";
import { mindmapsRoutes } from "./routes/mindmaps.js";
import { JsonStateRepo } from "./repos/JsonStateRepo.js";
import { JsonCorpusRepo } from "./repos/JsonCorpusRepo.js";
import { CachedElementsRepo } from "./repos/CachedElementsRepo.js";
import { CachedRelationsRepo } from "./repos/CachedRelationsRepo.js";
import { SqliteElementsRepo } from "./repos/SqliteElementsRepo.js";
import { SqliteRelationsRepo } from "./repos/SqliteRelationsRepo.js";
import { SqlitePathsRepo } from "./repos/SqlitePathsRepo.js";
import { SqliteSignalsRepo } from "./repos/SqliteSignalsRepo.js";
import { SqliteChatVisualBlocksRepo } from "./repos/SqliteChatVisualBlocksRepo.js";
import { SqliteChatAttachmentsRepo } from "./repos/SqliteChatAttachmentsRepo.js";
import { SqliteQARepo } from "./repos/SqliteQARepo.js";
import { SqliteAnnotationsRepo } from "./repos/SqliteAnnotationsRepo.js";
import { SqliteStateRepo } from "./repos/SqliteStateRepo.js";
import { SqliteCorpusRepo } from "./repos/SqliteCorpusRepo.js";
import { openDb } from "./db/sqlite.js";
import { openPostgresPool } from "./db/postgres.js";
import type { ElementsRepo } from "./repos/ElementsRepo.js";
import type { RelationsRepo } from "./repos/RelationsRepo.js";
import type { PathsRepo } from "./repos/PathsRepo.js";
import type { SignalsRepo } from "./repos/SignalsRepo.js";
import type { ChatVisualBlocksRepo } from "./repos/ChatVisualBlocksRepo.js";
import type { ChatAttachmentsRepo } from "./repos/ChatAttachmentsRepo.js";
import type { HealthRepo } from "./repos/HealthRepo.js";
import type { QARepo } from "./repos/QARepo.js";
import type { AnnotationsRepo } from "./repos/AnnotationsRepo.js";
import type { StateRepo } from "./repos/StateRepo.js";
import type { CorpusRepo } from "./repos/CorpusRepo.js";
import { dataDir, aiDir } from "./lib/paths.js";
import { ClaudeAdapter } from "./ai/claude.js";
import { CodexAdapter } from "./ai/codex.js";
import { HermesAdapter } from "./ai/hermes.js";
import { configureOpLog, healStaleRunningOps } from "./ai/aiOpLog.js";
import { imageQueue } from "./ai/imageQueue.js";
import type { AIAdapter } from "./ai/adapter.js";
import { createLogger, noopLogger, type Logger } from "./lib/logger.js";
import { installShutdownHandlers, childRegistry } from "./lib/childRegistry.js";
import { mountMcp } from "./mcp/transport.js";
import { eventsRoute } from "./routes/events.js";
import { greatMeRoutes } from "./routes/greatMe.js";
import { chatRoutes } from "./routes/chat.js";
import { chatVisualBlocksRoutes } from "./routes/chatVisualBlocks.js";
import { chatAttachmentsRoutes } from "./routes/chatAttachments.js";
import { healthRoutes } from "./routes/health.js";
import { createReminderTicker } from "./lib/reminderTicker.js";
import { projectsRoutes } from "./routes/projects.js";
import { projectManagementRoutes } from "./routes/projectManagement.js";
import { rikingProjectsRoutes } from "./routes/rikingProjects.js";
import { cronRoutes } from "./routes/cron.js";
import { ImprovementsRepo, type ImprovementsStore } from "./repos/ImprovementsRepo.js";
import { improvementsRoutes } from "./routes/improvements.js";
import { InvocationsRepo, type InvocationsStore } from "./repos/InvocationsRepo.js";
import { ToolRuntime } from "./tools/runtime.js";
import { lockScreenTool } from "./tools/lockScreen.js";
import { toolboxRoutes } from "./routes/toolbox.js";
import { mascotRoutes } from "./routes/mascot.js";
import { SqliteGreatMeRepo } from "./repos/SqliteGreatMeRepo.js";
import { JsonGreatMeRepo } from "./repos/JsonGreatMeRepo.js";
import type { GreatMeRepo } from "./repos/GreatMeRepo.js";
import { PostgresElementsRepo } from "./repos/PostgresElementsRepo.js";
import { PostgresRelationsRepo } from "./repos/PostgresRelationsRepo.js";
import { PostgresPathsRepo } from "./repos/PostgresPathsRepo.js";
import { PostgresSignalsRepo } from "./repos/PostgresSignalsRepo.js";
import { PostgresChatVisualBlocksRepo } from "./repos/PostgresChatVisualBlocksRepo.js";
import { PostgresChatAttachmentsRepo } from "./repos/PostgresChatAttachmentsRepo.js";
import { PostgresHealthRepo } from "./repos/PostgresHealthRepo.js";
import { PostgresQARepo } from "./repos/PostgresQARepo.js";
import { PostgresAnnotationsRepo } from "./repos/PostgresAnnotationsRepo.js";
import { PostgresStateRepo } from "./repos/PostgresStateRepo.js";
import { PostgresCorpusRepo } from "./repos/PostgresCorpusRepo.js";
import { PostgresGreatMeRepo } from "./repos/PostgresGreatMeRepo.js";
import { PostgresInvocationsRepo } from "./repos/PostgresInvocationsRepo.js";
import { PostgresImprovementsRepo } from "./repos/PostgresImprovementsRepo.js";
import { getAgentId } from "./lib/agentId.js";
import type { ProjectManagementRepo } from "./repos/ProjectManagementRepo.js";
import { EmptyProjectManagementRepo } from "./repos/EmptyProjectManagementRepo.js";
import { PostgresProjectManagementRepo } from "./repos/PostgresProjectManagementRepo.js";
import { SqliteProjectManagementRepo } from "./repos/SqliteProjectManagementRepo.js";

export interface BuildAppOptions {
  adapters?: AIAdapter[];
  logger?: Logger;
  /** Override the AI manuals directory. Defaults to monorepo's `ai/`. */
  aiDir?: string;
}

export function buildApp(root: string, adapters?: AIAdapter[], logger?: Logger, opts: BuildAppOptions = {}) {
  // Storage backend selection. SQLite by default; legacy JSON files via KE_STORAGE=json.
  // For multi-machine Rich nodes, KE_STORAGE=postgres uses DATABASE_URL / KE_DATABASE_URL.
  const storage = (process.env.KE_STORAGE ?? "sqlite").toLowerCase();
  let elements: ElementsRepo;
  let relations: RelationsRepo;
  let paths: PathsRepo;
  let signals: SignalsRepo;
  let qa: QARepo;
  let annotations: AnnotationsRepo;
  let state: StateRepo;
  let corpus: CorpusRepo;
  let greatMe: GreatMeRepo;
  let improvements: ImprovementsStore | null = null;
  let invocations: InvocationsStore | null = null;
  let projectManagement: ProjectManagementRepo;
  /** chat_visual_blocks 仅 sqlite + postgres 后端支持；json 模式下保持 null。 */
  let chatVisualBlocks: ChatVisualBlocksRepo | null = null;
  /** chat_attachments 同上 —— bytea 存储需要数据库后端 */
  let chatAttachments: ChatAttachmentsRepo | null = null;
  /** Body Insights 健康档案 —— V0.1 只支持 postgres（数据敏感、需跨机同步） */
  let healthRepo: HealthRepo | null = null;
  if (storage === "json") {
    elements = new CachedElementsRepo(new JsonElementsRepo(root));
    relations = new CachedRelationsRepo(new JsonRelationsRepo(root));
    paths = new JsonPathsRepo(root);
    signals = new JsonSignalsRepo(root);
    qa = new JsonQARepo(root);
    annotations = new JsonAnnotationsRepo(root);
    state = new JsonStateRepo(root);
    corpus = new JsonCorpusRepo(root);
    greatMe = new JsonGreatMeRepo(root);
    projectManagement = new EmptyProjectManagementRepo();
  } else if (storage === "postgres") {
    const connectionString = process.env.DATABASE_URL ?? process.env.KE_DATABASE_URL;
    if (!connectionString) {
      throw new Error("KE_STORAGE=postgres requires DATABASE_URL or KE_DATABASE_URL");
    }
    const pg = openPostgresPool(connectionString);
    elements = new PostgresElementsRepo(pg);
    relations = new PostgresRelationsRepo(pg);
    paths = new PostgresPathsRepo(pg);
    signals = new PostgresSignalsRepo(pg);
    qa = new PostgresQARepo(pg);
    annotations = new PostgresAnnotationsRepo(pg);
    state = new PostgresStateRepo(pg);
    corpus = new PostgresCorpusRepo(pg);
    greatMe = new PostgresGreatMeRepo(pg);
    invocations = new PostgresInvocationsRepo(pg);
    improvements = new PostgresImprovementsRepo(pg);
    chatVisualBlocks = new PostgresChatVisualBlocksRepo(pg);
    chatAttachments = new PostgresChatAttachmentsRepo(pg);
    healthRepo = new PostgresHealthRepo(pg);
    projectManagement = new PostgresProjectManagementRepo(pg);
  } else {
    const dbPath = process.env.KE_SQLITE_PATH ?? join(root, "ke.db");
    const db = openDb(dbPath);
    elements = new SqliteElementsRepo(db);
    relations = new SqliteRelationsRepo(db);
    paths = new SqlitePathsRepo(db);
    signals = new SqliteSignalsRepo(db);
    qa = new SqliteQARepo(db);
    annotations = new SqliteAnnotationsRepo(db);
    state = new SqliteStateRepo(db);
    corpus = new SqliteCorpusRepo(db);
    greatMe = new SqliteGreatMeRepo(db);
    improvements = new ImprovementsRepo(db);
    invocations = new InvocationsRepo(db);
    chatVisualBlocks = new SqliteChatVisualBlocksRepo(db);
    chatAttachments = new SqliteChatAttachmentsRepo(db);
    projectManagement = new SqliteProjectManagementRepo(db);
  }

  // Toolbox runtime constructed below (after `log` is defined).
  // Order matters: pickAdapter() returns adapters[0] when no preference is given.
  // Codex first because Claude SDK 401s when the server is launched inside a
  // Claude Code session (no OAuth refresh available in the subprocess).
  // Default adapter order (per Plan B migration):
  //   1. Hermes — the new brain. Speaks OpenAI-compatible HTTP API and
  //      uses Codex internally via your existing OAuth. Routes that
  //      need an agent-style LLM should pick this.
  //   2. Codex — direct subprocess. Preserved for fallback while Plan B
  //      migration is in progress; pickAdapter() returns adapters[0] by
  //      default so codex is only used when explicitly requested via the
  //      `model` param.
  //   3. Claude Code — legacy SDK path; only used if explicitly named.
  const ai = adapters ?? opts.adapters ?? [
    new HermesAdapter(),
    new CodexAdapter(),
    new ClaudeAdapter(),
  ];
  const log = logger ?? opts.logger ?? noopLogger;
  const manualsDir = opts.aiDir ?? aiDir();
  // ─── Toolbox runtime (gracefully no-op if SQLite repo missing) ──
  const toolRuntime = invocations ? new ToolRuntime(invocations) : null;
  if (toolRuntime) {
    toolRuntime.register(lockScreenTool);
    // Re-schedule any deferred invocations that survived the previous crash.
    void toolRuntime.rehydrate().then(rehydrated => {
      if (rehydrated.rescheduled + rehydrated.cancelled > 0) {
        log.info("toolbox.rehydrated", rehydrated);
      }
    });
  }
  // Persist every AI op prompt + output to data/ai-ops.jsonl for the admin UI.
  configureOpLog(root);
  // Self-heal: any op stuck in "running" from a previous crash / pkill / OOM
  // gets a synthetic error terminal line, so the admin UI doesn't show
  // dead-but-still-running entries indefinitely. Fire-and-forget.
  void healStaleRunningOps().then(n => {
    if (n > 0) log.info("ai.ops.healed", { stale_running_marked_error: n });
  });
  // Image generation runs in a separate AI op from text generation. The
  // text op emits image-placeholder blocks; this background queue processes
  // them. Hermes's OpenAI-compat endpoint can't produce image files (it's
  // text-only), so the image queue specifically targets the Codex adapter
  // instead of pickAdapter's default. Falls back to whichever adapter is
  // first if Codex isn't configured.
  const codexForImages = ai.find(a => a.name === "codex") ?? ai[0];
  imageQueue.configure(codexForImages, elements, log);
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.header("access-control-allow-origin", "*");
    c.header("access-control-allow-headers", "content-type");
    if (c.req.method === "OPTIONS") return c.body(null, 204);
    await next();
  });
  app.route("/api/elements", elementsRoutes({ elements, relations, paths, qa, annotations, signals }));
  app.route("/api/relations", relationsRoutes(relations));
  app.route("/api/paths", pathsRoutes(paths));
  app.route("/api/signals", signalsRoutes(signals));
  app.route("/api/annotations", annotationsRoutes(annotations));
  app.route("/api/images", imagesRoutes());
  app.route("/api/attachments", attachmentsRoutes());
  app.route("/api/state", stateRoutes(state, elements, signals));
  app.route("/api/corpus", corpusRoutes(corpus));
  app.route("/api/great-me", greatMeRoutes(greatMe));
  app.route("/api/chat", chatRoutes(chatAttachments, ai));
  app.route("/api/chat-visual-blocks", chatVisualBlocksRoutes(chatVisualBlocks));
  app.route("/api/chat/attachments", chatAttachmentsRoutes(chatAttachments));
  app.route("/api/health", healthRoutes(healthRepo));
  app.route("/api/projects", projectsRoutes(elements));
  app.route("/api/project-management", projectManagementRoutes(projectManagement));
  app.route("/api/riking-projects", rikingProjectsRoutes(root));

  // 提醒触发器 —— 仅在 healthRepo 可用（即 KE_STORAGE=postgres）时启动。
  // 每分钟扫描一次 enabled 的提醒，到点发飞书 + SSE。
  if (healthRepo) {
    const ticker = createReminderTicker(healthRepo);
    ticker.start();
    log.info("reminder.ticker.started");
  }
  app.route("/api/cron", cronRoutes());
  if (improvements) {
    app.route("/api/improvements", improvementsRoutes(improvements));
  }
  if (toolRuntime && invocations) {
    app.route("/api/toolbox", toolboxRoutes(toolRuntime, invocations));
  }
  app.route("/api/mascot", mascotRoutes());
  app.route("/api/ai", aiRoutes({
    adapters: ai, elements, relations, paths, signals, qa, annotations,
    aiDir: manualsDir, logger: log,
  }));
  app.route("/api/admin", adminRoutes({ signals, aiDir: manualsDir, adapters: ai, corpus }));
  // Mindmap PPT decks — element-backed. Every deck IS the root element of
  // a subtree that carries a `mindmap-embed` section. No separate storage.
  app.route("/api/mindmaps", mindmapsRoutes({
    adapters: ai, elements, relations, signals, logger: log,
  }));

  // SSE channel for UIs to receive change notifications. Backend code
  // calls `eventBus.publish("element.changed", ...)` whenever it writes
  // data; this route forwards those events to every connected tab so
  // they re-hydrate without polling.
  app.route("/api/events", eventsRoute());

  // MCP server — exposes Rich's data + AI ops as MCP tools so external
  // agents (Hermes / Claude Desktop / Cursor / Codex / etc.) can drive
  // the knowledge tree. Mounted at /mcp. Shares the same repos and AI
  // adapters as the rest of this Hono app, so an agent edit lands in
  // the same SQLite the Rich UI is reading from.
  mountMcp(app, {
    elements, relations, paths, signals, qa, annotations,
    adapters: ai, aiDir: manualsDir, improvements, corpus,
    toolRuntime,
    greatMe,
  });

  // Agent-id endpoint：前端读这个值在 admin UI 默认填进 claim 表单。
  app.get("/api/agent-id", (c) => {
    return c.json({ agentId: getAgentId() });
  });

  app.post("/api/launcher/open-ops-manual", (c) => {
    const target = findOpsManualIndex();
    if (!target) {
      return c.json({ error: "ops_manual_not_found" }, 404);
    }
    try {
      openLocalFile(target);
      return c.json({ ok: true, path: target });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return c.json({ error: "open_failed", message }, 500);
    }
  });

  app.get("/api/mini-programs", (c) => {
    return c.json({
      workspaceDir: richWorkspaceDir,
      programs: MINI_PROGRAMS.map(program => {
        const target = resolveMiniProgramTarget(program);
        return {
          id: program.id,
          label: program.label,
          desc: program.desc,
          category: program.category,
          icon: program.icon,
          tone: program.tone,
          path: target,
          exists: Boolean(target),
          launchable: Boolean(target),
        };
      }),
    });
  });

  app.post("/api/mini-programs/:id/open", (c) => {
    const id = c.req.param("id");
    const program = MINI_PROGRAMS.find(item => item.id === id);
    if (!program) {
      return c.json({ error: "mini_program_not_found" }, 404);
    }
    const target = resolveMiniProgramTarget(program);
    if (!target) {
      return c.json({ error: "mini_program_entry_not_found", workspaceDir: richWorkspaceDir }, 404);
    }
    try {
      openLocalFile(target);
      return c.json({ ok: true, path: target });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return c.json({ error: "open_failed", message }, 500);
    }
  });

  // Health endpoint registered BEFORE the SPA catch-all so it actually matches.
  app.get("/api/health", async (c) => {
    const adapterChecks = await Promise.all(ai.map(async (a) => ({
      name: a.name,
      available: await a.available(),
    })));
    const allAdaptersOk = adapterChecks.some(a => a.available);
    return c.json({
      ok: allAdaptersOk,
      adapters: adapterChecks,
      uptimeSec: Math.round(process.uptime()),
      childProcesses: childRegistry.size(),
      signals: await signals.count(),
    });
  });

  // In desktop / standalone mode, serve the prebuilt web bundle from the
  // same server so the Electron BrowserWindow can load http://localhost:<p>/
  // without a separate vite dev server. Activated when KE_WEB_DIST points
  // at the apps/web/dist/ directory.
  const webDist = process.env.KE_WEB_DIST;
  if (webDist) {
    const ROOT = pathResolve(webDist);
    app.get("/*", async (c) => {
      // Skip /api/* — those are mounted earlier and would have matched.
      if (c.req.path.startsWith("/api/")) return c.notFound();
      let p = c.req.path.replace(/^\/+/, "");
      if (!p || p.endsWith("/")) p = pathJoin(p, "index.html");
      const target = pathResolve(pathJoin(ROOT, p));
      if (!target.startsWith(ROOT)) return c.notFound();
      // SPA fallback: any path not matching a real file falls back to
      // index.html so the React app can render the right view.
      const fallback = pathResolve(pathJoin(ROOT, "index.html"));
      try {
        const s = await fsStat(target);
        if (!s.isFile()) {
          const buf = await fsReadFile(fallback);
          return c.body(new Uint8Array(buf), 200, { "content-type": "text/html; charset=utf-8" });
        }
      } catch {
        try {
          const buf = await fsReadFile(fallback);
          return c.body(new Uint8Array(buf), 200, { "content-type": "text/html; charset=utf-8" });
        } catch { return c.notFound(); }
      }
      const ct = STATIC_MIMES[pathExtname(target).toLowerCase()] ?? "application/octet-stream";
      const buf = await fsReadFile(target);
      return c.body(new Uint8Array(buf), 200, { "content-type": ct, "cache-control": "private, max-age=60" });
    });
  }

  return app;
}

function isMainModule(): boolean {
  // ESM detection (works when running via tsx / node loader).
  try {
    return fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
  } catch { return false; }
}

if (isMainModule() || process.env.KE_AUTO_START === "1") {
  const port = Number(process.env.PORT ?? 3001);
  const log = createLogger({ bound: { app: "ke-server" } });
  const app = buildApp(dataDir(), undefined, log);
  serve({ fetch: app.fetch, port });
  log.info("server.started", { port, url: `http://localhost:${port}` });

  // Publish the MCP URL to a known location so external agent configs
  // (Hermes, Claude Desktop, ...) can read it without guessing the port.
  // Re-written on every boot — port can shift if 31515 is taken.
  void (async () => {
    try {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const url = `http://127.0.0.1:${port}/mcp`;
      await fs.writeFile(path.join(dataDir(), ".mcp-url"), url + "\n", "utf8");
      log.info("mcp.url.published", { url });
    } catch (e) {
      log.warn("mcp.url.publish_failed", { error: e instanceof Error ? e.message : String(e) });
    }
  })();

  installShutdownHandlers({
    onShutdown: () => log.info("server.shutdown", { childProcesses: childRegistry.size() }),
  });
}
