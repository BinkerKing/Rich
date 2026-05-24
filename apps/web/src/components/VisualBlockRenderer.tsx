import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { maybeFallback } from "../lib/asciiCharFallback.js";
import { detectBlockType, type DetectedBlockType } from "../lib/detectBlockType.js";
export { detectBlockType };
export type { DetectedBlockType };
import "./VisualBlockRenderer.css";

/**
 * Rich 首页动画展示系统 v0.1 —— VisualBlockRenderer (T09)。
 *
 * 渲染 AI 输出的 ASCII 视觉块。支持两种模式：
 *  - stream：边接字符边显示（伴随 fade-in 动画）。用于 chat 流式回答。
 *  - final：直接整版渲染（无动画）。用于历史回看、详情面板。
 *
 * 自动按 detectBlockType 选 className，对应不同动画路径（T10-T14 的各场景）。
 *
 * 等宽字体 fallback：通过 asciiCharFallback 处理，缺 box-drawing 字符时
 * 自动降级到 ASCII 7-bit。
 */

export interface VisualBlockProps {
  /** ASCII 内容（围栏内的原文，不含 ```ascii ... ``` 包裹） */
  ascii: string;
  /** AI 可选给的类型 hint；不给则用 detectBlockType 自动判 */
  hint?: DetectedBlockType;
  /** "stream" 实时；"final" 已完成 */
  mode?: "stream" | "final";
  /** 用户偏好 reduced-motion（T22） */
  reducedMotion?: boolean;
  /** 可选：流模式下，外部驱动「这个块已经写完了」—— 触发 done 动画 */
  done?: boolean;
  /** 可选标题（AI 给的 caption） */
  caption?: string;
  /** 点击放大（T17 三栏历史里点击就 open detail）—— 这里只 emit 给上层 */
  onClick?: () => void;
}

export function VisualBlockRenderer({
  ascii, hint, mode = "final", reducedMotion = false, done = false, caption, onClick,
}: VisualBlockProps): ReactNode {
  const detected = useMemo<DetectedBlockType>(
    () => hint ?? detectBlockType(ascii),
    [hint, ascii],
  );
  const text = useMemo(() => maybeFallback(ascii), [ascii]);
  const rootRef = useRef<HTMLDivElement>(null);
  // stream 模式下，整体在 done 时跑一次 reveal/highlight 动画
  const [animKey, setAnimKey] = useState(0);
  useEffect(() => {
    if (mode === "stream" && done && !reducedMotion) {
      setAnimKey(k => k + 1);
    }
  }, [mode, done, reducedMotion]);

  const className = [
    "vbr",
    `vbr--${detected}`,
    mode === "stream" ? "vbr--streaming" : "vbr--final",
    done ? "is-done" : "",
    reducedMotion ? "is-reduced" : "",
    onClick ? "is-clickable" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className={className} ref={rootRef} onClick={onClick} role={onClick ? "button" : undefined}>
      {caption && <div className="vbr__caption">{caption}</div>}
      <pre className="vbr__pre" key={animKey} data-type={detected}>
        {text}
      </pre>
    </div>
  );
}
