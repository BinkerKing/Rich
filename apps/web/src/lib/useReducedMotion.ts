/**
 * Rich 首页动画展示系统 v0.1 —— T22 prefers-reduced-motion 检测。
 *
 * React hook 监听系统 `prefers-reduced-motion: reduce` 偏好。
 * 设置变化时立即生效（macOS 系统偏好"减少动态效果"切换无需重启）。
 *
 * 使用方：
 *   const reduced = useReducedMotion();
 *   <streamCharScheduler reduced={reduced} ... />
 *   <VisualBlockRenderer reducedMotion={reduced} ... />
 *
 * 同时也注意：CSS 的 @media (prefers-reduced-motion: reduce) 在 vbr / mascot
 * 等关键组件 CSS 里已经直接 disable animation；hook 是给纯 JS 代码用的。
 */
import { useEffect, useState } from "react";

const MQ = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(MQ).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(MQ);
    const handler = (e: MediaQueryListEvent): void => setReduced(e.matches);
    // 现代浏览器：addEventListener；老 Safari fallback addListener
    if (mql.addEventListener) {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, []);

  return reduced;
}

/** 给非 React 代码读取的版本（同步、不订阅） */
export function isReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(MQ).matches;
}
