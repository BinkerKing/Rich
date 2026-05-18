import type { QARecord } from "@ke/domain";

export interface QARepo {
  append(qa: QARecord): Promise<void>;
  /** Delete a single Q&A by id. Returns false when not found. */
  remove(id: string): Promise<boolean>;
  /** All Q&A for a given element, oldest first. */
  listForElement(elementId: string): Promise<QARecord[]>;
  /** Wipe every Q&A record attached to the given element ids. */
  removeForElements(elementIds: string[]): Promise<void>;
}
