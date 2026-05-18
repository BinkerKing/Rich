import type { ElementId } from "./element.js";

/**
 * Where a Q&A is anchored — a specific section, an annotation, or the element overall.
 * Renderer uses this to slot the answer card right after the relevant block.
 */
export type QAAnchor =
  | { type: "section"; sectionId: string }
  | { type: "annotation"; annotationId: string }
  | { type: "element" };

/**
 * A Q&A entry attached to an element. Persisted append-only in qa.jsonl
 * and surfaced under each element as a "答疑" history.
 */
export interface QARecord {
  id: string;
  elementId: ElementId;
  question: string;
  answer: string;
  /** Where this Q&A should render. Defaults to { type: "element" } for old records. */
  anchor?: QAAnchor;
  /** ISO timestamp. */
  createdAt: string;
  /** Which adapter answered. */
  aiModel?: string;
  /** Optional session id from the adapter, for follow-ups. */
  aiSessionId?: string;
}
