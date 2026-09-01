import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BreakReminder } from "../src/lib/breakReminder.js";

describe("BreakReminder", () => {
  afterEach(() => vi.useRealTimers());

  it("starts a configured-length break after the work interval", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T00:00:00.000Z"));
    const reminder = new BreakReminder();

    reminder.configure({ enabled: true, intervalMinutes: 30, breakMinutes: 5 });
    expect(reminder.status().nextReminderAt).toBe("2026-08-30T00:30:00.000Z");

    vi.advanceTimersByTime(30 * 60_000);
    expect(reminder.status().activeUntil).toBe("2026-08-30T00:35:00.000Z");

    vi.advanceTimersByTime(5 * 60_000);
    expect(reminder.status().activeUntil).toBeNull();
    expect(reminder.status().nextReminderAt).toBe("2026-08-30T01:05:00.000Z");
  });

  it("clears pending work and break timers when paused", () => {
    vi.useFakeTimers();
    const reminder = new BreakReminder();
    reminder.configure({ enabled: true, intervalMinutes: 1 });
    reminder.configure({ enabled: false });
    vi.advanceTimersByTime(5 * 60_000);
    expect(reminder.status()).toMatchObject({ enabled: false, nextReminderAt: null, activeUntil: null });
  });

  it("restores the saved next reminder time after Rich restarts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-30T00:00:00.000Z"));
    const dir = mkdtempSync(join(tmpdir(), "rich-break-reminder-"));
    const file = join(dir, "break-reminder.json");
    try {
      const first = new BreakReminder(file);
      first.configure({ enabled: true, intervalMinutes: 30 });
      vi.advanceTimersByTime(10 * 60_000);
      const restarted = new BreakReminder(file);
      expect(restarted.restore().nextReminderAt).toBe("2026-08-30T00:30:00.000Z");
      vi.advanceTimersByTime(20 * 60_000);
      expect(restarted.status().activeUntil).toBe("2026-08-30T00:32:00.000Z");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
