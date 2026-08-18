/**
 * 健康顾问 · 提醒触发器
 *
 * 每分钟扫描一次所有 enabled 的 reminder，判断是否到点：
 *   - daily:   今天 HH:mm 已过，且 lastFiredAt 不是今天
 *   - interval: 距 lastFiredAt 已超过 intervalMin 分钟
 *
 * 命中后分三路投递：
 *   1. feishu  → POST 用户配置的 webhook（消息体走"text" type）
 *   2. screen  → eventBus.publish("reminder.fire") → SSE → 浏览器调 window.Notification
 *   3. inapp   → 同上的 SSE，让 UI 弹应用内 banner
 *
 * 触发后写回 lastFiredAt，避免同分钟内重复触发。
 *
 * 设计选择：复用 greatme.changed 事件作为载体，detail.kind === "reminder.fire"
 *   区分；省得在 EventKind 枚举里加新值（会动到 4-5 个文件）。
 */
import type { HealthRepo } from "../repos/HealthRepo.js";
import type { HealthReminder } from "@ke/domain";
import { eventBus } from "./eventBus.js";

const TICK_MS = 60_000; // 1 minute

export interface ReminderTicker {
  start: () => void;
  stop: () => void;
}

export function createReminderTicker(repo: HealthRepo): ReminderTicker {
  let timer: ReturnType<typeof setInterval> | null = null;

  async function tick() {
    let reminders: HealthReminder[];
    try { reminders = await repo.listReminders(); }
    catch { return; }                       // DB 暂时不可用就跳过这轮
    if (reminders.length === 0) return;

    const now = new Date();
    const due = reminders.filter(r => r.enabled && isDue(r, now));
    if (due.length === 0) return;

    let feishuUrl: string | null = null;
    try { feishuUrl = await repo.getFeishuWebhook(); } catch { /* ignore */ }

    const updated: HealthReminder[] = reminders.map(r => {
      if (!due.some(d => d.id === r.id)) return r;
      return { ...r, lastFiredAt: now.toISOString() };
    });
    await repo.putReminders(updated).catch(() => { /* best-effort */ });

    for (const r of due) {
      // 1. 飞书
      if (r.channels.includes("feishu") && feishuUrl) {
        void postToFeishu(feishuUrl, r).catch(err => {
          console.warn("[reminder] feishu failed:", err);
        });
      }
      // 2 + 3. screen / inapp 共用 SSE 通道
      if (r.channels.includes("screen") || r.channels.includes("inapp")) {
        eventBus.publish("greatme.changed", {
          source: "queue",
          detail: {
            kind: "reminder.fire",
            id: r.id,
            reminderKind: r.kind,
            title: r.title,
            body: r.body ?? "",
            channels: r.channels,
            firedAt: now.toISOString(),
          },
        });
      }
    }
  }

  return {
    start() {
      if (timer) return;
      timer = setInterval(() => { void tick(); }, TICK_MS);
      // 也跑一次首轮，免得用户刚启动就要等 60s
      setTimeout(() => { void tick(); }, 5_000);
    },
    stop() {
      if (timer) { clearInterval(timer); timer = null; }
    },
  };
}

/** "to fire or not to fire" —— 仅本地时间判断 */
function isDue(r: HealthReminder, now: Date): boolean {
  const last = r.lastFiredAt ? new Date(r.lastFiredAt) : null;
  if (r.schedule.kind === "daily") {
    if (!r.schedule.time) return false;
    const [hh, mm] = r.schedule.time.split(":").map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return false;
    // 已经过了今天的目标时间点
    const todayTarget = new Date(now);
    todayTarget.setHours(hh, mm, 0, 0);
    if (now.getTime() < todayTarget.getTime()) return false;
    // 今天还没触发过
    if (last && isSameLocalDay(last, now)) return false;
    return true;
  }
  if (r.schedule.kind === "interval") {
    const min = r.schedule.intervalMin ?? 60;
    if (!last) return true;          // 没触发过 → 立刻触发一次
    return now.getTime() - last.getTime() >= min * 60_000;
  }
  return false;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}

async function postToFeishu(url: string, r: HealthReminder): Promise<void> {
  // 飞书自定义机器人 webhook，msg_type=text 最通用
  const text = r.body ? `${r.title}\n${r.body}` : r.title;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ msg_type: "text", content: { text: `[Rich 提醒] ${text}` } }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`feishu ${res.status}: ${detail.slice(0, 120)}`);
  }
}
