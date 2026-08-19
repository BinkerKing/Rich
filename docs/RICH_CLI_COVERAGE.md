# Rich CLI Coverage

This audit maps Rich UI operations to CLI/MCP entry points. The rule is:

- Data mutation, AI generation, system action, uploads, and deletions must have CLI/MCP coverage.
- Pure UI operations do not need CLI: open/close modal, switch tab, filter list, select card, scroll, copy, local text formatting inside an open editor before save.
- If a new button calls `/api/...`, it is automatically covered by the generic CLI fallback:

```bash
pnpm rich -- api <METHOD> /api/<path> --json '{"body":"when needed"}'
pnpm rich -- sse POST /api/<stream-path> --json '{"body":"when needed"}'
```

## Existing CLI Layers

| Layer | Use |
| --- | --- |
| `pnpm rich -- ...` | Unified CLI for Rich API/SSE operations. Covers UI-backed HTTP operations. |
| `pnpm corpus ...` | Focused AI corpus template CLI. Kept for short template workflows. |
| `pnpm --filter @ke/server run plan -- ...` | Offline/server-side GreatMe plan CLI. Uses `KE_STORAGE` to select backend. |
| Rich MCP tools | Preferred for Hermes/Codex when available, especially knowledge tree, plan management, practice projects, toolbox, corpus, improvements. |

## Button Coverage By Area

| UI area | Button operation | CLI / MCP |
| --- | --- | --- |
| Home / global chat | Send text or image message | `pnpm rich -- chat stream --json '{"messages":[...]}'`; attachments via `pnpm rich -- chat-attachments upload --file image.png` |
| Home / global chat | Attach image | `pnpm rich -- chat-attachments upload --file image.png` |
| Home / global chat | Play mascot animation | `pnpm rich -- mascot play --json '{"name":"dance","durationMs":3000}'`; MCP `play_mascot_animation` |
| Home / history | View/select history | `pnpm rich -- api GET /api/chat/conversations`; `pnpm rich -- api GET /api/chat/conversations/<id>/messages` |
| Knowledge tree | List/read topics | `pnpm rich -- elements list`; MCP `list_topics`, `get_element`, `get_subtree` |
| Knowledge tree | Create element | `pnpm rich -- elements create --json '{"title":"...","type":"topic","parentId":"..."}'`; MCP `create_element` |
| Knowledge tree | Edit title/type/difficulty/content | `pnpm rich -- elements patch <id> --json '{...}'`; MCP `update_element`, `update_section_blocks` |
| Knowledge tree | Delete element | `pnpm rich -- elements delete <id>`; MCP `delete_element` |
| Knowledge tree | Move/reparent/reorder | `pnpm rich -- elements move <id> --json '{"newParentId":"..."}'`; `pnpm rich -- relations reorder --json '{"parentId":"...","childIds":[...]}'`; MCP `reparent_element`, `reorder_children` |
| Knowledge tree | Refine/feedback/expand/extend/path | `pnpm rich -- ai refine|feedback|expand|extend|path --json '{...}'`; MCP `refine`, `expand`, `extend`, `generate_paths` |
| Knowledge tree | Ask/mark/analyze annotations | `pnpm rich -- ai ask --json '{...}'`; `pnpm rich -- annotations create/delete`; MCP `write_annotation`, `list_qa`, `write_qa` |
| AI news | Generate daily news | `pnpm rich -- ai news-generate-daily --json '{"date":"YYYY-MM-DD","model":"codex"}'`; MCP `generate_news` |
| AI news | Edit news element or add Skill section | `pnpm rich -- elements sections <id> --json '{"sections":[...]}'`; MCP `update_section_blocks` |
| Mindmap PPT | List/open deck | `pnpm rich -- mindmaps list`; `pnpm rich -- mindmaps get <id>` |
| Mindmap PPT | Attach existing element as deck | `pnpm rich -- mindmaps attach --json '{"elementId":"..."}'`; MCP `attach_mindmap` |
| Mindmap PPT | Generate from prose | `pnpm rich -- mindmaps generate --json '{"prose":"...","titleHint":"..."}'` |
| Mindmap PPT | Retry cover / hide / disable image / disable text / detach | `pnpm rich -- mindmaps retry-cover|toggle-hidden|toggle-image|toggle-text|detach <elementId> --json '{"deckRootId":"..."}'` |
| Plan management | List/get/create/update/delete plans/goals/tasks | `pnpm --filter @ke/server run plan -- ...`; `pnpm rich -- great-me get/put`; MCP `plan_*`, `goal_*`, `task_*` |
| Plan management | AI decompose/progress/review | `pnpm rich -- ai decompose-plan|analyze-progress|draft-review --json '{...}'`; MCP `plan_decompose`, `analyze_progress` |
| Practice projects | Create/list/read practice | MCP `practice_create`, `practice_list`, `practice_get`; API fallback `pnpm rich -- elements create ...` |
| Practice projects | Add/patch/delete group or child | MCP `practice_add_group`, `practice_add_child`, `practice_patch_child`, `practice_delete_child`, `practice_rename_group`, `practice_delete_group` |
| Practice projects | Draft PRD/child/adjust child | `pnpm rich -- ai draft-prd|draft-child|adjust-child --json '{...}'`; MCP `draft_prd`, `practice_draft_child`, `practice_adjust_child` |
| Practice projects | Guided project kickoff with Hermes | `pnpm rich -- ai guided-practice --json '{"stage":"goal","userInput":"...","draft":{},"messages":[],"model":"hermes"}'`; then persist with `practice_create` / `practice_add_child` or `pnpm rich -- elements create ...` |
| Practice media | Upload project image/material | `pnpm rich -- upload /api/images/<practiceId>/upload --file image.png --field file`; attachments via `pnpm rich -- attachments upload <elementId> --file file.pdf` |
| Toolbox | List/invoke/cancel tools | `pnpm rich -- toolbox tools`; `pnpm rich -- toolbox invoke --json '{"tool":"...","args":{}}'`; `pnpm rich -- toolbox cancel <id>`; MCP `list_toolbox_tools`, `invoke_toolbox_tool` |
| Admin monitor | Engine/ops/signals/manuals | `pnpm rich -- admin engine|ops|signals|manuals`; MCP `list_signals` |
| AI corpus | List/get/upsert/delete/reset templates | `pnpm corpus ...`; `pnpm rich -- corpus ...`; MCP `corpus_*` |
| Improvements | Create/claim/release/update/delete system tasks | `pnpm rich -- improvements ...`; MCP `create_improvement`, `claim_improvement`, `update_improvement`, `release_improvement`, `delete_improvement` |
| Cron | View cron jobs | `pnpm rich -- cron jobs` |
| Health data | Profile/weight/workout/meal/sleep/mood/timeline | Generic fallback: `pnpm rich -- api GET /api/health/<resource>` and `pnpm rich -- api POST /api/health/<resource> --json '{...}'` |

## Known UI-Only Buttons

These do not need CLI because they do not change Rich state or perform an external action:

- Switch tab, open/close modal, cancel modal, collapse/expand local tree nodes.
- Select an element/card, scroll history, preview a modal image, open fullscreen preview.
- Local text editor toolbar actions before save. The persisted operation is `elements sections`.
- History row selection and history overlay toggle. Durable chat history itself is backend data and can be read through `/api/chat/conversations`.

## Agent Rule

When an AI employee needs to perform a Rich operation:

1. Prefer MCP if the matching semantic tool exists.
2. Use `pnpm rich -- <semantic-command>` when operating from shell or when MCP is unavailable.
3. Use `pnpm rich -- api ...` or `pnpm rich -- sse ...` only as fallback for newly added endpoints that do not yet have a semantic command.
4. After mutation, verify with a read command, for example `elements get`, `practice_get`, `plan_get`, or `toolbox invocations`.
