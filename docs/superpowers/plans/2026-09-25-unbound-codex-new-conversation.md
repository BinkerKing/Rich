# Unbound Codex New Conversation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Codex workbench's `+ 新对话` action create a general, unbound Session even when the workbench was opened from a mindmap.

**Architecture:** Add a general-session creation route in the deliverable-Codex server route. It uses the existing conversation repository but writes `isBound: false`, so it has no resource scope binding. Change the workbench's create action to call that route instead of the active resource path; opening a resource's existing bound Session remains unchanged.

**Tech Stack:** Hono, TypeScript, Vitest, React.

---

### Task 1: Prove a general Session is unbound

**Files:**
- Modify: `apps/server/test/deliverable-codex-routes.test.ts`
- Modify: `apps/server/src/routes/deliverableCodex.ts`

- [ ] **Step 1: Write the failing route test**

Add a test that sends `POST /conversations` with `{ title: "新会话" }`, captures the repository `create` payload, and asserts the response is `201`, its context is the general context, and the persisted record contains:

```ts
expect(created).toMatchObject({
  projectId: "__general__",
  deliverableId: "__general__",
  isBound: false,
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm --filter @ke/server test -- deliverable-codex-routes.test.ts`

Expected: FAIL because `POST /conversations` has no route.

- [ ] **Step 3: Implement the general creation route**

Add a route before parameterized conversation routes. Validate a non-empty title, create the regular Chat conversation and delivery-Codex repository record with `projectId` and `deliverableId` both `__general__`, `isBound: false`, start the Codex agent, and return the general context. Keep `createBoundConversation` unchanged for resource entry points.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `pnpm --filter @ke/server test -- deliverable-codex-routes.test.ts`

Expected: PASS.

### Task 2: Send the workbench's New Conversation action to the general route

**Files:**
- Modify: `apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.tsx`
- Create: `apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.newConversation.test.ts`

- [ ] **Step 1: Write the failing frontend regression test**

Read the workbench source and assert its `create` method uses the general conversation API path:

```ts
assert.match(source, /readJson<\{ conversation: Conversation \}>\(conversationApiPath, \{ method: "POST"/);
assert.doesNotMatch(source, /readJson<\{ conversation: Conversation \}>\(currentResourcePath, \{ method: "POST"/);
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm --filter @ke/web test -- DeliverableCodexWorkbench.newConversation.test.ts`

Expected: FAIL because the create action currently posts to `currentResourcePath`.

- [ ] **Step 3: Implement the minimal frontend change**

In `create`, replace the `readJson` target from `currentResourcePath` to `conversationApiPath`. This path is `/api/deliverable-codex/conversations` for the workbench's non-dictionary UI, so it creates a general Session without the active mindmap context.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `pnpm --filter @ke/web test -- DeliverableCodexWorkbench.newConversation.test.ts`

Expected: PASS.

### Task 3: Verify and commit

**Files:**
- Modify: `apps/server/src/routes/deliverableCodex.ts`
- Modify: `apps/server/test/deliverable-codex-routes.test.ts`
- Modify: `apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.tsx`
- Create: `apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.newConversation.test.ts`

- [ ] **Step 1: Run focused regression tests**

Run:

```bash
pnpm --filter @ke/server test -- deliverable-codex-routes.test.ts
pnpm --filter @ke/web test -- DeliverableCodexWorkbench.newConversation.test.ts
```

Expected: both commands exit 0.

- [ ] **Step 2: Run package typechecks**

Run:

```bash
pnpm --filter @ke/server typecheck
pnpm --filter @ke/web typecheck
```

Expected: both commands exit 0.

- [ ] **Step 3: Commit only the files for this change**

Run:

```bash
git add apps/server/src/routes/deliverableCodex.ts apps/server/test/deliverable-codex-routes.test.ts apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.tsx apps/web/src/views/project-management/deliverables/DeliverableCodexWorkbench.newConversation.test.ts docs/superpowers/plans/2026-09-25-unbound-codex-new-conversation.md
git commit -m "fix: create unbound Codex sessions"
```
