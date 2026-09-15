import type { HTMLAttributes } from "react";
import { cn } from "./cn.js";

export function Separator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="separator" className={cn("h-px w-full shrink-0 bg-rich-border", className)} {...props} />;
}
