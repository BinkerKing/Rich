import { cn } from "./cn.js";

export type TableOfContentsItem = { id: string; title: string; level: number };

export function TableOfContents({ items, activeId, onSelect, label = "目录", className }: { items: TableOfContentsItem[]; activeId?: string | null; onSelect: (item: TableOfContentsItem) => void; label?: string; className?: string }) {
  return <nav className={cn("sticky top-[18px] grid self-start gap-0.5 border-l border-[#3a3a42] py-0.5 pl-4 max-[1080px]:hidden", className)} aria-label={label}>
    <p className="mb-1.5 text-[11px] font-semibold tracking-[0.06em] text-[#aaaab4]">{label}</p>
    {items.map(item => <button type="button" key={item.id} className={cn("min-h-7 overflow-hidden border-0 border-l border-l-transparent bg-transparent px-2 py-0.5 text-left text-xs leading-[1.45] text-rich-muted text-ellipsis whitespace-nowrap hover:border-l-[#d4d4dc] hover:text-rich-text", item.level === 2 && "pl-3.5", item.level === 3 && "pl-5", activeId === item.id && "border-l-[#d4d4dc] text-rich-text")} aria-current={activeId === item.id ? "location" : undefined} onClick={() => onSelect(item)}>{item.title}</button>)}
  </nav>;
}
