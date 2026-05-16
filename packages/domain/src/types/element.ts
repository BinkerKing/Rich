export type ElementType =
  | "topic"
  | "concept"
  | "step"
  | "viewpoint"
  | "question"
  | "case"
  | "tool"
  | "ability"
  | "project"
  | "practice"
  | "summary"
  | "relation"
  | "dispute"
  | "exercise";

export type ElementId = string;

export type RichnessLevel = 1 | 2 | 3 | 4 | 5;

export interface ElementMetadata {
  createdAt: string;
  updatedAt: string;
  generatedBy: "ai" | "user";
  aiModel?: string;
  aiSessionId?: string;
  richness: RichnessLevel;
}

export interface Element<TContent = unknown> {
  id: ElementId;
  type: ElementType;
  title: string;
  subtitle?: string;
  aliases?: string[];
  tags?: string[];
  domain?: string;
  difficulty?: "low" | "mid" | "high";
  content: TContent;
  metadata: ElementMetadata;
}
