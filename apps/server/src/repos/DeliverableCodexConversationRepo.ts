export type DeliverableCodexMode = "free" | "task" | "bug";
export type DeliverableCodexConversationStatus = "active" | "archived";

export interface DeliverableCodexConversation {
  id: string;
  conversationId: string;
  scopeKey: string;
  projectId: string;
  deliverableId: string;
  title: string;
  mode: DeliverableCodexMode;
  executor: "codex";
  codexThreadId?: string;
  status: DeliverableCodexConversationStatus;
  contextVersion?: string;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
}

export interface DeliverableCodexConversationRepo {
  create(conversation: DeliverableCodexConversation): Promise<void>;
  get(id: string): Promise<DeliverableCodexConversation | null>;
  listActive(scopeKey: string): Promise<DeliverableCodexConversation[]>;
  touch(id: string, at: string): Promise<DeliverableCodexConversation | null>;
  archive(id: string, at: string): Promise<DeliverableCodexConversation | null>;
  setCodexThread(id: string, threadId: string | undefined, contextVersion: string | undefined, at: string): Promise<void>;
}
