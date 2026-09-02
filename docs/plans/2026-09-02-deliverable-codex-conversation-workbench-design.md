# Deliverable Codex Conversation Workbench Design

## Goal

Add a Codex-first, persistent conversation workbench to each deliverable page. A user can open several conversations for the same deliverable, switch them from a title-tab strip, and keep their history until explicitly archived. Each conversation is created in one fixed mode: free, task, or bug.

This is an interactive Codex workspace, not a queue of compulsory writeback jobs. The user talks to Codex normally in every mode. Task mode only gives Codex a richer context, an explicit operating contract, and access to the deliverable writeback tools when the user asks for a writeback in the conversation.

## Product Contract

### Scope identity

The first release is limited to `deliverables`. A conversation belongs to one stable page scope:

```text
deliverable:{projectId}:{deliverableId}
```

Names, folder paths, and URLs are display data and must not be used as identity. A future nested target may extend the key with `:{targetType}:{targetId}` without changing existing conversations.

### Persistent conversation windows

- A deliverable can have any number of unarchived conversation windows.
- The workbench is opened from that deliverable, lists all of its unarchived windows in a topmost title-tab strip, and restores the most recently active one by default.
- There is no close button on a title tab. Archiving is the only removal action; it hides the tab but retains searchable history and the audit trail.
- Closing the workbench only hides it. It does not archive the conversation or cancel a running Codex turn.
- Title tabs show a user-editable title, fixed mode badge, and the fixed executor label. The first release always creates `codex` conversations, but executor remains persisted as a field for later Claude Code support.

### Immutable creation choices

The `+` at the end of the top tab strip opens a compact `新建任务窗口` popover. Before creation it collects:

1. Mode: `free`, `task`, or `bug`.
2. A user-facing conversation title, defaulted from the selected mode and deliverable title.

The app creates the conversation only after the user presses `创建会话`. Mode and executor are immutable after creation. The popover states `创建后不可切换`.

### Modes

All modes are persistent, ordinary Codex conversations. They differ only in the initial context package, fixed developer instructions, capabilities, and permitted Rich MCP tools.

| Mode | Initial context and instructions | Rich business writeback |
| --- | --- | --- |
| Free | Deliverable identity, title, description, folder reference, and a compact “assist in this deliverable context” instruction. | Disabled. No Rich business record is generated. |
| Bug | Free context plus diagnostic instructions, relevant linked files/versions, and bug-report guidance. | Disabled. No Rich business record is generated. |
| Task | Deliverable context plus objectives, acceptance conditions, relevant records/files, and an explicit contract for reporting or writing results when the user requests it. | Available only through task-mode tools. |

Task mode never writes back merely because a turn ends. A user can say, for example, “将这份检查结论回写到交付物”; Codex then uses the task-mode writeback tool. The normal task result projection creates or updates the visible deliverable result/status. The deliverable UI is the source of truth for writeback progress, success, failure, and later approval/review states; the chat shows streamed work but never blocks on a chat-local approval dialog.

## UX Layout

```text
[ 数据字典核对 · Codex [任务模式] ] [ … ] [ + ]   <- first/topmost row
项目管理 / 二代 SAFE 项目 / 交付物 / 当前交付物      [上下文已连接 · 12 轮]
-----------------------------------------------------------------
                        active conversation
-----------------------------------------------------------------
composer                                               [发送]
```

The tab strip is the first row in the workbench. Project/deliverable breadcrumb and connection state are secondary, read-only context indicators. No right-side context panel is shown; chat owns the available space. Tool progress, command activity, errors, and final output appear inline in the message timeline.

## Runtime and Data Design

### Conversation records

Existing `chat_conversations`, messages, summaries, turns, and agent-tool audit records remain the transcript and audit stores. A new workbench configuration record replaces the current one-conversation-per-page assumption:

```ts
type DeliverableConversation = {
  id: string;
  scopeKey: string;              // deliverable:{projectId}:{deliverableId}
  projectId: string;
  deliverableId: string;
  title: string;
  mode: "free" | "task" | "bug";
  executor: "codex";
  codexThreadId?: string;
  status: "active" | "archived";
  contextVersion?: string;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
};
```

The database must index `(scope_key, status, last_active_at DESC)`. It must not identify a conversation with a deterministic scope key, because a scope permits multiple conversations.

`contextVersion` is a digest/version of the built deliverable context. On initial creation Rich sends the complete mode-specific context to Codex. When reopening a conversation, Rich resumes the saved native thread. It only supplies a concise context refresh when the version changed; it does not resend a large page snapshot on every turn.

### Codex runtime

Implement a `CodexAppServerRuntime` behind `AgentRuntimePort`, using a locally spawned `codex app-server` stdio JSON-RPC connection. It owns one reusable local app-server process for the Rich server session and maps:

- Rich conversation → Codex `thread/start` or `thread/resume`;
- user message → `turn/start`;
- streamed Codex items/deltas/tool progress → existing Rich SSE event types;
- archive → Codex thread archive plus Rich conversation archive;
- interruption → `turn/interrupt`.

Codex app-server is preferred over the existing `CodexAdapter`, whose non-interactive `codex exec` path is adequate for one-off calls but does not provide the required rich-client approval and event surface. The existing `AgentConversationService` remains the durable admission, summary, turn-lease, and event bridge. Its config/repository contracts must generalize from fixed `hermes` to executor/mode-aware records.

### Tools and state visibility

Free and bug modes receive no writeback MCP tools. Task mode receives only the task-scoped Rich MCP tools needed for the deliverable, including the existing result/report projection tool. The tools carry correlation fields for the conversation, turn, project, and deliverable, so the deliverable UI can show writeback status without inventing status from assistant prose.

For this release, Rich displays execution and writeback state in the deliverable workspace (including the current `ai_task_result` projection) and streams tool progress in the chat. It does not add chat-based approval prompts. Any approval/review mechanism introduced later is implemented as a deliverable page state and does not change the Codex conversation flow.

## API Shape

Add a page-scoped conversation API rather than overloading the home-chat default conversation:

- `GET /api/projects/:projectId/deliverables/:deliverableId/codex-conversations` — list active conversations, newest active first.
- `POST /api/projects/:projectId/deliverables/:deliverableId/codex-conversations` — create a fixed-mode Codex conversation.
- `POST /api/codex-conversations/:id/activate` — update `lastActiveAt` and return resume state.
- `POST /api/codex-conversations/:id/archive` — archive the Rich and native Codex threads.
- `POST /api/codex-conversations/:id/stream` — submit a message and stream ordinary conversation/tool events.

The creation route validates that the deliverable belongs to the project, that the mode is supported, and that Codex is locally available. It creates a durable Rich record before the first Codex turn, so a first-turn failure leaves a visible recoverable conversation instead of an orphaned native thread.

## Failure and Recovery Rules

- If Codex is unavailable, creation is rejected with a visible availability error; no fake conversation is created.
- If the saved native thread cannot resume, Rich starts a replacement native thread with the persisted Rich summary, recent transcript, fixed mode instructions, and current context package. It updates `codexThreadId` only after the replacement starts successfully.
- A Codex writeback tool failure is an inline tool error and a deliverable-side failed state. It does not archive the conversation or discard later dialogue.
- The existing per-conversation turn lease still permits only one active turn in one title tab. Other tabs may run independently.

## Acceptance Criteria

1. Opening one deliverable shows only that deliverable’s unarchived Codex title tabs and restores its most recently active tab.
2. Creating three conversations in the same deliverable produces three tabs with immutable mode labels; switching tabs restores each transcript and native Codex context.
3. The title-tab strip is the topmost workbench row; no right context sidebar exists.
4. Closing the workbench preserves conversations. Archiving a tab removes it from the active list and leaves an archived, recoverable history entry.
5. Free and bug mode cannot invoke a Rich writeback tool in an integration test.
6. Task mode does not write anything back after ordinary dialogue; an explicit user request can invoke the task-mode writeback tool and creates observable deliverable-side state.
7. Codex text, tool activity, errors, and completion stream in real time through the workbench.
8. A restart or stale native thread recovers using Rich conversation history without mixing scopes or modes.

## Deferred

- Claude Code or any non-Codex executor selection and runtime adapter.
- Folder and other page modes.
- User-configurable permissions per conversation.
- A global archived-conversation browser and cross-page search.
- New writeback approval policy; the first release surfaces current task result/status behavior in the deliverable UI.
