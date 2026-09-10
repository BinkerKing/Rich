# Test Center Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a case-centric test center to Rich, with table-plus-inline-expansion workspaces for test cases, executions, and issues, and MCP/CLI parity.

**Architecture:** Introduce normalized test-center tables beside the current project-management schema. Extend the existing project-management repository, Hono routes, web API client, and project workspace navigation. UI state stays local to the Test Center page; all persistent state is owned by a service/repository so REST, MCP, and CLI share status rules.

**Tech Stack:** TypeScript, Hono, SQLite/PostgreSQL, React/Vite, Node test runner, existing Rich MCP v2 registry and CLI.

---

### Task 1: Define the case-centric domain contract

**Files:**
- Modify: `apps/server/src/repos/ProjectManagementRepo.ts`
- Test: `apps/server/test/testCenterContracts.test.ts`

**Step 1:** Write failing tests for allowed case/run/issue statuses and for a run retaining its immutable historical result after the case is retested.

**Step 2:** Run `pnpm --filter @ke/server test -- test/testCenterContracts.test.ts`; verify the contract is absent.

**Step 3:** Add only the shared TypeScript types, input types, and status unions: task, suite, case, step, run, run-step, evidence, issue, discussion, and report summary.

**Step 4:** Re-run the focused test and make it pass.

### Task 2: Add durable SQLite and PostgreSQL storage

**Files:**
- Modify: `apps/server/src/db/projectManagementSchema.ts`
- Modify: `apps/server/src/repos/SqliteProjectManagementRepo.ts`
- Modify: `apps/server/src/repos/PostgresProjectManagementRepo.ts`
- Modify: `apps/server/src/repos/EmptyProjectManagementRepo.ts`
- Test: `apps/server/test/testCenterRepository.test.ts`

**Step 1:** Write failing repository tests for creating a case, appending a run, attaching evidence, creating an issue from a failed run, and creating a later retest without replacing the original run.

**Step 2:** Run the focused test and observe its failure.

**Step 3:** Add normalized schema tables and indexes in both database dialects. Store attachments as metadata/path references; never store a credential or database connection string in evidence.

**Step 4:** Implement minimal repository methods in SQLite, PostgreSQL, and Empty repositories; add project-id predicates to every read/write.

**Step 5:** Re-run the focused test until green.

### Task 3: Expose validated Test Center HTTP APIs

**Files:**
- Modify: `apps/server/src/routes/projectManagement.ts`
- Modify: `apps/web/src/api/client.ts`
- Test: `apps/server/test/testCenterRoutes.test.ts`

**Step 1:** Write failing route tests for list filters, case creation, run submission, evidence attachment metadata, issue creation/linking, and invalid status transitions.

**Step 2:** Implement REST endpoints under `/api/project-management/:projectId/testing`; validate request shapes and reject cross-project references.

**Step 3:** Expose typed API-client methods that map exactly to those endpoint contracts.

**Step 4:** Re-run focused server tests.

### Task 4: Add menu navigation and the case table workspace

**Files:**
- Modify: `apps/server/src/repos/ProjectManagementRepo.ts`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/views/project-management/ProjectManagementNavigation.tsx`
- Modify: `apps/web/src/views/ProjectWorkspace.tsx`
- Create: `apps/web/src/views/project-management/testing/TestCenterWorkspace.tsx`
- Create: `apps/web/src/views/project-management/testing/TestCenterWorkspace.css`
- Test: `apps/web/src/views/project-management/testing/TestCenterWorkspace.test.tsx`

**Step 1:** Write a failing UI test asserting that the Test Center navigation entry opens a case table with all scan-level columns visible without opening a row.

**Step 2:** Implement the minimal table/filter state and a single inline expansion row. The collapsed row shows identifier, goal, type, priority, linked object, step count, latest status, issue, and update timestamp.

**Step 3:** Use the inline row to show only case design details, not a duplicate page.

**Step 4:** Run focused web tests.

### Task 5: Add the execution matrix and evidence flow

**Files:**
- Modify: `apps/web/src/views/project-management/testing/TestCenterWorkspace.tsx`
- Modify: `apps/web/src/views/project-management/testing/TestCenterWorkspace.css`
- Test: `apps/web/src/views/project-management/testing/TestCenterWorkspace.test.tsx`
- Test: `apps/server/test/testCenterRoutes.test.ts`

**Step 1:** Write a failing UI test for collapsed execution rows and a failed run’s inline detail showing step progress, result, evidence count, linked issue, and last-executed time.

**Step 2:** Implement run creation and result updates through the typed API client. Do not mutate an older run when starting a retest.

**Step 3:** Reuse the existing attachment upload infrastructure for evidence metadata, with a test proving the evidence is returned for the associated run.

**Step 4:** Run the focused server and web tests.

### Task 6: Add the issue table, discussion trail, and retest loop

**Files:**
- Modify: `apps/web/src/views/project-management/testing/TestCenterWorkspace.tsx`
- Test: `apps/web/src/views/project-management/testing/TestCenterWorkspace.test.tsx`
- Test: `apps/server/test/testCenterRepository.test.ts`

**Step 1:** Write failing tests for issues originating from failed/blocked runs, external reference links, discussion entries, and a retest action that points back to the original case.

**Step 2:** Implement the issue table’s collapsed columns and inline details. Keep external links as references only; do not call third-party issue trackers in this feature.

**Step 3:** Implement the “create retest” action as a new run of the source case.

**Step 4:** Run focused tests.

### Task 7: Generate report summaries and add MCP/CLI parity

**Files:**
- Modify: `apps/server/src/mcp-v2/registerResourceTools.ts`
- Create: `apps/server/src/mcp-v2/resources/testCenterTools.ts`
- Modify: `scripts/rich-cli.mjs`
- Test: `apps/server/test/testCenterMcp.test.ts`
- Test: `apps/server/test/testCenterReport.test.ts`

**Step 1:** Write failing tests for report totals being calculated from runs, not an independently editable report status.

**Step 2:** Implement summary/report queries for a task or suite.

**Step 3:** Add MCP tools and matching CLI commands for listing/creating/updating cases, appending runs, recording evidence, linking issues, creating retests, and generating reports. Require project ID and validate all IDs belong to it.

**Step 4:** Run focused tests.

### Task 8: End-to-end verification and documentation

**Files:**
- Create: `docs/TEST_CENTER.md`
- Modify: `apps/server/test/project-management-search.test.ts` (only if adding Test Center search records)

**Step 1:** Add one end-to-end repository/route scenario: case → failed run → evidence → issue → fix → retest → report.

**Step 2:** Run `pnpm --filter @ke/server test`, `pnpm --filter @ke/web typecheck`, and the relevant web test command.

**Step 3:** Document the personal workflow and MCP/CLI examples. State explicitly that external Codex generates or records test content through tools; it does not control the UI.

**Step 4:** Review the diff, preserve unrelated user changes, and record final verification evidence in the task workbench.
