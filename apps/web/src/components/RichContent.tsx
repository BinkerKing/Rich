import type { ReactNode } from "react";
import { marked } from "marked";
import { useStore } from "../state/store.js";
import { VisualBlockRenderer } from "./VisualBlockRenderer.js";

// 启用 GFM + 软换行 —— AI 写 "\n" 会渲染成 <br>，避免每行都得 \n\n
marked.setOptions({ gfm: true, breaks: true });

/** 这段文字是不是含块级 markdown（标题 / 列表 / 引用 / 段落分隔）？*/
function isBlockMarkdown(text: string): boolean {
  return /(\n\n)|(^|\n)#{1,6}\s|(^|\n)[-*]\s|(^|\n)>\s|(^|\n)\d+\.\s/.test(text);
}

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
 * Anything that doesn't match `rich://` stays in the normal answer surface.
 * Plain http(s), file:// and common macOS absolute file paths are rendered
 * as external links so generated files and URLs can be opened directly.
 *
 * Streaming safety: the regex requires a closing `)`, so half-arrived
 * tokens like "[查看攻略](rich://elem" render as plain text until the
 * full pattern completes. No flicker / broken state.
 */

const RICH_LINK_RE = /\[([^\]]+)\]\(rich:\/\/([^)\s]+)\)/g;
const URL_RE = /\b(?:https?:\/\/|file:\/\/\/)[^\s<>"']+/g;
const URL_ONLY_RE = /^(?:https?:\/\/|file:\/\/\/)[^\s<>"']+$/i;
const MAC_FILE_PATH_RE = /(^|[\s([{（:：])((?:\/Users|\/Volumes|\/Applications|\/tmp|\/private\/tmp)[^\n\r\t<>"]+?\.(?:md|txt|json|csv|xlsx?|docx?|pptx?|pdf|png|jpe?g|gif|webp|svg|html?|zip|log|sql|ts|tsx|js|jsx|py|sh|yaml|yml))/gi;
const MAC_FILE_PATH_ONLY_RE = /^(?:\/Users|\/Volumes|\/Applications|\/tmp|\/private\/tmp)[^\n\r\t<>"]+?\.(?:md|txt|json|csv|xlsx?|docx?|pptx?|pdf|png|jpe?g|gif|webp|svg|html?|zip|log|sql|ts|tsx|js|jsx|py|sh|yaml|yml)$/i;
const LINK_TOKEN_PREFIX = "\uE000RICH_LINK_";
const LINK_TOKEN_SUFFIX = "\uE001";
// 视觉块围栏：```<lang>\n ... \n``` (T03 系统提示词约定的协议)
// 流式时如果还没闭合，pre-parse 也会识别一个"streaming"块（用末尾未闭合的部分）
const VISUAL_FENCE_RE = /```([a-zA-Z]*)\n([\s\S]*?)```/g;
const VISUAL_FENCE_OPEN_RE = /```([a-zA-Z]*)\n([\s\S]*)$/;  // 末尾未闭合

interface Segment {
  type: "text" | "link" | "visual";
  /** For text segments */
  text?: string;
  /** For link segments */
  label?: string;
  target?: string;
  /** For visual segments — ASCII content + lang hint + 是否已闭合 */
  ascii?: string;
  langHint?: string;
  closed?: boolean;
}

/**
 * 把消息文本切成 text / link / visual 三类 segment。
 *
 * 优先级：先识别完整的视觉块围栏（闭合的 ```...```），再在 text 段里识别 rich:// 链接。
 * 末尾未闭合的围栏识别成一个 streaming 视觉块（content=尚未到的部分）。
 */
function parse(text: string): Segment[] {
  const out: Segment[] = [];
  let cursor = 0;
  // 第一遍：识别所有闭合的视觉块围栏
  VISUAL_FENCE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = VISUAL_FENCE_RE.exec(text)) !== null) {
    if (m.index > cursor) {
      // 前缀文字段，进 link parser
      const before = text.slice(cursor, m.index);
      for (const seg of parseTextWithLinks(before)) out.push(seg);
    }
    out.push({ type: "visual", ascii: m[2], langHint: m[1], closed: true });
    cursor = VISUAL_FENCE_RE.lastIndex;
  }

  // 剩余：可能含一个未闭合的围栏（流式中的状态）
  if (cursor < text.length) {
    const tail = text.slice(cursor);
    const openMatch = tail.match(VISUAL_FENCE_OPEN_RE);
    if (openMatch) {
      const openStart = tail.indexOf("```");
      if (openStart > 0) {
        for (const seg of parseTextWithLinks(tail.slice(0, openStart))) out.push(seg);
      }
      out.push({
        type: "visual",
        ascii: openMatch[2],
        langHint: openMatch[1],
        closed: false,
      });
    } else {
      for (const seg of parseTextWithLinks(tail)) out.push(seg);
    }
  }
  return out;
}

/** 把一段文字里的 rich:// 链接识别成 link segment */
function parseTextWithLinks(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unescapeHtml(value: string): string {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function trimUrlCandidate(value: string): { link: string; suffix: string } {
  let link = value;
  let suffix = "";
  while (/[),.;:!?，。；：！？、）\]}]$/.test(link)) {
    suffix = link.slice(-1) + suffix;
    link = link.slice(0, -1);
  }
  return { link, suffix };
}

function toExternalHref(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  const fileUrl = /^file:\/\//i.test(value) ? encodeURI(value) : `file://${encodeURI(value)}`;
  return `rich://open-external?url=${encodeURIComponent(fileUrl)}`;
}

function externalAnchor(label: string, href: string, className = "rich-external-link"): string {
  return `<a class="${className}" href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
}

function isExternalReference(value: string): boolean {
  return URL_ONLY_RE.test(value) || MAC_FILE_PATH_ONLY_RE.test(value);
}

function shouldSkipRawUrl(source: string, offset: number): boolean {
  const prev = source.slice(Math.max(0, offset - 2), offset);
  const attrPrefix = source.slice(Math.max(0, offset - 12), offset);
  return prev === "](" || /href\s*=\s*["']?$/i.test(attrPrefix);
}

function linkifyPlainReferences(text: string): string {
  const anchors: string[] = [];
  const stash = (html: string) => {
    const token = `${LINK_TOKEN_PREFIX}${anchors.length}${LINK_TOKEN_SUFFIX}`;
    anchors.push(html);
    return token;
  };

  let out = text.replace(URL_RE, (raw, offset: number, source: string) => {
    if (shouldSkipRawUrl(source, offset)) return raw;
    const { link, suffix } = trimUrlCandidate(raw);
    if (!link) return raw;
    return `${stash(externalAnchor(link, toExternalHref(link)))}${suffix}`;
  });

  out = out.replace(MAC_FILE_PATH_RE, (full, prefix: string, path: string) => {
    if (full.includes(LINK_TOKEN_PREFIX)) return full;
    return `${prefix}${stash(externalAnchor(path, toExternalHref(path)))}`;
  });

  anchors.forEach((html, index) => {
    out = out.replace(new RegExp(escapeRegExp(`${LINK_TOKEN_PREFIX}${index}${LINK_TOKEN_SUFFIX}`), "g"), html);
  });
  return out;
}

function decorateMarkdownAnchors(html: string): string {
  return html.replace(/<a\s+href="([^"]*)"/g, (_match, href: string) => {
    const externalHref = /^\/(?:Users|Volumes|Applications|tmp|private\/tmp)\//i.test(href)
      ? escapeHtml(toExternalHref(href))
      : href;
    return `<a class="rich-external-link" target="_blank" rel="noreferrer" href="${externalHref}"`;
  });
}

function decorateCodeReferences(html: string): string {
  return html.replace(/<code>([\s\S]*?)<\/code>/g, (match, codeHtml: string) => {
    const label = unescapeHtml(codeHtml).trim();
    if (!isExternalReference(label)) return match;
    return externalAnchor(label, toExternalHref(label), "rich-external-link rich-external-link--code");
  });
}

function renderMarkdown(text: string, block: boolean): string {
  const parsed = block
    ? marked.parse(linkifyPlainReferences(text), { async: false }) as string
    : marked.parseInline(linkifyPlainReferences(text), { async: false }) as string;
  return decorateCodeReferences(decorateMarkdownAnchors(parsed));
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
          const t = seg.text ?? "";
          if (!t) return null;
          // 块级 markdown（列表 / 标题 / 引用 / 多段）→ 用 div + marked.parse 完整渲染
          // 否则用 inline 渲染（不破坏行内的 rich-jump 按钮）
          if (isBlockMarkdown(t)) {
            const html = renderMarkdown(t, true);
            return <div key={i} className="rich-md" dangerouslySetInnerHTML={{ __html: html }} />;
          }
          const html = renderMarkdown(t, false);
          return <span key={i} className="rich-md-inline" dangerouslySetInnerHTML={{ __html: html }} />;
        }
        if (seg.type === "visual") {
          return (
            <VisualBlockRenderer
              key={i}
              ascii={seg.ascii ?? ""}
              hint={undefined /* 让 detectBlockType 自动判 */}
              mode={seg.closed ? "final" : "stream"}
              done={seg.closed}
            />
          );
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
