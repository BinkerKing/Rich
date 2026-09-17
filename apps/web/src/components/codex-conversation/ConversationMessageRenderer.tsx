import type { ReactNode } from "react";

export type ConversationMessage = {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
  state?: "streaming" | "running" | "awaiting_confirmation" | "succeeded" | "failed" | "cancelled";
  blocks?: ConversationBlock[];
};
export type ConversationBlock =
  | { type: "text"; text: string }
  | { type: "status"; text: string; state: NonNullable<ConversationMessage["state"]> }
  | { type: "proposal"; summary: string; onAccept?: () => void; onReject?: () => void }
  | { type: "table"; columns: string[]; rows: string[][] };
export type ConversationBlockRenderers = Partial<Record<ConversationBlock["type"], (block: never) => ReactNode>>;

export function ConversationMessageRenderer({ message, renderers = {} }: { message: ConversationMessage; renderers?: ConversationBlockRenderers }): ReactNode {
  const blocks = message.blocks ?? [{ type: "text", text: message.content } satisfies ConversationBlock];
  return <article className={`codex-conversation__message is-${message.role} ${message.state ? `is-${message.state}` : ""}`}>
    <div className="codex-conversation__message-content">
      {blocks.map((block, index) => <ConversationBlockRenderer key={index} block={block} renderer={renderers[block.type]} />)}
    </div>
  </article>;
}

function ConversationBlockRenderer({ block, renderer }: { block: ConversationBlock; renderer?: (block: never) => ReactNode }): ReactNode {
  if (renderer) return renderer(block as never);
  if (block.type === "status") return <p className={`codex-conversation__status is-${block.state}`} role="status">{block.text}</p>;
  if (block.type === "proposal") return <section className="codex-conversation__proposal"><strong>工作台更新候选</strong><p>{block.summary}</p><div>{block.onReject && <button onClick={block.onReject}>暂不写入</button>}{block.onAccept && <button className="is-primary" onClick={block.onAccept}>写入工作台</button>}</div></section>;
  if (block.type === "table") return <table className="codex-conversation__table"><thead><tr>{block.columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{block.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>;
  return <p>{block.text}</p>;
}
