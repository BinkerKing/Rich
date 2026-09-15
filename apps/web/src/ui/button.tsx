import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn.js";

type Variant = "primary" | "secondary" | "ghost" | "danger";
export function Button({ className, variant = "secondary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const variants: Record<Variant, string> = {
    primary: "bg-rich-accent text-white hover:bg-[#9b9df0]",
    secondary: "border border-rich-border bg-rich-raised text-rich-text hover:bg-[#27272e]",
    ghost: "text-rich-muted hover:bg-rich-raised hover:text-rich-text",
    danger: "border border-red-400/30 bg-red-400/10 text-red-200 hover:bg-red-400/20",
  };
  return <button type="button" className={cn("inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rich-accent disabled:pointer-events-none disabled:opacity-50", variants[variant], className)} {...props} />;
}
