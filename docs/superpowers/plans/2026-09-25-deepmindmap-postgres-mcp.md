# DeepMindMap Postgres MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist standalone DeepMindMap documents exclusively in Postgres and let a dedicated Codex session read and maintain them through MCP.

**Architecture:** A Postgres-only repository backs `deep_mindmaps`; a nullable dependency makes the API explicitly unavailable without a Postgres URL. The web client migrates legacy browser records once, then reads and writes the server API. A new `deepmindmap` Codex resource builds context from the repository and exposes `rich_deep_mindmap_manage`, without sharing knowledge-tree MCP state.

**Tech Stack:** TypeScript, Hono, node-postgres, React, Zustand, Vitest, Node test runner.

---

### Task 1: Postgres-only repository and routes

**Files:**
- Create: `apps/server/src/repos/DeepMindMapsRepo.ts`
- Create: `apps/server/src/repos/PostgresDeepMindMapsRepo.ts`
- Create: `apps/server/src/routes/deepMindMaps.ts`
- Create: `apps/server/test/deep-mindmaps-routes.test.ts`
- Modify: `apps/server/src/db/projectManagementSchema.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Write the failing route tests.**

```ts
it("returns explicit unavailability without the Postgres repository", async () => {
  const response = await deepMindMapsRoutes(null).request("/");
  expect(response.status).toBe(503);
  expect((await response.json()).error).toBe("DeepMindMap requires Postgres");
});

it("rejects a stale map update", async () => {
  const response = await app.request("/map-1", { method: "PUT", body: JSON.stringify({ title: "方案", map, expectedUpdatedAt: "old" }) });
  expect(response.status).toBe(409);
});
```

- [ ] **Step 2: Run the route test.** Run `pnpm --filter @ke/server exec vitest run test/deep-mindmaps-routes.test.ts`; expect failure because the route and repository are absent.

- [ ] **Step 3: Implement the table, repository, and routes.**

```sql
CREATE TABLE IF NOT EXISTS deep_mindmaps (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, map_json JSONB NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
```

```ts
export interface DeepMindMapsRepo {
  list(): Promise<DeepMindMap[]>;
  get(id: string): Promise<DeepMindMap | null>;
  create(input: DeepMindMapCreateInput): Promise<DeepMindMap>;
  update(id: string, input: DeepMindMapUpdateInput): Promise<DeepMindMap | "conflict" | null>;
  remove(id: string): Promise<boolean>;
}
```

Wire `PostgresDeepMindMapsRepo` only from the main Postgres pool or `DEEP_MINDMAP_DATABASE_URL`. Add no SQLite schema or repository. Validate title and map shape; return 404 for missing IDs and 409 for a stale `expectedUpdatedAt`.

- [ ] **Step 4: Run the route test.** Run the command from Step 2; expect pass.

- [ ] **Step 5: Commit.**

```bash
git add apps/server/src/db/projectManagementSchema.ts apps/server/src/index.ts apps/server/src/repos/DeepMindMapsRepo.ts apps/server/src/repos/PostgresDeepMindMapsRepo.ts apps/server/src/routes/deepMindMaps.ts apps/server/test/deep-mindmaps-routes.test.ts
git commit -m "feat: persist DeepMindMap documents in Postgres"
```

### Task 2: API-backed editor and one-time import

**Files:**
- Create: `apps/web/src/views/deep-workbench/deepMindMapsApi.ts`
- Create: `apps/web/src/views/deep-workbench/deepMindMapsApi.test.ts`
- Modify: `apps/web/src/views/DeepWorkbenchView.tsx`
- Modify: `apps/web/src/views/workbench-document/WorkbenchDocumentView.tsx`

- [ ] **Step 1: Write the failing legacy merge test.**

```ts
test("imports legacy records only when absent from the server", () => {
  const result = mergeLegacyMaps(serverMaps, legacyMaps);
  assert.deepEqual(result.map(item => item.id), ["server", "legacy"]);
  assert.equal(result.find(item => item.id === "server")?.title, "server title");
});
```

- [ ] **Step 2: Run it.** Run `pnpm --filter @ke/web exec tsx --test src/views/deep-workbench/deepMindMapsApi.test.ts`; expect failure.

- [ ] **Step 3: Implement API loading, writes, and import.**

```ts
export async function loadDeepMindMaps(): Promise<DeepWorkbenchItem[]> { return request("/api/deep-mindmaps"); }
export async function importLegacyDeepMindMaps(items: DeepWorkbenchItem[]): Promise<void> {
  for (const item of items) await request("/api/deep-mindmaps", { method: "POST", body: JSON.stringify({ ...item, importOnly: true }) });
}
```

Start standalone state from the API. Import each legacy `rich.deep-workbench.v1` record only if its ID is absent; clear the key only after every item succeeds. All edit writes include `expectedUpdatedAt`; 409 reloads the server version. Keep knowledge-tree projections separate. Replace workbench-document localStorage lookup with the API helper.

- [ ] **Step 4: Verify and commit.** Run `pnpm --filter @ke/web exec tsx --test src/views/deep-workbench/deepMindMapsApi.test.ts && pnpm --filter @ke/web typecheck`; expect pass. Commit with `feat: load DeepMindMap documents from Postgres`.

### Task 3: Dedicated Codex context and MCP

**Files:**
- Create: `apps/server/src/mcp-v2/resources/deepMindMapTools.ts`
- Create: `apps/server/test/deep-mindmap-mcp.test.ts`
- Modify: `apps/server/src/deliverable-codex/DeliverableCodexContextService.ts`
- Modify: `apps/server/src/routes/deliverableCodex.ts`
- Modify: `apps/server/src/index.ts`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/views/DeepWorkbenchView.tsx`
- Modify: `apps/web/src/views/DeepWorkbenchView.codex.test.ts`

- [ ] **Step 1: Write failing MCP and context tests.**

```ts
it("writes formatted root details through the dedicated MCP", async () => {
  const result = await registry.invoke("rich_deep_mindmap_manage", {
    action: "update_root_details", mapId: "map-1", details: "<h2>需求</h2><p>已整理</p>", context: { requestId: "root-1" },
  });
  expect(result).toMatchObject({ ok: true, verification: { status: "verified" } });
});

it("supplies the full map, maintenance rule, and initial task", async () => {
  const context = await service.build({ projectId: "__general__", deliverableId: "map-1", resourceType: "deepmindmap", mode: "free" });
  expect(context.allowedMcpTools).toContain("rich_deep_mindmap_manage");
  expect(context.initialContext).toContain("梳理该思维导图的需求和资料信息");
});
```

- [ ] **Step 2: Run them.** Run `pnpm --filter @ke/server exec vitest run test/deep-mindmap-mcp.test.ts test/deliverable-codex-context-service.test.ts`; expect failure.

- [ ] **Step 3: Implement the resource.**

```ts
allowedMcpTools: ["rich_deep_mindmap_manage"],
systemInstruction: "You are maintaining a Postgres-backed DeepMindMap. Call rich_deep_mindmap_manage(action: get) before relying on the snapshot. Save requested changes through that tool."
```

Implement `get`, `update_node`, `create_node`, `delete_node`, and `update_root_details`. Delete requires destructive confirmation; every mutation refetches and verifies. Context embeds the complete tree, root detail, and exact initial organization task.

- [ ] **Step 4: Bind the toolbar.** Replace generic session creation with `ensureDeepMindMapCodexSession(map.id, `[DeepMindMap] ${map.title} · Codex`)` and open resource type `deepmindmap`.

- [ ] **Step 5: Verify and commit.** Run `pnpm --filter @ke/server exec vitest run test/deep-mindmap-mcp.test.ts test/deliverable-codex-context-service.test.ts && pnpm --filter @ke/web exec tsx --test src/views/DeepWorkbenchView.codex.test.ts && pnpm --filter @ke/web typecheck`; expect pass. Commit with `feat: add DeepMindMap Codex MCP sessions`.

### Task 4: Lifecycle regression

**Files:**
- Modify: `apps/server/test/deep-mindmaps-routes.test.ts`
- Modify: `apps/web/src/views/DeepWorkbenchView.codex.test.ts`

- [ ] **Step 1: Add a failing lifecycle test.**

```ts
it("opens a dedicated session whose first turn receives map context and MCP rules", async () => {
  const response = await app.request("/deep-mindmaps/map-1/conversations/ensure-bound", { method: "POST", body: JSON.stringify({ title: "[DeepMindMap] 方案 · Codex" }) });
  expect((await response.json()).context).toContain("rich_deep_mindmap_manage");
});
```

- [ ] **Step 2: Run focused verification and commit.** Run `pnpm --filter @ke/server exec vitest run test/deep-mindmaps-routes.test.ts test/deep-mindmap-mcp.test.ts test/deliverable-codex-context-service.test.ts && pnpm --filter @ke/web exec tsx --test src/views/deep-workbench/deepMindMapsApi.test.ts src/views/DeepWorkbenchView.codex.test.ts && pnpm --filter @ke/web typecheck`; expect all focused tests pass. Commit with `test: cover DeepMindMap Codex lifecycle`.

