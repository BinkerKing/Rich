# ADR: Embed Persistent Hermes Agent Sessions in Rich Chat

- **Status:** Accepted for implementation
- **Date:** 2026-09-01
- **Decision owners:** Rich product and engineering

## Context

Rich currently has two related but different AI interactions:

1. A user publishes a bounded business task, such as producing an intermediate or final deliverable. Rich must assemble scenario context, track lifecycle, validate outputs, and write approved results back to business data.
2. A user talks with Rich on the home screen and sometimes wants to open a Hermes conversation like a Codex thread. Hermes should keep a long-running session and may inspect files, run tests, browse, or use selected MCP tools, but the conversation itself must not automatically become a Rich project record.

Treating both interactions as the same task creates false completion states, forces every conversation to have a result contract, and risks accidental writes to Rich. Treating a Hermes Agent session as a sequence of unrelated chat turns is also insufficient: Hermes does not reliably receive one persistent native session, and ordinary chat does not express enforceable workspace, Shell, browser, and MCP permissions.

The existing server already persists `chat_conversations`, `chat_messages`, conversation summaries, and Hermes `session_id`. The structured task implementation already persists task snapshots and dispatches Hermes or Multica through a shared protocol. The design should reuse both foundations without merging their lifecycle rules.

## Decision

Rich will expose two first-class interaction modes in the existing chat surface:

| Dimension | Hermes Agent session | Structured task |
| --- | --- | --- |
| `mode` | `agent_session` | `task` |
| Typical use | Explore, analyze, develop, test, revise through dialogue | Deliverable, development, test, or another bounded scenario |
| Lifecycle | Active or archived conversation; each turn may fail independently | Queued, running, waiting, succeeded, failed, cancelled, reviewed |
| Context | Conversation transcript, summary, attachments, optional workspace | Scenario context snapshot frozen at publication, plus prior task history |
| Result contract | None | Scenario-defined result and evidence contract |
| Business writeback | Never automatic | Only through scenario-scoped tools and policy |
| Default executor | Hermes | User-selected Hermes or Multica |

Executor selection is orthogonal to mode and scenario. Hermes is the default interactive runtime. Multica remains available for structured work that benefits from internal delegation; it is not required for the first free-conversation release.

## Hermes Agent session contract

Each Agent conversation has a small configuration record separate from its transcript:

```ts
export type AgentInteractionMode = "chat" | "agent_session" | "task";
export type AgentExecutor = "hermes" | "multica";
export type AgentPermissionProfile =
  | "chat_only"
  | "workspace_agent"
  | "extended_agent";

export interface AgentConversationConfig {
  conversationId: string;
  executor: AgentExecutor;
  permissionProfile: AgentPermissionProfile;
  workspaceRoot?: string;
  allowedMcpServers: string[];
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}
```

The transcript continues to use `ChatConversationsRepo`; a new `AgentConversationConfigRepo` stores only Agent-specific policy. The latest successful assistant message remains the source of the Hermes `modelSessionId`. If Hermes loses that session, Rich starts a replacement session with the stored summary and recent transcript rather than losing the conversation.

There is no separate Free Agent page. The home chat and global chat overlay show the same conversation and the same active Hermes session. Starting an Agent session changes the behavior of the current Rich conversation until the user exits or starts another session.

## Slash command entry

Typing `/` in either Rich chat input opens one shared command menu. The initial conversation commands are:

- `/chat` — ordinary Rich conversation; no persistent Agent execution state.
- `/agent` — start or resume a persistent Hermes Agent session in the current Rich conversation.
- `/task` — enter structured-task publication and select a scenario/target before dispatch.
- `/find` — search and navigate to a Rich application or element; this preserves the existing slash-search behavior.

Selecting `/agent` consumes the command; it is not sent to the model as user prose. Rich creates an Agent configuration, starts a Hermes session, and displays an inline session marker above the composer. The user then writes the actual request normally. Every later message uses the same Hermes `session_id` without re-running the general intent classifier.

`/chat` exits Agent mode but retains the transcript and session metadata for later resume. `/agent new` explicitly starts a new Hermes session; plain `/agent` resumes the most recent session when one exists. `/task` does not implicitly convert the whole conversation: Rich shows the scenario/target confirmation before freezing selected context.

Only one turn may execute at a time for a conversation. A failed or interrupted turn is recorded as a turn failure and does not close the conversation.

## Permission model

The user chooses a profile before an Agent can act:

- `chat_only`: model inference and response only; no filesystem, Shell, browser, network, or mutating MCP tools.
- `workspace_agent`: read/write inside one canonical workspace root and run allowlisted development commands or tests.
- `extended_agent`: `workspace_agent` plus explicitly selected browser/network capabilities and MCP servers.

Profiles are enforced by an `AgentCapabilityGateway`, not only by system prompts. It issues a turn-scoped capability grant containing the canonical workspace root, allowed tool families, allowed MCP servers, expiry, and conversation/turn IDs. Every Rich-provided tool validates that grant.

Native Hermes tools are a separate trust boundary. Before enabling `workspace_agent` or `extended_agent`, the Hermes runtime adapter must prove that it can enforce the requested per-session tool set and filesystem boundary. If it cannot, Rich returns a capability-unavailable error and keeps the conversation in `chat_only`; prompt-only restrictions are not accepted as enforcement.

The following actions always require a distinct user approval even in `extended_agent`:

- destructive or broad filesystem changes;
- access outside the selected workspace;
- system-wide package installation;
- Git push, deployment, or release;
- sending messages or changing external systems;
- writing project, deliverable, or other Rich business records.

Permission changes apply to later turns. They are audit events and never silently escalate an already-running turn.

## Runtime flow

```text
`/agent` selection in the existing chat composer
    |
    v
Start/resume Agent session and show inline status
    |
    v
User message
    |
    v
AgentConversationService -- load transcript/config --> ChatConversationsRepo
    |
    +-- serialize conversation turn
    +-- resolve permission profile
    +-- issue turn-scoped capability grant
    v
AgentRuntimePort (Hermes first)
    |
    +-- stream text/tool/progress events
    +-- persist returned session_id
    +-- audit tool requests and approvals
    v
Assistant message + turn outcome
```

An active Agent session bypasses the current chat intent classifier. The user has already selected the mode, so Rich must not reclassify later development turns into unrelated scenarios. Ordinary `/chat` messages continue to use the current planning and routing behavior.

## Promotion and writeback

Free conversation has two explicit exits:

1. **Convert to task:** the user selects a structured scenario, target object, instructions, and acceptance criteria. Rich freezes a promotion snapshot containing the conversation summary, selected message IDs, attachment references, workspace artifact references, and the user's latest goal. The scenario registry then validates and publishes a normal structured task.
2. **Save to Rich:** the user chooses an exact Rich destination and preview. The write is performed as a separately approved scenario action; conversation text is never copied into business data automatically.

Promotion does not duplicate the full transcript by default. It stores immutable references plus a generated summary and selected evidence so the resulting task remains bounded and auditable.

## Shared scenario architecture

Structured tasks will use a scenario registry rather than embedding deliverable assumptions in the dispatcher:

```ts
export interface AgentTaskScenario<Input, Snapshot, Result> {
  id: string;
  parseInput(value: unknown): Input;
  buildSnapshot(input: Input): Promise<Snapshot>;
  permissionPolicy: TaskPermissionPolicy;
  resultContract: ResultContract<Result>;
  validateResult(result: Result, snapshot: Snapshot): Promise<void>;
}
```

`deliverable_analysis` is the first registered scenario. Future `software_development` and `software_test` scenarios use the same publish/dispatch/status protocol but provide different context builders, capability policies, result contracts, and writeback rules. The dispatcher knows only the scenario ID and executor; it does not contain scenario-specific code.

## API boundary

The Agent session API extends the existing chat boundary instead of creating a separate conversation product:

- `POST /api/chat/conversations/:id/agent-session` starts or resumes Hermes and returns session state.
- `POST /api/chat/conversations/:id/agent-session/new` closes the active binding and starts a new Hermes session.
- `DELETE /api/chat/conversations/:id/agent-session` exits Agent mode without deleting its transcript.
- `GET /api/chat/conversations/:id/agent-session` returns mode, executor, permissions, workspace, capability availability, and recovery state.
- `POST /api/chat/stream` continues to stream messages; when the conversation has an active Agent session it resolves the stored Hermes session and bypasses turn classification.
- `POST /api/chat/conversations/:id/promote` previews or publishes a structured task.
- `POST /api/chat/conversations/:id/save-to-rich` previews or performs an approved Rich write.

Every response includes the conversation ID and turn ID. Tool, approval, progress, text, completion, and error are distinct SSE events so the UI does not infer tool activity from prose.

## Consequences

### Positive

- Conversational work is not forced into an artificial task lifecycle.
- The existing Rich home conversation remains the only chat interface.
- Existing transcript persistence and Hermes session continuation are reused.
- Scenario-specific business rules remain modular.
- Rich writeback is explicit and auditable.
- Permission enforcement has a fail-closed boundary.

### Costs and risks

- A capability gateway and approval protocol add implementation work.
- Hermes per-session native-tool enforcement must be verified before broad Agent profiles can ship.
- Long conversations require summary compaction and session recovery testing.
- Concurrency locking is needed to avoid two simultaneous turns corrupting session order.

## Rejected alternatives

- **Use prompt instructions as permissions:** rejected because the model can misunderstand or ignore them and native tools would remain reachable.
- **Store Agent configuration in message metadata only:** rejected because querying current policy and auditing changes would be fragile.
- **Automatically turn every conversation into an `mcp_task`:** rejected because exploration has no meaningful terminal result or review contract.
- **Automatically write useful answers into Rich:** rejected because destination and business meaning require explicit user intent.

## Acceptance criteria

- A Hermes Agent session survives Rich and Hermes restarts without losing its transcript.
- Typing `/` in the home input and global overlay shows the same keyboard-accessible mode menu.
- Selecting `/agent` starts or resumes a Hermes session without sending `/agent` as model text.
- Once Agent mode is active, later messages keep the same Hermes session until `/chat`, `/agent new`, or an explicit exit.
- Hermes continues the same session when possible and recovers from a lost session using Rich context.
- `chat_only` cannot invoke any tool in an integration test.
- Broader profiles are unavailable unless runtime enforcement is proven.
- No conversation turn can modify Rich business data without a separate approval or promotion action.
- A promoted conversation produces a normal scenario task with frozen, auditable context.
