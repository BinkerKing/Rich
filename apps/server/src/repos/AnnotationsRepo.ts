import type { Annotation } from "@ke/domain";

export interface AnnotationsRepo {
  append(a: Annotation): Promise<void>;
  remove(id: string): Promise<boolean>;
  /** Replace an existing annotation by id; returns updated record or null when missing. */
  update(id: string, patch: Partial<Annotation>): Promise<Annotation | null>;
  listForElement(elementId: string): Promise<Annotation[]>;
}
