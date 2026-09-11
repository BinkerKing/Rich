# App Launcher Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Rich app launcher a compact dark desktop with movable application icons and drag-created folders.

**Architecture:** Replace the launcher’s flat persisted order with a localStorage layout containing ordered app entries and ordered folder entries. Render each entry as a desktop icon; dragging onto an application creates a folder, dragging into an open folder adds it, and dragging out of an open folder removes it. Keep the existing `AppView` routing and task-list reset behavior unchanged.

**Tech Stack:** React 18, TypeScript, CSS Grid, native HTML drag and drop, localStorage, Node test runner.

---

### Task 1: Define and test the persisted desktop layout

**Files:**
- Modify: `apps/web/src/views/AppLauncherView.tsx`
- Modify: `apps/web/src/views/AppLauncherView.test.ts`

- [ ] **Step 1: Write failing source-level tests for the desktop entry points**

```ts
test("应用中心支持文件夹布局", () => {
  assert.match(source, /type LauncherFolder/);
  assert.match(source, /function createFolder/);
  assert.match(source, /function moveIntoFolder/);
  assert.match(source, /function removeFromFolder/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @ke/server exec node --test --import tsx ../web/src/views/AppLauncherView.test.ts`

Expected: the new assertion fails because folder state has not been implemented.

- [ ] **Step 3: Implement minimal persisted layout helpers**

```ts
type LauncherFolder = { id: string; label: string; items: LauncherId[] };
type LauncherEntry = LauncherId | LauncherFolder;

function loadLayout(): LauncherEntry[] { /* migrate the legacy order */ }
function saveLayout(entries: LauncherEntry[]) { /* store desktop layout */ }
```

- [ ] **Step 4: Re-run the focused test**

Run: `pnpm --filter @ke/server exec node --test --import tsx ../web/src/views/AppLauncherView.test.ts`

Expected: PASS.

### Task 2: Render the icon desktop and folder interactions

**Files:**
- Modify: `apps/web/src/views/AppLauncherView.tsx`
- Modify: `apps/web/src/views/AppLauncherView.test.ts`

- [ ] **Step 1: Add a failing source-level test for required desktop UI markers**

```ts
test("应用中心以图标桌面和文件夹呈现", () => {
  assert.match(source, /app-launcher__desktop/);
  assert.match(source, /app-launcher-folder/);
  assert.match(source, /拖到应用图标上即可建组/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @ke/server exec node --test --import tsx ../web/src/views/AppLauncherView.test.ts`

Expected: FAIL because the existing launcher is a flat card grid.

- [ ] **Step 3: Implement rendering and drag rules**

```tsx
<section className="app-launcher__desktop" aria-label="应用列表">
  {/* App icons open their view; folder icons open a panel. */}
</section>
```

Rules: dropping an app on a different app replaces both entries with one two-item folder; dropping an app on a folder adds it; dropping a folder member on the desktop removes it from that folder; a one-item folder unwraps into a normal app icon.

- [ ] **Step 4: Run the focused test and TypeScript check**

Run: `pnpm --filter @ke/server exec node --test --import tsx ../web/src/views/AppLauncherView.test.ts && pnpm --filter @ke/web typecheck`

Expected: both commands exit 0.

### Task 3: Apply the minimal dark desktop visual design

**Files:**
- Modify: `apps/web/src/views/AppLauncherView.css`
- Modify: `apps/web/src/views/AppLauncherView.test.ts`

- [ ] **Step 1: Add a failing source-level style test**

```ts
test("应用中心移除标题区并使用大图标桌面样式", () => {
  assert.doesNotMatch(source, /恢复默认排序/);
  assert.match(css, /\.app-launcher__desktop/);
  assert.match(css, /\.app-launcher-icon/);
  assert.match(css, /\.app-launcher-folder/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @ke/server exec node --test --import tsx ../web/src/views/AppLauncherView.test.ts`

Expected: FAIL because the header and card styles still exist.

- [ ] **Step 3: Replace card styling with the desktop treatment**

```css
.app-launcher__desktop { display: grid; grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); }
.app-launcher-icon { background: transparent; border: 0; }
.app-launcher-icon__glyph { width: 88px; height: 88px; }
```

Use a near-black background, bright line icons, restrained gray text, and no decorative panel borders. Hide the former header entirely by removing it from JSX.

- [ ] **Step 4: Run verification and inspect the running desktop app**

Run: `pnpm --filter @ke/server exec node --test --import tsx ../web/src/views/AppLauncherView.test.ts && pnpm --filter @ke/web typecheck && pnpm --filter @ke/desktop package`

Expected: all commands exit 0. Replace `/Applications/Rich.app`, open it, then verify that no title block or reset button remains and that app icons and at least one folder can be interacted with.

### Task 4: Commit the finished change

**Files:**
- Modify: `apps/web/src/views/AppLauncherView.tsx`
- Modify: `apps/web/src/views/AppLauncherView.css`
- Modify: `apps/web/src/views/AppLauncherView.test.ts`
- Create: `docs/superpowers/plans/2026-09-11-app-launcher-desktop.md`

- [ ] **Step 1: Check the final diff**

Run: `git diff --check && git status --short`

Expected: only the launcher implementation, its test, and this plan are changed.

- [ ] **Step 2: Commit**

Run: `git add apps/web/src/views/AppLauncherView.tsx apps/web/src/views/AppLauncherView.css apps/web/src/views/AppLauncherView.test.ts docs/superpowers/plans/2026-09-11-app-launcher-desktop.md && git commit -m "feat: turn app launcher into icon desktop"`

Expected: the commit succeeds and `git status --short` is empty.
