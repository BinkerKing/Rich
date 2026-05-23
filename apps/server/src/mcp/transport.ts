import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildMcpServer, type BuildMcpDeps } from "./server.js";

/**
 * Mount the Rich MCP server at `/mcp` of the parent Hono app.
 *
 * Transport: Web-standard Streamable HTTP, stateless mode.
 *   - Stateless = no per-session state. Every Hermes request lands here
 *     fresh; the McpServer holds tool definitions, the transport just
 *     does protocol-level framing (JSON-RPC over POST + SSE for streams).
 *   - For Rich's use case (single user, single agent, low connection
 *     count) stateless is plenty. Sessions only matter for multi-tenant
 *     deployments.
 *
 * Hermes config side:
 *   mcp_servers:
 *     rich:
 *       url: http://127.0.0.1:<port>/mcp
 */
export function mountMcp(parent: Hono, deps: BuildMcpDeps): void {
  // The McpServer (tool definitions) is built once — it's pure state-free
  // logic. The transport, however, MUST be re-created per request when
  // running in stateless mode (no sessionIdGenerator). The SDK explicitly
  // throws "Stateless transport cannot be reused" if a single transport
  // sees more than one request. So we pair every incoming HTTP request
  // with a fresh transport.
  const server = buildMcpServer(deps);

  parent.all("/mcp", async (c) => {
    const transport = new WebStandardStreamableHTTPServerTransport({
      // No sessionIdGenerator → stateless, one-shot.
      enableJsonResponse: true, // Plain JSON response when no streaming needed.
    });
    await server.connect(transport);
    try {
      return await transport.handleRequest(c.req.raw);
    } finally {
      // Close the transport so the server doesn't keep accumulating
      // dangling connections.
      try { await transport.close(); } catch { /* ignore */ }
    }
  });
}
