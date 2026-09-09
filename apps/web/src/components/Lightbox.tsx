import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./Lightbox.css";

type Payload =
  | { type: "img"; src: string; alt?: string }
  | { type: "svg"; html: string };

/**
 * Global click-to-enlarge for any <img> inside .body-section, plus any <img>
 * with the `.is-zoomable` class (聊天附件 / 历史里的图都加这个类)。
 * 也接受手动触发：window.dispatchEvent(new CustomEvent("ke-lightbox-open", {detail:{src}}))
 * —— 用于那些被 button 包裹、click 事件被吞掉的场景。
 */
export function Lightbox() {
  const [payload, setPayload] = useState<Payload | null>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // <img> inside any section/article in the element panel
      const img = target.closest("img") as HTMLImageElement | null;
      if (img && img.closest(".body-section, .sec-image, .sec-image-pair, .workflow-rich-content")) {
        if (!img.src) return;
        event.preventDefault();
        event.stopPropagation();
        setPayload({ type: "img", src: img.src, alt: img.alt });
        return;
      }
      // 任何带 .is-zoomable 类的 <img> —— 聊天图片附件 / 缩略图 / 历史里的图都用这个
      if (img && img.classList.contains("is-zoomable")) {
        if (!img.src) return;
        event.preventDefault();
        event.stopPropagation();
        setPayload({ type: "img", src: img.src, alt: img.alt });
        return;
      }

      // Mermaid SVG inside the diagram host
      const host = target.closest(".mermaid-diagram__host") as HTMLElement | null;
      if (host) {
        const svg = host.querySelector("svg");
        if (!svg) return;
        event.preventDefault();
        event.stopPropagation();
        setPayload({ type: "svg", html: svg.outerHTML });
      }
    }
    document.addEventListener("click", onClick);
    // 手动触发入口 —— 用于嵌在 button 里的 img，避免 React onClick 吃掉事件
    function onOpenEvent(e: Event) {
      const detail = (e as CustomEvent<{ src?: string; alt?: string; html?: string }>).detail;
      if (!detail) return;
      if (detail.src) setPayload({ type: "img", src: detail.src, alt: detail.alt });
      else if (detail.html) setPayload({ type: "svg", html: detail.html });
    }
    window.addEventListener("ke-lightbox-open", onOpenEvent);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("ke-lightbox-open", onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (!payload) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPayload(null);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [payload]);

  if (!payload || typeof document === "undefined") return null;

  return createPortal(
    <div className="ke-lightbox" role="dialog" aria-modal="true" onClick={() => setPayload(null)}>
      <button
        type="button"
        className="ke-lightbox__close"
        aria-label="关闭"
        onClick={() => setPayload(null)}
      >×</button>
      <div className="ke-lightbox__inner" onClick={event => event.stopPropagation()}>
        {payload.type === "img" ? (
          <img src={payload.src} alt={payload.alt ?? ""} />
        ) : (
          <div className="ke-lightbox__svg" dangerouslySetInnerHTML={{ __html: payload.html }} />
        )}
      </div>
    </div>,
    document.body,
  );
}
