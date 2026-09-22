export type DeliverableCodexMode = "free";
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
  isBound?: boolean;
  contextVersion?: string;
  lastContextSyncAt?: string;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
}

export interface DeliverableCodexConversationRepo {
  create(conversation: DeliverableCodexConversation): Promise<void>;
  get(id: string): Promise<DeliverableCodexConversation | null>;
  listAllActive(): Promise<DeliverableCodexConversation[]>;
  listActive(scopeKey: string): Promise<DeliverableCodexConversation[]>;
  getBound(scopeKey: string): Promise<DeliverableCodexConversation | null>;
  bind(id: string, at: string): Promise<DeliverableCodexConversation | null>;
  rename(id: string, title: string, at: string): Promise<DeliverableCodexConversation | null>;
  touch(id: string, at: string): Promise<DeliverableCodexConversation | null>;
  archive(id: string, at: string): Promise<DeliverableCodexConversation | null>;
  setCodexThread(id: string, threadId: string | undefined, contextVersion: string | undefined, at: string): Promise<void>;
  markContextSynced(id: string, at: string): Promise<void>;
}
