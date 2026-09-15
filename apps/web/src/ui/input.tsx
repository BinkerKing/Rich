import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./cn.js";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn("h-9 w-full rounded-md border border-rich-border bg-rich-surface px-3 text-sm text-rich-text outline-none placeholder:text-rich-muted focus:border-rich-accent focus:ring-1 focus:ring-rich-accent disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />;
});
