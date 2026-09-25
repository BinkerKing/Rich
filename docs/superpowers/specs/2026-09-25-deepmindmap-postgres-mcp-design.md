# DeepMindMap Postgres persistence and Codex MCP

## Goal

Make standalone DeepMindMap documents server-persistent and operable from their own Codex sessions. A session must receive the full map, the applicable MCP rules, and the initial task to organize the map's requirements and source material into the root-node detail.

## Storage boundary

- `deep_mindmaps` is a Postgres-only table: `id`, `title`, `map_json JSONB`, `created_at`, and `updated_at`.
- The app uses `DEEP_MINDMAP_DATABASE_URL` when supplied; when the main Rich storage is already Postgres it reuses that pool. If neither is available, the API returns an explicit unavailable error.
- There is no SQLite table, SQLite repository, localStorage write fallback, or dual write.
- Existing `rich.deep-workbench.v1` data is read once only for migration. Local-only IDs absent from Postgres are imported; an ID already present on the server remains server-authoritative. The legacy key is cleared only after every item has been accepted or already exists on the server.
- Knowledge-tree projections remain knowledge-tree data and are not inserted into `deep_mindmaps`.

## API and client behavior

- Add a Postgres repository and routes to list, fetch, create, replace, and remove standalone maps.
- `DeepWorkbenchView` loads its standalone list from the API, uses server updates for every edit, and blocks the standalone list/editor with a clear Postgres-required message if the API is unavailable.
- Local browser state may be used only during the one-time import. It is never the active store after this change.

## Codex sessions

- Add resource type `deepmindmap` and route `/deep-mindmaps/:id/conversations/ensure-bound`.
- Opening Codex for a standalone map creates or reopens that map's dedicated bound session. It is distinct from MindPPT, knowledge-tree mindmaps, and generic sessions.
- The context service reads the complete map JSON from Postgres and injects the tree, node details, map ID, and content version before the first user turn.
- The session rule set requires the dedicated MCP to read current state before relying on a snapshot; it must write requested map changes through the MCP.
- Its initial task is: “梳理该思维导图的需求和资料信息，放在主节点详情中展示，注意排版。” The task is supplied as session context; it does not mutate the map until Codex performs the MCP write.

## Dedicated MCP

`rich_deep_mindmap_manage` operates only on Postgres-backed standalone maps. It exposes:

- `get` — retrieve the complete map and root-node detail.
- `update_node` — update a node title, body/detail, or presentation fields.
- `create_node` and `delete_node` — make structural changes with the normal destructive confirmation rule.
- `update_root_details` — write formatted content to the root node detail for the initial organization task.

Every write reads the saved map back and returns verification data. The MCP never calls, aliases, or modifies `rich_mindmap_manage`, which remains a knowledge-tree tool.

## Error handling

- Missing Postgres configuration: return `DeepMindMap requires Postgres`; the UI shows this as a storage availability issue.
- Missing map: return 404 and do not create a session.
- Version conflict: reject the stale client update and reload the server copy rather than overwrite it.
- The Codex opener reports a Codex-specific error, never a knowledge-tree synchronization error.

## Verification

- Repository and route tests cover Postgres CRUD, explicit unavailable behavior, one-time migration input, and stale-version rejection.
- MCP tests cover full-map read, root-detail write, structural write confirmation, and read-back verification.
- Codex context tests assert the injected full snapshot, dedicated MCP name, maintenance rule, and initial task.
- Web tests cover API-backed loading, no localStorage persistence fallback, and the dedicated session route.
