# External Desktop Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Codex start a detached local deployment job with `pnpm run deploy` that rebuilds, replaces, and relaunches Rich without depending on the Rich process that will exit.

**Architecture:** `pnpm run deploy` starts a detached Node worker and immediately prints a job id and log path. The worker packages the Electron app, quits Rich only after a successful package, atomically promotes a staged app bundle into `/Applications/Rich.app`, and relaunches it. Conversation continuity remains the responsibility of the existing persisted Codex thread id and database.

**Tech Stack:** Node.js 22, node:test, pnpm, Electron Builder, macOS `osascript`, `ditto`, and `open`.

---

### Task 1: Define the detached job contract

**Files:**
- Create: `scripts/rich-deploy.test.mjs`
- Create: `scripts/rich-deploy.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createDeploymentJob } from "./rich-deploy.mjs";

test("creates an isolated job with a stable log path", () => {
  const job = createDeploymentJob({ now: () => new Date("2026-09-13T12:34:56.789Z"), tempDir: "/tmp" });
  assert.match(job.id, /^rich-deploy-20260913T123456789Z-[a-z0-9]+$/);
  assert.equal(job.logPath, `/tmp/${job.id}.log`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/rich-deploy.test.mjs`

Expected: FAIL because `scripts/rich-deploy.mjs` does not exist.

- [ ] **Step 3: Write minimal implementation**

Export `createDeploymentJob`, dispatch `--worker` runs to a detached process with ignored stdio, and add `deploy` and `test:deploy` root scripts.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:deploy`

Expected: PASS with one test.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/rich-deploy.mjs scripts/rich-deploy.test.mjs
git commit -m "feat: add detached Rich deployment command"
```

### Task 2: Execute deployment safely after Rich exits

**Files:**
- Modify: `scripts/rich-deploy.test.mjs`
- Modify: `scripts/rich-deploy.mjs`

- [ ] **Step 1: Write the failing test**

```js
test("runs package, installation, and relaunch in order", async () => {
  const commands = [];
  await runDeployment({ run: async (command, args) => commands.push([command, args]) });
  assert.deepEqual(commands.map(([command]) => command), ["pnpm", "osascript", "ditto", "rm", "mv", "open"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:deploy`

Expected: FAIL because `runDeployment` is not exported.

- [ ] **Step 3: Write minimal implementation**

Implement the ordered worker steps: package, quit Rich, stage the built app at the exact sibling target, remove only the exact installed bundle, promote the staged bundle, and launch it. Each command failure aborts the remainder and is recorded in the job log.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:deploy`

Expected: PASS with two tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/rich-deploy.mjs scripts/rich-deploy.test.mjs
git commit -m "feat: deploy Rich outside its app process"
```

### Task 3: Verify the command interface

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document Codex invocation**

Add `pnpm deploy` with its detached semantics and log inspection path to the scripts table.

- [ ] **Step 2: Verify quality gates**

Run: `pnpm test:deploy && pnpm typecheck && pnpm --filter @ke/desktop package`

Expected: test and typecheck exit 0; the packaged bundle exists at `apps/desktop/release/mac-arm64/Rich.app`.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/superpowers/plans/2026-09-13-external-desktop-deployment.md
git commit -m "docs: document detached Rich deployment"
```
