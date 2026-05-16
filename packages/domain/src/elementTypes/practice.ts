export interface PracticeContent {
  productPositioning: string;
  targetAudience: string;
  needs: string[];
  competitors?: {
    name: string;
    takeaway: string;
  }[];
  mvpFeatures: string[];
  implementationPath: string[];
}
