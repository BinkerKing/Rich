import type { AIScenario } from "./modelRouter.js";
import type { AIAdapter } from "./adapter.js";
import { extractJson } from "./extractJson.js";
import { startOpRecord } from "./aiOpLog.js";

type MessageLike = { role: string; content: unknown };

export interface ChatTurnPlan {
  scenario: AIScenario;
  intent: "answer" | "content" | "analysis" | "document" | "data" | "operate-rich";
  requiresAgent: boolean;
  reason: string;
}

const VALID_SCENARIOS = new Set<AIScenario>(["chat", "agent-task", "content", "analysis", "document", "data"]);
const VALID_INTENTS = new Set<ChatTurnPlan["intent"]>(["answer", "content", "analysis", "document", "data", "operate-rich"]);

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map(part => {
      if (!part || typeof part !== "object") return "";
      const record = part as Record<string, unknown>;
      return record.type === "text" && typeof record.text === "string" ? record.text : "";
    })
    .filter(Boolean)
    .join("\n");
}

function lastUserText(messages: MessageLike[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messageText(messages[i].content).trim();
  }
  return "";
}

const RICH_OPERATION_RE = /(rich|hermes|codex|飞书|后台|首页|项目管理|应用中心|小程序|数据字典|知识树|ai早报|数据库|postgres|sqlite|服务器|部署|app|快捷键|cli|mcp|git|github)/i;
const OPERATION_VERB_RE = /(帮我|把|给|需要|继续|开始|处理|修复|新增|删除|修改|更新|调整|接入|迁移|同步|导入|导出|启动|重启|打包|提交|配置|绑定|清理|排查|检查|测试|落库|入库|生成|记录)/;
const PROJECT_TASK_RE = /(项目|需求|功能|任务|待办|迭代|版本|原型|页面|模块|流程|bug|问题)/i;
const PROJECT_TASK_VERB_RE = /(帮我|请|需要|继续|开始|处理|修复|实现|开发|完成|做|推进|落地|搭建|创建|新增|删除|修改|更新|调整|接入|迁移|同步|导入|导出|启动|重启|打包|提交|配置|清理|排查|检查|测试|查看|列出|读取|查询)/;
const DOCUMENT_RE = /(文档|ppt|pptx|excel|xlsx|pdf|合同|报告|日报|周报|演讲稿|手册)/i;
const DATA_RE = /(数据分析|数据库|sql|mapping|字段|表结构|码值|postgres|mysql|oracle|etl)/i;

export function planChatTurn(messages: MessageLike[]): ChatTurnPlan {
  const text = lastUserText(messages);
  const normalized = text.toLowerCase();

  if (normalized.startsWith("/干活") || normalized.startsWith("/task")) {
    return { scenario: "agent-task", intent: "operate-rich", requiresAgent: true, reason: "用户显式进入干活模式" };
  }
  if (RICH_OPERATION_RE.test(text) && OPERATION_VERB_RE.test(text)) {
    return { scenario: "agent-task", intent: "operate-rich", requiresAgent: true, reason: "请求包含 Rich/代码/环境相关操作意图" };
  }
  if (normalized.startsWith("/搜索") || normalized.startsWith("/search")) {
    return { scenario: "analysis", intent: "analysis", requiresAgent: false, reason: "用户显式进入搜索/分析模式" };
  }
  if (DATA_RE.test(text)) {
    return { scenario: "data", intent: "data", requiresAgent: false, reason: "请求偏数据、SQL 或 Mapping 分析" };
  }
  if (DOCUMENT_RE.test(text)) {
    return { scenario: "document", intent: "document", requiresAgent: false, reason: "请求偏文档/材料产出或解析" };
  }
  if (/(写|整理|润色|改写|扩写|总结|提炼|观点|方案|prd)/i.test(text)) {
    return { scenario: "content", intent: "content", requiresAgent: false, reason: "请求偏内容产出" };
  }
  if (PROJECT_TASK_RE.test(text) && PROJECT_TASK_VERB_RE.test(text)) {
    return { scenario: "agent-task", intent: "operate-rich", requiresAgent: true, reason: "请求包含项目任务与执行意图" };
  }

  return { scenario: "chat", intent: "answer", requiresAgent: false, reason: "默认普通问答" };
}

export async function planChatTurnWithModel(
  adapter: AIAdapter,
  messages: MessageLike[],
  signal?: AbortSignal,
): Promise<ChatTurnPlan> {
  const fallback = planChatTurn(messages);
  const text = lastUserText(messages);
  if (!text) return fallback;

  const prompt = [
    "你是 Rich 的 AI 调度器。只输出 JSON，不要解释。",
    "根据用户最后一轮输入，判断这一轮应该走哪个 Rich AI 场景。",
    "scenario 只能是 chat, content, analysis, document, data, agent-task。",
    "普通问答用 chat；文章/方案/表达产出用 content；文档/PPT/Excel/PDF/合同处理用 document；SQL/Mapping/数据库分析用 data；需要操作 Rich、代码、部署、文件、服务器、Git、CLI、MCP 时用 agent-task。",
    `用户输入：${text}`,
    "输出 JSON: {\"scenario\":\"chat\",\"intent\":\"answer\",\"requiresAgent\":false,\"reason\":\"一句话原因\"}",
  ].join("\n");
  const handle = await startOpRecord({
    op: "chat-turn-plan",
    model: adapter.name,
    scenario: "analysis",
    scope: { fallbackScenario: fallback.scenario },
    prompt,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let output = "";
  try {
    for await (const event of adapter.stream({
      prompt,
      scenario: "analysis",
      signal: controller.signal,
    })) {
      if (event.type === "delta") output += event.text;
      if (event.type === "done") output = event.fullText || output;
      if (event.type === "error") throw new Error(event.message);
    }
    const parsed = extractJson(output) as Partial<ChatTurnPlan>;
    const scenario = VALID_SCENARIOS.has(parsed.scenario as AIScenario)
      ? parsed.scenario as AIScenario
      : fallback.scenario;
    const intent = VALID_INTENTS.has(parsed.intent as ChatTurnPlan["intent"])
      ? parsed.intent as ChatTurnPlan["intent"]
      : fallback.intent;
    const requiresAgent = typeof parsed.requiresAgent === "boolean"
      ? parsed.requiresAgent
      : scenario === "agent-task";
    const reason = typeof parsed.reason === "string" && parsed.reason.trim()
      ? parsed.reason.trim().slice(0, 160)
      : fallback.reason;
    const plan: ChatTurnPlan = { scenario, intent, requiresAgent, reason };
    await handle.recordDone(output);
    return plan;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await handle.recordError(message);
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}
