import type { ElementsRepo } from "../repos/ElementsRepo.js";
import type { GreatMeRepo } from "../repos/GreatMeRepo.js";
import type { McpOperationRepo } from "../repos/McpOperationRepo.js";
import type { McpTaskRepo } from "../repos/McpTaskRepo.js";
import type { ProjectManagementRepo } from "../repos/ProjectManagementRepo.js";
import type { ProjectAutomationRepo } from "../modules/project-automation/contracts.js";
import type { RichToolDefinition } from "./registry/catalog.js";
import type { RichToolRegistry } from "./registry/toolRegistry.js";
import { buildMcpV2Registry } from "./server.js";

export function createDocumentationRegistry(): RichToolRegistry {
  const unavailable = new Proxy({}, {
    get: () => async () => { throw new Error("Documentation dependency must not be invoked."); },
  });
  return buildMcpV2Registry({
    elements: unavailable as ElementsRepo,
    projectManagement: unavailable as ProjectManagementRepo,
    operationRepo: unavailable as McpOperationRepo,
    taskRepo: unavailable as McpTaskRepo,
    greatMe: unavailable as GreatMeRepo,
    projectAutomation: unavailable as ProjectAutomationRepo,
  });
}

export function renderMcpV2Catalog(registry: RichToolRegistry): string {
  const definitions = registry.listDefinitions();
  const metrics = registry.measure();
  const lines = [
    "# Rich MCP 2.0 工具目录",
    "",
    "> 此文件由 `pnpm --filter @ke/server mcp:docs` 生成，请勿手工编辑。",
    "",
    `工具数：${metrics.toolCount}；输入 Schema：${metrics.schemaBytes} bytes。所有工具返回统一的 \`{ ok, action, data/error, refs, changes, verification, warnings }\` 信封。`,
    "",
  ];
  for (const tool of definitions) {
    const schema = tool.inputSchema as { properties?: Record<string, unknown>; required?: string[] };
    const fields = Object.keys(schema.properties ?? {});
    lines.push(
      `## \`${tool.name}\``,
      "",
      `- 场景：\`${tool.category}\``,
      `- 用于：${tool.description}`,
      `- 不用于：${whenNotToUse(tool)}`,
      `- 安全属性：只读=${tool.annotations.readOnly}，破坏性=${tool.annotations.destructive}，幂等=${tool.annotations.idempotent}`,
      `- 输入：${fields.length > 0 ? fields.map(field => `\`${field}\`${schema.required?.includes(field) ? "（必填）" : ""}`).join("、") : "无"}`,
      "- 结果：统一 Rich 信封；业务结果在 `data`，持久化对象在 `refs`，写入事实在 `changes`。",
      `- 验证：${tool.verification}`,
      "- 示例：",
      "",
      "```json",
      JSON.stringify(tool.examples[0]?.input ?? {}, null, 2),
      "```",
      "",
    );
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function selectMcpV2Tool(prompt: string, catalog: RichToolDefinition[]): string {
  const available = new Set(catalog.map(tool => tool.name));
  const choose = (name: string) => available.has(name) ? name : "";

  if (/停止任务|确认取消|取消它|取消.*外部执行/.test(prompt)) return choose("rich_work_cancel");
  if (/任务.*(?:执行状态|状态和产物|最新进度)|监控.*Agent|刚才派出的 Agent/.test(prompt)) return choose("rich_work_get_status");
  if (/(?:哪些|列出|同时列出).*(?:Agent )?任务|正在执行或者等待输入|排队、执行中/.test(prompt)) return choose("rich_work_list");

  if (/概括|总体概览|进展到哪一步|有哪些资料和待办/.test(prompt)) return choose("rich_context_get_overview");

  if (/数据字典|字段 G080009.*验证状态/.test(prompt)) return choose("rich_dictionary_manage");
  if (/季度目标/.test(prompt)) return choose("rich_planning_manage");
  if (/数据自动化执行计划/.test(prompt)) return choose("rich_automation_manage");
  if (/练习任务/.test(prompt)) return choose("rich_practice_manage");
  if (/删除知识|知识条目.*标签/.test(prompt)) return choose("rich_knowledge_manage");
  if (/项目待办|项目说明标题|预演删除项目环境/.test(prompt)) return choose("rich_project_manage");

  if (/会议纪要|归档到.*项目|更新项目背景|整理进项目|拆成项目说明|提取行动项/.test(prompt)) {
    return choose("rich_project_organize_conversation");
  }
  if (/知识记录|记住这个经验|保存到知识库|架构原则.*保存|核心观点.*保存/.test(prompt)) {
    return choose("rich_knowledge_capture");
  }

  if (/应用.*(?:执行团队|小队).*计划|确认.*(?:创建|组建).*(?:执行团队|小队)|按.*团队计划.*创建/.test(prompt)) {
    return choose("rich_execution_team_apply");
  }
  if (/(?:规划|准备|设计|需要哪些).*(?:执行团队|小队|Agent)|(?:执行团队|小队).*(?:规划|方案|复用)|复用.*Agent.*(?:小队|团队)/.test(prompt)) {
    return choose("rich_execution_team_plan");
  }

  if (/先给出|先不要|不要开始执行|评估|分析|梳理风险|阻塞点|比较 CLI|实施和回滚计划|分阶段改造计划|技术方案|开发步骤/.test(prompt)) {
    return choose("rich_project_analyze_and_plan");
  }
  if (/交给|派给|让 Codex|帮我把这个做了|工作交给外部 Agent/.test(prompt)) return choose("rich_work_delegate");

  if (/教训|经验库|可复用的调试方法|Agent 选择规则/.test(prompt)) return choose("rich_learning_capture");
  if (/验收|审核|退回|是否接受|确认这次开发达标|检查 Agent 返回/.test(prompt)) return choose("rich_work_review_result");
  return choose("rich_context_search");
}

function whenNotToUse(tool: RichToolDefinition): string {
  if (tool.annotations.readOnly) return "用户已明确要求写入、删除或委派实际工作时。";
  if (tool.category === "delegate") return "目标仍不清楚、只需要方案，或任务不能由外部 Agent 实际执行时。";
  if (tool.category === "capture") return "只需临时回答、不需要写入 Rich，或目标记录需要精确更新而不是新建时。";
  if (tool.category === "review") return "任务尚未完成，或还没有产物与验证证据时。";
  return "目标对象尚未定位；此时先使用查询工具。";
}
