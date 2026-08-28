# Rich Multica Project Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Multica-backed Rich project workbench, expose it through Rich CLI and UI, then create and run the real `【VTB】二代SAFE` four-agent analysis squad.

**Architecture:** Multica remains the task source of truth. A typed server-side gateway calls Multica CLI, validates every JSON boundary, checks Rich-to-Multica project bindings, and exposes project-scoped REST operations. Rich CLI and the project Todo UI consume those REST operations; the UI follows Multica's board/detail behavior while preserving required attribution.

**Tech Stack:** TypeScript, Hono, Zod, Vitest, React 18, Vite, Node test runner, Electron, Multica CLI v0.4.35.

---

## File map

### Server domain and integration

- Create `apps/server/src/mcp-v2/delegation/multica/MulticaProjectWorkbenchSchemas.ts`: Zod schemas and public workbench DTOs.
- Create `apps/server/src/mcp-v2/delegation/multica/MulticaProjectWorkbenchService.ts`: project-bound reads and mutations.
- Modify `apps/server/src/mcp-v2/delegation/multica/MulticaBindingRepo.ts`: leader, MCP server, execution mode and model binding fields.
- Modify `apps/server/src/mcp-v2/delegation/multica/MulticaAdministrationService.ts`: member-as-leader, Rich MCP assignment and `in_place` resources.
- Modify `apps/server/src/mcp-v2/delegation/multica/createMulticaIntegration.ts`: expose the workbench service.
- Create `apps/server/src/routes/multicaProjectWorkbench.ts`: project-scoped REST routes and errors.
- Modify `apps/server/src/index.ts`: mount workbench routes using the same production integration.

### CLI

- Modify `scripts/rich-cli.mjs`: `multica team`, `multica work` and `multica project` commands.

### Web

- Modify `apps/web/src/api/client.ts`: typed workbench DTOs and API methods.
- Replace `apps/web/src/views/project-management/sections/TodoBoardModel.ts`: Multica status catalog and drag planning helpers.
- Replace `apps/web/src/views/project-management/sections/TodoBoardModel.test.ts`: model tests.
- Create `apps/web/src/views/project-management/multica/MulticaProjectBoard.tsx`: board shell, polling and mutations.
- Create `apps/web/src/views/project-management/multica/MulticaTeamPanel.tsx`: Multica Project, Squad, leader, members, Agent runtime/model/MCP and project resource summary.
- Create `apps/web/src/views/project-management/multica/MulticaBoardColumn.tsx`: 280px column and empty state.
- Create `apps/web/src/views/project-management/multica/MulticaBoardCard.tsx`: Multica-density task card.
- Create `apps/web/src/views/project-management/multica/MulticaIssueDetail.tsx`: title, description, sub-issues and timeline.
- Create `apps/web/src/views/project-management/multica/MulticaIssueSidebar.tsx`: properties, PR, execution log, details and usage.
- Create `apps/web/src/views/project-management/multica/MulticaTimeline.tsx`: activity/comment stream and composer.
- Create `apps/web/src/views/project-management/multica/MulticaExecutionLog.tsx`: Run and incremental message view.
- Create `apps/web/src/views/project-management/multica/MulticaProjectWorkbench.css`: source-aligned semantic styles and attribution.
- Modify `apps/web/src/views/project-management/sections/TodosSection.tsx`: mount workbench instead of local Todo CRUD.
- Modify `apps/web/src/views/ProjectsView.css`: remove obsolete local board rules after the new stylesheet is active.

### Tests and documentation

- Create `apps/server/test/multica-project-workbench.test.ts`.
- Create `apps/server/test/multica-project-workbench-routes.test.ts`.
- Modify `apps/server/test/multica-administration.test.ts`.
- Create `apps/server/test/rich-cli-multica.test.ts`.
- Create `apps/web/src/views/project-management/multica/MulticaProjectWorkbench.test.ts`.
- Modify `docs/PROJECT_MANAGEMENT_MCP_MANUAL.md` and `docs/RICH_CLI_COVERAGE.md` with workbench and attribution behavior.

## Task 1: Define the complete Multica workbench boundary

**Files:**
- Create: `apps/server/src/mcp-v2/delegation/multica/MulticaProjectWorkbenchSchemas.ts`
- Test: `apps/server/test/multica-project-workbench.test.ts`

- [ ] **Step 1: Write failing schema tests**

Add fixtures inline that cover a board Issue, a comment/activity timeline, Runs, Run Messages, PRs and usage. Assert that unknown fields survive only inside `raw`, while required identifiers and statuses are typed.

```ts
it("parses one complete project workbench snapshot", () => {
  const result = multicaBoardSnapshotSchema.parse({
    project: { id: "mp-1", title: "【VTB】二代SAFE", status: "planned" },
    statuses: [{ id: "in_progress", name: "进行中", category: "started", color: "#f5a524", position: 2 }],
    issues: [{ id: "issue-1", identifier: "VTB-1", title: "熟悉项目", status: "in_progress", project_id: "mp-1", priority: "high", position: 10 }],
    syncedAt: "2026-08-28T06:00:00.000Z",
  });
  expect(result.issues[0]).toMatchObject({ id: "issue-1", identifier: "VTB-1", priority: "high" });
});
```

- [ ] **Step 2: Run the narrow test and verify RED**

Run: `pnpm --filter @ke/server exec vitest run test/multica-project-workbench.test.ts`

Expected: FAIL because `MulticaProjectWorkbenchSchemas.ts` does not exist.

- [ ] **Step 3: Implement DTO schemas**

Define explicit schemas and inferred types for:

```ts
export const multicaWorkbenchIssueSchema = z.object({
  id: z.string().min(1),
  identifier: z.string().nullable().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  status: z.string().min(1),
  status_category: z.string().nullable().optional(),
  priority: z.string().nullable().optional(),
  position: z.number().optional(),
  project_id: z.string().nullable().optional(),
  parent_id: z.string().nullable().optional(),
  assignee_id: z.string().nullable().optional(),
  assignee_type: z.string().nullable().optional(),
  start_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
}).passthrough();

export type MulticaWorkbenchIssue = z.infer<typeof multicaWorkbenchIssueSchema>;
```

Also define `MulticaStatus`, `MulticaActor`, `MulticaAttachment`, `MulticaTimelineEntry`, `MulticaComment`, `MulticaRunMessage`, `MulticaPullRequest`, `MulticaUsage`, `MulticaTeamSnapshot`, `MulticaBoardSnapshot` and `MulticaIssueDetailSnapshot`.

- [ ] **Step 4: Run the narrow test and verify GREEN**

Run: `pnpm --filter @ke/server exec vitest run test/multica-project-workbench.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/mcp-v2/delegation/multica/MulticaProjectWorkbenchSchemas.ts apps/server/test/multica-project-workbench.test.ts
git commit -m "feat(multica): define project workbench contracts"
```

## Task 2: Let a requested member lead the Squad and receive Rich MCP

**Files:**
- Modify: `apps/server/src/mcp-v2/delegation/multica/MulticaBindingRepo.ts`
- Modify: `apps/server/src/mcp-v2/delegation/multica/MulticaAdministrationService.ts`
- Modify: `apps/server/test/multica-administration.test.ts`
- Modify: `apps/server/test/multica-binding-repo.test.ts`

- [ ] **Step 1: Add failing VTB plan/apply tests**

Use a request with `leaderCapabilityKey: "project-management"`, `executionMode: "in_place"`, and `richMcp: { name: "rich", url: "http://127.0.0.1:31515/mcp" }`.

```ts
const vtbRequest: MulticaTeamPlanRequest = {
  richProjectId: "vtb-二代safe",
  richProjectName: "【VTB】二代SAFE",
  goal: "建立项目认知基线",
  workingDirectory: "/Users/binkerking/Documents/Ai-WorkSpace/Projects/【VTB】二代SAFE",
  executionMode: "in_place",
  leaderCapabilityKey: "project-management",
  richMcp: { name: "rich", url: "http://127.0.0.1:31515/mcp" },
  capabilities: [
    { key: "project-management", proposedName: "沈砚", role: "project-manager", description: "项目经理", runtimeProvider: "codex", model: "gpt-5.6-terra" },
    { key: "business-analysis", proposedName: "苏澄", role: "business-analyst", description: "BA", runtimeProvider: "codex", model: "gpt-5.6-terra" },
    { key: "development-analysis", proposedName: "陆骁", role: "developer", description: "开发", runtimeProvider: "codex", model: "gpt-5.6-terra" },
    { key: "test-analysis", proposedName: "林检", role: "tester", description: "测试", runtimeProvider: "codex", model: "gpt-5.6-terra" },
  ],
};
```

Assert that `definition.leader.name === "沈砚"`, `members` contains the other three agents only, Agent creation uses `--model gpt-5.6-terra`, resource creation uses `--execution-mode in_place`, Workspace MCP is created through stdin, and only the leader receives `agent mcp add`.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @ke/server exec vitest run test/multica-administration.test.ts test/multica-binding-repo.test.ts`

Expected: FAIL on the current hard-coded `Rich 调度员` and `worktree` behavior.

- [ ] **Step 3: Extend request and binding types**

Add:

```ts
export interface MulticaTeamPlanRequest {
  // existing fields
  leaderCapabilityKey?: string;
  executionMode?: "in_place" | "worktree";
  richMcp?: { name: string; url: string };
}

export interface MulticaProjectBinding {
  // existing fields
  leader: MulticaAgentBinding;
  executionMode: "in_place" | "worktree";
  richMcp?: { serverId: string; name: string; url: string; agentId: string };
}
```

- [ ] **Step 4: Resolve the leader from capabilities**

In `planTeam`, select the capability named by `leaderCapabilityKey`, create/reuse it as `definition.leader`, and exclude it from `definition.members`. Preserve the old dedicated leader behavior only when `leaderCapabilityKey` is omitted.

- [ ] **Step 5: Apply execution mode and MCP assignment**

Use `plan.request.executionMode ?? "worktree"` in `project resource add`. Add `ensureWorkspaceMcp()` that lists Workspace MCP servers, creates the Rich server with `--server-config-stdin`, and assigns it only to the resolved leader.

```ts
await this.commands.runJson([
  "workspace", "mcp", "add", request.name, "--server-config-stdin", "--output", "json",
], { stdin: JSON.stringify({ url: request.url }) });
```

- [ ] **Step 6: Run tests and verify GREEN**

Run: `pnpm --filter @ke/server exec vitest run test/multica-administration.test.ts test/multica-binding-repo.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/mcp-v2/delegation/multica/MulticaBindingRepo.ts apps/server/src/mcp-v2/delegation/multica/MulticaAdministrationService.ts apps/server/test/multica-administration.test.ts apps/server/test/multica-binding-repo.test.ts
git commit -m "feat(multica): support project leaders and Rich MCP"
```

## Task 3: Implement complete read projections

**Files:**
- Create: `apps/server/src/mcp-v2/delegation/multica/MulticaProjectWorkbenchService.ts`
- Modify: `apps/server/test/multica-project-workbench.test.ts`

- [ ] **Step 1: Write failing project-bound read tests**

Create a fake command port with two Projects and Issues from both Projects. Assert:

```ts
await expect(service.getBoard("vtb-二代safe")).resolves.toMatchObject({
  project: { id: "multica-vtb" },
  issues: [{ id: "vtb-1", project_id: "multica-vtb" }],
});
await expect(service.getIssue("vtb-二代safe", "other-1")).rejects.toMatchObject({ code: "NOT_FOUND" });
```

Cover `getTeam`, `getIssue`, `getTimeline`, `getRuns`, `getRunMessages`, `getPullRequests`, `getUsage`, attachments, labels, properties, metadata, subscribers and children.

- [ ] **Step 2: Run test and verify RED**

Run: `pnpm --filter @ke/server exec vitest run test/multica-project-workbench.test.ts`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement binding and ownership guards**

```ts
private async binding(projectId: string): Promise<MulticaProjectBinding> {
  const binding = await this.bindings.getBinding(projectId);
  if (!binding) throw new RichMcpError("CONFLICT", `Rich project ${projectId} is not connected to Multica.`);
  return binding;
}

private async ownedIssue(projectId: string, issueId: string): Promise<MulticaWorkbenchIssue> {
  const binding = await this.binding(projectId);
  const issue = multicaWorkbenchIssueSchema.parse(await this.commands.runJson(["issue", "get", issueId, "--output", "json"]));
  if (issue.project_id !== binding.projectId) throw new RichMcpError("NOT_FOUND", `Issue ${issueId} is not in this Rich project.`);
  return issue;
}
```

- [ ] **Step 4: Implement board and lazy detail readers**

`getBoard()` returns only board data and a `syncedAt` timestamp. Because CLI v0.4.35 has no status-catalog list command, derive the status projection from the documented baseline plus statuses observed on project Issues. Detail subresources call their exact CLI commands only after `ownedIssue()` succeeds. Parse every result with Task 1 schemas, including attachment metadata returned by Issue detail and downloadable attachment references.

- [ ] **Step 5: Run test and verify GREEN**

Run: `pnpm --filter @ke/server exec vitest run test/multica-project-workbench.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/mcp-v2/delegation/multica/MulticaProjectWorkbenchService.ts apps/server/test/multica-project-workbench.test.ts
git commit -m "feat(multica): project complete workbench data"
```

## Task 4: Implement controlled Multica mutations

**Files:**
- Modify: `apps/server/src/mcp-v2/delegation/multica/MulticaProjectWorkbenchService.ts`
- Modify: `apps/server/test/multica-project-workbench.test.ts`

- [ ] **Step 1: Write failing mutation tests**

Cover create, patch, cross-column status, same-column reorder, assign, comment, reply, resolve, rerun, cancel, labels, properties, metadata and subscribers. Assert long descriptions/comments use stdin and every existing Issue mutation calls `ownedIssue()` first.

```ts
await service.updateIssue("vtb-二代safe", "vtb-1", { description: "多行\n说明" });
expect(commands.last()).toEqual({
  args: ["issue", "update", "vtb-1", "--description-stdin", "--output", "json"],
  stdin: "多行\n说明",
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `pnpm --filter @ke/server exec vitest run test/multica-project-workbench.test.ts`

Expected: FAIL on missing mutation methods.

- [ ] **Step 3: Add typed mutation methods**

Expose narrow operations, not a generic `run(args)` escape hatch:

```ts
createIssue(projectId, input)
updateIssue(projectId, issueId, patch)
setStatus(projectId, issueId, status)
reorderIssue(projectId, issueId, target)
assignIssue(projectId, issueId, assigneeId)
addComment(projectId, issueId, content, parentId?)
resolveComment(projectId, issueId, commentId, resolved)
rerunIssue(projectId, issueId)
cancelRun(projectId, issueId, runId)
setLabel(projectId, issueId, labelId, attached)
setProperty(projectId, issueId, propertyId, value)
setMetadata(projectId, issueId, key, value)
setSubscriber(projectId, issueId, actorId, subscribed)
```

- [ ] **Step 4: Run test and verify GREEN**

Run: `pnpm --filter @ke/server exec vitest run test/multica-project-workbench.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/mcp-v2/delegation/multica/MulticaProjectWorkbenchService.ts apps/server/test/multica-project-workbench.test.ts
git commit -m "feat(multica): mutate project issues safely"
```

## Task 5: Expose project-scoped HTTP routes and team commands

**Files:**
- Create: `apps/server/src/routes/multicaProjectWorkbench.ts`
- Modify: `apps/server/src/mcp-v2/delegation/multica/createMulticaIntegration.ts`
- Modify: `apps/server/src/index.ts`
- Create: `apps/server/test/multica-project-workbench-routes.test.ts`

- [ ] **Step 1: Write failing route tests**

Build the route against a fake `MulticaProjectWorkbenchPort` and fake team/delegation facade. Verify GET, PATCH and POST payloads, `cache-control: no-store`, 404 for foreign Issues, and 503/retryable body for unavailable CLI.

```ts
const response = await app.request("/api/project-management/vtb-%E4%BA%8C%E4%BB%A3safe/multica/board");
expect(response.status).toBe(200);
expect(response.headers.get("cache-control")).toBe("no-store");
```

- [ ] **Step 2: Run test and verify RED**

Run: `pnpm --filter @ke/server exec vitest run test/multica-project-workbench-routes.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement routes**

Mount under `/api/project-management/:projectId/multica`. Add board/team/detail/subresource routes and narrow mutation actions from the design. Add:

```text
POST /:projectId/multica/team/plan
POST /:projectId/multica/team/apply
POST /:projectId/multica/work/delegate
GET  /:projectId/multica/work/:taskId
POST /:projectId/multica/sync
```

Reuse the same `executionTeams`, `delegationAdapter`, binding repo and persistent task service as MCP composition; do not create parallel bindings.

- [ ] **Step 4: Expose `workbench` from production integration**

```ts
export interface MulticaIntegration {
  commands: MulticaCommandPort;
  executionTeams: ExecutionTeamAdministrationPort;
  delegationAdapter: WorkDelegationPort;
  workbench: MulticaProjectWorkbenchService;
}
```

- [ ] **Step 5: Run route and regression tests**

Run: `pnpm --filter @ke/server exec vitest run test/multica-project-workbench-routes.test.ts test/routes.test.ts test/multica-integration.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/routes/multicaProjectWorkbench.ts apps/server/src/mcp-v2/delegation/multica/createMulticaIntegration.ts apps/server/src/index.ts apps/server/test/multica-project-workbench-routes.test.ts apps/server/test/multica-integration.test.ts
git commit -m "feat(multica): expose project workbench API"
```

## Task 6: Add Rich CLI semantic commands

**Files:**
- Modify: `scripts/rich-cli.mjs`
- Create: `apps/server/test/rich-cli-multica.test.ts`
- Modify: `docs/RICH_CLI_COVERAGE.md`

- [ ] **Step 1: Write failing CLI tests**

Start a local fake HTTP server, invoke `node scripts/rich-cli.mjs`, and assert request method, path and body for all five commands. Verify `team apply` rejects missing `--confirmed` before making an HTTP request.

- [ ] **Step 2: Run test and verify RED**

Run: `pnpm --filter @ke/server exec vitest run test/rich-cli-multica.test.ts`

Expected: FAIL with `unknown command: multica ...`.

- [ ] **Step 3: Implement commands and usage**

```js
if (domain === "multica") {
  const projectId = id(b, "projectId");
  if (action === "team" && a === "plan") return request("POST", `/api/project-management/${projectId}/multica/team/plan`, flags, body ?? {});
  if (action === "team" && a === "apply") {
    if (flags.confirmed !== true) throw new Error("multica team apply requires --confirmed");
    return request("POST", `/api/project-management/${projectId}/multica/team/apply`, flags, body ?? {});
  }
}
```

Adjust positional parsing explicitly for:

```text
multica team plan <projectId>
multica team apply <projectId>
multica work delegate <projectId>
multica work status <projectId> <taskId>
multica project sync <projectId>
```

- [ ] **Step 4: Run test and verify GREEN**

Run: `pnpm --filter @ke/server exec vitest run test/rich-cli-multica.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/rich-cli.mjs apps/server/test/rich-cli-multica.test.ts docs/RICH_CLI_COVERAGE.md
git commit -m "feat(cli): manage Multica project work"
```

## Task 7: Add the web API and board model

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Replace: `apps/web/src/views/project-management/sections/TodoBoardModel.ts`
- Replace: `apps/web/src/views/project-management/sections/TodoBoardModel.test.ts`

- [ ] **Step 1: Write failing pure model tests**

Test dynamic status ordering and drag planning:

```ts
assert.deepEqual(planMulticaDrop({ issueId: "a", fromStatus: "todo", toStatus: "in_progress", beforeId: "b" }), [
  { kind: "status", issueId: "a", status: "in_progress" },
]);
assert.deepEqual(planMulticaDrop({ issueId: "a", fromStatus: "todo", toStatus: "todo", afterId: "b" }), [
  { kind: "reorder", issueId: "a", afterId: "b" },
]);
```

- [ ] **Step 2: Run and verify RED**

Run: `pnpm --filter @ke/server exec tsx --test ../web/src/views/project-management/sections/TodoBoardModel.test.ts`

Expected: FAIL because dynamic helpers do not exist.

- [ ] **Step 3: Implement API DTOs and methods**

Mirror server DTO names in `client.ts`, then add `getMulticaBoard`, `getMulticaTeam`, `getMulticaIssue`, `getMulticaTimeline`, `getMulticaRuns`, `getMulticaRunMessages`, `getMulticaPullRequests`, `getMulticaUsage` and mutation methods. Every fetch uses `cache: "no-store"` and reports the endpoint/status in errors.

- [ ] **Step 4: Implement board helpers**

Remove the local five-state normalization. Multica CLI v0.4.35 does not expose a status-catalog list command, so build the ordered baseline from the CLI-supported values `backlog`, `todo`, `in_progress`, `in_review`, `done`, `blocked`, and `cancelled`; append any unknown status observed on an Issue instead of dropping it. Return status and reorder commands exactly as Multica drag rules require.

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm --filter @ke/server exec tsx --test ../web/src/views/project-management/sections/TodoBoardModel.test.ts && pnpm --filter @ke/web typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/api/client.ts apps/web/src/views/project-management/sections/TodoBoardModel.ts apps/web/src/views/project-management/sections/TodoBoardModel.test.ts
git commit -m "feat(web): add Multica board client model"
```

## Task 8: Replace local Todo CRUD with the Multica board

**Files:**
- Create: `apps/web/src/views/project-management/multica/MulticaProjectBoard.tsx`
- Create: `apps/web/src/views/project-management/multica/MulticaTeamPanel.tsx`
- Create: `apps/web/src/views/project-management/multica/MulticaBoardColumn.tsx`
- Create: `apps/web/src/views/project-management/multica/MulticaBoardCard.tsx`
- Create: `apps/web/src/views/project-management/multica/MulticaProjectWorkbench.css`
- Modify: `apps/web/src/views/project-management/sections/TodosSection.tsx`
- Create: `apps/web/src/views/project-management/multica/MulticaProjectWorkbench.test.ts`

- [ ] **Step 1: Write failing source-level UI tests**

The current web package has no DOM test environment, so use Node source/style assertions consistent with existing project management tests. Assert:

```ts
assert.match(styles, /--multica-board-column-width:\s*280px/);
assert.match(cardSource, /Powered by Multica/);
assert.match(boardSource, /getMulticaBoard/);
assert.doesNotMatch(todosSource, /createProjectManagementModuleItem/);
```

- [ ] **Step 2: Run and verify RED**

Run: `pnpm --filter @ke/server exec tsx --test ../web/src/views/project-management/multica/MulticaProjectWorkbench.test.ts`

Expected: FAIL because the files do not exist.

- [ ] **Step 3: Implement board polling and states**

`MulticaProjectBoard` loads on mount, refreshes every 5 seconds while focused and every 30 seconds while hidden, refreshes on `visibilitychange`, preserves the last successful board on error, and shows `lastSyncedAt` plus retry.

- [ ] **Step 4: Implement source-aligned columns and cards**

Use exact behavior from Multica source:

```css
.multica-workbench {
  --multica-board-column-width: 280px;
  --multica-surface: var(--panel);
  --multica-surface-hover: color-mix(in srgb, var(--panel) 92%, white 8%);
}
.multica-workbench__card {
  border: .5px solid var(--border);
  border-radius: 8px;
  background: var(--multica-surface);
  padding: 12px 10px;
  box-shadow: 0 1px 2px rgba(0,0,0,.18);
}
```

Render dynamic status columns, identifier, title, priority, assignee, labels, child progress and active Agent indicator. Add a source-aligned team panel showing the bound Multica Project and Squad, leader/member roles, each Agent's model/runtime/MCP assignments, and the project resource path/mode. Keep the visible `Powered by Multica` attribution in the board footer.

- [ ] **Step 5: Implement optimistic drag with rollback**

Apply the deterministic local board move, call status/reorder API, then refresh. On error restore the previous snapshot and show a retryable error.

- [ ] **Step 6: Replace `TodosSection`**

```tsx
export function TodosSection({ project }: Props): ReactNode {
  return <MulticaProjectBoard projectId={project.id} projectTitle={project.title} />;
}
```

- [ ] **Step 7: Run tests, typecheck and build**

Run: `pnpm --filter @ke/server exec tsx --test ../web/src/views/project-management/multica/MulticaProjectWorkbench.test.ts && pnpm --filter @ke/web typecheck && pnpm --filter @ke/web build`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/views/project-management/multica apps/web/src/views/project-management/sections/TodosSection.tsx
git commit -m "feat(web): show Multica project board"
```

## Task 9: Build the Multica-compatible Issue detail

**Files:**
- Create: `apps/web/src/views/project-management/multica/MulticaIssueDetail.tsx`
- Create: `apps/web/src/views/project-management/multica/MulticaIssueSidebar.tsx`
- Create: `apps/web/src/views/project-management/multica/MulticaTimeline.tsx`
- Create: `apps/web/src/views/project-management/multica/MulticaExecutionLog.tsx`
- Modify: `apps/web/src/views/project-management/multica/MulticaProjectBoard.tsx`
- Modify: `apps/web/src/views/project-management/multica/MulticaProjectWorkbench.css`
- Modify: `apps/web/src/views/project-management/multica/MulticaProjectWorkbench.test.ts`

- [ ] **Step 1: Add failing structural tests**

Assert the detail source includes description, sub-issues, timeline, comment composer, resizable/right Sheet behavior, properties, parent, PR, execution log, details and usage. Assert no custom tab strip is introduced.

- [ ] **Step 2: Run and verify RED**

Run: `pnpm --filter @ke/server exec tsx --test ../web/src/views/project-management/multica/MulticaProjectWorkbench.test.ts`

Expected: FAIL on missing detail components.

- [ ] **Step 3: Implement main detail and lazy resources**

On card selection load Issue detail, including attachment metadata and download actions. Load Timeline immediately after detail, but load Runs, Messages, PR and Usage only when their collapsible sections open. Use `AbortController` when selection changes.

- [ ] **Step 4: Implement timeline and comments**

Merge activity and comments chronologically. Group adjacent activity records, keep the latest block expanded, support comment replies and resolve/unresolve, and refresh after successful submission.

- [ ] **Step 5: Implement right sidebar and execution log**

Match Multica's desktop 320px sidebar and small-screen Sheet. Show property pickers, parent, attachments, PR list, Execution Log, creator/dates and Usage. Runs are collapsible and messages use `since` sequence incremental loads. Attachment creation is exposed only where the current Multica CLI has a corresponding upload/create flag; unsupported mutations remain read-only rather than becoming Rich-local state.

- [ ] **Step 6: Run tests, typecheck and build**

Run: `pnpm --filter @ke/server exec tsx --test ../web/src/views/project-management/multica/MulticaProjectWorkbench.test.ts && pnpm --filter @ke/web typecheck && pnpm --filter @ke/web build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/views/project-management/multica
git commit -m "feat(web): add complete Multica issue detail"
```

## Task 10: Document and verify automated behavior

**Files:**
- Modify: `docs/PROJECT_MANAGEMENT_MCP_MANUAL.md`
- Modify: `docs/RICH_CLI_COVERAGE.md`
- Modify: `ai/rich-system.md`

- [ ] **Step 1: Document source of truth and commands**

State that bound project Todo data comes from Multica, list the CLI commands, document retry/error behavior, record `Powered by Multica` attribution and the local-source compatibility basis, and teach Hermes to use team plan/apply/delegate rather than local Todo creation for external execution work.

- [ ] **Step 2: Run full automated verification**

Run:

```bash
pnpm rebuild:sqlite
pnpm test
pnpm typecheck
pnpm --filter @ke/web build
```

Expected: domain 30 tests pass; server suite passes with only the configured safe-database integration tests skipped; all typechecks and Web build pass.

- [ ] **Step 3: Commit**

```bash
git add docs/PROJECT_MANAGEMENT_MCP_MANUAL.md docs/RICH_CLI_COVERAGE.md ai/rich-system.md
git commit -m "docs: explain Multica project workbench"
```

## Task 11: Create the real VTB Multica team through Rich CLI

**Files:**
- Create temporarily outside Git: `/tmp/rich-vtb-multica-team.json`
- Create temporarily outside Git: `/tmp/rich-vtb-multica-task.json`

- [ ] **Step 1: Build and restart the current Rich Server/Desktop before writes**

Run the Desktop packaging command from Task 13 only after Node tests. Start the latest Rich.app and verify `pnpm rich -- health` and `/mcp` respond.

- [ ] **Step 2: Create the team request file with mode 0600**

The JSON must contain the four names, `gpt-5.6-terra`, member-as-leader, `in_place`, Rich MCP URL, exact VTB directory and role instructions from the design. Do not include secrets.

- [ ] **Step 3: Plan through Rich CLI and inspect the plan**

Run:

```bash
VTB_PLAN_ID="$(pnpm rich -- multica team plan vtb-二代safe --file /tmp/rich-vtb-multica-team.json --raw | jq -r '.data.planId // .planId')"
test -n "$VTB_PLAN_ID" && test "$VTB_PLAN_ID" != "null"
```

Expected: Project `【VTB】二代SAFE`, Squad `VTB SAFE 研析小队`, Leader `沈砚`, members `苏澄/陆骁/林检`, Codex Runtime and `gpt-5.6-terra`; no writes yet.

- [ ] **Step 4: Apply the exact returned plan**

Run:

```bash
pnpm rich -- multica team apply vtb-二代safe --confirmed --json "$(jq -nc --arg planId "$VTB_PLAN_ID" '{planId: $planId}')"
```

Expected: Project, four Agents, Squad, `in_place` local resource and Rich MCP assignment are created or reused once.

- [ ] **Step 5: Verify external resources read-only**

Use Multica CLI list/get commands to verify UUIDs, model, leader, member roles, resource mode and that only `沈砚` has Rich MCP.

- [ ] **Step 6: Commit no files**

The resource creation is external state. Confirm `git status --short` remains clean.

## Task 12: Publish the real analysis task and verify Rich sync

**Files:**
- Temporary: `/tmp/rich-vtb-multica-task.json`

- [ ] **Step 1: Create the exact analysis task payload**

Include the title, read-only instructions, seven acceptance criteria, required roles, working directory and Rich project context reference from the design.

- [ ] **Step 2: Delegate through Rich CLI**

Run:

```bash
pnpm rich -- multica work delegate vtb-二代safe --file /tmp/rich-vtb-multica-task.json
```

Expected: one Rich task ID and one Multica Issue UUID, assigned to `VTB SAFE 研析小队`.

- [ ] **Step 3: Verify the run and workbench projection**

Check Rich CLI status plus the Rich board API. Confirm the same Issue identifier, status, assignee, Run and latest activity appear in both Multica and Rich.

- [ ] **Step 4: Verify one controlled round-trip interaction**

Add a clearly marked test comment in Rich and confirm it appears in Multica. Change it only through a reversible/status-safe action, confirm Multica reflects it, then leave the task in the intended execution status.

- [ ] **Step 5: Verify VTB directory remains unchanged**

Record a before/after file metadata snapshot for the directory and verify no project file was created, modified or deleted by the analysis task at this checkpoint.

- [ ] **Step 6: Record external IDs in the final handoff**

Report Multica Project UUID, Squad UUID, Agent UUIDs, Rich task ID and Multica Issue UUID. Do not commit tokens or private runtime configuration.

## Task 13: Package, install and restart Rich Desktop

**Files:**
- Build output: `apps/desktop/release/mac-arm64/Rich.app`
- Installed app: `/Applications/Rich.app`

- [ ] **Step 1: Run final verification before packaging**

Run:

```bash
pnpm rebuild:sqlite
pnpm test
pnpm typecheck
pnpm --filter @ke/web build
```

Expected: all required commands exit 0.

- [ ] **Step 2: Package Desktop**

Run: `pnpm --filter @ke/desktop package`

Expected: `apps/desktop/release/mac-arm64/Rich.app` exists.

- [ ] **Step 3: Replace the installed app safely**

Quit Rich, copy the new app to an exact temporary `/Applications/Rich.app.new`, move the existing exact `/Applications/Rich.app` aside, promote the new bundle, launch it, verify health and remove the old exact backup only after successful launch. Do not use recursive deletion against broad paths.

- [ ] **Step 4: Verify the installed UI**

Open `【VTB】二代SAFE → 项目代办`. Verify Multica-aligned 280px columns, populated cards, `Powered by Multica`, Issue detail, Timeline and Execution Log. Capture a screenshot for evidence.

- [ ] **Step 5: Restore Node ABI if additional tests are run**

Electron packaging changes the shared `better-sqlite3` ABI. Before any later Node tests run `pnpm rebuild:sqlite`.

- [ ] **Step 6: Final clean-state check**

Run:

```bash
git status --short --branch
git log -5 --oneline --decorate
```

Expected: `main` is clean and contains the workbench commits.
