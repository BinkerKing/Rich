import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentCapabilityGateway } from "../src/agent-conversations/AgentCapabilityGateway.js";

describe("AgentCapabilityGateway", () => {
  it("denies every tool family for chat_only", () => {
    const gateway = new AgentCapabilityGateway("test-secret");
    const grant = gateway.issue({
      conversationId: "c1",
      turnId: "t1",
      profile: "chat_only",
      allowedMcpServers: [],
      now: "2026-09-01T00:00:00.000Z",
      ttlMs: 30_000,
    });

    expect(gateway.authorize(grant.token, { family: "filesystem", action: "read" }, "2026-09-01T00:00:01.000Z").allowed).toBe(false);
    expect(gateway.authorize(grant.token, { family: "mcp", action: "rich.project.update", server: "rich" }, "2026-09-01T00:00:01.000Z").allowed).toBe(false);
  });

  it("rejects expired and cross-turn grants", () => {
    const gateway = new AgentCapabilityGateway("test-secret");
    const grant = gateway.issue({
      conversationId: "c1",
      turnId: "t1",
      profile: "workspace_agent",
      workspaceRoot: "/workspace/project",
      allowedMcpServers: ["rich"],
      now: "2026-09-01T00:00:00.000Z",
      ttlMs: 1_000,
    });

    expect(gateway.authorize(grant.token, { family: "filesystem", action: "read", turnId: "t2", path: "/workspace/project/a.ts" }, "2026-09-01T00:00:00.500Z").allowed).toBe(false);
    expect(gateway.authorize(grant.token, { family: "filesystem", action: "read", turnId: "t1", path: "/workspace/project/a.ts" }, "2026-09-01T00:00:02.000Z").allowed).toBe(false);
  });

  it("rejects traversal and symlink escapes from a workspace", () => {
    const base = mkdtempSync(join(tmpdir(), "rich-capability-"));
    const workspace = join(base, "workspace");
    const outside = join(base, "outside");
    mkdirSync(workspace);
    mkdirSync(outside);
    symlinkSync(outside, join(workspace, "escape"));
    const gateway = new AgentCapabilityGateway("test-secret");
    const grant = gateway.issue({
      conversationId: "c1",
      turnId: "t1",
      profile: "workspace_agent",
      workspaceRoot: workspace,
      allowedMcpServers: [],
      now: "2026-09-01T00:00:00.000Z",
      ttlMs: 30_000,
    });

    expect(gateway.authorize(grant.token, { family: "filesystem", action: "read", path: "../outside/secret.txt" }, "2026-09-01T00:00:01.000Z").allowed).toBe(false);
    expect(gateway.authorize(grant.token, { family: "filesystem", action: "write", path: "escape/new.txt" }, "2026-09-01T00:00:01.000Z").allowed).toBe(false);
    expect(gateway.authorize(grant.token, { family: "filesystem", action: "write", path: "new.txt" }, "2026-09-01T00:00:01.000Z").allowed).toBe(true);
  });
});
