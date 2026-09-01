export interface BreakReminderStatus {
  enabled: boolean;
  intervalMinutes: number;
  breakMinutes: number;
  nextReminderAt: string | null;
  activeUntil: string | null;
}

/**
 * Keeps the work/rest cadence alive in the server process. The desktop shell
 * polls `activeUntil`, so the reminder remains visible even while its main
 * BrowserWindow is hidden or another app has the focus.
 */
export class BreakReminder {
  private enabled = false;
  private intervalMinutes = 60;
  private breakMinutes = 2;
  private nextReminderAt: number | null = null;
  private activeUntil: number | null = null;
  private reminderTimer: NodeJS.Timeout | null = null;
  private breakTimer: NodeJS.Timeout | null = null;

  constructor(private storagePath?: string) {}

  /** Restore the exact schedule that was active before Rich last quit. */
  restore(): BreakReminderStatus {
    if (!this.storagePath || !existsSync(this.storagePath)) return this.status();
    try {
      const saved = JSON.parse(readFileSync(this.storagePath, "utf8")) as Partial<{
        enabled: boolean; intervalMinutes: number; breakMinutes: number; nextReminderAt: number | null; activeUntil: number | null;
      }>;
      this.enabled = saved.enabled === true;
      this.intervalMinutes = Number.isInteger(saved.intervalMinutes) && (saved.intervalMinutes as number) >= 1
        ? saved.intervalMinutes as number : 60;
      this.breakMinutes = Number.isInteger(saved.breakMinutes) && (saved.breakMinutes as number) >= 1
        ? saved.breakMinutes as number : 2;
      this.nextReminderAt = typeof saved.nextReminderAt === "number" ? saved.nextReminderAt : null;
      this.activeUntil = typeof saved.activeUntil === "number" ? saved.activeUntil : null;
    } catch {
      return this.status();
    }
    if (!this.enabled) return this.status();
    const now = Date.now();
    if (this.activeUntil && this.activeUntil > now) {
      this.breakTimer = setTimeout(() => this.finishBreak(), this.activeUntil - now);
    } else if (this.activeUntil) {
      const next = this.activeUntil + this.intervalMinutes * 60_000;
      this.activeUntil = null;
      if (next <= now) this.startBreak();
      else this.scheduleReminderAt(next);
    } else if (this.nextReminderAt && this.nextReminderAt > now) {
      this.scheduleReminderAt(this.nextReminderAt);
    } else {
      // Rich was closed when a reminder became due: show that missed break on restart.
      this.startBreak();
    }
    return this.status();
  }

  configure(input: { enabled: boolean; intervalMinutes?: number; breakMinutes?: number }): BreakReminderStatus {
    if (typeof input.intervalMinutes === "number") this.intervalMinutes = input.intervalMinutes;
    if (typeof input.breakMinutes === "number") this.breakMinutes = input.breakMinutes;
    this.enabled = input.enabled;
    this.clearTimers();
    this.nextReminderAt = null;
    this.activeUntil = null;
    if (this.enabled) this.scheduleNext();
    this.persist();
    return this.status();
  }

  status(now = Date.now()): BreakReminderStatus {
    if (this.activeUntil !== null && this.activeUntil <= now) this.finishBreak();
    return {
      enabled: this.enabled,
      intervalMinutes: this.intervalMinutes,
      breakMinutes: this.breakMinutes,
      nextReminderAt: this.nextReminderAt === null ? null : new Date(this.nextReminderAt).toISOString(),
      activeUntil: this.activeUntil === null ? null : new Date(this.activeUntil).toISOString(),
    };
  }

  private scheduleNext(from = Date.now()) {
    this.scheduleReminderAt(from + this.intervalMinutes * 60_000);
  }

  private scheduleReminderAt(at: number) {
    this.nextReminderAt = at;
    this.reminderTimer = setTimeout(() => this.startBreak(), Math.max(0, at - Date.now()));
    this.persist();
  }

  private startBreak() {
    this.reminderTimer = null;
    this.nextReminderAt = null;
    const durationMs = this.breakMinutes * 60_000;
    this.activeUntil = Date.now() + durationMs;
    this.breakTimer = setTimeout(() => this.finishBreak(), durationMs);
    this.persist();
  }

  private finishBreak() {
    if (this.breakTimer) clearTimeout(this.breakTimer);
    this.breakTimer = null;
    const breakEndedAt = this.activeUntil ?? Date.now();
    this.activeUntil = null;
    if (this.enabled) this.scheduleNext(breakEndedAt);
    else this.persist();
  }

  private clearTimers() {
    if (this.reminderTimer) clearTimeout(this.reminderTimer);
    if (this.breakTimer) clearTimeout(this.breakTimer);
    this.reminderTimer = null;
    this.breakTimer = null;
  }

  private persist() {
    if (!this.storagePath) return;
    try {
      writeFileSync(this.storagePath, JSON.stringify({
        enabled: this.enabled,
        intervalMinutes: this.intervalMinutes,
        breakMinutes: this.breakMinutes,
        nextReminderAt: this.nextReminderAt,
        activeUntil: this.activeUntil,
      }), "utf8");
    } catch { /* The reminder still works for this session if storage is unavailable. */ }
  }
}
import { existsSync, readFileSync, writeFileSync } from "node:fs";
