import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildMcpV2Server, type BuildMcpV2Deps } from "./server.js";

export interface McpV2TransportOptions {
  onError?: (error: unknown) => void;
  state?: McpTransportState;
}

export interface McpTransportSnapshot {
  startedAt: Date;
  requestsTotal: number;
  lastRequestAt?: Date;
  lastSuccessAt?: Date;
  lastError?: string;
}

const stateValues = new WeakMap<McpTransportState, McpTransportSnapshot>();

export class McpTransportState {
  constructor() {
    stateValues.set(this, { startedAt: new Date(), requestsTotal: 0 });
  }

  get snapshot(): Readonly<McpTransportSnapshot> {
    const value = stateValues.get(this)!;
    return {
      ...value,
      startedAt: new Date(value.startedAt),
      ...(value.lastRequestAt ? { lastRequestAt: new Date(value.lastRequestAt) } : {}),
      ...(value.lastSuccessAt ? { lastSuccessAt: new Date(value.lastSuccessAt) } : {}),
    };
  }
}

function recordRequest(state: McpTransportState): void {
  const value = stateValues.get(state)!;
  value.requestsTotal += 1;
  value.lastRequestAt = new Date();
}

function recordSuccess(state: McpTransportState): void {
  stateValues.get(state)!.lastSuccessAt = new Date();
}

function recordError(state: McpTransportState, error: unknown): void {
  stateValues.get(state)!.lastError = error instanceof Error ? error.message : String(error);
}

export function mountMcpV2(parent: Hono, deps: BuildMcpV2Deps, options: McpV2TransportOptions = {}): void {
  const server = buildMcpV2Server(deps);
  const state = options.state ?? new McpTransportState();
  parent.all("/mcp", async c => {
    recordRequest(state);
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    try {
      await server.connect(transport);
      const response = await transport.handleRequest(c.req.raw);
      recordSuccess(state);
      return response;
    } catch (error) {
      recordError(state, error);
      options.onError?.(error);
      return c.json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal MCP transport error." },
        id: null,
      }, 500);
    } finally {
      try { await transport.close(); } catch { /* transport is already unusable */ }
    }
  });
}
