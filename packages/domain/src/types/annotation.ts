import type { ElementId } from "./element.js";

export type AnnotationKind = "highlight" | "underline";

/** AI-generated deep-analysis attached to a single annotation. */
export interface AnnotationAnalysis {
  title?: string;
  body: string;
  /** Which adapter produced it. */
  aiModel?: string;
  createdAt: string;
}

/**
 * A user-applied text mark on an element body. Persisted in annotations.jsonl
 * and re-applied each render by searching for `text` (optionally disambiguated
 * by `contextBefore` / `contextAfter`) within the body article.
 */
export interface Annotation {
  id: string;
  elementId: ElementId;
  kind: AnnotationKind;
  /** The selected text the user marked. */
  text: string;
  /** Up to ~30 chars immediately before the selection — for disambiguation. */
  contextBefore?: string;
  /** Up to ~30 chars immediately after the selection. */
  contextAfter?: string;
  /** Optional user note attached to the mark. */
  note?: string;
  /** AI deep-analysis attached to this annotation; rendered inline under the mark. */
  analysis?: AnnotationAnalysis;
  createdAt: string;
}
