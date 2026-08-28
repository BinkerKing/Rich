import type Database from "better-sqlite3";
import type { RichToolResponse } from "../mcp-v2/registry/types.js";
import type {
  McpOperationClaim,
  McpOperationRecord,
  McpOperationRepo,
  McpOperationStatus,
} from "./McpOperationRepo.js";

interface OperationRow {
  tool_name: string;
  request_id: string;
  input_hash: string;
  status: McpOperationStatus;
  response_json: string | null;
  created_at: string;
  completed_at: string | null;
}

export class SqliteMcpOperationRepo implements McpOperationRepo {
  constructor(private readonly db: Database.Database) {}

  claim(toolName: string, requestId: string, inputHash: string): McpOperationClaim {
    const result = this.db.prepare(`
      INSERT OR IGNORE INTO mcp_operation_log
        (tool_name, request_id, input_hash, status, response_json, created_at, completed_at)
      VALUES (?, ?, ?, 'pending', NULL, ?, NULL)
    `).run(toolName, requestId, inputHash, new Date().toISOString());
    if (result.changes === 1) return { claimed: true };
    const row = this.db.prepare(`
      SELECT tool_name, request_id, input_hash, status, response_json, created_at, completed_at
      FROM mcp_operation_log
      WHERE tool_name = ? AND request_id = ?
    `).get(toolName, requestId) as OperationRow;
    return { claimed: false, record: hydrateOperation(row) };
  }

  complete(
    toolName: string,
    requestId: string,
    inputHash: string,
    response: RichToolResponse<unknown>,
  ): void {
    this.db.prepare(`
      UPDATE mcp_operation_log
      SET status = 'completed', response_json = ?, completed_at = ?
      WHERE tool_name = ? AND request_id = ? AND input_hash = ? AND status = 'pending'
    `).run(JSON.stringify(response), new Date().toISOString(), toolName, requestId, inputHash);
  }

  abandon(toolName: string, requestId: string, inputHash: string): void {
    this.db.prepare(`
      DELETE FROM mcp_operation_log
      WHERE tool_name = ? AND request_id = ? AND input_hash = ? AND status = 'pending'
    `).run(toolName, requestId, inputHash);
  }
}

function hydrateOperation(row: OperationRow): McpOperationRecord {
  return {
    toolName: row.tool_name,
    requestId: row.request_id,
    inputHash: row.input_hash,
    status: row.status,
    ...(row.response_json
      ? { response: JSON.parse(row.response_json) as RichToolResponse<unknown> }
      : {}),
    createdAt: row.created_at,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
  };
}
