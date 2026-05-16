# AI Integration · generate-tree Sprint

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace mocked `/api/ai/generate-tree` with real AI invocation through a pluggable adapter (Claude Code SDK + Codex SDK), streaming output to the browser via SSE. After this sprint, user types a topic and gets a freshly generated knowledge tree from AI, not seed data.

**Architecture:** Single `AIAdapter` interface, two implementations (`ClaudeAdapter`, `CodexAdapter`). Server route streams Server-Sent Events; frontend `InputView` consumes via `EventSource`. Generated tree is parsed from AI's JSON output and persisted to `data/elements/*.json` so it shows up on `/api/elements` afterward.

**Tech Stack:** `@anthropic-ai/claude-agent-sdk`, `@openai/codex` (both as server deps) · Hono SSE · Server-Sent Events on browser

**Karpathy constraints:**
- §2: only `generate-tree` this sprint. No `refine/expand/extend/paths` yet.
- §3: don't touch the seed data or pre-existing routes beyond what's needed.
- §4: success criteria = type "认知心理学" in browser → see streaming AI output → tree renders with elements not present in seed data.

---

### Task 1: Install AI SDKs

**Role:** Backend Engineer

**Files:**
- Modify: `apps/server/package.json`

- [ ] **Step 1: Add deps**

```bash
cd "/Users/binkerking/Documents/Ai-WorkSpace/Project/Know Everything"
pnpm --filter @ke/server add @anthropic-ai/claude-agent-sdk @openai/codex
```

- [ ] **Step 2: Verify install**

```bash
pnpm --filter @ke/server list @anthropic-ai/claude-agent-sdk @openai/codex
```
Expected: both packages listed with their version.

- [ ] **Step 3: Commit**

```bash
git add apps/server/package.json pnpm-lock.yaml
git commit -m "chore(server): add claude-agent-sdk + codex SDK deps"
```

---

### Task 2: AIAdapter interface + StreamEvent type

**Role:** Backend Engineer

**Files:**
- Create: `apps/server/src/ai/adapter.ts`

- [ ] **Step 1: Define the interface**

```ts
// apps/server/src/ai/adapter.ts
export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; fullText: string; sessionId?: string }
  | { type: "error"; message: string };

export interface GenerateArgs {
  prompt: string;
  sessionId?: string;
  signal?: AbortSignal;
}

export interface AIAdapter {
  readonly name: "claude-code" | "codex";
  available(): Promise<boolean>;
  stream(args: GenerateArgs): AsyncIterable<StreamEvent>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/ai/adapter.ts
git commit -m "feat(ai): add AIAdapter interface + StreamEvent type"
```

---

### Task 3: ClaudeAdapter via @anthropic-ai/claude-agent-sdk

**Role:** Backend Engineer

**Files:**
- Create: `apps/server/src/ai/claude.ts`
- Create: `apps/server/test/claude-adapter.test.ts` (integration test, marked skipped by default)

- [ ] **Step 1: Adapter implementation**

```ts
// apps/server/src/ai/claude.ts
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { AIAdapter, GenerateArgs, StreamEvent } from "./adapter.js";

export class ClaudeAdapter implements AIAdapter {
  readonly name = "claude-code" as const;

  async available(): Promise<boolean> {
    try {
      const { execSync } = await import("node:child_process");
      execSync("claude --version", { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  async *stream(args: GenerateArgs): AsyncIterable<StreamEvent> {
    let fullText = "";
    try {
      const it = query({
        prompt: args.prompt,
        options: {
          resume: args.sessionId,
          abortController: args.signal ? { signal: args.signal } as AbortController : undefined,
        },
      });
      for await (const msg of it) {
        if (msg.type === "assistant" && msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === "text" && typeof block.text === "string") {
              fullText += block.text;
              yield { type: "delta", text: block.text };
            }
          }
        }
        if (msg.type === "result") {
          yield { type: "done", fullText, sessionId: msg.session_id };
          return;
        }
      }
      yield { type: "done", fullText };
    } catch (err) {
      yield { type: "error", message: err instanceof Error ? err.message : String(err) };
    }
  }
}
```

> NOTE: The exact shape of `query()` return events comes from the SDK. If the SDK's actual event shape differs from the assumption above (`msg.type === "assistant"` etc.), adjust accordingly — the SDK's docs / types are authoritative. The contract this adapter MUST honor is: yield `delta` events as text streams in, then exactly one `done` event with full accumulated text.

- [ ] **Step 2: Integration test (skipped by default)**

```ts
// apps/server/test/claude-adapter.test.ts
import { describe, it, expect } from "vitest";
import { ClaudeAdapter } from "../src/ai/claude.js";

const liveTests = process.env.KE_AI_LIVE === "1";
describe.skipIf(!liveTests)("ClaudeAdapter [live]", () => {
  it("streams response for a tiny prompt", async () => {
    const a = new ClaudeAdapter();
    expect(await a.available()).toBe(true);
    let deltas = 0;
    let done = false;
    let fullText = "";
    for await (const ev of a.stream({ prompt: "Say only the word: OK" })) {
      if (ev.type === "delta") { deltas++; }
      if (ev.type === "done") { done = true; fullText = ev.fullText; }
      if (ev.type === "error") throw new Error(ev.message);
    }
    expect(done).toBe(true);
    expect(fullText.toLowerCase()).toContain("ok");
  }, 60_000);
});
```

- [ ] **Step 3: Verify typecheck**

```bash
pnpm --filter @ke/server typecheck
```
Expected: no errors. If the SDK's actual `query()` event shape disagrees with the assumed shape, this is where it surfaces — fix by reading the SDK's `.d.ts` for `query`.

- [ ] **Step 4: Live smoke (optional, costs tokens)**

```bash
KE_AI_LIVE=1 pnpm --filter @ke/server test claude-adapter
```
Expected: test passes; AI responds with "OK".

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/ai apps/server/test
git commit -m "feat(ai): add ClaudeAdapter via claude-agent-sdk"
```

---

### Task 4: CodexAdapter via @openai/codex

**Role:** Backend Engineer

**Files:**
- Create: `apps/server/src/ai/codex.ts`
- Create: `apps/server/test/codex-adapter.test.ts`

- [ ] **Step 1: Inspect SDK shape**

Run this to see the exported API:

```bash
node -e "console.log(Object.keys(require('@openai/codex')))" 2>&1
```

Use the result to choose between the SDK's high-level `Codex` class (if present) vs. spawning the `codex` binary directly. If the SDK shape isn't a clean async iterator, fall back to spawning `/Applications/Codex.app/Contents/Resources/codex exec --json -` and streaming stdout.

- [ ] **Step 2: Implementation (subprocess fallback shown — substitute SDK path if cleaner)**

```ts
// apps/server/src/ai/codex.ts
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { AIAdapter, GenerateArgs, StreamEvent } from "./adapter.js";

const CODEX_BIN = "/Applications/Codex.app/Contents/Resources/codex";

export class CodexAdapter implements AIAdapter {
  readonly name = "codex" as const;

  async available(): Promise<boolean> {
    return existsSync(CODEX_BIN);
  }

  async *stream(args: GenerateArgs): AsyncIterable<StreamEvent> {
    const childArgs = ["exec", "--json"];
    if (args.sessionId) childArgs.push("--session", args.sessionId);
    childArgs.push("-");
    const child = spawn(CODEX_BIN, childArgs, { stdio: ["pipe", "pipe", "pipe"] });
    args.signal?.addEventListener("abort", () => child.kill("SIGTERM"));
    child.stdin.end(args.prompt);
    let fullText = "";
    let buf = "";
    for await (const chunk of child.stdout) {
      buf += chunk.toString("utf8");
      let nl: number;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.type === "agent_message_delta" && typeof obj.delta === "string") {
            fullText += obj.delta;
            yield { type: "delta", text: obj.delta };
          } else if (obj.type === "agent_message" && typeof obj.text === "string") {
            // some codex versions emit final message as one event
            if (!fullText) { fullText = obj.text; yield { type: "delta", text: obj.text }; }
          }
        } catch { /* non-JSON progress line, ignore */ }
      }
    }
    const code = await new Promise<number>((res) => child.on("exit", (c) => res(c ?? 0)));
    if (code !== 0) {
      const errText = (await streamToString(child.stderr)).slice(-500);
      yield { type: "error", message: `codex exited ${code}: ${errText}` };
      return;
    }
    yield { type: "done", fullText };
  }
}

async function streamToString(s: NodeJS.ReadableStream): Promise<string> {
  let out = "";
  for await (const c of s) out += c.toString("utf8");
  return out;
}
```

> NOTE: The `--json` event shape (`agent_message_delta`, `agent_message`) is the assumed Codex output format. If a quick smoke shows different event names, adjust by inspecting actual stdout from `echo "hi" | codex exec --json -`.

- [ ] **Step 3: Manual stdout inspection (informs adjustments above)**

```bash
echo "say only: OK" | /Applications/Codex.app/Contents/Resources/codex exec --json - 2>/dev/null | head -20
```
Expected: a few lines of JSON events. Confirm the field name for streaming text deltas; fix the adapter if needed.

- [ ] **Step 4: Integration test (skipped by default)**

```ts
// apps/server/test/codex-adapter.test.ts
import { describe, it, expect } from "vitest";
import { CodexAdapter } from "../src/ai/codex.js";

const liveTests = process.env.KE_AI_LIVE === "1";
describe.skipIf(!liveTests)("CodexAdapter [live]", () => {
  it("streams response for a tiny prompt", async () => {
    const a = new CodexAdapter();
    expect(await a.available()).toBe(true);
    let fullText = "";
    let done = false;
    for await (const ev of a.stream({ prompt: "Say only the word: OK" })) {
      if (ev.type === "done") { done = true; fullText = ev.fullText; }
      if (ev.type === "error") throw new Error(ev.message);
    }
    expect(done).toBe(true);
    expect(fullText.toLowerCase()).toContain("ok");
  }, 60_000);
});
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @ke/server typecheck
```

- [ ] **Step 6: Live smoke**

```bash
KE_AI_LIVE=1 pnpm --filter @ke/server test codex-adapter
```

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/ai apps/server/test
git commit -m "feat(ai): add CodexAdapter via codex CLI subprocess"
```

---

### Task 5: generate-tree prompt template

**Role:** Senior Software Engineer

**Files:**
- Create: `apps/server/src/ai/prompts/generateTree.ts`

- [ ] **Step 1: Write prompt template**

```ts
// apps/server/src/ai/prompts/generateTree.ts
import type { RichnessLevel } from "@ke/domain";

const RICHNESS_NOTES: Record<RichnessLevel, string> = {
  1: "骨架级：只输出最核心的概念，oneSentence 必填，其余字段尽量简短或省略。",
  2: "中等：核心概念 + 简短解释（oneSentence + coreExplain + whyMatters 完整）。",
  3: "丰富：增加例子、关键机制（mechanisms 3-4 步）。",
  4: "深度：增加常见误区、练习题、下一步学习建议。",
  5: "专家：增加专家视角、争议点、研究方向。",
};

export interface GenerateTreePromptArgs {
  topic: string;
  richness: RichnessLevel;
}

export function buildGenerateTreePrompt({ topic, richness }: GenerateTreePromptArgs): string {
  return `你是 Know Everything 系统的"知识树架构师"。用户输入主题：「${topic}」。

请生成一棵以该主题为根的知识树，输出为单个 JSON 对象，不要任何前后文字、Markdown 围栏或解释。JSON 结构必须严格符合：

{
  "rootId": string,                              // 主题元的 id
  "elements": Element[],                          // 所有元（含 root + L2 + L3）
  "relations": Relation[],                        // 父子关系
  "paths": LearningPath[]                         // 3 条推荐路径
}

每个 Element：
{
  "id": string,                                  // 点分层级，例如 "cog-psy.perception.vision"
  "type": "topic" | "concept" | "step" | "practice",
  "title": string,                               // 简洁中文
  "subtitle"?: string,
  "domain"?: string,
  "content": {                                   // 按 type 不同：
    // 主题元 (type=topic):
    "intro": string,
    "learningGoals": string[],
    "coreModules": [{ "id": string, "title": string, "description": string }],
    "recommendedPaths": string[]
    // 概念元 (type=concept):
    "oneSentence": string,
    "coreExplain": string,
    "whyMatters": string
    // 实战元 (type=practice):
    "productPositioning": string,
    "targetAudience": string,
    "needs": string[],
    "mvpFeatures": string[],
    "implementationPath": string[]
  },
  "metadata": { "createdAt": ISO8601, "updatedAt": ISO8601, "generatedBy": "ai", "richness": ${richness} }
}

每个 Relation：
{ "id": string, "from": string, "to": string, "kind": "child", "createdAt": ISO8601 }

每个 LearningPath：
{
  "id": string,
  "centerElementId": string,                     // 必须 = rootId
  "kind": "quick" | "academic" | "practice",
  "label": string,                               // 如 "快速入门 15min"
  "color": "gold" | "cyan" | "pink",             // quick→gold, academic→cyan, practice→pink
  "steps": string[],                             // 2-4 个 element id，按学习顺序
  "estimatedTime": string,
  "generatedBy": "ai",
  "createdAt": ISO8601
}

规模与丰富度：
- 根元 1 个（type=topic）。
- 二级元 5-7 个（type=concept 为主），全部作为根的 child。
- 三级元每个二级元下 2-4 个（type=concept 或 practice）。
- 路径 3 条：quick / academic / practice，每条 2-4 个 element id。
- 丰富度等级 ${richness}：${RICHNESS_NOTES[richness]}

ID 命名规则：用主题英文/拼音短名作为前缀（≤ 12 字符），用点分隔层级。例如主题"认知心理学"→ "cog-psy"；其子元"感知"→ "cog-psy.perception"；孙元"视觉"→ "cog-psy.perception.vision"。

只输出 JSON。不要任何其他文字。`;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/server/src/ai/prompts/generateTree.ts
git commit -m "feat(ai): add generate-tree prompt template"
```

---

### Task 6: Orchestrator — adapter selection + JSON extraction + persistence

**Role:** Backend Engineer

**Files:**
- Create: `apps/server/src/ai/orchestrator.ts`
- Create: `apps/server/src/ai/extractJson.ts`
- Create: `apps/server/test/extractJson.test.ts`

- [ ] **Step 1: JSON extractor (handles fenced ```json blocks)**

Failing test first:

```ts
// apps/server/test/extractJson.test.ts
import { describe, it, expect } from "vitest";
import { extractJson } from "../src/ai/extractJson.js";

describe("extractJson", () => {
  it("returns parsed JSON when input is pure JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it("strips ```json fences", () => {
    expect(extractJson("```json\n{\"a\":2}\n```")).toEqual({ a: 2 });
  });
  it("strips ``` (no language tag)", () => {
    expect(extractJson("```\n{\"a\":3}\n```")).toEqual({ a: 3 });
  });
  it("finds the first JSON object embedded in prose", () => {
    expect(extractJson("Sure, here:\n{\"a\":4}\nThanks.")).toEqual({ a: 4 });
  });
  it("throws on no JSON", () => {
    expect(() => extractJson("nope")).toThrow();
  });
});
```

Run, confirm FAILS:

```bash
pnpm --filter @ke/server test extractJson
```

Implementation:

```ts
// apps/server/src/ai/extractJson.ts
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  // Try direct parse first
  try { return JSON.parse(trimmed); } catch { /* fall through */ }
  // Strip code fences
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fence) {
    try { return JSON.parse(fence[1]); } catch { /* fall through */ }
  }
  // Find first balanced { ... } block
  const start = trimmed.indexOf("{");
  if (start !== -1) {
    let depth = 0;
    for (let i = start; i < trimmed.length; i++) {
      if (trimmed[i] === "{") depth++;
      else if (trimmed[i] === "}") {
        depth--;
        if (depth === 0) {
          const candidate = trimmed.slice(start, i + 1);
          try { return JSON.parse(candidate); } catch { /* fall through */ }
        }
      }
    }
  }
  throw new Error("No valid JSON found in input");
}
```

Run, confirm 5 tests pass.

- [ ] **Step 2: Orchestrator**

```ts
// apps/server/src/ai/orchestrator.ts
import type { Element, Relation, LearningPath, RichnessLevel } from "@ke/domain";
import type { AIAdapter, StreamEvent } from "./adapter.js";
import { buildGenerateTreePrompt } from "./prompts/generateTree.js";
import { extractJson } from "./extractJson.js";

export interface GenerateTreeResult {
  rootId: string;
  elements: Element[];
  relations: Relation[];
  paths: LearningPath[];
}

export type GenerateTreeEvent =
  | { type: "delta"; text: string }
  | { type: "done"; result: GenerateTreeResult }
  | { type: "error"; message: string };

export async function* generateTree(
  adapter: AIAdapter,
  args: { topic: string; richness?: RichnessLevel }
): AsyncIterable<GenerateTreeEvent> {
  const prompt = buildGenerateTreePrompt({ topic: args.topic, richness: args.richness ?? 2 });
  let buf = "";
  for await (const ev of adapter.stream({ prompt })) {
    if (ev.type === "delta") {
      buf += ev.text;
      yield { type: "delta", text: ev.text };
    } else if (ev.type === "error") {
      yield { type: "error", message: ev.message };
      return;
    } else if (ev.type === "done") {
      try {
        const parsed = extractJson(ev.fullText || buf) as GenerateTreeResult;
        if (!parsed.rootId || !Array.isArray(parsed.elements)) {
          throw new Error("Missing rootId or elements in AI output");
        }
        yield { type: "done", result: parsed };
        return;
      } catch (e) {
        yield { type: "error", message: `JSON parse failed: ${e instanceof Error ? e.message : e}` };
        return;
      }
    }
  }
}

export function pickAdapter(adapters: AIAdapter[], preference?: "claude-code" | "codex"): AIAdapter {
  if (preference) {
    const found = adapters.find(a => a.name === preference);
    if (found) return found;
  }
  return adapters[0]; // first available
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @ke/server typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/ai apps/server/test
git commit -m "feat(ai): add orchestrator + JSON extractor with tests"
```

---

### Task 7: Replace mock generate-tree route with SSE + real AI + persistence

**Role:** Backend Engineer

**Files:**
- Modify: `apps/server/src/routes/ai.ts`
- Modify: `apps/server/src/index.ts` (inject adapters)
- Modify: `apps/server/test/routes.test.ts` (update mock-based test)

- [ ] **Step 1: New ai routes file**

```ts
// apps/server/src/routes/ai.ts
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AIAdapter } from "../ai/adapter.js";
import type { ElementsRepo } from "../repos/ElementsRepo.js";
import { generateTree, pickAdapter } from "../ai/orchestrator.js";

export function aiRoutes(adapters: AIAdapter[], repo: ElementsRepo): Hono {
  const r = new Hono();
  r.post("/generate-tree", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const topic = String(body.topic ?? "").trim();
    const model = body.model as "claude-code" | "codex" | undefined;
    const richness = (body.richness ?? 2) as 1 | 2 | 3 | 4 | 5;
    if (!topic) return c.json({ error: "topic required" }, 400);
    const adapter = pickAdapter(adapters, model);
    return streamSSE(c, async (stream) => {
      for await (const ev of generateTree(adapter, { topic, richness })) {
        await stream.writeSSE({ event: ev.type, data: JSON.stringify(ev) });
        if (ev.type === "done") {
          // Persist elements so they show up on /api/elements afterwards.
          for (const el of ev.result.elements) {
            await repo.put(el);
          }
        }
      }
    });
  });
  return r;
}
```

- [ ] **Step 2: Wire adapters in `buildApp`**

```ts
// apps/server/src/index.ts (replace existing buildApp)
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import { elementsRoutes } from "./routes/elements.js";
import { aiRoutes } from "./routes/ai.js";
import { JsonElementsRepo } from "./repos/JsonElementsRepo.js";
import { dataDir } from "./lib/paths.js";
import { ClaudeAdapter } from "./ai/claude.js";
import { CodexAdapter } from "./ai/codex.js";
import type { AIAdapter } from "./ai/adapter.js";

export function buildApp(root: string, adapters?: AIAdapter[]) {
  const repo = new JsonElementsRepo(root);
  const ai = adapters ?? [new ClaudeAdapter(), new CodexAdapter()];
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.header("access-control-allow-origin", "*");
    c.header("access-control-allow-headers", "content-type");
    if (c.req.method === "OPTIONS") return c.body(null, 204);
    await next();
  });
  app.route("/api/elements", elementsRoutes(repo));
  app.route("/api/ai", aiRoutes(ai, repo));
  app.get("/api/health", (c) => c.json({ ok: true }));
  return app;
}

if (fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  const port = Number(process.env.PORT ?? 3001);
  const app = buildApp(dataDir());
  serve({ fetch: app.fetch, port });
  console.log(`Know Everything server: http://localhost:${port}`);
}
```

- [ ] **Step 3: Update existing routes.test.ts (mock adapter)**

Replace the old generate-tree test block with one that uses an injected fake adapter (avoid live AI in unit tests):

```ts
// add at top of apps/server/test/routes.test.ts
import type { AIAdapter, StreamEvent, GenerateArgs } from "../src/ai/adapter.js";

class FakeAdapter implements AIAdapter {
  readonly name = "claude-code" as const;
  async available() { return true; }
  async *stream(_args: GenerateArgs): AsyncIterable<StreamEvent> {
    yield { type: "delta", text: "{" };
    const tree = {
      rootId: "fake",
      elements: [{ id: "fake", type: "topic", title: "Fake", content: { intro: "" }, metadata: { createdAt: "", updatedAt: "", generatedBy: "ai", richness: 2 } }],
      relations: [],
      paths: [],
    };
    yield { type: "delta", text: JSON.stringify(tree) };
    yield { type: "done", fullText: JSON.stringify(tree) };
  }
}

// then in the routes test, build the app with this adapter and assert
// generate-tree returns an SSE stream with a "done" event whose data contains rootId="fake".
```

Update the existing `POST /api/ai/generate-tree` test:

```ts
it("POST /api/ai/generate-tree streams SSE with done event", async () => {
  const fakeApp = buildApp(dataDir(), [new FakeAdapter()]);
  const res = await fakeApp.request("/api/ai/generate-tree", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ topic: "test" }),
  });
  expect(res.status).toBe(200);
  const text = await res.text();
  expect(text).toContain("event: done");
  expect(text).toContain('"rootId":"fake"');
});
```

- [ ] **Step 4: Run all tests**

```bash
pnpm --filter @ke/server test
```
Expected: all tests pass (previously 7 — now maybe still 7 because the test count didn't change, plus 5 extractJson tests = 12). Be flexible — the goal is "all green".

- [ ] **Step 5: Live smoke**

```bash
pnpm --filter @ke/server dev &
sleep 2
curl -N -X POST http://localhost:3001/api/ai/generate-tree \
  -H 'content-type: application/json' \
  -d '{"topic":"光合作用","richness":2,"model":"claude-code"}' | head -50
# Ctrl-C or kill the server
```
Expected: SSE stream with `event: delta` lines and a final `event: done` line containing `"rootId":...`. AI took 10-30 seconds.

- [ ] **Step 6: Commit**

```bash
git add apps/server
git commit -m "feat(ai): wire real generate-tree route with SSE streaming"
```

---

### Task 8: Frontend SSE consumption

**Role:** UI Developer

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/state/store.ts`
- Modify: `apps/web/src/views/InputView.tsx`

- [ ] **Step 1: API client streaming variant**

```ts
// apps/web/src/api/client.ts (add to existing exports)
import type { Element, Relation, LearningPath } from "@ke/domain";

export interface GenerateTreeResponse {
  rootId: string;
  elements: Element[];
  relations: Relation[];
  paths: LearningPath[];
}

export type GenerateTreeEvent =
  | { type: "delta"; text: string }
  | { type: "done"; result: GenerateTreeResponse }
  | { type: "error"; message: string };

const base = "/api";

export const api = {
  async *generateTreeStream(
    topic: string,
    model?: "claude-code" | "codex"
  ): AsyncIterable<GenerateTreeEvent> {
    const r = await fetch(`${base}/ai/generate-tree`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic, model }),
    });
    if (!r.ok || !r.body) throw new Error(`generate-tree failed: ${r.status}`);
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const dataLine = chunk.split("\n").find(l => l.startsWith("data: "));
        if (!dataLine) continue;
        try {
          const obj = JSON.parse(dataLine.slice(6)) as GenerateTreeEvent;
          yield obj;
        } catch { /* ignore malformed SSE chunk */ }
      }
    }
  },
  async getElement(id: string): Promise<Element | null> {
    const r = await fetch(`${base}/elements/${encodeURIComponent(id)}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`getElement failed: ${r.status}`);
    return r.json();
  },
};
```

> NOTE: This removes the old non-streaming `generateTree()` method. Update the store to use `generateTreeStream` instead.

- [ ] **Step 2: Store consumes the stream**

Replace the `generate()` implementation in `apps/web/src/state/store.ts`:

```ts
// inside useStore create()
  async generate(topic) {
    set({ loading: true, error: null, deltaText: "" });
    try {
      for await (const ev of api.generateTreeStream(topic)) {
        if (ev.type === "delta") {
          set(s => ({ deltaText: (s.deltaText ?? "") + ev.text }));
        } else if (ev.type === "error") {
          set({ error: ev.message, loading: false });
          return;
        } else if (ev.type === "done") {
          const tree = ev.result;
          const elements = new Map(tree.elements.map(e => [e.id, e]));
          const paths = new Map<string, LearningPath[]>();
          for (const p of tree.paths) {
            const list = paths.get(p.centerElementId) ?? [];
            list.push(p);
            paths.set(p.centerElementId, list);
          }
          set({
            elements, relations: tree.relations, pathsByCenter: paths,
            rootId: tree.rootId, centerId: tree.rootId,
            loading: false, deltaText: "",
          });
          return;
        }
      }
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
```

Also add `deltaText: string` to the `AppState` interface (with `""` default).

- [ ] **Step 3: InputView shows streaming preview**

Add to `apps/web/src/views/InputView.tsx`, below the form:

```tsx
const deltaText = useStore(s => s.deltaText);
// ...
{loading && (
  <div className="streaming">
    <div className="status">AI 正在生成知识树…</div>
    {deltaText && <pre className="preview">{deltaText.slice(-1200)}</pre>}
  </div>
)}
```

CSS to add to `InputView.css`:

```css
.input-shell .streaming {
  margin-top: 16px; padding: 14px;
  border: 1px solid var(--teal-line); border-radius: var(--radius);
  background: var(--teal-soft);
}
.input-shell .streaming .status {
  color: var(--teal); font-size: 13px; margin-bottom: 8px;
}
.input-shell .streaming .preview {
  margin: 0; max-height: 240px; overflow: auto;
  font-family: var(--mono); font-size: 11px; color: var(--soft);
  white-space: pre-wrap; word-break: break-all;
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @ke/web typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): consume SSE generate-tree stream with live preview"
```

---

### Task 9: End-to-end live smoke test

**Role:** Senior Software Engineer

- [ ] **Step 1: Run both servers**

```bash
pnpm --filter @ke/server dev   # terminal A
pnpm --filter @ke/web dev      # terminal B
```

- [ ] **Step 2: Browser test**

Open http://localhost:5173. Type a topic NOT in seed data (e.g. "光合作用" or "区块链") and submit.

Verify:
1. Loading area shows "AI 正在生成知识树…"
2. A scrollable preview appears showing AI's streamed JSON building up
3. Within 30-60 seconds, the page transitions to TreeView
4. The center node title matches the topic you typed (not "认知心理学")
5. Children appear and reflect the actual topic
6. Clicking a child switches center (proves the data is real, not stale seed)

- [ ] **Step 3: Tag**

```bash
git tag v0.0.2-ai-generate-tree
```

- [ ] **Step 4: Update README status section**

In `README.md`, change the Status section:

```
- ✅ Real AI generate-tree via Claude Code SDK (with Codex fallback)
- ⬜ Real AI refine / expand / extend / paths endpoints (next sprint)
```

```bash
git add README.md
git commit -m "docs: mark generate-tree complete; refine/expand next"
```

---

## Definition of Done

- [ ] All 9 tasks complete
- [ ] `pnpm -r test` green (unit tests; live AI tests opt-in via KE_AI_LIVE=1)
- [ ] Browser smoke (Task 9 Step 2) all 6 checks pass
- [ ] Generated tree appears in `/api/elements` (persisted)
- [ ] `v0.0.2-ai-generate-tree` tag exists

## Karpathy compliance checklist

- §1 Think Before Coding — every adapter task has a "verify SDK shape" step before coding
- §2 Simplicity First — only one endpoint (`generate-tree`), no extras
- §3 Surgical Changes — pre-existing routes (`/api/elements`) untouched; only one route file modified
- §4 Goal-Driven — Task 9 has 6 verifiable checks
