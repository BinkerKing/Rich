import type { ReactNode } from "react";
import { useStore } from "../state/store.js";

/**
 * RichContent — render an assistant's message content with in-line jump
 * buttons. Hermes embeds jump targets using a markdown-link with the
 * custom scheme `rich://`:
 *
 *   [查看攻略](rich://element/el-abc123)        → enterAtElement(id)
 *   [打开 AI 早报](rich://view/news)             → setAppView("news")
 *   [查看工具箱](rich://view/toolbox)            → setAppView("toolbox")
 *   [播放 PPT](rich://mindmap/deck-xyz)         → openMindmap(deckId)
 *   [回首页](rich://home)                       → exitToHome()
 *
 * Anything that doesn't match `rich://` stays as plain text — including
 * normal http/https links (we deliberately don't auto-render those as
 * buttons to keep the surface clean; the user already gets readable URLs).
 *
 * Streaming safety: the regex requires a closing `)`, so half-arrived
 * tokens like "[查看攻略](rich://elem" render as plain text until the
 * full pattern completes. No flicker / broken state.
 */

const RICH_LINK_RE = /\[([^\]]+)\]\(rich:\/\/([^)\s]+)\)/g;

interface Segment {
  type: "text" | "link";
  /** For text segments — the literal string. */
  text?: string;
  /** For link segments — display label + target path. */
  label?: string;
  target?: string;
}

function parse(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  // Reset regex state per call — global regexes carry .lastIndex across calls.
  RICH_LINK_RE.lastIndex = 0;
  while ((m = RICH_LINK_RE.exec(text)) !== null) {
    if (m.index > last) {
      out.push({ type: "text", text: text.slice(last, m.index) });
    }
    out.push({ type: "link", label: m[1], target: m[2] });
    last = RICH_LINK_RE.lastIndex;
  }
  if (last < text.length) {
    out.push({ type: "text", text: text.slice(last) });
  }
  return out;
}

export function RichContent({ text }: { text: string }): ReactNode {
  // The store hooks are pulled at top level (rules-of-hooks). The button
  // handlers below use these via a captured store reference at click time.
  const setAppView = useStore(s => s.setAppView);
  const exitToHome = useStore(s => s.exitToHome);
  const enterAtElement = useStore(s => s.enterAtElement);
  const enterTree = useStore(s => s.enterTree);
  const openMindmap = useStore(s => s.openMindmap);

  function handleClick(target: string) {
    // target shape: "<kind>/<id>" or just "<kind>" (e.g. "home").
    const slash = target.indexOf("/");
    const kind = slash < 0 ? target : target.slice(0, slash);
    const id = slash < 0 ? "" : target.slice(slash + 1);
    switch (kind) {
      case "home":
        setAppView("tree");
        exitToHome();
        return;
      case "view": {
        const valid = ["home", "tree", "news", "mindmap", "greatme", "toolbox", "admin"] as const;
        type V = typeof valid[number];
        if ((valid as readonly string[]).includes(id)) {
          if (id === "tree") exitToHome();
          setAppView(id as V);
        }
        return;
      }
      case "element":
        if (id) void enterAtElement(id);
        return;
      case "tree":
        if (id) void enterTree(id);
        return;
      case "mindmap":
        if (id) {
          setAppView("mindmap");
          openMindmap(id);
        }
        return;
      default:
        // Unknown kind — silently no-op. Could console.warn but that
        // spams during stream when partial matches exist.
        return;
    }
  }

  const segments = parse(text);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return <span key={i}>{seg.text}</span>;
        }
        return (
          <button
            key={i}
            type="button"
            className="rich-jump"
            onClick={() => seg.target && handleClick(seg.target)}
            title={`跳转：${seg.target}`}
          >
            <span className="rich-jump__label">{seg.label}</span>
            <span className="rich-jump__arrow" aria-hidden="true">→</span>
          </button>
        );
      })}
    </>
  );
}
