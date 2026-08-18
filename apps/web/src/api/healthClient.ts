/**
 * Body Insights 前端 API 客户端 —— 包一层 fetch，统一错误处理 + ISO 时间。
 *
 * 服务端走 /api/health/*。详见 apps/server/src/routes/health.ts。
 */
import type {
  HealthProfile,
  WeightEntry,
  WorkoutSession,
  WorkoutSet,
  MealEntry,
  SleepEntry,
  MoodEntry,
  HealthReminder,
} from "@ke/domain";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`health api ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export const healthApi = {
  // profile
  async getProfile(): Promise<HealthProfile | null> {
    const r = await fetch("/api/health/profile");
    const d = await jsonOrThrow<{ profile: HealthProfile | null }>(r);
    return d.profile;
  },
  async putProfile(p: Partial<HealthProfile>): Promise<HealthProfile> {
    const r = await fetch("/api/health/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(p),
    });
    const d = await jsonOrThrow<{ profile: HealthProfile }>(r);
    return d.profile;
  },

  // weight
  async listWeights(opts?: { since?: string; until?: string; limit?: number }): Promise<WeightEntry[]> {
    const qs = new URLSearchParams();
    if (opts?.since) qs.set("since", opts.since);
    if (opts?.until) qs.set("until", opts.until);
    if (opts?.limit) qs.set("limit", String(opts.limit));
    const r = await fetch(`/api/health/weight?${qs}`);
    const d = await jsonOrThrow<{ items: WeightEntry[]; count: number }>(r);
    return d.items;
  },
  async logWeight(p: { kg: number; loggedAt?: string; bodyFatPct?: number; notes?: string }): Promise<WeightEntry> {
    const r = await fetch("/api/health/weight", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(p),
    });
    const d = await jsonOrThrow<{ entry: WeightEntry }>(r);
    return d.entry;
  },
  async deleteWeight(id: string): Promise<void> {
    await fetch(`/api/health/weight/${id}`, { method: "DELETE" });
  },

  // workout
  async listWorkouts(opts?: { since?: string; until?: string; limit?: number }): Promise<Array<WorkoutSession & { sets: WorkoutSet[] }>> {
    const qs = new URLSearchParams();
    if (opts?.since) qs.set("since", opts.since);
    if (opts?.until) qs.set("until", opts.until);
    if (opts?.limit) qs.set("limit", String(opts.limit));
    const r = await fetch(`/api/health/workout?${qs}`);
    const d = await jsonOrThrow<{ items: Array<WorkoutSession & { sets: WorkoutSet[] }>; count: number }>(r);
    return d.items;
  },
  async logWorkout(p: {
    sessionName?: string;
    performedAt?: string;
    durationMin?: number;
    notes?: string;
    sets: Array<{ exercise: string; reps?: number; weightKg?: number; rpe?: number; orderIndex?: number; notes?: string }>;
  }): Promise<{ workout: WorkoutSession; sets: WorkoutSet[] }> {
    const r = await fetch("/api/health/workout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(p),
    });
    return jsonOrThrow<{ workout: WorkoutSession; sets: WorkoutSet[] }>(r);
  },
  async deleteWorkout(id: string): Promise<void> {
    await fetch(`/api/health/workout/${id}`, { method: "DELETE" });
  },

  // meal
  async listMeals(opts?: { since?: string; until?: string; limit?: number }): Promise<MealEntry[]> {
    const qs = new URLSearchParams();
    if (opts?.since) qs.set("since", opts.since);
    if (opts?.until) qs.set("until", opts.until);
    if (opts?.limit) qs.set("limit", String(opts.limit));
    const r = await fetch(`/api/health/meal?${qs}`);
    const d = await jsonOrThrow<{ items: MealEntry[]; count: number }>(r);
    return d.items;
  },
  async logMeal(p: Partial<MealEntry> & { items: MealEntry["items"] }): Promise<MealEntry> {
    const r = await fetch("/api/health/meal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(p),
    });
    const d = await jsonOrThrow<{ entry: MealEntry }>(r);
    return d.entry;
  },
  async deleteMeal(id: string): Promise<void> {
    await fetch(`/api/health/meal/${id}`, { method: "DELETE" });
  },

  // sleep
  async listSleep(opts?: { since?: string; until?: string; limit?: number }): Promise<SleepEntry[]> {
    const qs = new URLSearchParams();
    if (opts?.since) qs.set("since", opts.since);
    if (opts?.limit) qs.set("limit", String(opts.limit));
    const r = await fetch(`/api/health/sleep?${qs}`);
    const d = await jsonOrThrow<{ items: SleepEntry[]; count: number }>(r);
    return d.items;
  },
  async logSleep(p: Partial<SleepEntry>): Promise<SleepEntry> {
    const r = await fetch("/api/health/sleep", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(p),
    });
    const d = await jsonOrThrow<{ entry: SleepEntry }>(r);
    return d.entry;
  },

  // mood
  async listMoods(opts?: { since?: string; until?: string; limit?: number }): Promise<MoodEntry[]> {
    const qs = new URLSearchParams();
    if (opts?.since) qs.set("since", opts.since);
    if (opts?.limit) qs.set("limit", String(opts.limit));
    const r = await fetch(`/api/health/mood?${qs}`);
    const d = await jsonOrThrow<{ items: MoodEntry[]; count: number }>(r);
    return d.items;
  },
  async logMood(p: Partial<MoodEntry>): Promise<MoodEntry> {
    const r = await fetch("/api/health/mood", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(p),
    });
    const d = await jsonOrThrow<{ entry: MoodEntry }>(r);
    return d.entry;
  },

  // reminders
  async listReminders(): Promise<HealthReminder[]> {
    const r = await fetch("/api/health/reminders");
    const d = await jsonOrThrow<{ reminders: HealthReminder[] }>(r);
    return d.reminders;
  },
  async createReminder(p: Partial<HealthReminder>): Promise<HealthReminder> {
    const r = await fetch("/api/health/reminders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(p),
    });
    const d = await jsonOrThrow<{ reminder: HealthReminder }>(r);
    return d.reminder;
  },
  async updateReminder(id: string, p: Partial<HealthReminder>): Promise<HealthReminder> {
    const r = await fetch(`/api/health/reminders/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(p),
    });
    const d = await jsonOrThrow<{ reminder: HealthReminder }>(r);
    return d.reminder;
  },
  async deleteReminder(id: string): Promise<void> {
    await fetch(`/api/health/reminders/${id}`, { method: "DELETE" });
  },
  async testFireReminder(id: string): Promise<void> {
    await fetch(`/api/health/reminders/${id}/fire-test`, { method: "POST" });
  },

  // sync status（顶部徽章用）
  async getSyncStatus(): Promise<{
    lastSyncAt: string | null;
    hasData: boolean;
    byKind: {
      weight:  { count: number; lastAt: string | null };
      sleep:   { count: number; lastAt: string | null };
      workout: { count: number; lastAt: string | null };
    };
  }> {
    const r = await fetch("/api/health/sync/status");
    return jsonOrThrow(r);
  },

  // feishu webhook
  async getFeishuWebhook(): Promise<{ configured: boolean; masked: string | null }> {
    const r = await fetch("/api/health/feishu-webhook");
    return jsonOrThrow<{ configured: boolean; masked: string | null }>(r);
  },
  async setFeishuWebhook(url: string | null): Promise<void> {
    await fetch("/api/health/feishu-webhook", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: url ?? "" }),
    });
  },
};
