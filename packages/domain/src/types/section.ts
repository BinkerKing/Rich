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

/**
 * Provenance for a piece of information. Used by 报告元 to mark each item with
 * its real-world source. UI renders this as a small "来源 · 出处 · 时间" line
 * beneath the content. All fields optional so AI can emit partial citations.
 */
export interface Source {
  /** Short publisher / outlet name shown to the user: "Anthropic Blog", "TechCrunch". */
  cite?: string;
  /** Canonical URL of the source. */
  url?: string;
  /** ISO date (YYYY-MM-DD or full ISO timestamp) when the source was published. */
  publishedAt?: string;
}

/** List item that may carry its own source. Plain string = no source. */
export type SourcedItem = string | { text: string; source?: Source };

export interface CalloutBlock {
  style: "callout";
  kind: "tip" | "insight" | "example" | "warning" | "info";
  title?: string;
  body: string;
  source?: Source;
}

export interface LeadBlock { style: "lead"; text: string; source?: Source }
export interface ProseBlock { style: "prose"; text: string; source?: Source }
export interface QuoteBlock { style: "quote"; text: string; cite?: string; source?: Source }

export interface CheckListBlock {
  style: "check-list";
  items: SourcedItem[];
  /** 1 = single column (default), 2 = two columns */
  columns?: 1 | 2;
}

export interface DotListBlock { style: "dot-list"; items: SourcedItem[] }

/** Vertical warning cards (one per row), red bar + ⚠ icon. */
export interface WarnCardsBlock { style: "warn-cards"; items: SourcedItem[] }

/** Numbered example cards (one per row), green bar. */
export interface ExampleListBlock { style: "example-list"; items: SourcedItem[] }

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
  cards: Array<{ title: string; body: string; focus?: string; source?: Source }>;
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

/**
 * Placeholder emitted by the text-generating AI. The dedicated image engine
 * (separate background op) fills this in later — at that point the block is
 * rewritten to `image` with a served URL. `imagePrompt` is optional; when
 * missing the image engine composes its own prompt from alt + caption + the
 * surrounding section text.
 */
export interface ImagePlaceholderBlock {
  style: "image-placeholder";
  alt: string;
  caption?: string;
  /** Optional English prompt for the image-gen model (subject / composition /
   *  lighting / style keywords). Hybrid mode: if absent, image engine writes
   *  its own. */
  imagePrompt?: string;
  /** Set by the image engine while a generation is in flight, so the frontend
   *  can show a loading state. Cleared once the placeholder is replaced. */
  status?: "pending" | "generating" | "failed";
  /** Last error if status === "failed". */
  error?: string;
}

/**
 * Mindmap PPT embed. Marks the element as having a "导图 PPT" view and
 * embeds a preview inline. The actual mindmap tree IS the element's subtree
 * — this block just declares "render this element as a mindmap" + carries
 * a snapshot of when the PPT was generated.
 *
 * Conventional section id: `mindmap-ppt`. Conventional section title:
 * `PPT 展示图`. Both auto-applied when a PPT is generated.
 */
export interface MindmapEmbedBlock {
  style: "mindmap-embed";
  /** Element id of the deck-root this embed belongs to. When `deckRootId`
   *  equals the element's OWN id, this element is the root of that deck;
   *  otherwise it's a node inside someone else's deck. A single element can
   *  carry multiple embed blocks — one per deck it participates in — and
   *  each carries its own cover / disable flags. */
  deckRootId: string;
  /** Source of this PPT card. `child-of-deck` means the element is a node
   *  inside someone else's deck — it shows the same embed UI but doesn't
   *  appear in the top-level mindmap list. */
  origin: "from-element" | "ai-from-prose" | "child-of-deck";
  /** ISO time the PPT was (re-)generated. */
  generatedAt: string;
  /** Adapter that generated it, when AI-driven. */
  aiModel?: string;
  /** Optional one-line summary for the embed card (audience / hint / etc.). */
  caption?: string;
  /** Deck-root only: when true, the deck is hidden from the mindmap list
   *  view. The element keeps its "PPT 展示图" section so the user can
   *  unhide later. */
  hidden?: boolean;
  /** When true, this node renders without text in the deck identified by
   *  deckRootId. Per-deck — different decks can have different settings. */
  textDisabled?: boolean;
  /** When true, this node renders without image in the deck identified by
   *  deckRootId. Per-deck — different decks can have different settings. */
  imageDisabled?: boolean;
  /** Per-deck cover image / placeholder. Lives inline on the embed so two
   *  embeds in the same section don't compete for which image is "theirs".
   *  Absent = no cover, no image generation queued. Present with status
   *  "pending"/"generating" = imageQueue is or will be working on it. */
  cover?: MindmapEmbedCover;
}

export interface MindmapEmbedCover {
  status: "pending" | "generating" | "ready" | "failed";
  /** Public URL when status === "ready". */
  src?: string;
  /** Alt text passed into the image-gen prompt; also used as fallback caption. */
  alt?: string;
  caption?: string;
  /** Optional English prompt; codex falls back to deriving one from alt + alt
   *  context when missing. */
  imagePrompt?: string;
  /** Last error message when status === "failed". */
  error?: string;
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
  | ImageBlock
  | MindmapEmbedBlock;

export interface DynamicSection {
  /** Short kebab-case id for the TOC anchor. */
  id: string;
  /** Section heading shown in the body. */
  title: string;
  /** Ordered block sequence inside the section. */
  blocks: StyleBlock[];
}
