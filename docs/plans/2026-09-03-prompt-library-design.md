# Prompt library

## Goal

Rich stores editable prompt templates centrally. A scene explicitly selects reusable common templates; no automatic rule matching or priority engine is introduced.

## Data and rendering

Templates live in the Rich data directory (`prompt-library.json`), so saving in the UI is immediately visible to the running server. A template has a stable key, kind (`common` or `scene`), Markdown content, explicit includes and enabled state. `PromptLibraryService.render(sceneKey, variables)` expands includes in declared order and replaces `{{variable}}` placeholders. It reads the file for every render, so later sends use saved content without restart. Existing messages remain stored unchanged.

## First migration

`codex.deliverable-analysis-start` is the first scene. It includes the common Codex task guardrails and the editable deliverable-analysis recording/file rules. The task-start route renders this scene with location, fixed IDs and the current deliverable context.

## Migration inventory

The library exposes an inventory for later migration: Codex task turns, homepage chat system prompt, Hermes deliverable task, knowledge operations, project operations and content operations. Each remains unchanged until explicitly migrated.

## UI

Backend management contains a Prompt Library tab: select a template, edit Markdown/includes/enabled state, save, and preview a scene with sample variables. The preview is assembled by the same server renderer used at runtime.
