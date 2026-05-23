import { useMemo } from "react";
import { marked, type MarkedOptions } from "marked";
import "./MarkdownView.css";

interface Props {
  /** Raw Markdown source. */
  text: string;
  /** Optional eyebrow title rendered above the parsed body. */
  title?: string;
}

const MD_OPTIONS: MarkedOptions = {
  // GFM extensions (tables, task lists, autolinks) are on by default in
  // marked ≥ 4. We explicitly preserve newlines so soft line breaks read
  // naturally for users who type plain text without double-newlines.
  gfm: true,
  breaks: true,
};

/**
 * Read-only Markdown block renderer. Parses the source with `marked` once per
 * text change and dumps the HTML into a styled container. Single-user local
 * app → we trust the source and don't sanitize. The container scopes all
 * markdown chrome (headings / code / tables) so it doesn't leak into the
 * surrounding page CSS.
 */
export function MarkdownView({ text, title }: Props) {
  const html = useMemo(() => {
    if (!text) return "";
    try {
      // marked.parse can return Promise<string> if async options enabled;
      // we keep it sync. Cast accordingly.
      return marked.parse(text, MD_OPTIONS) as string;
    } catch (e) {
      return `<pre style="color:#ff5ed4">Markdown 解析失败: ${e instanceof Error ? e.message : String(e)}</pre>`;
    }
  }, [text]);

  if (!text.trim() && !title) {
    return <div className="md-view md-view--empty">空 Markdown · 切到编辑态写点东西吧</div>;
  }

  return (
    <article className="md-view">
      {title && <header className="md-view__title">{title}</header>}
      <div className="md-view__body" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
