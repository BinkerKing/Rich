/**
 * Rich 首页动画展示系统 v0.1 —— Mascot 状态的 React 接入层。
 *
 * 一个全局共享状态机实例（应用级），多个 Mascot 组件实例共享同一状态机。
 * useMascotState() hook 订阅状态机，事件总线接到状态机做 derived 转移。
 */

import { useSyncExternalStore } from "react";
import { createMascotStateMachine, type StateMachineHandle } from "./mascotStateMachine.js";
import { onMascotEvent, type MascotState } from "./mascotEvents.js";

// 单例：整个 app 只有一个 Mascot 状态机。模块作用域避免被 React 重建。
const machine: StateMachineHandle = createMascotStateMachine("idle");

// 事件总线 → 状态机（启动时挂一次；模块加载即生效）
let busSubscribed = false;
function ensureBusSubscribed(): void {
  if (busSubscribed) return;
  busSubscribed = true;
  onMascotEvent((event) => {
    machine.dispatch(event);
  });
}
ensureBusSubscribed();

/**
 * React hook：返回当前 Mascot 状态，状态变化时自动 rerender。
 * 用 useSyncExternalStore 避免并发模式下的 tearing。
 */
export function useMascotState(): MascotState {
  return useSyncExternalStore(
    (callback) => machine.onChange(callback),
    () => machine.getState(),
    () => machine.getState(),
  );
}

/** 给非 React 代码（如 SSE handler）直接读当前状态。 */
export function getMascotState(): MascotState {
  return machine.getState();
}

/** 单元测试 / 调试用 —— 重置到 idle。生产代码别用，用 dispatchMascotEvent({ type: 'force', state: 'idle' })。 */
export function _resetMascotForTest(): void {
  machine.destroy();
  ensureBusSubscribed();
}

// 在 chat / error 处发起 dispatch 时记得 import dispatchMascotEvent
// 这里 export 给方便：
export { dispatchMascotEvent, setMascotState } from "./mascotEvents.js";
