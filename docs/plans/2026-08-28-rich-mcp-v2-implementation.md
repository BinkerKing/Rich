# Rich MCP 2.0 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Rich's approximately 136 low-level MCP tools with a scenario-first MCP 2.0 of at most 40 tools, backed by a uniform contract, persistent tasks, generated documentation, and a replaceable external-agent delegation port.

**Architecture:** Build MCP 2.0 beside the current implementation, reuse existing Rich repositories and domain services, and expose tools only through a typed registry. Scenario tools orchestrate resource services; resource manage tools provide precise fallback operations. Switch `/mcp` atomically after contract, regression, and tool-selection tests pass, then delete the legacy MCP registration code.

**Tech Stack:** TypeScript, Fastify, `@modelcontextprotocol/sdk`, Zod, SQLite/Postgres repositories, Vitest, pnpm.

---

## Implementation rules

- Work test-first: add one failing test, run it, add the minimum implementation, rerun it.
- Do not change existing Rich page or HTTP API behavior.
- Reuse repositories and domain services; do not call Rich's own HTTP API from MCP.
- Do not add backward-compatible aliases for old MCP tools.
- Every write path must cover request idempotency, dry-run where applicable, confirmation for destructive actions, and write-after-read verification.
- Keep the current `/mcp` active until Task 10.
- Commit after each task only when the working tree can isolate that task from unrelated user changes.

## Success criteria

Run from `/Users/binkerking/Documents/Ai-WorkSpace/Rich` unless a step says otherwise.

```bash
pnpm --filter @ke/server exec vitest run
pnpm --filter @ke/server typecheck
pnpm --filter @ke/web typecheck
pnpm --filter @ke/web build
```

Final MCP-specific checks must prove:

- no more than 40 registered tools;
- generated schema JSON is at least 60% smaller than the frozen legacy baseline;
- all 50 deterministic tool-selection cases pass;
- the optional live Hermes benchmark reaches at least 90%;
- duplicate request IDs do not duplicate writes;
- destructive actions without confirmation fail;
- persisted tasks survive service/repository recreation;
- `/mcp` lists and invokes only MCP 2.0 tools.

## Task 1: Freeze the legacy catalog and selection benchmark

**Files:**

- Create: `apps/server/src/mcp-v2/registry/catalogMetrics.ts`
- Create: `apps/server/scripts/snapshot-legacy-mcp.ts`
- Create: `apps/server/test/fixtures/mcp-v2/legacy-catalog.json`
- Create: `apps/server/test/fixtures/mcp-v2/tool-selection-cases.json`
- Create: `apps/server/test/mcp-v2-baseline.test.ts`

**Step 1: Write a failing baseline test**

The fixture must contain `toolCount`, `schemaBytes`, and the legacy tool names. The selection fixture must contain at least 50 realistic Chinese prompts covering all six scenarios, with one expected MCP 2.0 tool and optional forbidden tools.

```ts
it("freezes a useful MCP migration baseline", () => {
  expect(legacy.toolCount).toBeGreaterThan(100);
  expect(legacy.schemaBytes).toBeGreaterThan(0);
  expect(cases).toHaveLength(50);
  expect(new Set(cases.map((item) => item.scenario))).toEqual(
    new Set(["query", "capture", "manage", "plan", "delegate", "review"]),
  );
});
```

**Step 2: Run the test and confirm failure**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-baseline.test.ts
```

Expected: fail because fixtures and metric helper do not exist.

**Step 3: Implement deterministic catalog measurement**

`catalogMetrics.ts` must calculate UTF-8 bytes from stable JSON, sorting tools by name before serialization. `snapshot-legacy-mcp.ts` may inspect the current server registration once to create the frozen fixture; production MCP 2.0 tests must not use SDK-private `_registeredTools`.

**Step 4: Add the 50 prompt cases**

Include ambiguous cases such as “帮我把这个做了” with enough context to distinguish planning from delegation, and negative cases that must not use a destructive/manage tool for a read request.

**Step 5: Run and commit**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-baseline.test.ts
git add apps/server/src/mcp-v2/registry/catalogMetrics.ts apps/server/scripts/snapshot-legacy-mcp.ts apps/server/test/fixtures/mcp-v2 apps/server/test/mcp-v2-baseline.test.ts
git commit -m "test(mcp): freeze v1 catalog and selection baseline"
```

## Task 2: Define the MCP 2.0 contract and response boundary

**Files:**

- Create: `apps/server/src/mcp-v2/registry/types.ts`
- Create: `apps/server/src/mcp-v2/registry/errors.ts`
- Create: `apps/server/src/mcp-v2/registry/response.ts`
- Create: `apps/server/test/mcp-v2-response.test.ts`

**Step 1: Write failing contract tests**

Cover success, known domain error, unknown error redaction, changes, refs, warnings, and verification.

```ts
it("redacts unknown exceptions at the MCP boundary", () => {
  const response = toRichToolFailure("rich_project_manage", new Error("secret detail"));
  expect(response).toMatchObject({
    ok: false,
    action: "rich_project_manage",
    error: { code: "INTERNAL_ERROR", retryable: false },
  });
  expect(JSON.stringify(response)).not.toContain("secret detail");
});
```

**Step 2: Run and confirm failure**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-response.test.ts
```

**Step 3: Add the minimum types and helpers**

Define `RichToolContext`, `RichToolOptions`, `RichToolResponse<T>`, `RichToolError`, `RichErrorCode`, `RichToolAnnotations`, and a typed `RichMcpError`. Provide `richSuccess`, `richFailure`, and `toRichToolFailure`. Do not log or return a raw stack from these helpers; logging belongs at the server boundary.

**Step 4: Verify and commit**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-response.test.ts
pnpm --filter @ke/server typecheck
git add apps/server/src/mcp-v2/registry apps/server/test/mcp-v2-response.test.ts
git commit -m "feat(mcp): define v2 tool contract"
```

## Task 3: Build the typed tool registry

**Files:**

- Create: `apps/server/src/mcp-v2/registry/toolRegistry.ts`
- Create: `apps/server/src/mcp-v2/registry/catalog.ts`
- Create: `apps/server/test/mcp-v2-registry.test.ts`

**Step 1: Write failing registry tests**

Test duplicate names, invalid names, missing annotations/examples, stable catalog output, schema-byte reporting, and the 40-tool cap.

```ts
it("rejects a forty-first tool", () => {
  const registry = new RichToolRegistry({ maxTools: 40 });
  for (let index = 0; index < 40; index += 1) registerFixture(registry, index);
  expect(() => registerFixture(registry, 40)).toThrow(/40/);
});
```

**Step 2: Run and confirm failure**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-registry.test.ts
```

**Step 3: Implement the registry**

Each registration contains name, title, concise model-facing description, category, Zod input schema, annotations, examples, verification description, and handler. Expose explicit `listDefinitions()` and `invoke()` methods so tests never inspect SDK-private fields.

Enforce `^rich_[a-z0-9]+_[a-z0-9_]+$`. Keep registration order irrelevant by sorting catalog output by name.

**Step 4: Verify metrics against the frozen baseline**

The test should assert the cap now and report schema bytes. Do not assert the 60% reduction until all tools are registered in Task 11.

**Step 5: Run and commit**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-registry.test.ts
pnpm --filter @ke/server typecheck
git add apps/server/src/mcp-v2/registry apps/server/test/mcp-v2-registry.test.ts
git commit -m "feat(mcp): add typed v2 tool registry"
```

## Task 4: Add persistent operation idempotency

**Files:**

- Modify: `apps/server/src/db/sqlite.ts`
- Modify: `apps/server/src/db/postgres.ts`
- Create: `apps/server/src/repos/McpOperationRepo.ts`
- Create: `apps/server/src/repos/SqliteMcpOperationRepo.ts`
- Create: `apps/server/src/repos/PostgresMcpOperationRepo.ts`
- Create: `apps/server/src/mcp-v2/registry/idempotency.ts`
- Create: `apps/server/test/mcp-v2-idempotency.test.ts`

**Step 1: Write failing repository and wrapper tests**

Cover first execution, exact replay, same request ID with changed input, failure not cached unless explicitly marked final, and repository recreation using the same SQLite database.

```ts
it("returns the original response without repeating the write", async () => {
  const write = vi.fn().mockResolvedValue(richSuccess("rich_project_manage", { id: "p1" }));
  await executeIdempotently(repo, request, write);
  await executeIdempotently(repo, request, write);
  expect(write).toHaveBeenCalledTimes(1);
});
```

**Step 2: Run and confirm failure**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-idempotency.test.ts
```

**Step 3: Add the schema**

Create `mcp_operation_log` with a unique key over tool name and request ID, a canonical input hash, serialized response, status, and timestamps. Follow the existing SQLite/Postgres migration style in each file; do not introduce a new migration framework.

**Step 4: Implement repositories and wrapper**

Canonicalize JSON before hashing. If an existing key has a different input hash, throw `CONFLICT`. Make concurrent duplicate requests serialize safely through the database uniqueness constraint.

**Step 5: Verify both database implementations and commit**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-idempotency.test.ts
pnpm --filter @ke/server typecheck
git add apps/server/src/db/sqlite.ts apps/server/src/db/postgres.ts apps/server/src/repos/McpOperationRepo.ts apps/server/src/repos/SqliteMcpOperationRepo.ts apps/server/src/repos/PostgresMcpOperationRepo.ts apps/server/src/mcp-v2/registry/idempotency.ts apps/server/test/mcp-v2-idempotency.test.ts
git commit -m "feat(mcp): persist write idempotency"
```

## Task 5: Implement the read-oriented resource tools

**Files:**

- Create: `apps/server/src/mcp-v2/resources/contextTools.ts`
- Create: `apps/server/src/mcp-v2/resources/knowledgeTools.ts`
- Create: `apps/server/src/mcp-v2/resources/projectTools.ts`
- Create: `apps/server/src/mcp-v2/registerResourceTools.ts`
- Create: `apps/server/test/mcp-v2-read-tools.test.ts`

**Step 1: Write failing outcome tests**

Start with the minimum public read surface:

- `rich_context_search`
- `rich_context_get_overview`
- `rich_knowledge_manage` with read actions only
- `rich_project_manage` with read actions only

Test returned refs, empty results, invalid action, and source filters. Assert business outcomes, not private repository calls.

**Step 2: Run and confirm failure**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-read-tools.test.ts
```

**Step 3: Implement by reusing existing repositories**

Use the current knowledge and project-management repositories. Normalize existing entities into stable `data` and `refs`, but do not create a second domain model. Keep manage action schemas discriminated so the model sees only parameters relevant to each action.

**Step 4: Verify existing MCP tests still pass**

The legacy `/mcp` remains active, so both suites must pass.

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-read-tools.test.ts test/mcp-elements.test.ts test/mcp-project-management.test.ts
pnpm --filter @ke/server typecheck
```

**Step 5: Commit**

```bash
git add apps/server/src/mcp-v2/resources apps/server/src/mcp-v2/registerResourceTools.ts apps/server/test/mcp-v2-read-tools.test.ts
git commit -m "feat(mcp): add v2 read resource tools"
```

## Task 6: Complete resource manage tools and write safety

**Files:**

- Modify: `apps/server/src/mcp-v2/resources/knowledgeTools.ts`
- Modify: `apps/server/src/mcp-v2/resources/projectTools.ts`
- Create: `apps/server/src/mcp-v2/resources/dictionaryTools.ts`
- Create: `apps/server/src/mcp-v2/resources/planningTools.ts`
- Create: `apps/server/src/mcp-v2/resources/practiceTools.ts`
- Create: `apps/server/src/mcp-v2/resources/automationTools.ts`
- Create: `apps/server/src/mcp-v2/registry/writeSafety.ts`
- Create: `apps/server/test/mcp-v2-write-tools.test.ts`

**Step 1: Write failing write-safety tests**

For representative create, update and delete actions, test:

- dry-run causes zero writes and returns planned changes;
- missing requestId on a non-idempotent write returns `VALIDATION_ERROR`;
- missing destructive confirmation returns `CONFIRMATION_REQUIRED`;
- replay returns the same response without another write;
- a successful write is read back and marked `verified`;
- failed read-back is not reported as fully successful.

**Step 2: Run and confirm failure**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-write-tools.test.ts
```

**Step 3: Implement shared write safety**

`writeSafety.ts` should compose confirmation, dry-run, idempotency, execution, and verification in that order. Resource modules supply only the planned change, domain write, and read-back function.

**Step 4: Add resource actions without multiplying tools**

Keep one manage tool per cohesive resource domain. Migrate only actions used by current Rich workflows or legacy tools; do not add speculative operations. Every action must have a clear description and one example.

**Step 5: Verify and commit**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-write-tools.test.ts test/mcp-v2-read-tools.test.ts
pnpm --filter @ke/server typecheck
git add apps/server/src/mcp-v2 apps/server/test/mcp-v2-write-tools.test.ts
git commit -m "feat(mcp): add safe v2 resource writes"
```

## Task 7: Add persistent Rich work tasks

**Files:**

- Modify: `apps/server/src/db/sqlite.ts`
- Modify: `apps/server/src/db/postgres.ts`
- Create: `apps/server/src/repos/McpTaskRepo.ts`
- Create: `apps/server/src/repos/SqliteMcpTaskRepo.ts`
- Create: `apps/server/src/repos/PostgresMcpTaskRepo.ts`
- Create: `apps/server/src/mcp-v2/tasks/persistentTaskService.ts`
- Create: `apps/server/src/mcp-v2/tasks/taskTools.ts`
- Create: `apps/server/test/mcp-v2-tasks.test.ts`

**Step 1: Write failing state-machine and persistence tests**

Allowed states are `queued`, `running`, `waiting_input`, `succeeded`, `failed`, and `cancelled`. Reject impossible transitions such as `succeeded -> running`. Recreate the service over the same database and prove status remains available.

**Step 2: Run and confirm failure**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-tasks.test.ts
```

**Step 3: Add the task schema and repositories**

Store Rich task ID, backend, external task ID, request payload, status, progress summary, result refs, error, conversation/request IDs, and timestamps. Add indexes for status, request ID, and external task lookup.

**Step 4: Implement the service and tools**

Register:

- `rich_work_get_status`
- `rich_work_list`
- `rich_work_cancel`

Cancellation is destructive and requires confirmation. It must update the external executor first when one exists, then persist the local terminal state.

**Step 5: Verify and commit**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-tasks.test.ts
pnpm --filter @ke/server typecheck
git add apps/server/src/db/sqlite.ts apps/server/src/db/postgres.ts apps/server/src/repos/McpTaskRepo.ts apps/server/src/repos/SqliteMcpTaskRepo.ts apps/server/src/repos/PostgresMcpTaskRepo.ts apps/server/src/mcp-v2/tasks apps/server/test/mcp-v2-tasks.test.ts
git commit -m "feat(mcp): persist delegated work tasks"
```

## Task 8: Implement the high-frequency scenario tools

**Files:**

- Create: `apps/server/src/mcp-v2/scenarios/captureInformation.ts`
- Create: `apps/server/src/mcp-v2/scenarios/organizeIntoProject.ts`
- Create: `apps/server/src/mcp-v2/scenarios/analyzeAndPlan.ts`
- Create: `apps/server/src/mcp-v2/registerScenarioTools.ts`
- Create: `apps/server/test/mcp-v2-scenarios.test.ts`

**Step 1: Write failing end-to-end scenario tests**

Register and test:

- `rich_knowledge_capture`
- `rich_project_organize_conversation`
- `rich_project_analyze_and_plan`

Use representative Chinese conversations. Assert the final Rich records, refs, changes and verification. A scenario may call several domain services internally, but a successful high-frequency path must require no more than three external MCP calls.

**Step 2: Run and confirm failure**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-scenarios.test.ts
```

**Step 3: Implement thin orchestration**

Scenario modules should validate intent-specific input, call resource/domain services, and aggregate results. Do not copy parsing, validation or persistence rules out of existing services. For multi-write scenarios, support dry-run and return every planned/actual change.

**Step 4: Add partial-failure behavior**

When an atomic transaction is unavailable, return completed changes and warnings plus a follow-up task or recovery instruction. Never return `ok: true` without exposing an incomplete required step.

**Step 5: Verify and commit**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-scenarios.test.ts test/mcp-v2-write-tools.test.ts
pnpm --filter @ke/server typecheck
git add apps/server/src/mcp-v2/scenarios apps/server/src/mcp-v2/registerScenarioTools.ts apps/server/test/mcp-v2-scenarios.test.ts
git commit -m "feat(mcp): add scenario-first workflows"
```

## Task 9: Define delegation, review, and learning boundaries

**Files:**

- Create: `apps/server/src/mcp-v2/delegation/WorkDelegationPort.ts`
- Create: `apps/server/src/mcp-v2/delegation/UnavailableDelegationAdapter.ts`
- Create: `apps/server/src/mcp-v2/scenarios/delegateWork.ts`
- Create: `apps/server/src/mcp-v2/scenarios/reviewWorkResult.ts`
- Create: `apps/server/src/mcp-v2/scenarios/captureLearning.ts`
- Create: `apps/server/test/mcp-v2-delegation.test.ts`

**Step 1: Write failing port-contract tests**

Test successful delegation with a fake adapter, unavailable dependency, external status synchronization, failed delegation, review accept/reject, and learning records retaining source task refs.

```ts
it("does not create a fake delegated task when no executor is configured", async () => {
  const result = await invoke("rich_work_delegate", validRequest);
  expect(result).toMatchObject({
    ok: false,
    error: { code: "DEPENDENCY_UNAVAILABLE", retryable: true },
  });
  expect(await taskRepo.list()).toHaveLength(0);
});
```

**Step 2: Run and confirm failure**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-delegation.test.ts
```

**Step 3: Implement the stable port**

The port exposes `delegate`, `getStatus`, and `cancel`. The request includes task type, goal, structured context refs, acceptance criteria, suggested capabilities, and optional preferred backend. The result returns the backend, external ID, status, and artifact refs.

**Step 4: Register scenario tools**

- `rich_work_delegate`
- `rich_work_review_result`
- `rich_learning_capture`

The unavailable adapter must return `DEPENDENCY_UNAVAILABLE`. Do not implement `MulticaCliAdapter` in this plan; it is a separate integration once its CLI contract, authentication, and output format are selected.

**Step 5: Verify and commit**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-delegation.test.ts test/mcp-v2-tasks.test.ts
pnpm --filter @ke/server typecheck
git add apps/server/src/mcp-v2/delegation apps/server/src/mcp-v2/scenarios apps/server/test/mcp-v2-delegation.test.ts
git commit -m "feat(mcp): add agent delegation boundary"
```

## Task 10: Build the MCP 2.0 server and switch `/mcp`

**Files:**

- Create: `apps/server/src/mcp-v2/server.ts`
- Create: `apps/server/src/mcp-v2/transport.ts`
- Create: `apps/server/test/mcp-v2-transport.test.ts`
- Modify: `apps/server/src/index.ts`

**Step 1: Write failing transport tests**

Exercise MCP `initialize`, `tools/list`, and representative `tools/call` requests over the same Streamable HTTP transport used in production. Assert only `rich_` tools are listed and responses use the uniform envelope.

**Step 2: Run and confirm failure**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-transport.test.ts
```

**Step 3: Implement server assembly**

Construct all dependencies explicitly, register resource/scenario/task tools once, and adapt registry definitions to the MCP SDK. Keep transport stateless unless the SDK requires session state. Log unexpected exceptions server-side and return the redacted response boundary.

**Step 4: Switch the production mount atomically**

Change only the MCP import/assembly in `apps/server/src/index.ts`; preserve the `/mcp` URL and `.mcp-url` publication behavior. Do not alter unrelated server routes.

**Step 5: Run new and old HTTP regressions, then commit**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-transport.test.ts test/routes.test.ts
pnpm --filter @ke/server typecheck
git add apps/server/src/mcp-v2/server.ts apps/server/src/mcp-v2/transport.ts apps/server/test/mcp-v2-transport.test.ts apps/server/src/index.ts
git commit -m "feat(mcp): switch endpoint to v2 registry"
```

## Task 11: Generate the catalog and retrain Hermes instructions

**Files:**

- Create: `apps/server/scripts/generate-mcp-v2-docs.ts`
- Create: `apps/server/scripts/benchmark-mcp-tool-selection.ts`
- Create: `docs/RICH_MCP_V2_CATALOG.md`
- Modify: `ai/rich-system.md`
- Modify: `apps/server/src/mcp/README.md`
- Modify: `docs/RICH_CLI_COVERAGE.md`
- Modify: `docs/PROJECT_MANAGEMENT_MCP_MANUAL.md`
- Create: `apps/server/test/mcp-v2-catalog.test.ts`
- Create: `apps/server/test/mcp-v2-tool-selection.test.ts`

**Step 1: Write failing drift and deterministic selection tests**

The catalog test generates Markdown in memory and compares it byte-for-byte with the checked-in file. The selection test loads all 50 cases and runs a deterministic scene router/catalog matcher; it must report a confusion list when a case fails.

**Step 2: Run and confirm failure**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-catalog.test.ts test/mcp-v2-tool-selection.test.ts
```

**Step 3: Implement catalog generation**

Generate tool name, scenario, when-to-use, when-not-to-use, annotations, input summary, result summary, verification, and example from the registry. Add a package script such as `mcp:docs` rather than requiring a handwritten command.

**Step 4: Rewrite Hermes guidance by scenario**

Update `ai/rich-system.md` to teach this decision order:

1. read before writing when the target is uncertain;
2. prefer one scenario tool for a complete user outcome;
3. use a resource manage tool for explicit, precise resource changes;
4. use requestId, dry-run and confirmation correctly;
5. delegate only genuinely executable work;
6. track by Rich task ID, review results, then capture learning.

Remove stale legacy tool lists. Clearly separate MCP tools from Rich CLI commands in coverage documentation.

**Step 5: Add the optional live Hermes benchmark**

`benchmark-mcp-tool-selection.ts` should call Hermes only when `RICH_MCP_LIVE_BENCH=1`, write a JSON report outside source directories, and fail below 90%. It must never run as part of the default offline test suite.

**Step 6: Verify the hard metrics**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-catalog.test.ts test/mcp-v2-tool-selection.test.ts
pnpm --filter @ke/server exec tsx scripts/generate-mcp-v2-docs.ts --check
pnpm --filter @ke/server typecheck
```

Assert in tests:

```ts
expect(catalog.toolCount).toBeLessThanOrEqual(40);
expect(catalog.schemaBytes).toBeLessThanOrEqual(legacy.schemaBytes * 0.4);
```

**Step 7: Commit**

```bash
git add apps/server/scripts/generate-mcp-v2-docs.ts apps/server/scripts/benchmark-mcp-tool-selection.ts docs/RICH_MCP_V2_CATALOG.md ai/rich-system.md apps/server/src/mcp/README.md docs/RICH_CLI_COVERAGE.md docs/PROJECT_MANAGEMENT_MCP_MANUAL.md apps/server/test/mcp-v2-catalog.test.ts apps/server/test/mcp-v2-tool-selection.test.ts
git commit -m "docs(mcp): generate v2 catalog and Hermes guide"
```

## Task 12: Remove the legacy MCP and run the complete verification

**Files:**

- Delete: `apps/server/src/mcp/server.ts`
- Delete: `apps/server/src/mcp/tasks.ts`
- Delete or reduce after checking remaining imports: `apps/server/src/mcp/transport.ts`
- Delete: `apps/server/src/mcp/corpusTools.ts`
- Delete: `apps/server/src/mcp/projectManagementTools.ts`
- Delete: `apps/server/src/mcp/planTools.ts`
- Delete: `apps/server/src/mcp/practiceTools.ts`
- Delete: `apps/server/src/mcp/projectAutomationTools.ts`
- Modify or replace: `apps/server/test/mcp-elements.test.ts`
- Modify or replace: `apps/server/test/mcp-project-management.test.ts`
- Create: `apps/server/test/mcp-v2-regression.test.ts`

**Step 1: Find all remaining legacy references**

```bash
rg 'src/mcp/|from "\.\/mcp|from "\.\.\/src\/mcp|createMcpServer|projectManagementTools|planTools|practiceTools|projectAutomationTools' apps packages scripts docs ai
```

Classify every hit as production import, test, or historical documentation. Do not delete a file until all still-required domain logic has moved out of it or is reused from a non-MCP service.

**Step 2: Add a failing regression test before deletion**

Cover one representative outcome from every legacy domain and assert that no legacy tool name appears in the MCP 2.0 catalog.

**Step 3: Delete only obsolete MCP registration code**

If a legacy MCP file contains business logic used nowhere else, first move only that logic into the appropriate existing domain service/repository with its tests. Do not preserve legacy tool wrappers.

**Step 4: Run focused verification**

```bash
pnpm --filter @ke/server exec vitest run test/mcp-v2-*.test.ts test/plan-cli.test.ts test/routes.test.ts
pnpm --filter @ke/server typecheck
```

Expected: all pass; CLI behavior remains independent and unchanged.

**Step 5: Run repository-wide verification**

```bash
pnpm --filter @ke/server exec vitest run
pnpm --filter @ke/server typecheck
pnpm --filter @ke/web typecheck
pnpm --filter @ke/web build
git diff --check
```

Note the repository currently declares Node `>=22 <23`; run final verification on Node 22 even if exploratory work used a newer local Node version.

**Step 6: Manually smoke-test Rich**

Start Rich and verify:

1. existing web pages load and their HTTP workflows still work;
2. MCP `tools/list` exposes at most 40 `rich_` tools;
3. a read scenario succeeds;
4. a dry-run write makes no change;
5. a confirmed write returns verified changes;
6. an unconfigured delegation returns `DEPENDENCY_UNAVAILABLE`;
7. a persisted task remains queryable after server restart.

**Step 7: Commit the removal**

```bash
git add -A apps/server/src/mcp apps/server/src/mcp-v2 apps/server/test docs ai
git commit -m "refactor(mcp): remove legacy tool surface"
```

## Follow-up plan: Multica CLI adapter

Do not include this in MCP 2.0 acceptance. After MCP 2.0 is stable, create a separate plan that first pins the Multica CLI version and records its real command/output contract. That plan should implement `MulticaCliAdapter`, configure credentials and executable discovery, map Multica states to Rich states, validate command arguments without shell interpolation, reconcile task status, link to the Multica board, and add timeout/cancellation/integration tests.

The desired runtime flow is then:

```text
用户对话 → Hermes 选择 rich_work_delegate
         → Rich 创建持久化任务
         → MulticaCliAdapter 调用 Multica CLI
         → Multica 分配给 Codex/其他 Agent
         → Rich 按外部 ID 同步进度
         → Hermes 调用 review_result 验收
         → 结果与经验沉淀回 Rich
```
