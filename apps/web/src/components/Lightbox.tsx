import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./Lightbox.css";

type Payload =
  | { type: "img"; src: string; alt?: string }
  | { type: "svg"; html: string };

/**
 * Global click-to-enlarge for any <img> inside .body-section and the SVG
 * inside .mermaid-diagram__host. Renders a portal overlay; click backdrop
 * or press Escape to close.
 */
export function Lightbox() {
  const [payload, setPayload] = useState<Payload | null>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // <img> inside any section/article in the element panel
      const img = target.closest("img") as HTMLImageElement | null;
      if (img && img.closest(".body-section, .sec-image, .sec-image-pair")) {
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
    return () => document.removeEventListener("click", onClick);
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
