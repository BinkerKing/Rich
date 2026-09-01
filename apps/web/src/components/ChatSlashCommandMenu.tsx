import type { ChatSlashCommand } from "../lib/chatSlashCommands.js";
import "./ChatSlashCommandMenu.css";

export function ChatSlashCommandMenu({ commands, activeIndex, onChoose }: {
  commands: ChatSlashCommand[];
  activeIndex: number;
  onChoose(command: ChatSlashCommand): void;
}) {
  if (commands.length === 0) return null;
  return (
    <div className="chat-command-menu" role="listbox" aria-label="对话类型">
      <header><span>/</span><strong>选择 Rich 对话类型</strong><small>↑↓ 选择 · Enter 确认</small></header>
      <div className="chat-command-menu__items">
        {commands.map((command, index) => (
          <button key={command.id} type="button" role="option" aria-selected={index === activeIndex}
            className={index === activeIndex ? "is-active" : ""}
            onMouseDown={event => event.preventDefault()} onClick={() => onChoose(command)}>
            <code>{command.token}</code>
            <span><strong>{command.label}</strong><small>{command.hint}</small></span>
          </button>
        ))}
      </div>
    </div>
  );
}
