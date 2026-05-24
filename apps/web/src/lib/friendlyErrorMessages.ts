/**
 * Rich 首页动画展示系统 v0.1 —— T21 错误友好化。
 *
 * 把原始 error.message 映射到「同事感」的友好文案。原始消息不丢，
 * 存到 debug 字段供 admin / cmd+shift+D 查看。
 *
 * 设计思路：检测关键词决定文案 + 重试建议，而不是显示 stack。
 */

export interface FriendlyError {
  /** 用户看到的标题（一句话总结） */
  title: string;
  /** 用户看到的正文（同事语气） */
  message: string;
  /** 建议的下一步动作 */
  suggestion?: string;
  /** 原始错误（保留给调试） */
  debug?: string;
  /** 错误类型（用于 Mascot 表情 / 颜色） */
  kind: "network" | "timeout" | "parse" | "server" | "ai-unavailable" | "validation" | "unknown";
}

const PATTERNS: Array<{
  match: (raw: string) => boolean;
  build: (raw: string) => Omit<FriendlyError, "debug">;
}> = [
  {
    match: (s) => /network|offline|unreachable|ECONNREFUSED|fetch failed/i.test(s),
    build: () => ({
      kind: "network",
      title: "网络好像断了",
      message: "我连不上服务器，可能 wifi / 后端服务暂时不通。",
      suggestion: "检查一下网络，然后重试。",
    }),
  },
  {
    match: (s) => /timeout|timed out|aborted/i.test(s),
    build: () => ({
      kind: "timeout",
      title: "等太久了",
      message: "这个请求超时没回来，可能服务那边正忙。",
      suggestion: "稍等几秒再试一次。",
    }),
  },
  {
    match: (s) => /Hermes unavailable|Hermes 503|Hermes \d+ /i.test(s),
    build: () => ({
      kind: "ai-unavailable",
      title: "Hermes 没响应",
      message: "AI 引擎现在连不上。可能在重启 / 在跑别的任务。",
      suggestion: "等 10 秒重试；持续不行去 后台 → AI 引擎监控 看一下。",
    }),
  },
  {
    match: (s) => /HTTP 5\d{2}|server|internal error/i.test(s),
    build: () => ({
      kind: "server",
      title: "服务器出错了",
      message: "后端返回了 5xx 错误。",
      suggestion: "重试通常能恢复；不行就看 admin 看板。",
    }),
  },
  {
    match: (s) => /JSON|parse|unexpected token|schema validation/i.test(s),
    build: () => ({
      kind: "parse",
      title: "数据解析失败",
      message: "AI 回的格式我没看懂——大概率是它没按约定输出 JSON。",
      suggestion: "重试一次；如果反复出，可能要调 prompt。",
    }),
  },
  {
    match: (s) => /validation failed|invalid input|400/i.test(s),
    build: () => ({
      kind: "validation",
      title: "请求被拒了",
      message: "服务器说我们发的内容不合规。",
      suggestion: "看一下你输入的内容是不是太长 / 含特殊字符。",
    }),
  },
];

export function toFriendlyError(raw: unknown): FriendlyError {
  const message = raw instanceof Error ? raw.message : String(raw ?? "");
  for (const p of PATTERNS) {
    if (p.match(message)) {
      return { ...p.build(message), debug: message };
    }
  }
  return {
    kind: "unknown",
    title: "我跑出错了",
    message: "这一步好像有问题。",
    suggestion: "要不要重来一下？",
    debug: message,
  };
}
