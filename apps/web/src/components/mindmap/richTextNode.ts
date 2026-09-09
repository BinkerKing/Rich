// RichText renders HTML in an SVG foreignObject. Browser paragraph margins can
// collapse outside that fixed box, leaving only the bottoms of glyphs visible.
export const richTextNodeLayoutCss = `
  .smm-richtext-node-wrap p {
    margin: 0;
    padding: 0;
    line-height: 1.2;
  }

  .smm-richtext-node-wrap .mindmap-node-title,
  .smm-richtext-node-edit-wrap .ql-editor .mindmap-node-title {
    color: #f8fafc;
    font-size: 1em;
    line-height: 1.25;
  }

  .smm-richtext-node-wrap .mindmap-node-note,
  .smm-richtext-node-edit-wrap .ql-editor .mindmap-node-note {
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

  .smm-richtext-node-wrap .mindmap-node-note p,
  .smm-richtext-node-edit-wrap .ql-editor .mindmap-node-note p {
    margin: 0;
    padding: 0;
  }

  .smm-richtext-node-wrap .mindmap-node-note p + p,
  .smm-richtext-node-edit-wrap .ql-editor .mindmap-node-note p + p {
    margin-top: 4px;
  }

  .smm-node.active .smm-hover-node {
    opacity: 1;
    stroke: #fef08a !important;
    stroke-width: 4px;
    filter: drop-shadow(0 0 5px rgba(250, 204, 21, .95));
  }
`;

export function titleNoteNodeHtml(title: string, note: string): string {
  return `<p class="mindmap-node-title"><strong>${escapeHtml(title)}</strong></p><div class="mindmap-node-note"><p>${escapeHtml(note).replace(/\n/g, "<br>")}</p></div>`;
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
  return `${addParagraphClass(title, "mindmap-node-title")}<div class="mindmap-node-note">${note.map(removeParagraphClass).join("")}</div>`;
}

type MindmapTreeNode = { data?: Record<string, unknown>; children?: MindmapTreeNode[]; [key: string]: unknown };

export function normalizeTitleNoteTree<T extends MindmapTreeNode>(node: T): T {
  const currentData = node.data;
  const nextText = currentData?.nodeCardStyle === "title-note" && hasNodeNote(currentData.text)
    ? decorateTitleNoteHtml(currentData.text)
    : currentData?.text;
  const nextChildren = node.children?.map(normalizeTitleNoteTree);
  const dataChanged = nextText !== currentData?.text;
  const childrenChanged = nextChildren?.some((child, index) => child !== node.children?.[index]) ?? false;
  if (!dataChanged && !childrenChanged) return node;
  return {
    ...node,
    ...(dataChanged ? { data: { ...currentData, text: nextText } } : {}),
    ...(childrenChanged ? { children: nextChildren } : {}),
  } as T;
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
