export interface OperationContextInput {
  operation: string;
  scenario: string;
  manual?: string;
  notes?: string[];
}

export function buildOperationContextFragment(input: OperationContextInput): string {
  const lines = [
    "【Rich AI 运行上下文】",
    `- operation: ${input.operation}`,
    `- scenario: ${input.scenario}`,
    "- Rich 会把必要的项目、元素、计划、手册或当前请求数据显式放进本次 prompt。",
    "- 只把本次 prompt 中出现的数据当成事实来源；不要依赖看不见的聊天历史补全事实。",
    "- 如果输入信息不足，输出结构内应保留不确定点或待确认问题，不要编造。",
  ];
  for (const note of input.notes ?? []) {
    const text = note.trim();
    if (text) lines.push(`- ${text}`);
  }
  return [
    lines.join("\n"),
    input.manual?.trim() ? input.manual.trim() : "",
    "",
  ].filter(Boolean).join("\n\n");
}
