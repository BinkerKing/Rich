export interface CodexLocationContextInput {
  page: string[];
  project?: { id: string; title: string };
  business?: { kind: "任务" | "交付物" | "项目流程图" | "项目数据字典" | "报告中心"; id: string; title: string };
}

export function formatCodexLocationContext(input: CodexLocationContextInput): string {
  const lines = [`页面定位：${input.page.join(" / ")}`];
  if (input.project && input.business) {
    lines.push(`业务定位：项目：${input.project.title}（项目编号：${input.project.id}） / ${input.business.kind}：${input.business.title}（${input.business.kind}编号：${input.business.id}）`);
  }
  return lines.join("\n");
}
