export interface ProductDesignDecision {
  topic: string;
  choice: string;
  rationale: string;
  alternatives?: string[];
}

export interface ProductDesignCompetitor {
  name: string;
  takeaway: string;
}

export interface ProductDesignContent {
  /** One-sentence framing of what this design slice answers (定位/用户/架构/etc). */
  designQuestion: string;
  positioning?: string;
  targetAudience?: string;
  needs?: string[];
  competitors?: ProductDesignCompetitor[];
  decisions?: ProductDesignDecision[];
  mvpScope?: string[];
  outOfScope?: string[];
  architectureNote?: string;
}
