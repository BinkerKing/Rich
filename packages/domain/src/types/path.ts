import type { ElementId } from "./element.js";

export type PathKind = "quick" | "academic" | "practice" | "custom";

export interface LearningPath {
  id: string;
  centerElementId: ElementId;
  kind: PathKind;
  label: string;
  color: string;
  steps: ElementId[];
  estimatedTime?: string;
  generatedBy: "ai" | "user";
  createdAt: string;
}
