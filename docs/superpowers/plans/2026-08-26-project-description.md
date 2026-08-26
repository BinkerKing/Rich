# Project Description Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one database-backed rich-text project description page that people can edit and AI tools can read directly.

**Architecture:** Reuse the existing `pm_module_items` repository with a new `description` module key. Add a small service that owns the singleton rule, expose GET/PUT HTTP routes and one read-only MCP tool, then render the existing rich-text editor in a focused section.

**Tech Stack:** TypeScript, Hono, PostgreSQL/SQLite repositories, MCP SDK, React, Vitest.

---

### Task 1: Project description domain service

**Files:**
- Create: `apps/server/src/modules/project-description/projectDescriptionService.ts`
- Test: `apps/server/test/projectDescriptionService.test.ts`
- Modify: `apps/server/src/repos/ProjectManagementRepo.ts`
- Modify: `apps/web/src/api/client.ts`

- [ ] Write a failing unit test proving an empty project returns an empty description and the first save creates one `description` module item.
- [ ] Add `description` to `ProjectManagementModuleKey` in server and web types.
- [ ] Implement `getProjectDescription(repo, projectId)` and `saveProjectDescription(repo, projectId, html)` using `listModuleItems`, `createModuleItem`, and `updateModuleItem`.
- [ ] Return `{ projectId, html, text, createdAt, updatedAt }`, with `text` produced by stripping HTML tags.
- [ ] Run `pnpm --filter @ke/server test -- projectDescriptionService.test.ts` and expect all tests to pass.

### Task 2: HTTP and MCP access

**Files:**
- Modify: `apps/server/src/routes/projectManagement.ts`
- Modify: `apps/server/src/mcp/projectManagementTools.ts`
- Modify: `apps/web/src/api/client.ts`
- Test: `apps/server/test/routes.test.ts`
- Test: `apps/server/test/mcp-project-management.test.ts`

- [ ] Add `GET /:projectId/description` returning the current singleton document.
- [ ] Add `PUT /:projectId/description` accepting `{ html: string }` and returning the saved document.
- [ ] Add `project_management_get_description` with required `project_id`; call the same domain service as HTTP.
- [ ] Add typed web API methods `getProjectDescription` and `saveProjectDescription`.
- [ ] Verify route and MCP tests pass.

### Task 3: Rich-text page and navigation

**Files:**
- Create: `apps/web/src/views/project-management/ProjectDescriptionSection.tsx`
- Create: `apps/web/src/views/project-management/ProjectDescriptionSection.test.ts`
- Modify: `apps/web/src/views/project-management/ProjectManagementNavigation.tsx`
- Modify: `apps/web/src/views/project-management/index.ts`
- Modify: `apps/web/src/views/ProjectWorkspace.tsx`
- Modify: `apps/web/src/views/ProjectsView.css`

- [ ] Add “项目说明” before “数据字典” in `PROJECT_MANAGEMENT_SECTIONS`.
- [ ] Render a read view with empty guidance, last-updated time, and an Edit button.
- [ ] Render `ProjectRichTextEditor` in edit mode with Save and Cancel actions.
- [ ] Keep the section height bound to the project workspace and scroll the document body internally.
- [ ] Add component tests for loading, editing, save, and cancel.

### Task 4: Verification and packaged app

**Files:** No additional source files.

- [ ] Run focused server and web tests.
- [ ] Run server and web type checks/builds.
- [ ] Package and restart Rich.app.
- [ ] Verify GET, PUT, global search, and MCP-facing service output against the local `rich` database.
- [ ] Open the page and visually confirm the menu, empty/read/edit states, scrolling, and saved content reload.
