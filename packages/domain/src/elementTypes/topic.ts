export interface TopicCoreModule {
  id: string;
  title: string;
  description: string;
  /** Optional learning focus — what the user should attend to in this module. */
  focus?: string;
}

export interface TopicContent {
  intro: string;
  learningGoals: string[];
  coreModules: TopicCoreModule[];
  recommendedPaths: string[];
  /** Beginner-friendly restatement of the topic. Optional. */
  beginnerExplain?: string;
}
