import type { ReactNode, UIEvent } from "react";
import "./CollaborativeWorkspaceShell.css";

export function InformationWorkspaceShell({ navigator, locator, main, onMainScroll }: { navigator?: ReactNode; locator?: ReactNode; main: ReactNode; onMainScroll?: (event: UIEvent<HTMLElement>) => void }): ReactNode {
  return <div className="information-workspace">
    {navigator && <nav className="information-workspace__navigator" aria-label="节点导航">{navigator}</nav>}
    <div className="information-workspace__content">
      {locator && <nav className="information-workspace__locator" aria-label="内容目录">{locator}</nav>}
      <main className="information-workspace__main" onScroll={onMainScroll}>{main}</main>
    </div>
  </div>;
}
