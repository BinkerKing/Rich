import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import type { AgentPermissionProfile } from "../repos/AgentConversationConfigRepo.js";
import type { AgentCapabilityAction, AgentCapabilityDecision } from "./types.js";

interface CapabilityClaims {
  conversationId: string;
  turnId: string;
  profile: AgentPermissionProfile;
  workspaceRoot?: string;
  allowedMcpServers: string[];
  expiresAt: string;
}

export interface IssueCapabilityInput extends Omit<CapabilityClaims, "expiresAt"> {
  now: string;
  ttlMs: number;
}

export class AgentCapabilityGateway {
  constructor(
    private readonly secret: string,
    private readonly verifyTurnLease?: (turnId: string, now: string) => Promise<boolean>,
  ) {
    if (!secret) throw new Error("Agent capability secret is required");
  }

  issue(input: IssueCapabilityInput): { token: string; expiresAt: string } {
    const expiresAt = new Date(new Date(input.now).getTime() + input.ttlMs).toISOString();
    const claims: CapabilityClaims = {
      conversationId: input.conversationId,
      turnId: input.turnId,
      profile: input.profile,
      workspaceRoot: input.workspaceRoot,
      allowedMcpServers: [...input.allowedMcpServers],
      expiresAt,
    };
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    return { token: `${payload}.${this.sign(payload)}`, expiresAt };
  }

  async authorize(token: string, action: AgentCapabilityAction, now: string): Promise<AgentCapabilityDecision> {
    const claims = this.verify(token);
    if (!claims) return { allowed: false, reason: "invalid capability grant" };
    if (claims.expiresAt <= now) return { allowed: false, reason: "capability grant expired" };
    if (action.turnId && action.turnId !== claims.turnId) return { allowed: false, reason: "capability grant belongs to another turn" };
    if (claims.profile === "chat_only") return { allowed: false, reason: "chat_only does not allow tools" };
    if (!this.verifyTurnLease || !(await this.verifyTurnLease(claims.turnId, now))) {
      return { allowed: false, reason: "Agent turn lease is not active" };
    }

    if (action.family === "filesystem") {
      if (!claims.workspaceRoot || !action.path || !this.isInside(claims.workspaceRoot, action.path)) {
        return { allowed: false, reason: "path is outside the granted workspace" };
      }
      return { allowed: true, requiresApproval: /delete|remove/i.test(action.action) };
    }
    if (action.family === "mcp") {
      const allowed = Boolean(action.server && claims.allowedMcpServers.includes(action.server));
      return allowed
        ? { allowed: true, requiresApproval: /update|write|delete|cancel/i.test(action.action) }
        : { allowed: false, reason: "MCP server is not granted" };
    }
    if (action.family === "shell") {
      return { allowed: true, requiresApproval: /install|push|deploy/i.test(action.action) };
    }
    if (claims.profile === "extended_agent") return { allowed: true, requiresApproval: true };
    return { allowed: false, reason: `${action.family} requires extended_agent` };
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.secret).update(payload).digest("base64url");
  }

  private verify(token: string): CapabilityClaims | null {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return null;
    const expected = Buffer.from(this.sign(payload));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    try {
      return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as CapabilityClaims;
    } catch {
      return null;
    }
  }

  private isInside(workspaceRoot: string, target: string): boolean {
    const lexicalRoot = resolve(workspaceRoot);
    const lexicalTarget = isAbsolute(target) ? resolve(target) : resolve(lexicalRoot, target);
    if (!this.contains(lexicalRoot, lexicalTarget)) return false;

    const canonicalRoot = existsSync(lexicalRoot) ? realpathSync(lexicalRoot) : lexicalRoot;
    let existingAncestor = lexicalTarget;
    while (!existsSync(existingAncestor)) {
      const parent = dirname(existingAncestor);
      if (parent === existingAncestor) return false;
      existingAncestor = parent;
    }
    const canonicalAncestor = realpathSync(existingAncestor);
    return this.contains(canonicalRoot, canonicalAncestor);
  }

  private contains(root: string, target: string): boolean {
    const offset = relative(root, target);
    return offset === "" || (!offset.startsWith("..") && !isAbsolute(offset));
  }
}
