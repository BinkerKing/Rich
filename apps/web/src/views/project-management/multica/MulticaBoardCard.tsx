import type { DragEvent, ReactNode } from "react";
import type { MulticaIssue } from "../../../api/client.js";

export const MULTICA_ATTRIBUTION = "Powered by Multica";

export function MulticaBoardCard({ issue, selected, onSelect, onDragStart, onDropBefore }: {
  issue: MulticaIssue;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDropBefore: (event: DragEvent<HTMLElement>) => void;
}): ReactNode {
  const childCount = Array.isArray(issue.children) ? issue.children.length : Number(issue.child_count ?? 0);
  const completed = Number(issue.completed_child_count ?? 0);
  const labels = Array.isArray(issue.labels) ? issue.labels : [];
  const active = Boolean(issue.active_run ?? issue.run_status === "running");
  return <article
    className={`multica-workbench__card${selected ? " is-selected" : ""}`}
    draggable
    aria-label={`${issue.identifier ?? issue.id} · ${issue.title} · ${MULTICA_ATTRIBUTION}`}
    onClick={onSelect}
    onDragStart={onDragStart}
    onDragOver={event => event.preventDefault()}
    onDrop={onDropBefore}
  >
    <header><span>{issue.identifier ?? issue.id.slice(0, 8)}</span>{active && <i title="Agent 正在执行" />}</header>
    <h3>{issue.title}</h3>
    {issue.description && <p>{issue.description}</p>}
    {labels.length > 0 && <div className="multica-workbench__labels">{labels.map(label => <span key={label.id} style={{ "--label-color": label.color ?? "#748099" } as React.CSSProperties}>{label.name}</span>)}</div>}
    <footer>
      <span className={`priority priority--${issue.priority ?? "none"}`}>{priorityLabel(issue.priority)}</span>
      {childCount > 0 && <span>{completed}/{childCount}</span>}
      <span>{String(issue.assignee_name ?? issue.assignee_id ?? "未分配")}</span>
    </footer>
  </article>;
}

function priorityLabel(value?: string | null): string {
  return ({ urgent: "紧急", high: "高", medium: "中", low: "低", none: "无" } as Record<string, string>)[value ?? "none"] ?? value ?? "无";
}
