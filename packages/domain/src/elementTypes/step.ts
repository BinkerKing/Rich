export interface StepContent {
  goal: string;
  preconditions?: string[];
  steps: {
    n: number;
    action: string;
    check?: string;
  }[];
  completionCriteria?: string[];
  commonFailures?: string[];
  nextAction?: string;
}
