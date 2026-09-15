import type { ReactNode } from "react";
import { cn } from "./cn.js";

export function DocumentLayout({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return <div className={cn("mx-auto grid w-full max-w-[1064px] grid-cols-[minmax(0,780px)_220px] justify-center gap-16 max-[1080px]:block max-[1080px]:max-w-[780px]", className)}>{children}{aside}</div>;
}
