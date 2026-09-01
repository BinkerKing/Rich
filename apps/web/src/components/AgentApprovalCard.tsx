import { useState } from "react";
import { api, type AgentApprovalInput } from "../api/client.js";
import "./ConversationTaskPanel.css";

export interface PendingAgentApproval extends Omit<AgentApprovalInput, "approved"> {
  name: string;
  arguments: Record<string, unknown>;
}

export function AgentApprovalCard({ conversationId, approval, onResolved }: {
  conversationId: string;
  approval: PendingAgentApproval;
  onResolved(): void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function resolve(approved: boolean) {
    setBusy(true); setError("");
    try { await api.resolveAgentApproval(conversationId, { ...approval, approved }); onResolved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }
  return <aside className="agent-approval-card" aria-label="Agent 操作审批">
    <small>AGENT APPROVAL REQUIRED</small><strong>{approval.name}</strong>
    <pre>{JSON.stringify(approval.arguments, null, 2)}</pre>
    <p>这项操作需要你的明确确认。</p>{error && <p className="conversation-task-error">{error}</p>}
    <div><button type="button" className="secondary" disabled={busy} onClick={() => void resolve(false)}>拒绝</button><button type="button" disabled={busy} onClick={() => void resolve(true)}>批准并执行</button></div>
  </aside>;
}
