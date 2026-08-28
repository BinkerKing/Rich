import type { PgPool } from "../db/postgres.js";
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

export class PostgresMcpOperationRepo implements McpOperationRepo {
  constructor(private readonly pg: PgPool) {}

  async claim(toolName: string, requestId: string, inputHash: string): Promise<McpOperationClaim> {
    await this.pg.ready;
    const inserted = await this.pg.query(`
      INSERT INTO mcp_operation_log
        (tool_name, request_id, input_hash, status, response_json, created_at, completed_at)
      VALUES ($1, $2, $3, 'pending', NULL, $4, NULL)
      ON CONFLICT (tool_name, request_id) DO NOTHING
    `, [toolName, requestId, inputHash, new Date().toISOString()]);
    if ((inserted.rowCount ?? 0) === 1) return { claimed: true };
    const { rows } = await this.pg.query<OperationRow>(`
      SELECT tool_name, request_id, input_hash, status, response_json, created_at, completed_at
      FROM mcp_operation_log
      WHERE tool_name = $1 AND request_id = $2
    `, [toolName, requestId]);
    if (!rows[0]) throw new Error("MCP operation claim conflicted but no record was found.");
    return { claimed: false, record: hydrateOperation(rows[0]) };
  }

  async complete(
    toolName: string,
    requestId: string,
    inputHash: string,
    response: RichToolResponse<unknown>,
  ): Promise<void> {
    await this.pg.ready;
    await this.pg.query(`
      UPDATE mcp_operation_log
      SET status = 'completed', response_json = $1, completed_at = $2
      WHERE tool_name = $3 AND request_id = $4 AND input_hash = $5 AND status = 'pending'
    `, [JSON.stringify(response), new Date().toISOString(), toolName, requestId, inputHash]);
  }

  async abandon(toolName: string, requestId: string, inputHash: string): Promise<void> {
    await this.pg.ready;
    await this.pg.query(`
      DELETE FROM mcp_operation_log
      WHERE tool_name = $1 AND request_id = $2 AND input_hash = $3 AND status = 'pending'
    `, [toolName, requestId, inputHash]);
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
