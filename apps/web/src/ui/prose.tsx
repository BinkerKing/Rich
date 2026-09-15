import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "./cn.js";

export const Prose = forwardRef<HTMLElement, ComponentPropsWithoutRef<"article">>(function Prose({ className, ...props }, ref) {
  return <article ref={ref} className={cn("rich-prose workflow-rich-content", className)} {...props} />;
});
