// RichText renders HTML in an SVG foreignObject. Browser paragraph margins can
// collapse outside that fixed box, leaving only the bottoms of glyphs visible.
export const richTextNodeLayoutCss = `
  .smm-richtext-node-wrap p {
    margin: 0;
    padding: 0;
    line-height: 1.2;
  }

  .smm-richtext-node-wrap p + p {
    margin-top: 4px;
  }

  .smm-richtext-node-wrap .mindmap-node-title {
    color: #f8fafc;
    font-size: 1em;
    line-height: 1.25;
  }

  .smm-richtext-node-wrap .mindmap-node-note {
    box-sizing: border-box;
    margin-top: 7px;
    padding: 5px 8px;
    border: 1px solid rgba(148, 163, 184, .42);
    border-radius: 6px;
    background: rgba(15, 23, 42, .38);
    color: #cbd5e1;
    font-size: .82em;
    line-height: 1.45;
  }
`;

export function titleNoteNodeHtml(title: string, note: string): string {
  return `<p class="mindmap-node-title"><strong>${escapeHtml(title)}</strong></p><p class="mindmap-node-note">${escapeHtml(note).replace(/\n/g, "<br>")}</p>`;
}

export function hasNodeNote(value: unknown): boolean {
  return richTextParagraphs(value).slice(1).some(paragraph => textFromHtml(paragraph).trim().length > 0);
}

export function titleOnlyNodeHtml(value: unknown): string {
  return removeParagraphClass(richTextParagraphs(value)[0] ?? "");
}

export function decorateTitleNoteHtml(value: unknown): string {
  const [title, ...note] = richTextParagraphs(value);
  if (!title) return "";
  return [addParagraphClass(title, "mindmap-node-title"), ...note.map(paragraph => addParagraphClass(paragraph, "mindmap-node-note"))].join("");
}

export function titleFromNodeHtml(value: unknown): string {
  const html = typeof value === "string" ? value : "";
  const firstParagraph = html.match(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/i)?.[1] ?? html;
  return textFromHtml(firstParagraph).trim();
}

function richTextParagraphs(value: unknown): string[] {
  const html = typeof value === "string" ? value : "";
  return Array.from(html.matchAll(/<p(?:\s[^>]*)?>[\s\S]*?<\/p>/gi), match => match[0]);
}

function addParagraphClass(paragraph: string, className: string): string {
  return paragraph.replace(/^<p(?:\s[^>]*)?>/i, `<p class="${className}">`);
}

function removeParagraphClass(paragraph: string): string {
  return paragraph.replace(/^<p\s+class=(?:"mindmap-node-title"|'mindmap-node-title')>/i, "<p>");
}

function textFromHtml(value: string): string {
  return decodeHtml(value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, ""));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
}

function decodeHtml(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|#39);/g, entity => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'" })[entity]!);
}
