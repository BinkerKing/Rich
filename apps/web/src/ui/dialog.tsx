import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "./cn.js";

export function Dialog({ open, onOpenChange, title, children, className }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; if (!dialog) return; if (open && !dialog.open) dialog.showModal(); if (!open && dialog.open) dialog.close(); }, [open]);
  return <dialog ref={ref} className={cn("m-auto w-[min(680px,calc(100vw-32px))] rounded-xl border border-rich-border bg-rich-surface p-0 text-rich-text shadow-2xl backdrop:bg-black/70", className)} onClose={() => onOpenChange(false)}><section><header className="flex items-center justify-between border-b border-rich-border px-5 py-4"><h2 className="text-base font-medium">{title}</h2><button type="button" className="text-rich-muted hover:text-rich-text" aria-label="关闭" onClick={() => onOpenChange(false)}>×</button></header><div className="p-5">{children}</div></section></dialog>;
}
