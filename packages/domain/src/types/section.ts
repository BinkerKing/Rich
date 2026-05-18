/**
 * Dynamic section model.
 *
 * Idea: the frontend ships a fixed palette of "block styles". AI emits a
 * `sections` array on element.content, where each section has a title + a
 * sequence of style blocks. AI picks which style fits the slice of content
 * being written, and may combine multiple block styles in one section.
 *
 * Existing per-type fields (oneSentence, coreExplain, ...) stay supported;
 * if an element has BOTH the typed fields and `sections`, `sections` wins.
 */

export interface CalloutBlock {
  style: "callout";
  kind: "tip" | "insight" | "example" | "warning" | "info";
  title?: string;
  body: string;
}

export interface LeadBlock { style: "lead"; text: string }
export interface ProseBlock { style: "prose"; text: string }
export interface QuoteBlock { style: "quote"; text: string; cite?: string }

export interface CheckListBlock {
  style: "check-list";
  items: string[];
  /** 1 = single column (default), 2 = two columns */
  columns?: 1 | 2;
}

export interface DotListBlock { style: "dot-list"; items: string[] }

/** Vertical warning cards (one per row), red bar + ⚠ icon. */
export interface WarnCardsBlock { style: "warn-cards"; items: string[] }

/** Numbered example cards (one per row), green bar. */
export interface ExampleListBlock { style: "example-list"; items: string[] }

/** Numbered mechanism / step flow. */
export interface MechanismFlowBlock {
  style: "mechanism-flow";
  steps: Array<{ label: string; description?: string }>;
}

/** Decision cards: topic / choice / rationale / alternatives[]. */
export interface DecisionListBlock {
  style: "decision-list";
  decisions: Array<{ topic: string; choice: string; rationale?: string; alternatives?: string[] }>;
}

/** Phase timeline with sequential numbered phases. */
export interface PhaseTimelineBlock {
  style: "phase-timeline";
  phases: Array<{ label: string; body: string }>;
}

/** Two-column key-value table. */
export interface KvTableBlock {
  style: "kv-table";
  rows: Array<{ key: string; value: string }>;
}

/** Module grid: rectangular cards in 2-col layout. */
export interface ModuleGridBlock {
  style: "module-grid";
  cards: Array<{ title: string; body: string; focus?: string }>;
}

/** Competitor / comparison table. */
export interface CompetitorTableBlock {
  style: "competitor-table";
  rows: Array<{ name: string; takeaway: string }>;
}

/** MVP feature grid (numbered feature cards). */
export interface MvpGridBlock {
  style: "mvp-grid";
  features: string[];
}

/** Mermaid diagram. */
export interface DiagramBlockSection {
  style: "diagram";
  title: string;
  caption?: string;
  mermaid: string;
}

/** Day-by-day schedule (for travel / project planning). */
export interface DayScheduleBlock {
  style: "day-schedule";
  days: Array<{
    label: string;
    summary?: string;
    items: Array<{ time?: string; what: string; note?: string }>;
  }>;
}

/** Budget / cost breakdown table. */
export interface BudgetTableBlock {
  style: "budget-table";
  lines: Array<{ item: string; qty?: string; cost: string; note?: string }>;
  total?: string;
}

/** Grouped checklist (sectioned). */
export interface ChecklistGroupedBlock {
  style: "checklist-grouped";
  groups: Array<{ title: string; items: string[] }>;
}

/** Generic placeholder for an image AI cannot generate; user can replace. */
export interface ImagePlaceholderBlock {
  style: "image-placeholder";
  alt: string;
  caption?: string;
}

/** Real image: either an AI-generated file (codex image tool) or external URL. */
export interface ImageBlock {
  style: "image";
  /** Image source. AI emits either an absolute path or a URL; backend post-processes
   *  absolute paths into a served /api/images/<elementId>/<file> URL. */
  src: string;
  alt: string;
  caption?: string;
}

export type StyleBlock =
  | LeadBlock
  | ProseBlock
  | QuoteBlock
  | CalloutBlock
  | CheckListBlock
  | DotListBlock
  | WarnCardsBlock
  | ExampleListBlock
  | MechanismFlowBlock
  | DecisionListBlock
  | PhaseTimelineBlock
  | KvTableBlock
  | ModuleGridBlock
  | CompetitorTableBlock
  | MvpGridBlock
  | DiagramBlockSection
  | DayScheduleBlock
  | BudgetTableBlock
  | ChecklistGroupedBlock
  | ImagePlaceholderBlock
  | ImageBlock;

export interface DynamicSection {
  /** Short kebab-case id for the TOC anchor. */
  id: string;
  /** Section heading shown in the body. */
  title: string;
  /** Ordered block sequence inside the section. */
  blocks: StyleBlock[];
}
