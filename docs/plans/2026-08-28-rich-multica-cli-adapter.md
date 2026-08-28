# Rich Multica CLI Adapter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a production Multica CLI integration that lets Hermes plan and apply reusable execution teams, delegate Rich work to Multica Squads, and track/cancel the resulting Issues.

**Architecture:** Keep every Multica-specific contract under `apps/server/src/mcp-v2/delegation/multica/`. Expose platform-neutral scenario tools, persist exact external UUID mappings, implement the existing delegation port with Multica Issue IDs, and wire the adapter only at the server composition root.

**Tech Stack:** TypeScript, Node.js `child_process.spawn`, Zod, SQLite, PostgreSQL, MCP SDK, Vitest, pnpm.

---

### Task 1: Multica CLI discovery and safe process runner

**Files:**
- Create: `apps/server/src/mcp-v2/delegation/multica/config.ts`
- Create: `apps/server/src/mcp-v2/delegation/multica/MulticaExecutableDiscovery.ts`
- Create: `apps/server/src/mcp-v2/delegation/multica/MulticaCommandRunner.ts`
- Test: `apps/server/test/multica-command-runner.test.ts`

**Step 1: Write failing discovery tests**

Cover precedence for `RICH_MULTICA_CLI_PATH`, PATH lookup, Desktop bundle fallback, missing CLI, version `0.4.35`, and rejection of `0.5.0`.

**Step 2: Run the test and verify RED**

Run: `pnpm --filter @ke/server test -- multica-command-runner.test.ts`

Expected: FAIL because discovery and runner modules do not exist.

**Step 3: Implement minimum discovery/configuration**

Return a configuration containing executable, profile, optional workspace ID, timeout, and maximum output bytes. Support `>=0.4.35 <0.5.0`. Do not inspect or expose tokens.

**Step 4: Write failing runner behavior tests**

Use a temporary executable fixture to prove argument-array execution, `shell: false`, stdin forwarding, JSON parsing, timeout, non-zero exit handling, and output-size rejection.

**Step 5: Implement the runner**

Expose `runJson(args, { stdin, includeWorkspace })`; inject global profile/workspace flags; redact error messages; discover the sole workspace using `workspace list --output json` when no workspace ID is configured.

**Step 6: Verify GREEN and commit**

Run: `pnpm --filter @ke/server test -- multica-command-runner.test.ts`

Expected: PASS.

Commit: `feat(multica): add safe CLI command runner`

### Task 2: CLI contracts and task-state aggregation

**Files:**
- Create: `apps/server/src/mcp-v2/delegation/multica/types.ts`
- Create: `apps/server/src/mcp-v2/delegation/multica/MulticaStateMapper.ts`
- Create: `apps/server/test/fixtures/multica/projects.json`
- Create: `apps/server/test/fixtures/multica/agents.json`
- Create: `apps/server/test/fixtures/multica/runtimes.json`
- Create: `apps/server/test/fixtures/multica/issue.json`
- Create: `apps/server/test/fixtures/multica/runs.json`
- Test: `apps/server/test/multica-state-mapper.test.ts`

**Step 1: Write failing schema tests**

Parse snake_case JSON fixtures captured from CLI v0.4.35 for projects, agents, runtimes, issues, squads and runs. Reject records without an ID and required display field.

**Step 2: Verify RED**

Run: `pnpm --filter @ke/server test -- multica-state-mapper.test.ts`

Expected: FAIL because schemas and mapper do not exist.

**Step 3: Implement Zod schemas and normalized types**

Keep raw CLI fields inside this module. Normalize only fields used by planning, delegation and status summaries.

**Step 4: Add failing aggregation tests**

Cover queued, dispatched, waiting for directory, one active member run, issue review, completed, retry after failed run, final failure, and cancellation.

**Step 5: Implement minimal aggregation**

Use Issue state as terminal authority and active Runs as progress authority. Return `McpTaskStatus` plus a concise count-based summary.

**Step 6: Verify and commit**

Run: `pnpm --filter @ke/server test -- multica-state-mapper.test.ts`

Expected: PASS.

Commit: `feat(multica): normalize CLI resources and task states`

### Task 3: Persistent bindings and confirmed team plans

**Files:**
- Create: `apps/server/src/mcp-v2/delegation/multica/MulticaBindingRepo.ts`
- Create: `apps/server/src/mcp-v2/delegation/multica/SqliteMulticaBindingRepo.ts`
- Create: `apps/server/src/mcp-v2/delegation/multica/PostgresMulticaBindingRepo.ts`
- Modify: `apps/server/src/db/sqlite.ts`
- Modify: `apps/server/src/db/postgres.ts`
- Test: `apps/server/test/multica-binding-repo.test.ts`

**Step 1: Write failing SQLite persistence tests**

Verify binding save/get across reopen, plan create/get, pending-to-applied transition, and immutable plan request/changes.

**Step 2: Verify RED**

Run: `pnpm --filter @ke/server test -- multica-binding-repo.test.ts`

Expected: FAIL because tables and repositories do not exist.

**Step 3: Add minimal tables**

Add `multica_project_bindings` with `rich_project_id`, `binding_json`, timestamps; add `multica_team_plans` with `id`, `rich_project_id`, `request_json`, `plan_json`, status and timestamps. Mirror schemas in PostgreSQL.

**Step 4: Implement repository contract**

Methods: `getBinding`, `saveBinding`, `createPlan`, `getPlan`, `markPlanApplied`. Store the complete typed binding/plan as JSON while keeping Rich project ID indexed.

**Step 5: Verify and commit**

Run: `pnpm --filter @ke/server test -- multica-binding-repo.test.ts`

Expected: PASS.

Commit: `feat(multica): persist project bindings and team plans`

### Task 4: Team planning and confirmed apply service

**Files:**
- Create: `apps/server/src/mcp-v2/delegation/multica/MulticaAdministrationService.ts`
- Test: `apps/server/test/multica-administration.test.ts`

**Step 1: Write failing planning tests**

Use an in-memory fake command runner and binding repo. Verify exact bound UUID reuse, exact-title Project reuse, preferred existing Agent reuse, capability/name candidate scoring, missing dedicated Leader creation, missing Squad creation, and no destructive changes.

**Step 2: Verify RED**

Run: `pnpm --filter @ke/server test -- multica-administration.test.ts`

Expected: FAIL because the service does not exist.

**Step 3: Implement `planTeam`**

Read Project, Agent, Runtime and Squad inventories. Build a stable plan containing `reuse` or `create` operations. Resolve new Agent runtime by requested provider and online status. Persist the plan and return `planId` plus a human-readable summary.

**Step 4: Write failing apply tests**

Verify dependency order: Project -> Leader -> member Agents -> Squad -> squad members -> binding. Verify already-applied plans are idempotent and partial external success is reconciled by re-querying before create.

**Step 5: Implement `applyPlan`**

Reject missing or already-invalid plans, execute only operations recorded in the confirmed plan, read each resource back, update resolved UUIDs, save binding, and mark the plan applied.

**Step 6: Verify and commit**

Run: `pnpm --filter @ke/server test -- multica-administration.test.ts`

Expected: PASS.

Commit: `feat(multica): plan and apply reusable execution teams`

### Task 5: Platform-neutral MCP team tools

**Files:**
- Create: `apps/server/src/mcp-v2/scenarios/manageExecutionTeam.ts`
- Modify: `apps/server/src/mcp-v2/scenarios/registerScenarioTools.ts`
- Modify: `apps/server/src/mcp-v2/server.ts`
- Modify: `apps/server/src/mcp-v2/catalogDocumentation.ts`
- Test: `apps/server/test/mcp-v2-multica-team.test.ts`
- Modify: `apps/server/test/fixtures/mcp-v2/tool-selection-cases.json`

**Step 1: Write failing registry tests**

Specify `rich_execution_team_plan` inputs (`projectId`, `projectName`, goal, required capability specs) and `rich_execution_team_apply` input (`planId`, context/request ID). Verify stable Rich response envelopes and no Multica CLI details in public schemas.

**Step 2: Verify RED**

Run: `pnpm --filter @ke/server test -- mcp-v2-multica-team.test.ts`

Expected: FAIL because tools are not registered.

**Step 3: Register the two tools**

Plan is externally read-only but persists a local proposal. Apply uses MCP idempotency and returns project/squad/agent Rich refs plus read-back verification.

**Step 4: Add selection corpus cases**

Add Chinese prompts for preparing a team, reusing an Agent, creating a Squad after confirmation, and distinguishing team preparation from actual delegation.

**Step 5: Verify and commit**

Run: `pnpm --filter @ke/server test -- mcp-v2-multica-team.test.ts mcp-v2-tool-selection.test.ts`

Expected: PASS.

Commit: `feat(mcp): expose execution-team planning scenarios`

### Task 6: Squad delegation adapter

**Files:**
- Modify: `apps/server/src/mcp-v2/delegation/WorkDelegationPort.ts`
- Create: `apps/server/src/mcp-v2/delegation/multica/MulticaCliAdapter.ts`
- Modify: `apps/server/src/mcp-v2/scenarios/delegateWork.ts`
- Modify: `apps/server/test/mcp-v2-delegation.test.ts`
- Test: `apps/server/test/multica-cli-adapter.test.ts`

**Step 1: Write failing adapter tests**

Verify Issue creation uses `--project`, `--assignee-id`, `--description-stdin`, and stores Issue ID as `externalTaskId`. Verify `getStatus` reads issue+runs and `cancel` cancels every active task ID.

**Step 2: Verify RED**

Run: `pnpm --filter @ke/server test -- multica-cli-adapter.test.ts`

Expected: FAIL because the adapter does not exist.

**Step 3: Extend the delegation request**

Replace `preferredAgent` with explicit `projectId`, `goal`, `acceptanceCriteria`, `requiredCapabilities`, working directory and context refs. Keep the port backend-neutral.

**Step 4: Implement the adapter**

Resolve the saved binding, require a default Squad, construct a structured Issue description, create the Issue and aggregate statuses. Cancel all non-terminal Runs for that Issue.

**Step 5: Update `rich_work_delegate`**

Expose the Squad-mode input schema and preserve create-after-external-success semantics for the local Rich task.

**Step 6: Verify and commit**

Run: `pnpm --filter @ke/server test -- multica-cli-adapter.test.ts mcp-v2-delegation.test.ts mcp-v2-tasks.test.ts`

Expected: PASS.

Commit: `feat(multica): delegate Rich work to Multica squads`

### Task 7: Production composition and graceful availability

**Files:**
- Create: `apps/server/src/mcp-v2/delegation/multica/createMulticaIntegration.ts`
- Modify: `apps/server/src/index.ts`
- Modify: `apps/server/src/mcp-v2/server.ts`
- Test: `apps/server/test/multica-integration.test.ts`

**Step 1: Write failing composition tests**

Verify available CLI builds administration+delegation services, missing CLI leaves Rich running with `DEPENDENCY_UNAVAILABLE`, and no external command runs during registry construction.

**Step 2: Verify RED**

Run: `pnpm --filter @ke/server test -- multica-integration.test.ts`

Expected: FAIL because composition factory does not exist.

**Step 3: Implement lazy integration factory**

Construct backend-specific binding repo at the storage composition root. Discover and validate CLI lazily on first Multica call. Inject the same services into team tools and delegation tools.

**Step 4: Add active-task synchronization**

Add a bounded background interval that refreshes non-terminal Multica tasks, prevents overlapping syncs, and exposes a stop hook used during server shutdown. Keep on-demand task refresh authoritative.

**Step 5: Verify and commit**

Run: `pnpm --filter @ke/server test -- multica-integration.test.ts`

Expected: PASS.

Commit: `feat(multica): wire CLI integration into Rich server`

### Task 8: Hermes guidance, generated catalog, full verification and desktop publish

**Files:**
- Modify: `ai/rich-system.md`
- Regenerate: `docs/RICH_MCP_V2_CATALOG.md`
- Modify: `docs/plans/2026-08-28-rich-multica-cli-adapter-design.md` only if implementation evidence changes a documented contract

**Step 1: Update Hermes workflow guidance**

Teach: direct answers stay in chat; actionable multi-turn work uses team plan/apply/delegate; user confirmation is required before creating/reconfiguring Agent/Squad; Squad chooses the executor; Rich reviews and captures learning.

**Step 2: Regenerate MCP catalog**

Run: `pnpm --filter @ke/server mcp:docs`

Expected: catalog contains the two execution-team tools and revised Squad delegation schema.

**Step 3: Run focused and full verification**

Run:

```bash
pnpm --filter @ke/server test
pnpm --filter @ke/server typecheck
pnpm --filter @ke/web typecheck
pnpm --filter @ke/web build
```

Expected: all commands pass; live Multica tests remain skipped unless explicitly enabled.

**Step 4: Rebuild and republish Rich Desktop**

Inspect the repository's existing desktop packaging scripts, build the current branch, replace the installed Rich.app using the established recoverable workflow, restart it, and verify `/mcp` starts without modifying Multica resources.

**Step 5: Review diff and commit**

Run: `git status --short`, `git diff --check`, and review every changed file against the module boundary.

Commit: `docs: teach Hermes the Multica squad workflow`
