export function titleNoteNodeHtml(title: string, note: string): string {
  return `<p><strong>${escapeHtml(title)}</strong></p><p>${escapeHtml(note).replace(/\n/g, "<br>")}</p>`;
}

export function titleFromNodeHtml(value: unknown): string {
  const html = typeof value === "string" ? value : "";
  const firstParagraph = html.match(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/i)?.[1] ?? html;
  return decodeHtml(firstParagraph.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "")).trim();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!);
}

function decodeHtml(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|#39);/g, entity => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#39;": "'" })[entity]!);
}
