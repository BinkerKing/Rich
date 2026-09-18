import type { ReactNode, UIEvent } from "react";
import "./CollaborativeWorkspaceShell.css";

export function InformationWorkspaceShell({ navigator, locator, main, onMainScroll, sharedScroll = false }: { navigator?: ReactNode; locator?: ReactNode; main: ReactNode; onMainScroll?: (event: UIEvent<HTMLElement>) => void; sharedScroll?: boolean }): ReactNode {
  return <div className="information-workspace">
    {navigator && <nav className="information-workspace__navigator" aria-label="节点导航">{navigator}</nav>}
    <div className="information-workspace__content">
      {sharedScroll ? <main className="information-workspace__main information-workspace__main--shared" onScroll={onMainScroll}>{locator && <nav className="information-workspace__locator information-workspace__locator--shared" aria-label="内容目录">{locator}</nav>}{main}</main> : <><>{locator && <nav className="information-workspace__locator" aria-label="内容目录">{locator}</nav>}</><main className="information-workspace__main" onScroll={onMainScroll}>{main}</main></>}
    </div>
  </div>;
}
