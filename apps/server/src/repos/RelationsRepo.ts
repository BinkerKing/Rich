import type { Relation, ElementId } from "@ke/domain";

export interface RelationsRepo {
  list(): Promise<Relation[]>;
  byFrom(id: ElementId): Promise<Relation[]>;
  byTo(id: ElementId): Promise<Relation[]>;
  append(rels: Relation[]): Promise<void>;
}
