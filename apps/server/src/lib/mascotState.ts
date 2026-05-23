import { eventBus } from "./eventBus.js";

/**
 * In-memory Rich mascot animation state. Lives only for the lifetime of the
 * server process — no persistence (a server restart resets to "walk").
 *
 * The full animation catalogue is defined here on the server so:
 *   1. Hermes gets a precise enum via MCP (list_mascot_animations).
 *   2. The REST API can validate names before publishing.
 *   3. New animations only need editing in one place (this file + the
 *      matching client-side CSS class in HomeView.css).
 *
 * The CLIENT decides how to *render* each name (CSS classes, sprite remix,
 * particle effects). Server-side we only carry the name + optional params.
 */

export type MascotAnimationName =
  | "walk"        // 默认走路（青色光晕）
  | "idle"        // 站立呼吸（最安静）
  | "celebrate"   // 庆祝（金色光晕，高频跳跃）
  | "think"       // 思考（蓝色光晕，慢速）
  | "happy"       // 高兴（绿色光晕，弹性跳）
  | "sad"         // 低落（灰色，慢）
  | "alert"       // 警觉（红色光晕，抖动）
  | "sleep"       // 睡眠（深蓝，几乎不动）
  | "dance"       // 跳舞（彩虹光晕，最快）
  | "wave"        // 打招呼（一次性挥手）
  | "transform"   // 变身特效（缩放 + 闪光，一次性）
  | "ironman";    // 钢铁侠 30s 完整序列（变身 → 起飞 → 飞行 → 降落）

export interface MascotAnimation {
  name: MascotAnimationName;
  label: string;
  description: string;
  /** Looping animations stay until something else triggers; one-shot ones
   *  auto-revert to the prior animation after `durationMs`. */
  loop: boolean;
  /** Default duration when caller doesn't override. One-shot fixed; loops
   *  ignored unless caller passes durationMs. */
  defaultDurationMs?: number;
}

export const ANIMATIONS: Record<MascotAnimationName, MascotAnimation> = {
  walk:      { name: "walk",      label: "走路",   description: "默认动画，青色光晕的稳定走路循环", loop: true },
  idle:      { name: "idle",      label: "待机",   description: "静默呼吸，几乎不动，最低视觉重量", loop: true },
  celebrate: { name: "celebrate", label: "庆祝",   description: "金色光晕 + 高频跳跃，适合任务完成", loop: false, defaultDurationMs: 4000 },
  think:     { name: "think",     label: "思考",   description: "蓝色光晕 + 慢速 + 头顶问号粒子", loop: true },
  happy:     { name: "happy",     label: "高兴",   description: "绿色光晕 + 弹性跳，适合正向反馈", loop: true },
  sad:       { name: "sad",       label: "低落",   description: "灰色 + 缓慢，适合表达失败 / 限制", loop: true },
  alert:     { name: "alert",     label: "警觉",   description: "红色光晕 + 抖动，适合警告 / 紧急", loop: true },
  sleep:     { name: "sleep",     label: "睡眠",   description: "深蓝 + 几乎不动 + Z 粒子，适合空闲", loop: true },
  dance:     { name: "dance",     label: "跳舞",   description: "彩虹光晕 + 最快速度，适合特殊时刻", loop: true },
  wave:      { name: "wave",      label: "打招呼", description: "挥手一下，一次性", loop: false, defaultDurationMs: 2000 },
  transform: { name: "transform", label: "变身",   description: "缩放 + 闪光特效，一次性", loop: false, defaultDurationMs: 1500 },
  ironman:   { name: "ironman",   label: "钢铁侠序列", description: "完整 30s 戏剧场景：变身 → 起飞 → 上半屏飞行 → 帅气三点落地", loop: false, defaultDurationMs: 30000 },
};

export interface MascotState {
  current: MascotAnimationName;
  /** Set to a fallback animation when current is one-shot. After current's
   *  duration elapses, runtime auto-reverts to fallback. */
  fallback: MascotAnimationName;
  /** ISO timestamp of when this animation was triggered. */
  startedAt: string;
  /** ms — for one-shot animations, how long before reverting to `fallback`. */
  durationMs?: number;
  /** Who triggered it — useful audit trail. */
  triggeredBy: "hermes" | "user" | "system";
}

let state: MascotState = {
  current: "walk",
  fallback: "walk",
  startedAt: new Date().toISOString(),
  triggeredBy: "system",
};

/** Timer handle for auto-revert on one-shot animations. */
let revertTimer: NodeJS.Timeout | null = null;

export function getMascotState(): MascotState {
  return { ...state };
}

export function listMascotAnimations(): MascotAnimation[] {
  return Object.values(ANIMATIONS);
}

/**
 * Trigger a new mascot animation. For one-shot animations, also schedule
 * an auto-revert back to the current loop animation when duration elapses.
 *
 * Returns the new state.
 */
export function playMascotAnimation(input: {
  name: MascotAnimationName;
  durationMs?: number;
  triggeredBy?: "hermes" | "user" | "system";
}): MascotState {
  const def = ANIMATIONS[input.name];
  if (!def) {
    throw new Error(`Unknown animation: ${input.name}`);
  }
  // Cancel any pending revert timer — new animation supersedes it.
  if (revertTimer) {
    clearTimeout(revertTimer);
    revertTimer = null;
  }
  // For one-shot, remember what to revert to. If the current is also one-shot
  // (rare), default the fallback to "walk".
  const fallback: MascotAnimationName = def.loop
    ? input.name
    : (ANIMATIONS[state.current]?.loop ? state.current : "walk");
  const duration = def.loop
    ? input.durationMs
    : (input.durationMs ?? def.defaultDurationMs);
  state = {
    current: input.name,
    fallback,
    startedAt: new Date().toISOString(),
    durationMs: duration,
    triggeredBy: input.triggeredBy ?? "system",
  };
  // Schedule auto-revert for one-shot.
  if (!def.loop && duration) {
    revertTimer = setTimeout(() => {
      revertTimer = null;
      state = {
        current: fallback,
        fallback,
        startedAt: new Date().toISOString(),
        triggeredBy: "system",
      };
      eventBus.publish("mascot.changed", {
        source: "route",
        detail: { op: "revert", to: fallback },
      });
    }, duration);
  }
  eventBus.publish("mascot.changed", {
    source: input.triggeredBy === "hermes" ? "mcp" : "route",
    detail: { op: "play", name: input.name },
  });
  return getMascotState();
}
