/**
 * Rich 首页动画展示系统 v0.1 —— Mascot 事件总线。
 *
 * 简单的 publish/subscribe，避免 chat / mascot 之间硬耦合。事件源：
 *  - ChatOverlay / HomeView 在用户回车 / 流式 chunk / done / error 时 dispatch
 *  - Server SSE 推过来的 mascot 事件（T02 的 mascot:thinking 兜底首帧）
 *  - 错误边界（T21 还没做）也会 dispatch
 *
 * 监听方：MascotDock 的 useMascotState() hook 订阅这些事件，喂给状态机。
 *
 * 为什么不用 Zustand？状态机要的是"瞬时事件流"而不是"持久状态"——事件只
 * 触发一次状态转移，本身不该作为 React state 存在。事件总线 + 状态机
 * derived from events 是最干净的模型。
 */

/** 触发 Mascot 状态变化的事件类型 */
export type MascotEvent =
  /** 用户按回车 / 发送 chat —— 立即切 thinking */
  | { type: "user-send" }
  /** 流式回答的第一个 text chunk 到达 —— 切 talking */
  | { type: "first-text-chunk" }
  /** AI 调用了工具（在 thinking 期间） —— 保持 thinking */
  | { type: "tool-progress"; tool: string }
  /** 回答完成 —— 切 idle 或 proud（看是否复杂任务） */
  | { type: "done"; complex?: boolean }
  /** 出错 —— 切 embarrassed */
  | { type: "error"; message?: string }
  /** 用户明确赞 / AI 主动得意 —— 切 proud */
  | { type: "praise" }
  /** 用户说了 Rich 听不懂的话 —— 切 confused */
  | { type: "puzzled" }
  /** 服务器 SSE 直接指定状态（T02 的 mascot:thinking 帧）—— 强制切 */
  | { type: "server-push"; state: MascotState }
  /** 强制切到某状态（调试用） */
  | { type: "force"; state: MascotState };

/** 6 种核心情绪 + idle */
export type MascotState =
  | "idle"           // 默认 - 漫步循环（现有 4 帧）
  | "thinking"       // AI 处理中 - 慢呼吸 + 偶尔小动作
  | "talking"        // 流式输出中 - 嘴动 / 手动
  | "proud"          // 答对了 - 小跳跃 / 抬头挺胸
  | "confused"       // 听不懂 - 歪头 + 问号
  | "embarrassed";   // 出错了 - 缩头 + 抓后脑

type Listener = (event: MascotEvent) => void;

const listeners = new Set<Listener>();

/** 订阅事件。返回取消订阅函数。 */
export function onMascotEvent(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 推一个事件 —— 所有 listener 同步执行 */
export function dispatchMascotEvent(event: MascotEvent): void {
  for (const l of listeners) {
    try { l(event); } catch (e) { console.error("mascot listener err:", e); }
  }
}

/** 便利函数：直接切到指定状态 */
export function setMascotState(state: MascotState): void {
  dispatchMascotEvent({ type: "force", state });
}
