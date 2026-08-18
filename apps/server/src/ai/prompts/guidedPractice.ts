export interface GuidedPracticeArgs {
  stage: "goal" | "scenario" | "technical" | "scope" | "prd" | "plan";
  userInput: string;
  draft: {
    title?: string;
    idea?: string;
    goal?: string;
    users?: string;
    scenarios?: string;
    technical?: string;
    features?: string;
    risks?: string;
    outOfScope?: string;
    tasks?: string;
  };
  messages: Array<{ role: "user" | "assistant"; stage: string; text: string }>;
}

export function buildGuidedPracticePrompt(args: GuidedPracticeArgs): string {
  const input = {
    stage: args.stage,
    userInput: args.userInput,
    draft: args.draft,
    messages: args.messages.slice(-8),
  };
  return `只输出合法 JSON。任务：项目实战引导式立项的需求分析。输入=${JSON.stringify(input)}。输出字段：reply,draftPatch,nextStage,confidence,openQuestions。draftPatch 只能使用 title,idea,goal,users,scenarios,technical,features,risks,outOfScope,tasks；字段值用中文字符串或字符串数组，不要嵌套对象。`;
}
