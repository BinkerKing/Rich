export interface FlowStep {
  label: string;
  description?: string;
}

export interface Example {
  title: string;
  body: string;
}

export interface Exercise {
  prompt: string;
  hint?: string;
}

export interface ConceptContent {
  oneSentence: string;
  coreExplain: string;
  whyMatters: string;
  mechanisms?: FlowStep[];
  examples?: Example[];
  misconceptions?: string[];
  exercises?: Exercise[];
  nextSteps?: string[];
}
