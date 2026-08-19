# Rich AI Engine Refactor

## Current AI Entrypoints

- `POST /api/chat` and `POST /api/chat/stream`: home page chat and quick chat. This route currently talks to Hermes directly and only falls back to Codex.
- `POST /api/ai/*`: structured AI operations including Great Me, plan decomposition, project practice, knowledge-tree generation/refinement, reviews, daily news, and ask/analyze flows.
- `POST /api/mindmaps/generate` plus image retry paths: mindmap generation and queued cover/image generation.
- MCP tools under `/mcp`: agent-facing Rich operations such as refine, expand, extend, news generation, plan decomposition, PRD drafting, and child adjustment.

## Migration Direction

- Centralize model selection by scenario, not by adapter array order.
- Keep Hermes as the default agent/task layer while making Codex, Claude Code, Bailian, and future providers pluggable.
- Add server-side conversation persistence for Rich chat so home chat and quick chat can share durable context.
- Migrate every AI caller through the same engine contract, then remove direct Hermes calls from `routes/chat.ts`.

## Scenario Defaults

- `chat`, `agent-task`, `content`, `analysis`, `document`, `data`, `planning`, `review`, `project-practice`, `knowledge`: Hermes by default.
- `coding`, `mindmap`, `image`: Codex by default.

Each scenario can be overridden with `RICH_AI_<SCENARIO>_MODEL`, or globally with `RICH_AI_DEFAULT_MODEL`.

## Bailian / DashScope

Rich registers a `bailian` adapter through the OpenAI-compatible protocol.
Keep credentials outside Git, for example in `~/.rich-ai.env`:

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
