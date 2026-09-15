import type { HTMLAttributes } from "react";
import { cn } from "./cn.js";

export function MetaText({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("whitespace-nowrap text-[11px] text-[#aaaab4]", className)} {...props} />;
}
