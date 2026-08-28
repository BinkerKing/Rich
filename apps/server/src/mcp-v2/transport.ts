import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildMcpV2Server, type BuildMcpV2Deps } from "./server.js";

export interface McpV2TransportOptions {
  onError?: (error: unknown) => void;
}

export function mountMcpV2(parent: Hono, deps: BuildMcpV2Deps, options: McpV2TransportOptions = {}): void {
  const server = buildMcpV2Server(deps);
  parent.all("/mcp", async c => {
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    try {
      await server.connect(transport);
      return await transport.handleRequest(c.req.raw);
    } catch (error) {
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
