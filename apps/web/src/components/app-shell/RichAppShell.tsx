import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/ui/index.js";
import "./RichAppShell.css";

export function RichAppShell({ header, navigation, aside, children, navigationStorageKey = "rich.app-shell.navigation" }: { header: ReactNode; navigation: ReactNode; aside?: ReactNode; children: ReactNode; navigationStorageKey?: string }) {
  const [navigationOpen, setNavigationOpen] = useState(() => localStorage.getItem(navigationStorageKey) !== "closed");
  useEffect(() => { localStorage.setItem(navigationStorageKey, navigationOpen ? "open" : "closed"); }, [navigationOpen, navigationStorageKey]);
  return <div className={`rich-app-shell${navigationOpen ? " is-navigation-open" : ""}`}>
    <header className="rich-app-shell__header"><Button variant="ghost" className="rich-app-shell__navigation-toggle" aria-label="切换导航" aria-pressed={navigationOpen} onClick={() => setNavigationOpen(open => !open)}>☰</Button>{header}</header>
    <aside className="rich-app-shell__navigation" aria-label="主导航">{navigation}</aside>
    <main className="rich-app-shell__main">{children}</main>
    {aside && <aside className="rich-app-shell__aside" aria-label="页面导航">{aside}</aside>}
  </div>;
}
