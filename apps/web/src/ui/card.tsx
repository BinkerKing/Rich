import type { HTMLAttributes } from "react";
import { cn } from "./cn.js";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-rich-border bg-rich-surface text-rich-text", className)} {...props} />;
}
