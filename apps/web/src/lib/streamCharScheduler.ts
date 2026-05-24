/**
 * Rich 首页动画展示系统 v0.1 —— rAF 字符调度器。
 *
 * 把 StreamParser 喂过来的字符按 charDelayMap 的节奏渲染到目标 DOM。
 * 用 requestAnimationFrame 而不是 setTimeout：
 *  - 更精准（rAF 跟显示器同步，60Hz = 16.67ms / 帧）
 *  - 暂停 tab 时自动停（节能）
 *  - 多个调度器同帧批量 append 不抖
 *
 * 使用：
 *   const sched = createStreamCharScheduler({
 *     onCommit: (ch) => { textEl.textContent += ch; },
 *     preset: "default",
 *   });
 *   sched.push("Hello");           // 入队
 *   sched.markBlockOpen();          // 视觉块前的仪式感停顿
 *   sched.flush();                  // 立即清空残留（end of stream）
 *   sched.cancel();                 // 强制停掉 rAF 循环
 *
 * 也支持 reduce-motion：reduced 为 true 时立刻 emit 所有字符（无延迟）。
 */

import { delayFor, BLOCK_OPEN_DELAY, type DelayPreset } from "./charDelayMap.js";

export interface StreamCharSchedulerOptions {
  /** 字符到达 DOM 时触发；调用方决定 append 到哪里 */
  onCommit: (ch: string) => void;
  /** 字符延迟预设 */
  preset?: DelayPreset;
  /** 系统 reduced-motion 偏好：true 时跳过所有延迟，瞬时 emit */
  reduced?: boolean;
  /** 整个 queue 排空时触发 */
  onIdle?: () => void;
}

export interface StreamCharScheduler {
  /** 入队字符（可以批量传字符串） */
  push: (chars: string) => void;
  /** 标记一个仪式感停顿（视觉块前用）—— 后续字符延迟 600ms 才 emit */
  markBlockOpen: () => void;
  /** 标记关键词起始 —— 下一个 push 的字符延迟 +keywordStartBoost ms */
  markKeywordStart: () => void;
  /** 切换预设（如概念解释 → slow） */
  setPreset: (preset: DelayPreset) => void;
  /** 立刻清空队列（end of stream 时调，避免拖尾） */
  flush: () => void;
  /** 取消整个调度器（卸载组件时调） */
  cancel: () => void;
  /** 当前队列长度（调试用） */
  pending: () => number;
}

interface QueueEntry {
  ch: string;
  /** 这个字符 ready 的绝对时间（performance.now() 时基） */
  readyAt: number;
}

export function createStreamCharScheduler(opts: StreamCharSchedulerOptions): StreamCharScheduler {
  const queue: QueueEntry[] = [];
  let rafId: number | null = null;
  let nextReadyAt = 0;       // 下一个字符最早可以 emit 的时间
  let preset: DelayPreset = opts.preset ?? "default";
  let pendingKeywordStart = false;
  let cancelled = false;
  let lastChar: string | null = null;

  function scheduleNext(): void {
    if (cancelled) return;
    if (queue.length === 0) {
      rafId = null;
      opts.onIdle?.();
      return;
    }
    if (rafId !== null) return;
    rafId = requestAnimationFrame(tick);
  }

  function tick(): void {
    rafId = null;
    if (cancelled) return;
    const now = performance.now();
    // 一帧内可能 emit 多个字符（如果它们 readyAt 都已经过去了）
    while (queue.length > 0 && queue[0].readyAt <= now) {
      const entry = queue.shift()!;
      opts.onCommit(entry.ch);
    }
    if (queue.length > 0) {
      rafId = requestAnimationFrame(tick);
    } else {
      opts.onIdle?.();
    }
  }

  function push(chars: string): void {
    if (cancelled) return;
    if (opts.reduced) {
      // reduce-motion: 瞬时 emit，跳过所有延迟
      for (const ch of chars) opts.onCommit(ch);
      return;
    }
    const now = performance.now();
    if (nextReadyAt < now) nextReadyAt = now;
    for (const ch of chars) {
      const ctx = {
        isKeywordStart: pendingKeywordStart,
        prevIsSpace: lastChar === " " || lastChar === null,
      };
      const delay = delayFor(ch, preset, ctx);
      nextReadyAt += delay;
      queue.push({ ch, readyAt: nextReadyAt });
      pendingKeywordStart = false;
      lastChar = ch;
    }
    scheduleNext();
  }

  function markBlockOpen(): void {
    if (cancelled) return;
    const now = performance.now();
    if (nextReadyAt < now) nextReadyAt = now;
    nextReadyAt += BLOCK_OPEN_DELAY;
  }

  function markKeywordStart(): void {
    pendingKeywordStart = true;
  }

  function setPreset(p: DelayPreset): void {
    preset = p;
  }

  function flush(): void {
    // 立刻 emit 所有剩余字符，跳过等待
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    while (queue.length > 0) {
      opts.onCommit(queue.shift()!.ch);
    }
    opts.onIdle?.();
  }

  function cancel(): void {
    cancelled = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    queue.length = 0;
  }

  return { push, markBlockOpen, markKeywordStart, setPreset, flush, cancel, pending: () => queue.length };
}
