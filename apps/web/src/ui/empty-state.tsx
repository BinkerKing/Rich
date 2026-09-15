import type { ReactNode } from "react";
import { cn } from "./cn.js";

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return <section className={cn("grid min-h-[360px] w-full max-w-[840px] place-items-center content-center gap-3 rounded-[10px] border border-rich-border bg-rich-surface px-6 text-center", className)}>
    {icon && <span className="text-[#d8d8de] [&>svg]:size-7 [&>svg]:stroke-[1.5]">{icon}</span>}
    <strong className="text-base font-semibold text-rich-text">{title}</strong>
    {description && <p className="m-0 max-w-[520px] text-[13px] leading-7 text-rich-muted">{description}</p>}
    {action}
  </section>;
}
