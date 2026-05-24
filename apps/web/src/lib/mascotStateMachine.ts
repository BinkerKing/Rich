/**
 * Rich 首页动画展示系统 v0.1 —— Mascot 状态机。
 *
 * 输入：MascotEvent 流；输出：current MascotState。
 *
 * 规则：
 *  - 大部分转移由事件直接决定（user-send → thinking）
 *  - 个别状态有"自然回落"——proud / confused / embarrassed 显示 2.5s 后回 idle
 *  - force / server-push 事件**总是**强制切换，无视当前状态
 *  - **防抖**：相同目标状态 200ms 内只切一次，避免快速 chat 时表情眨眼
 *
 * 这个模块纯逻辑，没有 React 依赖。React 接入靠 useMascotState() hook。
 */

import type { MascotEvent, MascotState } from "./mascotEvents.js";

/** 自动回 idle 的状态（显示一段时间后自然恢复） */
const AUTO_FALLBACK: Record<MascotState, number | undefined> = {
  idle: undefined,
  thinking: undefined,        // thinking 持续到下一事件
  talking: undefined,         // talking 持续到 done/error
  proud: 2500,
  confused: 2500,
  embarrassed: 3000,
};

/** 防抖窗口：相同目标状态 200ms 内只切一次（避免眨眼） */
const DEBOUNCE_MS = 200;

export interface StateMachineHandle {
  getState: () => MascotState;
  dispatch: (event: MascotEvent) => void;
  /** 订阅状态变化（每次 state 真的变了 emit 一次） */
  onChange: (listener: (state: MascotState) => void) => () => void;
  /** 销毁（清掉定时器） */
  destroy: () => void;
}

export function createMascotStateMachine(initial: MascotState = "idle"): StateMachineHandle {
  let state: MascotState = initial;
  /** 最近一次 setState 的目标 + 时间，用于防抖 */
  let lastTransition: { target: MascotState; at: number } | null = null;
  /** 自动回落定时器（proud/confused/embarrassed 显示一段时间后回 idle） */
  let fallbackTimer: number | null = null;
  const subscribers = new Set<(s: MascotState) => void>();

  function clearFallback(): void {
    if (fallbackTimer !== null) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
  }

  function scheduleFallback(): void {
    clearFallback();
    const ms = AUTO_FALLBACK[state];
    if (ms !== undefined) {
      fallbackTimer = setTimeout(() => {
        setState("idle", { force: true });
      }, ms) as unknown as number;
    }
  }

  function setState(next: MascotState, opts: { force?: boolean } = {}): void {
    if (next === state && !opts.force) return;
    // 防抖：除非 force 或转换时间间隔够，否则跳过
    const now = performance.now();
    if (
      !opts.force &&
      lastTransition &&
      lastTransition.target === next &&
      now - lastTransition.at < DEBOUNCE_MS
    ) {
      return;
    }
    state = next;
    lastTransition = { target: next, at: now };
    scheduleFallback();
    for (const fn of subscribers) {
      try { fn(state); } catch (e) { console.error("mascot subscriber err:", e); }
    }
  }

  function dispatch(event: MascotEvent): void {
    switch (event.type) {
      case "user-send":
        setState("thinking");
        break;
      case "first-text-chunk":
        // 只有当前在 thinking 才转 talking；如果已经在 talking 则保持
        if (state === "thinking") setState("talking");
        break;
      case "tool-progress":
        // 工具调用期间保持 thinking（已经在 thinking 就不动）
        if (state !== "thinking") setState("thinking");
        break;
      case "done":
        setState(event.complex ? "proud" : "idle");
        break;
      case "error":
        setState("embarrassed");
        break;
      case "praise":
        setState("proud");
        break;
      case "puzzled":
        setState("confused");
        break;
      case "server-push":
      case "force":
        setState(event.state, { force: true });
        break;
    }
  }

  return {
    getState: () => state,
    dispatch,
    onChange: (listener) => {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
    destroy: () => {
      clearFallback();
      subscribers.clear();
    },
  };
}
