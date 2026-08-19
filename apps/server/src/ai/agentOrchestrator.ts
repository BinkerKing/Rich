import type { AIScenario } from "./modelRouter.js";

type MessageLike = { role: string; content: unknown };

export interface ChatTurnPlan {
  scenario: AIScenario;
  intent: "answer" | "content" | "analysis" | "document" | "data" | "operate-rich";
  requiresAgent: boolean;
  reason: string;
}

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
const DOCUMENT_RE = /(文档|ppt|pptx|excel|xlsx|pdf|合同|发票|报告|日报|周报|演讲稿|手册)/i;
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

  return { scenario: "chat", intent: "answer", requiresAgent: false, reason: "默认普通问答" };
}
