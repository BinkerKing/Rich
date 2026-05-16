export interface TopicContent {
  intro: string;
  learningGoals: string[];
  coreModules: {
    id: string;
    title: string;
    description: string;
  }[];
  recommendedPaths: string[];
}
