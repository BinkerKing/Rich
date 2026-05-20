/**
 * Mindmap PPT — element-backed view, NOT a separate artifact.
 *
 * A "deck" is just an element subtree whose root carries a `mindmap-embed`
 * section block (see ./section.ts MindmapEmbedBlock). The server builds the
 * indented Markdown source on every read by walking the element tree, so
 * editing the elements automatically updates the PPT.
 *
 * This type is the public read shape returned by `/api/mindmaps` — it is
 * pure UI projection, never persisted on its own.
 */
export interface MindmapDeckView {
  /** Same as the root element id. */
  id: string;
  rootElementId: string;
  title: string;
  subtitle?: string;
  origin: "from-element" | "ai-from-prose";
  generatedAt: string;
  aiModel?: string;
  /** Indented Markdown tree consumed by the player. Built fresh server-side. */
  source: string;
  /** Number of descendant elements under the root, for the list card meta. */
  childCount: number;
}
