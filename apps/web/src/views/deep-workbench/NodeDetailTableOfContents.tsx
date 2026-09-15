import { nodeDetailToc } from "./nodeDetailToc.js";

export function NodeDetailTableOfContents({ activeId, onSelect }: { activeId: string; onSelect: (id: string) => void }) {
  return <nav className="node-detail-toc" aria-label="本页内容"><p>本页内容</p>{nodeDetailToc.map(item => <button key={item.id} type="button" className={item.id === activeId ? "is-active" : ""} onClick={() => onSelect(item.id)}>{item.label}</button>)}</nav>;
}
