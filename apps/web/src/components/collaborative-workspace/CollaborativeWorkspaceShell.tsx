import { useState, type ReactNode } from "react";
import "./CollaborativeWorkspaceShell.css";

export function CollaborativeWorkspaceShell({ information, conversation }: { information: ReactNode; conversation: ReactNode }): ReactNode {
  const [conversationFocused, setConversationFocused] = useState(false);
  return <section className={`collaborative-workspace ${conversationFocused ? "collaborative-workspace--conversation-focused" : ""}`}>
    <div className="collaborative-workspace__information">{information}</div>
    <aside className="collaborative-workspace__conversation" aria-label="对话">
      <button className="collaborative-workspace__focus" type="button" onClick={() => setConversationFocused(value => !value)} aria-pressed={conversationFocused}>
        {conversationFocused ? "返回工作台" : "专注对话"}
      </button>
      {conversation}
    </aside>
  </section>;
}
