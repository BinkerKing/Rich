import type { HTMLAttributes } from "react";
import { cn } from "./cn.js";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex h-6 items-center rounded-md border border-rich-border bg-rich-raised px-2 text-xs font-medium text-rich-muted", className)} {...props} />;
}
