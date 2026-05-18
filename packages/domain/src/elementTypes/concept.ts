export interface FlowStep {
  label: string;
  description?: string;
}

export interface Exercise {
  prompt: string;
  hint?: string;
}

/**
 * Open-ended user-requested section, appended via refine.
 * Renders as its own block in the body (and gets a TOC entry).
 */
export interface ExtraSection {
  /** Short slug for the TOC anchor; kebab-case. */
  id: string;
  /** Section heading shown to the reader. */
  title: string;
  /** Plain-text / markdown body. */
  body: string;
  /** Optional ordering hint; lower = earlier. Default: appended in array order. */
  order?: number;
}

/**
 * Mermaid flow / sequence / state diagram. Rendered as SVG by the frontend.
 * The AI emits the diagram in standard Mermaid syntax.
 */
export interface DiagramBlock {
  /** Short slug for the block id. */
  id: string;
  /** Display title shown above the diagram. */
  title: string;
  /** Optional one-line caption shown under the diagram. */
  caption?: string;
  /** Mermaid syntax body — e.g. "flowchart TD\n  A[读取] --> B[校验]\n  B --> C[落盘]". */
  mermaid: string;
}

export interface ConceptContent {
  oneSentence: string;
  coreExplain: string;
  whyMatters: string;
  /** Beginner-friendly restatement used in the "小白理解版" callout. */
  beginnerExplain?: string;
  /** Bullets shown in the "学习重点" list (also fed into "知识组成" when no modules). */
  keyPoints?: string[];
  /** Concrete learning goals — shown in the learning-points block alongside keyPoints. */
  learningGoals?: string[];
  mechanisms?: FlowStep[];
  /** Short example sentences (NOT structured Example objects — keep it lean). */
  examples?: string[];
  misconceptions?: string[];
  exercises?: Exercise[];
  nextSteps?: string[];
  /** User-requested ad-hoc sections (added via refine "add section ..."). */
  extraSections?: ExtraSection[];
  /** Mermaid flow / sequence / state diagrams attached to this concept. */
  diagrams?: DiagramBlock[];
}
