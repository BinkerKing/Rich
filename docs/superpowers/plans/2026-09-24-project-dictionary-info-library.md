# Project Dictionary Information Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one project-scoped rich-text data-dictionary information library, opened from an icon left of Codex and supplied to the dictionary Codex context.

**Architecture:** Store the document as a single `dictionary` module item named `数据字典信息库`. A dedicated service exposes its read/upsert behavior to the project-management dictionary routes and the Codex context. The dictionary workspace switches its entire right work area into the existing shared rich-text editor.

**Tech Stack:** TypeScript, Hono, existing ProjectManagementRepo, React, Tiptap editor, Vitest.

---

### Task 1: Persist and expose the project dictionary information library

**Files:**
- Create: `apps/server/src/modules/project-dictionary-info/projectDictionaryInfoService.ts`
- Create: `apps/server/src/modules/project-dictionary-info/projectDictionaryInfoService.test.ts`
- Modify: `apps/server/src/routes/projectManagement.ts`

- [ ] **Step 1: Write the failing service test**

```ts
it("creates once and then updates the project dictionary information library", async () => {
  expect(await getProjectDictionaryInfo(repo, "project-1")).toMatchObject({ html: "" });
  await saveProjectDictionaryInfo(repo, "project-1", "<p>first</p>");
  const updated = await saveProjectDictionaryInfo(repo, "project-1", "<p>second</p>");
  expect(updated.html).toBe("<p>second</p>");
  expect(created).toHaveLength(1);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @ke/server test -- projectDictionaryInfoService.test.ts`

Expected: FAIL because the service is absent.

- [ ] **Step 3: Implement the service and routes**

```ts
const item = items.find(entry => entry.title === "数据字典信息库" || typeof entry.content.html === "string");
return item
  ? repo.updateModuleItem(projectId, item.id, { title: "数据字典信息库", content: { ...item.content, html } })
  : repo.createModuleItem(projectId, { moduleKey: "dictionary", title: "数据字典信息库", sortOrder: 0, content: { html } });
```

Add `GET` and `PUT /:projectId/dictionary/info`; reject a non-string `html` with HTTP 400.

- [ ] **Step 4: Run the service test and typecheck**

Run: `pnpm --filter @ke/server test -- projectDictionaryInfoService.test.ts && pnpm --filter @ke/server typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/server/src/modules/project-dictionary-info apps/server/src/routes/projectManagement.ts && git commit -m "feat: store project dictionary information library"`

### Task 2: Add the information library to Codex context

**Files:**
- Modify: `apps/server/src/project-dictionary-codex/DictionaryCodexContextService.ts`
- Modify: `apps/server/src/project-dictionary-codex/DictionaryCodexContextService.test.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Extend the failing context test**

```ts
expect(context.initialContext).toContain("Mapping knowledge base");
expect(context.initialContext).toContain("已确认的账户类型映射");
```

- [ ] **Step 2: Run it and verify failure**

Run: `pnpm --filter @ke/server test -- DictionaryCodexContextService.test.ts`

Expected: FAIL because the information library is not loaded.

- [ ] **Step 3: Inject only nonempty saved information**

```ts
const info = await this.info.get(projectId);
const knowledge = info.text.trim()
  ? `\n\n## Mapping knowledge base\n${info.text.trim()}`
  : "";
```

Wire the service in `index.ts` and preserve existing live-dictionary MCP instructions.

- [ ] **Step 4: Run the context test and typecheck**

Run: `pnpm --filter @ke/server test -- DictionaryCodexContextService.test.ts && pnpm --filter @ke/server typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/server/src/project-dictionary-codex/DictionaryCodexContextService.ts apps/server/src/project-dictionary-codex/DictionaryCodexContextService.test.ts apps/server/src/index.ts && git commit -m "feat: add dictionary information to Codex context"`

### Task 3: Switch the whole dictionary work area to one rich-text document

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/views/project-management/DictionaryWorkspace.tsx`
- Modify: `apps/web/src/views/ProjectsView.css`
- Modify: `apps/web/src/views/project-management/DictionaryWorkspace.test.ts`

- [ ] **Step 1: Add failing source assertions**

```ts
assert.match(source, /aria-label="数据字典信息库"[\s\S]*MessageSquare/);
assert.match(source, /<ProjectRichTextEditor[\s\S]*projectId=\{`\$\{project\.id\}-dictionary-info`\}/);
assert.match(source, /dictionaryInfoOpen \? \(/);
```

- [ ] **Step 2: Run source checks and verify failure**

Run: `pnpm --filter @ke/web test -- DictionaryWorkspace.test.ts`

Expected: FAIL because the icon and full-workspace editor are absent.

- [ ] **Step 3: Add minimal UI and API client methods**

```tsx
<button type="button" aria-label="数据字典信息库" title="数据字典信息库" onClick={() => setDictionaryInfoOpen(true)}>
  <LibraryBig aria-hidden="true" />
</button>
{dictionaryInfoOpen ? <ProjectRichTextEditor projectId={`${project.id}-dictionary-info`} value={dictionaryInfoHtml} onChange={setDictionaryInfoHtml} /> : normalWorkspace}
```

Load on entry, save explicitly, and close the mode when a regular dictionary catalog or table is selected.

- [ ] **Step 4: Run focused checks and production build**

Run: `pnpm --filter @ke/web run build && git diff --check`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/web/src/api/client.ts apps/web/src/views/project-management/DictionaryWorkspace.tsx apps/web/src/views/ProjectsView.css apps/web/src/views/project-management/DictionaryWorkspace.test.ts && git commit -m "feat: add dictionary information library workspace"`
