import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import "./MermaidDiagram.css";

let initialized = false;
function ensureInit() {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    securityLevel: "strict",
    fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
    fontSize: 15,
    flowchart: { htmlLabels: true, curve: "basis", padding: 14, useMaxWidth: true },
    sequence: { useMaxWidth: true },
    gantt: {
      useMaxWidth: true,
      fontSize: 13,
      sectionFontSize: 14,
      barHeight: 22,
      barGap: 6,
      topPadding: 28,
      leftPadding: 110,
      gridLineStartPadding: 24,
    },
    themeVariables: {
      darkMode: true,
      background: "transparent",
      primaryColor: "#15324a",
      primaryTextColor: "#eaf4ff",
      primaryBorderColor: "rgba(106, 168, 255, .6)",
      lineColor: "rgba(106, 168, 255, .7)",
      secondaryColor: "#1d3a55",
      tertiaryColor: "#0d1c2e",
    },
  });
  initialized = true;
}

let idCounter = 0;

interface Props {
  title: string;
  caption?: string;
  code: string;
}

export function MermaidDiagram({ title, caption, code }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureInit();
    const host = hostRef.current;
    if (!host) return;
    const renderId = `mermaid-${++idCounter}`;
    setError(null);
    host.innerHTML = "";
    mermaid.render(renderId, code)
      .then(({ svg }) => {
        if (!hostRef.current) return;
        hostRef.current.innerHTML = svg;
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [code]);

  return (
    <figure className="mermaid-diagram">
      <header>
        <span className="mermaid-diagram__badge">流程图</span>
        <strong>{title}</strong>
      </header>
      <div className="mermaid-diagram__host" ref={hostRef} />
      {error && (
        <pre className="mermaid-diagram__error" title="Mermaid 渲染失败">
          {`渲染失败：${error}\n\n原始代码：\n${code}`}
        </pre>
      )}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
