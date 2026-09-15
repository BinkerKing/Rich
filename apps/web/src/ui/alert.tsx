import type { HTMLAttributes } from "react";
import { cn } from "./cn.js";

export function Alert({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-100", className)} {...props} />;
}
