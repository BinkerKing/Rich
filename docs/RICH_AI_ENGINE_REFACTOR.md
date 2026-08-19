# Rich AI Engine Refactor

## Current AI Entrypoints

- `POST /api/chat` and `POST /api/chat/stream`: home page chat and quick chat. These routes now persist conversation context and choose the chat model through the scenario router. Hermes still keeps the richest agent/tool progress path; non-Hermes adapters use the shared AI adapter contract.
- `GET /api/chat/conversations` and `GET /api/chat/conversations/:id/messages`: durable chat history retrieval for UI history and future cross-device context.
- `POST /api/ai/*`: structured AI operations including Great Me, plan decomposition, project practice, knowledge-tree generation/refinement, reviews, daily news, and ask/analyze flows. Each operation is routed by scenario.
- `POST /api/mindmaps/generate` plus image retry paths: mindmap generation and queued cover/image generation. Mindmap and image scenarios default to Codex.
- MCP tools under `/mcp`: agent-facing Rich operations such as refine, expand, extend, news generation, plan decomposition, PRD drafting, and child adjustment. MCP tools share the same scenario router instead of relying on adapter registration order.
- `GET /api/admin/engine`: health, operation stats, recent errors, and scenario-to-adapter routing.

## Migration Direction

- Centralize model selection by scenario, not by adapter array order.
- Keep Hermes as the default agent/task layer while making Codex, Claude Code, Bailian, and future providers pluggable.
- Keep server-side conversation persistence for Rich chat so home chat and quick chat can share durable context.
- Preserve direct Hermes streaming only where Hermes-specific tool progress or multimodal pass-through is needed; otherwise prefer the shared adapter contract.
- Add future provider adapters as OpenAI-compatible adapters first when possible.

## Scenario Defaults

- `chat`, `agent-task`, `content`, `analysis`, `document`, `data`, `planning`, `review`, `project-practice`, `knowledge`: Hermes by default.
- `coding`, `mindmap`, `image`: Codex by default.

Each scenario can be overridden in Backstage -> AI engine monitor. Rich persists non-secret routing preferences to `data/ai-engine-settings.json`.
Environment variables still work:

- `RICH_AI_<SCENARIO>_MODEL`
- `RICH_AI_DEFAULT_MODEL`

Request-level model selection has the highest priority, then persisted settings, then environment variables, then built-in defaults.

## Bailian / DashScope

Rich registers a `bailian` adapter through the OpenAI-compatible protocol.
Keep credentials outside Git, for example in `~/.rich-ai.env`. `Rich.app` loads this file at startup, alongside the database env file:

```bash
DASHSCOPE_API_KEY=...
DASHSCOPE_MODEL=qwen-plus
# Optional:
# DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

Then route a scenario to Bailian, for example:

```bash
RICH_AI_CHAT_MODEL=bailian
RICH_AI_ANALYSIS_MODEL=bailian
```

Do not commit Token Plan installer commands, API keys, or provider-specific secret tokens. The code only contains provider names and env variable names.

## Current Implementation Notes

- Chat context is stored in `chat_conversations` and `chat_messages`. The stream API appends the latest user message, reads recent messages, injects the Rich system prompt, and persists the assistant reply after completion.
- Scenario routing can be inspected in Backstage -> AI engine monitor, or through `GET /api/admin/engine`.
- Scenario routing can be changed with `PUT /api/admin/engine/settings`. Only adapter names are stored; provider credentials are never stored in this file.
- The first-provider priority is no longer the AI policy. Adapter registration only defines what exists; `RICH_AI_<SCENARIO>_MODEL` decides what is used.
- Hermes remains valuable when Rich needs agent behavior: MCP tool usage, progress events, and task execution. Direct model providers such as Bailian are better for normal Q&A, summarization, document/data analysis, and content generation when tool use is not needed.

## Remaining Work

- Add a user-facing model switcher in Backstage after configuration persistence is designed.
- Persist model/provider preferences in Rich settings rather than only environment variables.
- Extend the adapter contract if we need first-class multimodal messages outside Hermes.
- Add usage logging per provider/model after cost tracking requirements are clear.
