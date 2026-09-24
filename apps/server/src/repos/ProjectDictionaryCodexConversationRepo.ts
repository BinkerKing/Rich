export type ProjectDictionaryCodexConversationStatus = "active" | "archived";

export interface ProjectDictionaryCodexConversation {
  id: string;
  conversationId: string;
  projectId: string;
  title: string;
  executor: "codex";
  codexThreadId?: string;
  status: ProjectDictionaryCodexConversationStatus;
  isBound?: boolean;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
}

export interface ProjectDictionaryCodexConversationRepo {
  create(conversation: ProjectDictionaryCodexConversation): Promise<void>;
  get(id: string): Promise<ProjectDictionaryCodexConversation | null>;
  listActive(projectId: string): Promise<ProjectDictionaryCodexConversation[]>;
  getBound(projectId: string): Promise<ProjectDictionaryCodexConversation | null>;
  bind(id: string, at: string): Promise<ProjectDictionaryCodexConversation | null>;
  touch(id: string, at: string): Promise<ProjectDictionaryCodexConversation | null>;
  archive(id: string, at: string): Promise<ProjectDictionaryCodexConversation | null>;
  setCodexThread(id: string, threadId: string | undefined, at: string): Promise<void>;
}
