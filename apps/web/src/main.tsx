import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.js";
import "./theme/tokens.css";
import "./theme/themeStore.js";
import "./theme/theme-brutal.css";
import "./theme/theme-blueprint.css";
import "./theme/theme-duotone.css";
import "./theme/theme-fabric.css";
import "./theme/theme-editorial.css";
import "./theme/theme-ghibli.css";

installNavigationSwipeGuard();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>
);

function installNavigationSwipeGuard() {
  window.addEventListener("wheel", (event) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || event.deltaX === 0) return;
    if (canScrollHorizontally(event.target, event.deltaX)) return;
    event.preventDefault();
  }, { passive: false });
}

function canScrollHorizontally(target: EventTarget | null, deltaX: number) {
  let node = target instanceof Element ? target : null;

  while (node && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    const canOverflow = ["auto", "scroll"].includes(style.overflowX);
    const hasHorizontalRoom = node.scrollWidth > node.clientWidth + 1;

    if (canOverflow && hasHorizontalRoom) {
      const maxScrollLeft = node.scrollWidth - node.clientWidth;
      if (deltaX < 0 && node.scrollLeft > 0) return true;
      if (deltaX > 0 && node.scrollLeft < maxScrollLeft) return true;
      return false;
    }

    node = node.parentElement;
  }

  return false;
}
