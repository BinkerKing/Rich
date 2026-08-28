export interface MulticaBoardStatusLike {
  id: string;
  name: string;
  position?: number;
  category?: string | null;
  color?: string | null;
}

export interface MulticaBoardIssueLike {
  id: string;
  title: string;
  status: string;
  position?: number;
}

const BASE_STATUSES: MulticaBoardStatusLike[] = [
  { id: "backlog", name: "待规划", category: "backlog", color: "#8b94a7", position: 0 },
  { id: "todo", name: "待办", category: "unstarted", color: "#6ea8fe", position: 1 },
  { id: "in_progress", name: "进行中", category: "started", color: "#f5a524", position: 2 },
  { id: "in_review", name: "审核中", category: "started", color: "#55c2a3", position: 3 },
  { id: "done", name: "已完成", category: "completed", color: "#4387ff", position: 4 },
  { id: "blocked", name: "已阻塞", category: "canceled", color: "#e25555", position: 5 },
  { id: "cancelled", name: "已取消", category: "canceled", color: "#697386", position: 6 },
];

export function buildMulticaStatuses(serverStatuses: MulticaBoardStatusLike[], issues: MulticaBoardIssueLike[]): MulticaBoardStatusLike[] {
  const server = new Map(serverStatuses.map(status => [status.id, status]));
  const statuses = BASE_STATUSES.map(base => ({ ...base, ...server.get(base.id) }));
  const known = new Set(statuses.map(status => status.id));
  const candidates: MulticaBoardStatusLike[] = [...serverStatuses, ...issues.map(issue => ({ id: issue.status, name: issue.status }))];
  const additions = candidates
    .filter(status => !known.has(status.id))
    .filter((status, index, all) => all.findIndex(candidate => candidate.id === status.id) === index)
    .map((status, index) => ({ ...status, position: status.position ?? statuses.length + index }));
  return [...statuses, ...additions].sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
}

export function groupMulticaIssues<T extends MulticaBoardIssueLike>(issues: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const issue of issues) groups.set(issue.status, [...(groups.get(issue.status) ?? []), issue]);
  for (const [status, values] of groups) groups.set(status, values.sort((left, right) => (left.position ?? 0) - (right.position ?? 0)));
  return groups;
}

export type MulticaDropCommand =
  | { kind: "status"; issueId: string; status: string }
  | { kind: "reorder"; issueId: string; beforeId?: string; afterId?: string; edge?: "top" | "bottom" };

export function planMulticaDrop(input: { issueId: string; fromStatus: string; toStatus: string; beforeId?: string; afterId?: string; edge?: "top" | "bottom" }): MulticaDropCommand[] {
  if (input.fromStatus !== input.toStatus) return [{ kind: "status", issueId: input.issueId, status: input.toStatus }];
  return [{ kind: "reorder", issueId: input.issueId, ...(input.beforeId ? { beforeId: input.beforeId } : {}), ...(input.afterId ? { afterId: input.afterId } : {}), ...(input.edge ? { edge: input.edge } : {}) }];
}

/** Temporary compatibility for the old Todo section; removed with the Multica board component. */
export type TodoBoardStatus = "planned" | "todo" | "doing" | "review" | "done";
export function normalizeBoardStatus(value: Record<string, unknown>): TodoBoardStatus {
  const status = typeof value.status === "string" ? value.status : "todo";
  return (["planned", "todo", "doing", "review", "done"] as string[]).includes(status) ? status as TodoBoardStatus : "todo";
}
