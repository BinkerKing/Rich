# Unbound Codex New Conversation Design

## Goal

The `+ 新对话` control in the Codex workbench creates a general Codex session. It must not inherit the resource currently used to open the workbench.

## Scope

- Keep the existing resource entry points unchanged: opening Codex from a mindmap, flowchart, deliverable, report, or dictionary continues to select that resource's bound session.
- Change only the workbench's `+ 新对话` create path to use the general Session endpoint.
- A newly created Session has no resource binding, no resource-specific MCP tools, and no resource ID in its initial context.

## Data Flow

1. A resource entry point resolves or creates its bound Session and opens the workbench with that Session selected.
2. The workbench's `+ 新对话` action always posts to the general Codex Session endpoint.
3. The general Session appears in the shared conversation list and can be used independently of the resource that was open when it was created.

## Error Handling

The new path must not write an active `is_bound` record for the current resource scope, so it cannot violate `idx_deliverable_codex_bound`.

## Verification

- A focused frontend regression test asserts that the new-conversation request uses the general endpoint rather than `currentResourcePath`.
- Existing resource-bound opening behavior remains covered by its current tests.
