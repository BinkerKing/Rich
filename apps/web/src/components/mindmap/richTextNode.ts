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
    color: inherit;
    font-size: 1em;
    line-height: 1.25;
  }

  .smm-richtext-node-wrap .mindmap-node-icon {
    display: inline-block;
    margin-right: .35em;
    font-size: 1em;
    line-height: 1;
    vertical-align: -.08em;
  }

  .smm-richtext-node-wrap .mindmap-node-note,
  .smm-richtext-node-edit-wrap .ql-editor .mindmap-node-note {
    box-sizing: border-box;
    margin-top: 14px;
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

  /* Quill removes the display-only title/note wrapper while editing. Keep the
     first paragraph as the title and render the following paragraph as the
     same inner note card, so editing never visually merges the two regions. */
  .smm-richtext-node-edit-wrap .ql-editor > p:first-child {
    margin: 0;
    padding: 0;
    color: inherit;
    font-size: 1em;
    font-weight: inherit;
    line-height: 1.25;
  }

  .smm-richtext-node-edit-wrap .ql-editor > p:not(:first-child) {
    box-sizing: border-box;
    margin: 0;
    padding: 0 8px;
    background: rgba(15, 23, 42, .38);
    color: #cbd5e1;
    font-size: .82em;
    line-height: 1.45;
  }

  .smm-richtext-node-edit-wrap .ql-editor > p:nth-child(2):not(:last-child) {
    margin-top: 14px;
    padding-top: 5px;
    border: 1px solid rgba(148, 163, 184, .42);
    border-bottom: 0;
    border-radius: 6px 6px 0 0;
  }

  .smm-richtext-node-edit-wrap .ql-editor > p:nth-child(n + 3):not(:last-child) {
    border-right: 1px solid rgba(148, 163, 184, .42);
    border-left: 1px solid rgba(148, 163, 184, .42);
  }

  .smm-richtext-node-edit-wrap .ql-editor > p:not(:first-child):last-child {
    padding-bottom: 5px;
    border-right: 1px solid rgba(148, 163, 184, .42);
    border-bottom: 1px solid rgba(148, 163, 184, .42);
    border-left: 1px solid rgba(148, 163, 184, .42);
    border-radius: 0 0 6px 6px;
  }

  .smm-richtext-node-edit-wrap .ql-editor > p:nth-child(2):last-child {
    margin-top: 14px;
    padding: 5px 8px;
    border: 1px solid rgba(148, 163, 184, .42);
    border-radius: 6px;
  }

  .smm-node.active .smm-hover-node {
    opacity: 1;
    stroke: #fef08a !important;
    stroke-width: 4px;
    filter: drop-shadow(0 0 5px rgba(250, 204, 21, .95));
  }
`;

export function titleNoteNodeHtml(title: string, note: string): string {
  return `<p class="mindmap-node-title">${escapeHtml(title)}</p><div class="mindmap-node-note"><p>${escapeHtml(note).replace(/\n/g, "<br>")}</p></div>`;
}

export function hasNodeNote(value: unknown): boolean {
  return richTextParagraphs(value).slice(1).some(paragraph => textFromHtml(paragraph).trim().length > 0);
}

export function titleOnlyNodeHtml(value: unknown): string {
  return removeDefaultTitleWeight(removeParagraphClass(richTextParagraphs(value)[0] ?? ""));
}

export function nodeIconHtml(value: unknown, icon: unknown): string {
  const text = typeof value === "string" ? removeLeadingNodeIconText(removeNodeIconHtml(value)) : "";
  const nextIcon = typeof icon === "string" ? icon.trim() : "";
  if (!nextIcon) return text;
  const iconHtml = `<span class="mindmap-node-icon" contenteditable="false">${escapeHtml(nextIcon)}</span>`;
  if (/<p(?:\s[^>]*)?>/i.test(text)) return text.replace(/<p(?:\s[^>]*)?>/i, match => `${match}${iconHtml}`);
  return `<p>${iconHtml}${text}</p>`;
}

export function nextNodeIcon(currentIcon: unknown, selectedIcon: string): string | undefined {
  return currentIcon === selectedIcon ? undefined : selectedIcon;
}

export function nodeIconFromHtml(value: unknown): string | undefined {
  const html = typeof value === "string" ? value : "";
  const firstParagraph = html.match(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/i)?.[1] ?? html;
  const text = textFromHtml(firstParagraph).trimStart();
  return nodeIconChoices.find(icon => text.startsWith(icon));
}

export function decorateTitleNoteHtml(value: unknown): string {
  const [title, ...note] = richTextParagraphs(value);
  if (!title) return "";
  return `${addParagraphClass(title, "mindmap-node-title")}<div class="mindmap-node-note">${note.map(removeParagraphClass).join("")}</div>`;
}

type MindmapTreeNode = { data?: Record<string, unknown>; children?: MindmapTreeNode[]; [key: string]: unknown };

export function normalizeTitleNoteTree<T extends MindmapTreeNode>(node: T): T {
  const currentData = node.data;
  const normalizedTitleWeight = removeDefaultTitleWeight(typeof currentData?.text === "string" ? currentData.text : "");
  const savedIcon = typeof currentData?.nodeIcon === "string" && currentData.nodeIcon.trim() ? currentData.nodeIcon : undefined;
  const nodeIcon = savedIcon ?? nodeIconFromHtml(normalizedTitleWeight);
  const textWithIcon = nodeIconHtml(normalizedTitleWeight, nodeIcon);
  const nextText = currentData?.nodeCardStyle === "title-note" && hasNodeNote(textWithIcon)
    ? decorateTitleNoteHtml(textWithIcon)
    : textWithIcon;
  const nextChildren = node.children?.map(normalizeTitleNoteTree);
  const dataChanged = nextText !== currentData?.text;
  const iconChanged = nodeIcon !== savedIcon;
  const childrenChanged = nextChildren?.some((child, index) => child !== node.children?.[index]) ?? false;
  if (!dataChanged && !childrenChanged) return node;
  return {
    ...node,
    ...(dataChanged || iconChanged ? { data: { ...currentData, text: nextText, ...(iconChanged ? { nodeIcon } : {}) } } : {}),
    ...(childrenChanged ? { children: nextChildren } : {}),
  } as T;
}

export function titleFromNodeHtml(value: unknown): string {
  const html = typeof value === "string" ? value : "";
  const firstParagraph = html.match(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/i)?.[1] ?? html;
  return textFromHtml(removeNodeIconHtml(firstParagraph)).trim();
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

// Early title-note cards wrapped every title in <strong>. It made the node
// toolbar's normal weight ineffective because inline formatting wins over the
// node's inherited style. Only unwrap a strong tag that owns the whole title;
// partial strong tags remain available for per-character rich text formatting.
function removeDefaultTitleWeight(value: string): string {
  return value.replace(
    /^(<p(?:\s[^>]*)?>)((?:<span\b(?=[^>]*\bclass=(?:"[^"]*\bmindmap-node-icon\b[^"]*"|'[^']*\bmindmap-node-icon\b[^']*'))[^>]*>[\s\S]*?<\/span>)?)<strong>([\s\S]*?)<\/strong><\/p>/i,
    "$1$2$3</p>",
  );
}

function removeNodeIconHtml(value: string): string {
  return value.replace(/<span\b(?=[^>]*\bclass=(?:"[^"]*\bmindmap-node-icon\b[^"]*"|'[^']*\bmindmap-node-icon\b[^']*'))[^>]*>[\s\S]*?<\/span>\s*/gi, "");
}

function removeLeadingNodeIconText(value: string): string {
  return value.replace(/(<p(?:\s[^>]*)?>)(?:\s*(?:📌|⭐|💡|⚙️|🎯|✅|⚠️|📚|🔗|🚀|💬|🔍))+/u, "$1");
}

const nodeIconChoices = ["📌", "⭐", "💡", "⚙️", "🎯", "✅", "⚠️", "📚", "🔗", "🚀", "💬", "🔍"];

function textFromHtml(value: string): string {
  return decodeHtml(value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, ""));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
}

function decodeHtml(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|#39);/g, entity => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'" })[entity]!);
}
