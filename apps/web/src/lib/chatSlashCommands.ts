export type ChatSlashCommandId = "chat" | "agent" | "task" | "find";

export interface ChatSlashCommand {
  id: ChatSlashCommandId;
  token: string;
  label: string;
  hint: string;
}

export const CHAT_SLASH_COMMANDS: ChatSlashCommand[] = [
  { id: "chat", token: "/chat", label: "普通对话", hint: "退出 Agent Session，回到 Rich 智能对话" },
  { id: "agent", token: "/agent", label: "Hermes Agent", hint: "开启或恢复一段有上下文的执行会话" },
  { id: "task", token: "/task", label: "结构化任务", hint: "按场景发布可跟踪、可审核的正式任务" },
  { id: "find", token: "/find", label: "搜索 / 选择", hint: "查找 Rich 应用、项目和知识元" },
];

export interface ParsedChatSlashInput {
  open: boolean;
  query: string;
  matches: ChatSlashCommand[];
  selected?: { command: ChatSlashCommandId; argument?: string };
}

export function parseChatSlashInput(value: string): ParsedChatSlashInput {
  if (!value.startsWith("/") || value.includes("\n")) return { open: false, query: "", matches: [] };
  const raw = value.slice(1);
  const trimmed = raw.trim();
  const [head = "", ...tail] = trimmed.split(/\s+/);
  const selectedCommand = CHAT_SLASH_COMMANDS.find(command => command.id === head.toLowerCase());
  const query = selectedCommand ? "" : trimmed.toLowerCase();
  const directMatches = CHAT_SLASH_COMMANDS.filter(command => !query || command.id.startsWith(query));
  const matches = selectedCommand
    ? [selectedCommand]
    : directMatches.length > 0
      ? directMatches
      : CHAT_SLASH_COMMANDS.filter(command => `${command.label} ${command.hint}`.toLowerCase().includes(query));
  const hasArgumentMode = /^\/\S+\s/.test(value);
  return {
    open: !hasArgumentMode,
    query,
    matches,
    selected: selectedCommand
      ? { command: selectedCommand.id, ...(tail.length > 0 ? { argument: tail.join(" ") } : {}) }
      : undefined,
  };
}
