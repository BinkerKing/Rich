export function flowchartCodexPrompt({ projectId, flowchartId, title, selectedNodeIds, request }) {
  return [
    "你正在为 Rich 项目流程图执行节点细化/整改。",
    "第一步必须调用 rich_flowchart_manage(action: get) 读取最新流程图；不要依赖聊天内容猜测节点、连线或详情。",
    selectedNodeIds.length ? "只可操作下方指定的 Project ID 与 Flowchart ID。优先只修改选中节点；如需结构信息，先通过 MCP 获取。" : "本次针对整张流程图；请根据用户要求通过 MCP 创建或整改结构、内容与样式。",
    "可用 MCP：rich_flowchart_manage。使用 update_node 修改节点；create_node/create_edge 补图；update_edge 调整连线；update_chart 修改图目标或状态。删除必须先取得用户明确同意。",
    "完成修改后，简短说明已调整的节点和原因；不要只在聊天中给建议，必须通过 MCP 保存变更。",
    "", "## 定位",
    `- Project ID: ${projectId}`,
    `- Flowchart ID: ${flowchartId}`,
    `- 标题: ${title}`,
    "", selectedNodeIds.length ? `## 本次选中节点：${selectedNodeIds.join(", ")}` : "## 本次整改范围：整张流程图",
    `## 用户请求\n${request.trim()}`,
  ].join("\n");
}
