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
`;

export function titleNoteNodeHtml(title: string, note: string): string {
  return `<p><strong>${escapeHtml(title)}</strong></p><p>${escapeHtml(note).replace(/\n/g, "<br>")}</p>`;
}

export function hasNodeNote(value: unknown): boolean {
  return richTextParagraphs(value).slice(1).some(paragraph => textFromHtml(paragraph).trim().length > 0);
}

export function titleOnlyNodeHtml(value: unknown): string {
  return richTextParagraphs(value)[0] ?? "";
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

function textFromHtml(value: string): string {
  return decodeHtml(value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, ""));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
}

function decodeHtml(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|#39);/g, entity => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'" })[entity]!);
}
