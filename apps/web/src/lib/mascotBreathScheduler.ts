/**
 * Rich 首页动画展示系统 v0.1 —— Mascot 呼吸态调度器（T08）。
 *
 * Mascot 进入 thinking 状态后，每 3-5 秒随机插一个 800ms 单次微动作
 * （抓头 / 翻白眼 / 看左 / 看右），播完恢复原状态。让等待 30s+ 不焦虑。
 *
 * 设计：纯 JS 调度，不依赖 React lifecycle。返回 stop() 用于 useEffect 清理。
 */

const MICRO_ACTIONS = [
  "scratch",      // 抓头
  "eyeroll",      // 翻白眼
  "look-left",    // 看左
  "look-right",   // 看右
] as const;
export type MicroAction = typeof MICRO_ACTIONS[number];

const MIN_GAP_MS = 3000;
const MAX_GAP_MS = 5000;
const MICRO_DURATION_MS = 800;
const INITIAL_DELAY_MS = 1200;  // thinking 至少持续 1s 才启动微动作

export interface BreathSchedulerOptions {
  /** 触发一个微动作（前端切 className） */
  onTriggerMicro: (action: MicroAction) => void;
  /** 800ms 后清掉微动作 className */
  onClearMicro: () => void;
}

export function startBreathScheduler(opts: BreathSchedulerOptions): () => void {
  let cancelled = false;
  let timer: number | null = null;
  let lastAction: MicroAction | null = null;

  function scheduleNext(delay: number): void {
    if (cancelled) return;
    timer = window.setTimeout(() => {
      if (cancelled) return;
      // 避免连续相同动作
      let next: MicroAction;
      do {
        next = MICRO_ACTIONS[Math.floor(Math.random() * MICRO_ACTIONS.length)];
      } while (next === lastAction && MICRO_ACTIONS.length > 1);
      lastAction = next;

      opts.onTriggerMicro(next);
      // 微动作播 800ms 后清掉
      timer = window.setTimeout(() => {
        if (cancelled) return;
        opts.onClearMicro();
        // 安排下一次：3-5s 随机
        const gap = MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS);
        scheduleNext(gap);
      }, MICRO_DURATION_MS);
    }, delay);
  }

  scheduleNext(INITIAL_DELAY_MS);

  return () => {
    cancelled = true;
    if (timer !== null) clearTimeout(timer);
    opts.onClearMicro();
  };
}
