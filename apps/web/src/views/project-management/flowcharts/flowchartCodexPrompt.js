function compact(value, limit = 600) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) : "";
}

export function flowchartCodexPrompt({ projectId, flowchartId, title, graph, selectedNodeIds, request, includeGraph = true }) {
  const names = new Map(graph.nodes.map(node => [node.id, node.data.label]));
  const selected = new Set(selectedNodeIds);
  const nodeText = node => `- ${node.id}｜${node.data.kind}｜${node.data.label}｜范围：${node.data.scope}${node.data.source ? `｜来源：${compact(node.data.source, 180)}` : ""}${selected.has(node.id) ? `｜详情：${compact(node.data.description, 3_000) || "无"}` : ""}`;
  const nodes = graph.nodes.map(nodeText).join("\n") || "- 无节点";
  const selectedNodes = graph.nodes.filter(node => selected.has(node.id)).map(nodeText).join("\n") || "- 未找到选中节点";
  const edges = graph.edges.map(edge => `- ${names.get(edge.source) ?? edge.source} → ${names.get(edge.target) ?? edge.target}${edge.label ? `（${edge.label}）` : ""}`).join("\n") || "- 无连线";
  return [
    "你正在为 Rich 项目流程图执行节点细化/整改。",
    "先调用 rich_flowchart_manage(action: get) 读取当前完整图；数据可能已在任务发起后变化。",
    "只可操作下方指定的 Project ID 与 Flowchart ID。优先只修改选中节点；若结构完整性确实需要，可补充必要节点或连线，并说明原因。",
    "可用 MCP：rich_flowchart_manage。使用 update_node 修改节点标签、类型、位置或详情；create_node/create_edge 补图；update_edge 调整连线；update_chart 修改图目标或状态。删除必须先取得用户明确同意。",
    "完成修改后，简短说明已调整的节点和原因；不要只在聊天中给建议，必须通过 MCP 保存变更。",
    "", "## 定位",
    `- Project ID: ${projectId}`,
    `- Flowchart ID: ${flowchartId}`,
    `- 标题: ${title}`,
    ...(includeGraph ? [
      `- 背景/目标: ${compact(graph.objective, 2_000) || "未填写"}`,
      `- 状态: ${graph.status}`,
      "", "## 全图结构",
      "### 节点", nodes,
      "### 连线", edges,
    ] : ["- 此会话已具备首次发送的全图背景；本次请只处理以下节点。"]),
    "", `## 本次选中节点：${selectedNodeIds.join(", ")}`,
    selectedNodes,
    `## 用户请求\n${request.trim()}`,
  ].join("\n");
}
