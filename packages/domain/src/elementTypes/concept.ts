export interface FlowStep {
  label: string;
  description?: string;
}

export interface Exercise {
  prompt: string;
  hint?: string;
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
}
