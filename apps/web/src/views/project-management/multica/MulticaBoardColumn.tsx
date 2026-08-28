import type { DragEvent, ReactNode } from "react";
import type { MulticaIssue, MulticaStatus } from "../../../api/client.js";
import { MulticaBoardCard } from "./MulticaBoardCard.js";

export function MulticaBoardColumn({ status, issues, selectedId, onSelect, onCreate, onDragStart, onDrop }: {
  status: MulticaStatus;
  issues: MulticaIssue[];
  selectedId: string;
  onSelect: (issueId: string) => void;
  onCreate: (status: string) => void;
  onDragStart: (issue: MulticaIssue, event: DragEvent<HTMLElement>) => void;
  onDrop: (status: string, target: { beforeId?: string; edge?: "bottom" }, event: DragEvent<HTMLElement>) => void;
}): ReactNode {
  return <section className="multica-workbench__column" style={{ "--status-color": status.color ?? "#748099" } as React.CSSProperties}>
    <header className="multica-workbench__column-head"><span><i /><strong>{status.name}</strong><em>{issues.length}</em></span><button type="button" onClick={() => onCreate(status.id)} aria-label={`在${status.name}创建任务`}>＋</button></header>
    <div className="multica-workbench__column-body" onDragOver={event => event.preventDefault()} onDrop={event => onDrop(status.id, { edge: "bottom" }, event)}>
      {issues.length === 0
        ? <button type="button" className="multica-workbench__empty" onClick={() => onCreate(status.id)}><b>□</b><span>暂无任务</span><small>点击＋创建任务</small></button>
        : issues.map(issue => <MulticaBoardCard key={issue.id} issue={issue} selected={selectedId === issue.id} onSelect={() => onSelect(issue.id)} onDragStart={event => onDragStart(issue, event)} onDropBefore={event => { event.stopPropagation(); onDrop(status.id, { beforeId: issue.id }, event); }} />)}
    </div>
  </section>;
}
