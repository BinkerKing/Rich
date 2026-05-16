import type { ElementId } from "./element.js";

export type RelationKind =
  | "parent"
  | "child"
  | "sibling"
  | "related"
  | "prerequisite"
  | "extension"
  | "practice";

export interface Relation {
  id: string;
  from: ElementId;
  to: ElementId;
  kind: RelationKind;
  strength?: number;
  reason?: string;
  createdAt: string;
}
