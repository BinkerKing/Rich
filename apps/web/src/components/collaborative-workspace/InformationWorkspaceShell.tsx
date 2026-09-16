import type { ReactNode } from "react";
import "./CollaborativeWorkspaceShell.css";

export function InformationWorkspaceShell({ navigator, locator, main }: { navigator?: ReactNode; locator?: ReactNode; main: ReactNode }): ReactNode {
  return <div className="information-workspace">
    {navigator && <nav className="information-workspace__navigator" aria-label="节点导航">{navigator}</nav>}
    <div className="information-workspace__content">
      {locator && <nav className="information-workspace__locator" aria-label="内容目录">{locator}</nav>}
      <main className="information-workspace__main">{main}</main>
    </div>
  </div>;
}
