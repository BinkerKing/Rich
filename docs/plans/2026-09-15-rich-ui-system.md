# Rich UI System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Introduce shadcn/ui (Nova), Tailwind CSS and Lucide as Rich's single common UI foundation, then migrate the shared application chrome and the mind-map node-detail experience without changing existing canvas, table, or rich-text behavior.

**Architecture:** Keep the existing React/Vite application and its specialist libraries (`@xyflow/react`, `simple-mind-map`, Tiptap, AG Grid, React Data Grid) intact. Add Tailwind only as the styling/runtime foundation for newly introduced shadcn/ui components; old page CSS remains active until that page is deliberately migrated. Build a small Rich-owned layer of primitives and shell components so views consume one semantic API instead of importing arbitrary shadcn files directly.

**Tech Stack:** React 18, TypeScript, Vite 5, Tailwind CSS v4, shadcn/ui Nova using its supported base, Lucide React, existing Node test runner and `tsx` test loader.

---

## Scope and decisions

- The canonical target is a restrained near-black dark UI: neutral surfaces, one violet/blue interaction accent, line icons, comfortable reading density, and no decorative gradients in new UI.
- This first migration supports the default Rich dark theme. The existing `cyber`, `brutal`, `blueprint`, `duotone`, `fabric`, `editorial`, and `ghibli` CSS themes remain available for legacy pages but do not receive shadcn component overrides in this milestone.
- Do not replace or restyle the internals of `@xyflow/react`, `simple-mind-map`, Tiptap, AG Grid, or React Data Grid. Only their surrounding shell, toolbar and detail-panel chrome are in scope.
- Do not add a global `SidebarProvider` around every `App` route: overlay/chat routes and full-screen canvas workspaces have incompatible layout requirements. Migrate selected standard workspaces through a Rich-owned shell component instead.
- The existing dirty files `apps/web/src/views/project-management/delivery/DeliveryWorkspace.tsx` and `apps/web/src/views/project-management/delivery/DeliveryWorkspace.test.ts` are out of scope and must never be included in commits for this work.

## Milestones and acceptance criteria

1. **Foundation:** Tailwind and shadcn render in Vite without resetting or visually breaking legacy views. A stable `@/` alias and common dark tokens exist.
2. **Common interaction layer:** Buttons, input controls, dialogs, tooltips, toasts, scroll areas and icon usage have a single Rich-owned import path and keyboard-accessible defaults.
3. **Shell pilot:** A reusable app shell supports top bar, collapsible left navigation, optional right aside, mobile sheet behavior and persisted width/open state.
4. **Node-detail pilot:** The full-screen mind-map node detail is a documentation-style reading experience with a right-side table of contents. The existing narrow floating detail panel remains usable and does not force a desktop aside into narrow widths.
5. **Progressive migration:** New feature work uses the new layer. Existing pages move one route at a time only after a visual and behavior regression check.

### Task 1: Establish a measurable visual baseline and migration inventory

**Files:**
- Create: `docs/ui-system/2026-09-15-baseline.md`
- Modify: `apps/web/package.json`

- [ ] **Step 1: Record the baseline.**

Document the current routes from `apps/web/src/App.tsx`, the shared `TopBar`, the current `tokens.css` values, full-screen/canvas routes, and the first migration order: `DeepWorkbenchView`, `ProjectsView`, `AppLauncherView`, then project-management sub-workspaces. Capture desktop screenshots at 1440px and 1280px before visual changes; use them only for manual comparison.

- [ ] **Step 2: Add a `test` script to `apps/web/package.json`.**

Use the existing `tsx` Node test runner rather than adding a browser-test framework in this milestone. The script must run only `src/**/*.test.ts` and `src/**/*.test.tsx`.

- [ ] **Step 3: Run the existing test suite and build.**

Run: `pnpm --filter @ke/web test && pnpm --filter @ke/web build`

Expected: both commands exit 0.

### Task 2: Add Tailwind and the shadcn Nova toolchain without disturbing legacy CSS

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/web/tsconfig.json`
- Create: `apps/web/components.json`
- Create: `apps/web/src/styles/tailwind.css`
- Create: `apps/web/src/ui/uiToolchain.test.ts`
- Modify: `apps/web/src/main.tsx`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Write failing source-level tests for the Vite integration and canonical aliases.**

```ts
test("Vite enables Tailwind and the app has a stable UI alias", () => {
  assert.match(viteSource, /@tailwindcss\/vite/);
  assert.match(viteSource, /resolve:/);
  assert.match(tsconfigSource, /"@\/\*"/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `pnpm --filter @ke/web exec tsx --test src/ui/uiToolchain.test.ts`

Expected: FAIL because neither the Tailwind plugin nor an alias exists.

- [ ] **Step 3: Install only the initial dependencies.**

Install Tailwind CSS v4 with its Vite plugin, shadcn's required utility dependencies, and `lucide-react`. Initialize shadcn with the Nova preset and the same base selected by the generated `components.json`. Configure `@/*` to resolve to `apps/web/src/*` in both TypeScript and Vite.

- [ ] **Step 4: Import Tailwind once, before legacy view CSS.**

`apps/web/src/styles/tailwind.css` must include Tailwind and only the shadcn token layer. Do not enable a broad reset that changes legacy controls globally; if the selected Tailwind integration emits Preflight, scope its effect to the new Rich UI root or explicitly neutralize only conflicting base rules in the new layer.

- [ ] **Step 5: Verify both legacy and new compilation paths.**

Run: `pnpm --filter @ke/web test && pnpm --filter @ke/web typecheck && pnpm --filter @ke/web build`

Expected: all commands exit 0; the home route, tree route and deep-workbench route still load without console errors.

- [ ] **Step 6: Commit the isolated toolchain change.**

Run: `git add apps/web/package.json apps/web/vite.config.ts apps/web/tsconfig.json apps/web/components.json apps/web/src/styles/tailwind.css apps/web/src/main.tsx pnpm-lock.yaml apps/web/src/ui/uiToolchain.test.ts docs/ui-system/2026-09-15-baseline.md && git commit -m "feat: add Rich UI foundation"`

Expected: only Task 1–2 files are staged; do not stage the pre-existing DeliveryWorkspace changes.

### Task 3: Create the Rich-owned primitive layer

**Files:**
- Create: `apps/web/src/ui/index.ts`
- Create: `apps/web/src/ui/uiSystem.test.ts`
- Create: `apps/web/src/ui/cn.ts`
- Create: `apps/web/src/ui/theme.ts`
- Create: `apps/web/src/ui/button.tsx`
- Create: `apps/web/src/ui/input.tsx`
- Create: `apps/web/src/ui/dialog.tsx`
- Create: `apps/web/src/ui/scroll-area.tsx`
- Create: `apps/web/src/ui/tooltip.tsx`
- Create: `apps/web/src/ui/toast.tsx`
- Modify: `apps/web/src/ui/uiSystem.test.ts`

- [ ] **Step 1: Write failing tests for the public barrel and variants.**

```ts
test("new application primitives are exported through one Rich-owned module", () => {
  assert.match(source, /export \{ Button \}/);
  assert.match(source, /export \{ Dialog/);
  assert.match(source, /export \{ ScrollArea \}/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `pnpm --filter @ke/web test -- src/ui/uiSystem.test.ts`

Expected: FAIL because the barrel is not yet implemented.

- [ ] **Step 3: Add generated shadcn primitives behind Rich-owned exports.**

Use the generated Nova components as implementation details. Export only the variants Rich needs now: primary/secondary/ghost/destructive buttons; input/select/textarea; dialog/sheet; tooltip; scroll area; toast; and `cn`. Do not add calendars, charts, date pickers, data tables or forms until a view needs them.

- [ ] **Step 4: Add stable tokens for new UI only.**

Define Rich UI semantic tokens in `theme.ts`/the Tailwind theme layer: canvas, surface, raised surface, border, foreground, muted foreground, focus ring, accent, destructive, compact/normal spacing, and radii. Preserve existing `apps/web/src/theme/tokens.css` unchanged in this task.

- [ ] **Step 5: Re-run tests, typecheck and build.**

Run: `pnpm --filter @ke/web test && pnpm --filter @ke/web typecheck && pnpm --filter @ke/web build`

Expected: all commands exit 0.

- [ ] **Step 6: Commit the primitive layer.**

Run: `git add apps/web/src/ui apps/web/src/styles/tailwind.css apps/web/package.json pnpm-lock.yaml && git commit -m "feat: add shared Rich UI primitives"`

### Task 4: Build a reusable Rich application shell

**Files:**
- Create: `apps/web/src/components/app-shell/RichAppShell.tsx`
- Create: `apps/web/src/components/app-shell/RichAppShell.test.ts`
- Create: `apps/web/src/components/app-shell/RichAppShell.css`
- Modify: `apps/web/src/components/TopBar.tsx`
- Modify: `apps/web/src/views/TreeView.css`

- [ ] **Step 1: Write a failing test for supported shell regions.**

```ts
test("shell provides responsive navigation, main content and an optional right aside", () => {
  assert.match(source, /SidebarProvider/);
  assert.match(source, /RichAppShell/);
  assert.match(source, /aside\?: ReactNode/);
  assert.match(source, /side="right"/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails.**

Run: `pnpm --filter @ke/web test -- src/components/app-shell/RichAppShell.test.ts`

Expected: FAIL because no common shell exists.

- [ ] **Step 3: Implement the shell with explicit extension points.**

`RichAppShell` receives `header`, `navigation`, `children`, `aside`, and an optional `navigationStorageKey`. Use shadcn's sidebar with `collapsible="icon"` for desktop and sheet behavior on narrow screens. Render a right sidebar only when `aside` exists; it is a normal scrolling semantic `aside`, not a second application navigation tree. Persist only explicit user resizing/open state, never route content.

- [ ] **Step 4: Make `TopBar` a content component, not a CSS contract.**

Move its appearance from `.tv-*` page CSS toward new semantic shell classes. Keep its current `breadcrumb`, home behavior, theme switch and keyboard affordances intact. Do not remove `.tv-*` rules used by legacy Tree/Input/Admin pages yet.

- [ ] **Step 5: Run focused and full verification.**

Run: `pnpm --filter @ke/web test && pnpm --filter @ke/web typecheck && pnpm --filter @ke/web build`

Manual check: at 1440px and 1280px, verify left navigation collapses/expands, an optional right aside scrolls independently, focus is visible, and legacy TreeView still renders unchanged.

- [ ] **Step 6: Commit the shell.**

Run: `git add apps/web/src/components/app-shell apps/web/src/components/TopBar.tsx apps/web/src/views/TreeView.css apps/web/src/ui && git commit -m "feat: add reusable Rich application shell"`

### Task 5: Migrate the mind-map node-detail reading mode as the design pilot

**Files:**
- Modify: `apps/web/src/views/DeepWorkbenchView.tsx`
- Modify: `apps/web/src/views/DeepWorkbenchView.css`
- Modify: `apps/web/src/views/DeepWorkbenchView.detailHeader.test.ts`
- Create: `apps/web/src/views/deep-workbench/nodeDetailToc.ts`
- Create: `apps/web/src/views/deep-workbench/nodeDetailToc.test.ts`

- [ ] **Step 1: Write failing tests for the reading layout and section navigation model.**

```ts
test("node detail creates a stable table of contents from the four persisted sections", () => {
  assert.deepEqual(nodeDetailToc(), ["description", "flowcharts", "table", "files"]);
});

test("fullscreen detail renders a right-side document navigation", () => {
  assert.match(source, /RichAppShell/);
  assert.match(source, /node-detail__toc/);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail.**

Run: `pnpm --filter @ke/web test -- src/views/deep-workbench/nodeDetailToc.test.ts src/views/DeepWorkbenchView.detailHeader.test.ts`

Expected: FAIL because the current panel has no document TOC.

- [ ] **Step 3: Extract the four-section document model.**

Keep the persisted data contract in `nodeDetails.ts` unchanged. Add a pure TOC model that maps the existing section IDs to Chinese labels and stable heading IDs; it must not derive IDs from editable titles.

- [ ] **Step 4: Use the new shell only in full-screen detail mode.**

When `nodeDetailPanelFullscreen` is true, render the detail body inside `RichAppShell` with the TOC passed to `aside`. Add scroll-spy behavior to mark the active section and expand a target section before scrolling to it. In the existing resizable floating panel, keep the compact double-click-to-expand interaction and replace only local buttons/inputs/cards with Rich primitives.

- [ ] **Step 5: Apply the Nova reading treatment.**

Use a quiet document column, clear typography hierarchy, unboxed section boundaries, a 200–240px TOC aside at desktop width, and a mobile TOC sheet/trigger. Bound flowcharts, the configurable grid and external-file bindings stay functionally identical.

- [ ] **Step 6: Verify behavior and visual regressions.**

Run: `pnpm --filter @ke/web test && pnpm --filter @ke/web typecheck && pnpm --filter @ke/web build`

Manual check: open a node with content in all four modules; verify the default is "说明" open in the narrow panel, double-click switches expanded section, fullscreen TOC scrolls and highlights correctly, Escape closes fullscreen, file links and flowchart bindings still work, and a narrow 1280px window does not show an unusably cramped aside.

- [ ] **Step 7: Commit the pilot.**

Run: `git add apps/web/src/views/DeepWorkbenchView.tsx apps/web/src/views/DeepWorkbenchView.css apps/web/src/views/DeepWorkbenchView.detailHeader.test.ts apps/web/src/views/deep-workbench/nodeDetailToc.ts apps/web/src/views/deep-workbench/nodeDetailToc.test.ts && git commit -m "feat: redesign mindmap node details"`

### Task 6: Migrate shared high-frequency surfaces progressively

**Files:**
- Modify: `apps/web/src/views/ProjectsView.tsx`
- Modify: `apps/web/src/views/ProjectsView.css`
- Modify: `apps/web/src/views/AppLauncherView.tsx`
- Modify: `apps/web/src/views/AppLauncherView.css`
- Modify: `apps/web/src/components/CommandPalette.tsx`
- Modify: `apps/web/src/components/CommandPalette.css`
- Modify: their existing `*.test.ts` files
- Create: `docs/ui-system/migration-status.md`

- [ ] **Step 1: Add one failing source/behavior test per route before migrating it.**

Each test must verify the route uses Rich-owned primitives or `RichAppShell` where appropriate and preserves its existing route-specific interaction. Do not write a test that asserts Tailwind class strings.

- [ ] **Step 2: Migrate one route per commit.**

Order: `ProjectsView`, then `AppLauncherView`, then `CommandPalette`. Each route adopts shared buttons, iconography, dialogs, input fields and spacing while keeping its data loading, routing and keyboard behavior unchanged.

- [ ] **Step 3: Mark migration status.**

For every route, record `legacy`, `shell migrated`, or `fully migrated`; list why canvas/overlay routes are deliberately deferred. New pages must start in the new system after this task.

- [ ] **Step 4: Verify each route independently and then together.**

Run after each route: `pnpm --filter @ke/web test -- <route-test-file> && pnpm --filter @ke/web typecheck`

Run at milestone end: `pnpm --filter @ke/web test && pnpm --filter @ke/web build && git diff --check`

Expected: all commands exit 0; desktop screenshots at 1440px and 1280px show consistent top-level spacing, icon weight, action hierarchy and dark surfaces.

- [ ] **Step 5: Commit each route separately.**

Example: `git add apps/web/src/views/ProjectsView.tsx apps/web/src/views/ProjectsView.css apps/web/src/views/ProjectsView.test.ts docs/ui-system/migration-status.md && git commit -m "refactor: migrate projects to Rich UI system"`

### Task 7: Guard the system and define the next migration queue

**Files:**
- Modify: `docs/ui-system/migration-status.md`
- Create: `apps/web/src/ui/uiSystem.test.ts` (extend existing file)
- Modify: `apps/web/src/theme/tokens.css` only if a legacy-to-semantic token bridge is required

- [ ] **Step 1: Add guard tests.**

Test that the UI barrel remains the only import path for common primitives, the canonical icon source is Lucide for new UI, and the deep-workbench pilot retains its four modules and TOC behavior.

- [ ] **Step 2: Define deferred work explicitly.**

Queue `ProjectManagement` workspaces, Home/Tree/Admin legacy chrome, and special overlay/canvas surfaces separately. Do not mix them into a broad CSS cleanup.

- [ ] **Step 3: Final verification.**

Run: `pnpm --filter @ke/web test && pnpm --filter @ke/web typecheck && pnpm --filter @ke/web build && git diff --check && git status --short`

Expected: all validation commands exit 0; status shows no unrelated files staged or modified by this UI work.

## Rollback and release strategy

- Every task is a small independent commit. If a visual regression appears, revert the relevant commit rather than editing legacy pages opportunistically.
- Do not deploy or restart the Rich desktop application during this work unless explicitly requested.
- Do not delete legacy CSS until its final consumer is migrated and a separate removal task has verified all current themes and routes.
