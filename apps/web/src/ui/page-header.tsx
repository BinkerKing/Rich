import type { ReactNode } from "react";
import { cn } from "./cn.js";

export function PageHeader({ icon, title, description, meta, actions, className }: { icon?: ReactNode; title: string; description?: string; meta?: ReactNode; actions?: ReactNode; className?: string }) {
  return <header className={cn("flex min-h-[58px] items-center justify-between gap-5 border-b border-rich-border py-2 pb-4 max-[720px]:items-start max-[720px]:flex-col", className)}>
    <div className="flex min-w-0 items-start gap-3">
      {icon && <span className="mt-0.5 shrink-0 text-[#d8d8de] [&>svg]:size-5 [&>svg]:stroke-[1.8]">{icon}</span>}
      <div className="min-w-0"><h2 className="m-0 text-xl font-semibold tracking-[-0.02em] text-rich-text">{title}</h2>{description && <p className="mt-1.5 max-w-[720px] text-xs leading-relaxed text-[#aaaab4]">{description}</p>}</div>
    </div>
    <div className="flex shrink-0 items-center justify-end gap-2 max-[720px]:w-full max-[720px]:justify-between">{meta}{actions}</div>
  </header>;
}
