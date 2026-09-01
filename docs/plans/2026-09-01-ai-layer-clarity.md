# AI Layer Clarity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce coupling in Rich's AI layer while preserving its HTTP/MCP contracts and current model routing behavior.

**Architecture:** Keep the existing modular monolith. Extract only concrete seams: generated-tree validation/persistence, knowledge AI routes, project/content AI routes, and the shared model execution path. Do not introduce a workflow engine, dependency-injection framework, or generic command bus.

**Tech Stack:** TypeScript, Hono, Zod, Vitest, SQLite/Postgres repositories, SSE.

---

## Success criteria

- `/api/ai/*`, `/api/chat/*`, and `/mcp` public contracts remain compatible.
- Tree output is rejected before any write when IDs/references/root/path membership are inconsistent or typed content is invalid.
- A generated tree is persisted atomically per storage implementation.
- `routes/ai.ts` no longer owns all AI domains; it becomes a composition point or thin router.
- Structured operations and chat share a single model invocation/failure policy where their transport semantics overlap.
- No new runtime dependency or architectural framework is added.

## Non-goals

- Changing prompt wording or product behavior.
- Redesigning MCP tools or Multica delegation.
- Automatic provider retry/fallback policy changes beyond making the existing policy explicit and shared.
- Migrating existing stored data.

### Task 1: Validate a generated tree before persistence

**Files:**
- Create: `apps/server/src/ai/knowledge/generatedTreeValidator.ts`
- Create: `apps/server/test/generatedTreeValidator.test.ts`
- Modify: `apps/server/src/ai/operations.ts`

**Step 1: Write failing tests**

Cover duplicate element IDs, a missing `rootId`, a relation whose endpoint is absent, a path whose center/step is absent, and invalid typed element content. Keep one valid minimal tree fixture.

**Step 2: Run the focused test**

Run: `pnpm --filter @ke/server exec vitest run test/generatedTreeValidator.test.ts`

Expected: FAIL because the validator module does not exist.

**Step 3: Add minimal validator**

Validate the existing Zod result first, then enforce graph invariants and `parseElementStrict` for every element. Return the same generated-tree result shape; do not transform product content.

**Step 4: Wire it into `generateTreeFor`**

Replace its generic result validation only. Keep prompt construction, streams, and error envelope unchanged.

**Step 5: Run focused tests and typecheck**

Run the focused test and `pnpm --filter @ke/server typecheck`.

### Task 2: Make generated-tree persistence one explicit service

**Files:**
- Create: `apps/server/src/ai/knowledge/generatedTreeWriter.ts`
- Create: `apps/server/test/generatedTreeWriter.test.ts`
- Modify: repository interfaces/SQLite and Postgres implementations only as required for a transaction-capable tree write
- Modify: `apps/server/src/routes/ai.ts`

**Step 1: Write failing tests**

Assert that a failed tree write leaves no newly-created elements, relations, or paths; assert valid writes persist the complete tree.

**Step 2: Add the smallest transaction boundary**

Expose a dedicated generated-tree write operation rather than leaking database handles into the route. Implement it transactionally for SQLite and Postgres.

**Step 3: Replace the route's three write loops**

The route calls one writer on the `done` event, then schedules images only after persistence succeeds.

**Step 4: Run focused tests and typecheck**

### Task 3: Split AI HTTP routes by business domain

**Files:**
- Create: `apps/server/src/routes/ai/knowledgeRoutes.ts`
- Create: `apps/server/src/routes/ai/projectRoutes.ts`
- Create: `apps/server/src/routes/ai/contentRoutes.ts`
- Modify: `apps/server/src/routes/ai.ts`
- Modify: relevant focused route tests only

**Step 1: Move knowledge endpoints intact**

Move analyze-input, generate-tree, refine, feedback, section-feedback, expand, extend, path, ask, analyze-mark, and review behind a `knowledgeRoutes(deps)` factory. Extract shared helpers along with the domain that owns them.

**Step 2: Move project and content endpoints intact**

Move GreatMe, decomposition/progress/review/PRD/guided-practice endpoints, then daily-news/image endpoints. Do not rename URLs or alter request/response structures.

**Step 3: Reduce `ai.ts` to composition**

It should only define common dependencies and mount subrouters. Delete imports made obsolete by each move.

**Step 4: Run focused route tests and typecheck after each extraction**

### Task 4: Split operation definitions by domain

**Files:**
- Create: `apps/server/src/ai/knowledge/operations.ts`
- Create: `apps/server/src/ai/project/operations.ts`
- Create: `apps/server/src/ai/content/operations.ts`
- Modify: `apps/server/src/ai/operations.ts` or replace it with compatibility re-exports
- Modify: imports in routes and tests

**Step 1: Preserve exported signatures**

Move the existing operation plus its result schema with its domain. Keep only shared structured-operation helpers in the common module.

**Step 2: Run tests after each domain move**

No prompt is rewritten as part of this task.

### Task 5: Normalize model invocation policy

**Files:**
- Create: `apps/server/src/ai/modelExecution.ts`
- Create: `apps/server/test/modelExecution.test.ts`
- Modify: `apps/server/src/routes/chat.ts`
- Modify: structured-operation callers only where behavior is already duplicated

**Step 1: Write failing tests**

Cover explicit model selection, unavailable-model error normalization, abort timeout propagation, and the existing Codex fallback decision.

**Step 2: Extract shared policy**

The module owns selection, availability checks, timeout/abort composition and normalized errors. It does not erase the distinction between chat's message transport and structured prompt transport.

**Step 3: Replace direct duplicated selection/fallback code**

Keep the current user-visible behavior; do not silently add fallback to every operation.

**Step 4: Run complete server verification**

Run server tests, typecheck, and record any native SQLite ABI prerequisite separately from code failures.

## Execution order

Tasks 1 and 2 are the first safe slice: they improve correctness and create an ownership boundary without moving product behavior. Tasks 3–5 follow only after that slice is green.
