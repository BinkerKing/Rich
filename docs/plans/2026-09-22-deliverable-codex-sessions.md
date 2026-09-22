# Deliverable Codex Sessions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bind every deliverable to one active Codex Session, support question-and-answer records, and send each session only the new delivery context after its initial baseline.

**Architecture:** Extend persisted Codex conversation rows with a binding flag and a context cursor. Add a server-side “ensure bound session” operation that creates a fresh Session and baseline when no usable binding exists. Treat `question` and `answer` as first-class deliverable record kinds, with answers grouped below their parent question.

**Tech Stack:** TypeScript, React, Hono, SQLite/Postgres repositories, Vitest.

---

### Task 1: Persist the current binding and sync cursor

**Files:**
- Modify: `apps/server/src/db/sqlite.ts`
- Modify: `apps/server/src/db/postgres.ts`
- Modify: `apps/server/src/repos/DeliverableCodexConversationRepo.ts`
- Modify: `apps/server/src/repos/SqliteDeliverableCodexConversationRepo.ts`
- Modify: `apps/server/src/repos/PostgresDeliverableCodexConversationRepo.ts`
- Test: `apps/server/test/deliverable-codex-conversation-repo.test.ts`

**Step 1:** Add failing repository tests proving one active bound conversation per scope, unbinding on replacement, and a persisted `lastContextSyncAt` cursor.

**Step 2:** Run `pnpm --filter @ke/server test -- deliverable-codex-conversation-repo.test.ts`; verify the new tests fail.

**Step 3:** Add backward-compatible SQLite and Postgres columns/indexes, hydrate them in both repositories, and add `getBound`, `bind`, and `markContextSynced` repository methods.

**Step 4:** Re-run the targeted test; verify it passes.

### Task 2: Add automatic bound-Session lifecycle APIs

**Files:**
- Modify: `apps/server/src/routes/deliverableCodex.ts`
- Modify: `apps/server/src/deliverable-codex/DeliverableCodexContextService.ts`
- Test: `apps/server/test/deliverable-codex-routes.test.ts`

**Step 1:** Add failing route tests for initial creation/binding, a fresh baseline after an archived binding, and archiving the bound Session when a deliverable is accepted.

**Step 2:** Run `pnpm --filter @ke/server test -- deliverable-codex-routes.test.ts`; verify failure.

**Step 3:** Implement an idempotent ensure-bound endpoint. It must reuse an active binding, otherwise create/bind a new conversation and return whether a baseline is required. Add an archive-bound endpoint used when the deliverable reaches `accepted`.

**Step 4:** Build an initial baseline in the context service, and an incremental-context builder that selects delivery changes after the saved cursor.

**Step 5:** Run the route tests again; verify all pass.

### Task 3: Model question and answer records

**Files:**
- Modify: `apps/web/src/views/project-management/deliverables/DeliverablesModel.ts`
- Modify: `apps/server/src/mcp-v2/tasks/deliverableWorkspaceTools.ts`
- Modify: `apps/server/src/deliverable-codex/DeliverableCodexContextService.ts`
- Test: `apps/web/src/views/project-management/deliverables/DeliverablesModel.test.ts`
- Test: `apps/server/test/mcp-v2-deliverable-task-tools.test.ts`

**Step 1:** Add failing tests for normalizing `question`/`answer`, retaining `parentRecordId` for answers, and displaying answers directly below their parent question.

**Step 2:** Run the model and MCP tests; verify failures.

**Step 3:** Add `question`/`answer` record kinds, parent validation, ordering, and Codex-tool support. Update the Codex instruction to write unresolved clarifications as a `question` record.

**Step 4:** Run the targeted tests; verify they pass.

### Task 4: Connect record workflows and the Codex viewer

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.tsx`
- Modify: `apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.tsx`
- Modify: `apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.css`
- Test: `apps/web/src/views/project-management/deliverables/DeliverablesWorkspace.test.ts`

**Step 1:** Add failing UI/source tests covering automatic Session creation at deliverable creation, dispatching `Codex`-tagged records to the ensured bound Session, and answer editor placement below question records.

**Step 2:** Run the targeted web tests; verify failure.

**Step 3:** Call ensure-bound immediately after creating a deliverable. Before sending a Codex-tagged task, ensure its Session and send either the initial baseline or the computed delta. Add a reply control below each question and disable completion only after save succeeds.

**Step 4:** Make the Codex viewer load/select the bound Session rather than an arbitrary active Session. When the deliverable enters `accepted`, archive the binding through the new API.

**Step 5:** Run the targeted tests; verify they pass.

### Task 5: Full verification

**Files:**
- Verify: `apps/server/test/deliverable-codex-*.test.ts`
- Verify: `apps/web/src/views/project-management/deliverables/*.test.ts`

**Step 1:** Run `pnpm --filter @ke/server typecheck` and all focused server tests.

**Step 2:** Run `pnpm --filter @ke/web test -- DeliverablesModel.test.ts DeliverablesWorkspace.test.ts` (or the repository’s equivalent focused Vitest command).

**Step 3:** Build the desktop package and manually verify: create a delivery, publish from `Codex` record, receive a `问题`, answer below it, archive the session, and send another task to observe a new bound Session baseline.
