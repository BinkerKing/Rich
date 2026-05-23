# Rich MCP Server — Hermes Integration

Rich exposes its knowledge tree to external AI agents via the
**Model Context Protocol** (MCP). Mounted at `/mcp` on Rich's main
HTTP server, sharing the SAME in-memory repos and AI adapter as the
Rich UI — so an agent-driven edit lands in the same SQLite the UI
reads from.

## Connecting Hermes

Add to `~/.hermes/config.yaml`:

```yaml
provider: codex                 # use your existing Codex OAuth as the LLM
default: codex

mcp_servers:
  rich:
    url: http://127.0.0.1:31515/mcp
```

> **Port note**: 31515 is the default. If your machine had something
> on that port at Rich startup, Rich auto-shifted up. Check the
> actual URL with:
>
> ```bash
> cat ~/Library/Application\ Support/Rich/data/.mcp-url
> ```

Rich.app must be running for Hermes to reach the MCP server.

## Tools

### Layer 1 — Synchronous data ops

| Tool | What it does |
|------|--------------|
| `list_topics` | Lists all top-level elements |
| `get_element` | Reads one element + sections |
| `get_subtree` | Element + descendants up to `depth` |
| `create_element` | New element (top-level or as child) |
| `update_element` | Patch title / subtitle / domain / content |
| `delete_element` | Cascade delete element + descendants |

### Layer 2 — Fire-and-forget AI ops

Each tool returns `{ task_id, status: "queued", kind }` immediately.
The AI work runs in the background. Poll `get_task({ task_id })`
until `status === "done"` or `"error"`.

| Tool | What it does |
|------|--------------|
| `refine` | Deepen an element's content |
| `expand` | Generate children under a parent |
| `extend` | Generate sibling concepts in a direction |
| `generate_paths` | Build curated learning paths for a center |

### Status helpers

| Tool | What it does |
|------|--------------|
| `get_task` | Status + result for one task_id |
| `list_tasks` | Recent tasks (filter by status / kind) |

## Example Hermes session

```
You: 看一下我的知识库,然后帮我把"高铁科普"细化一下
Hermes (via Codex):
  → tool_call: list_topics()
  ← [{ id: "tour-railway", title: "高铁科普", ... }, ...]
  → tool_call: refine({ element_id: "tour-railway", target_richness: 4 })
  ← { task_id: "mcp-abc123", status: "queued", kind: "refine" }
  → tool_call: get_task({ task_id: "mcp-abc123" })
  ← { status: "running" }
  ... (wait ~30s, poll again) ...
  → tool_call: get_task({ task_id: "mcp-abc123" })
  ← { status: "done", result: { element_id: "tour-railway", content_updated: true } }
You: 写好了!
```

## Implementation notes

- **Transport**: Web Standard Streamable HTTP (stateless mode). Each
  request gets a fresh transport instance — the SDK rejects reuse.
- **Tools**: Defined via `McpServer.tool()` in
  `apps/server/src/mcp/server.ts`. Adding a new tool = 30 lines.
- **Task tracking**: In-memory `Map<taskId, TaskRecord>` in
  `apps/server/src/mcp/tasks.ts`. No persistence — process restart
  drops queued/running tasks.
- **LLM routing**: All Layer 2 tools use Rich's `pickAdapter()`,
  defaulting to whatever Rich.app's index.ts configures. Pass
  `model: "claude-code" | "codex"` in tool args to override.

## Debugging

```bash
# Confirm the MCP URL Rich is publishing
cat ~/Library/Application\ Support/Rich/data/.mcp-url

# List exposed tools (raw JSON-RPC)
curl -X POST $(cat ~/Library/Application\ Support/Rich/data/.mcp-url) \
  -H "Content-Type: application/json" \
  -H "Accept: application/json,text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq .

# Call a tool directly
curl -X POST $(cat ~/Library/Application\ Support/Rich/data/.mcp-url) \
  -H "Content-Type: application/json" \
  -H "Accept: application/json,text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_topics","arguments":{}}}' | jq .
```
