export const TODO_BOARD_STATUSES = ["planned", "todo", "doing", "review", "done"] as const;

export type TodoBoardStatus = typeof TODO_BOARD_STATUSES[number];

export function normalizeBoardStatus(value: Record<string, unknown>): TodoBoardStatus {
  const status = typeof value.status === "string" ? value.status : "";
  return (TODO_BOARD_STATUSES as readonly string[]).includes(status)
    ? status as TodoBoardStatus
    : "todo";
}
