import type { Element, ElementId } from "@ke/domain";

export interface ElementsRepo {
  list(): Promise<Element[]>;
  get(id: ElementId): Promise<Element | null>;
  put(el: Element): Promise<void>;
}
