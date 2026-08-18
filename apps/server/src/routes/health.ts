import { Hono } from "hono";
import { networkInterfaces } from "node:os";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join as pathJoin } from "node:path";
import type { HealthRepo } from "../repos/HealthRepo.js";
import type {
  HealthProfile,
  WeightEntry,
  WorkoutSession,
  WorkoutSet,
  MealEntry,
  SleepEntry,
  MoodEntry,
  HealthReminder,
  ReminderKind,
  ReminderChannel,
  ReminderScheduleKind,
} from "@ke/domain";
import { eventBus } from "../lib/eventBus.js";

/**
 * Body Insights REST 路由 —— 私人健康档案 CRUD。
 *
 *   GET    /api/health/profile
 *   PUT    /api/health/profile        body: HealthProfile
 *   POST   /api/health/weight         body: { kg, loggedAt?, bodyFatPct?, notes?, source? }
 *   GET    /api/health/weight         ?since=&until=&limit=
 *   DELETE /api/health/weight/:id
 *   POST   /api/health/workout        body: { performedAt?, sessionName?, sets:[...], durationMin?, notes? }
 *   GET    /api/health/workout        ?since=&until=&limit=        (含 sets)
 *   DELETE /api/health/workout/:id
 *   POST   /api/health/meal           body: { consumedAt?, mealType?, items:[...], photoUrl?, notes? }
 *   GET    /api/health/meal           ?since=&until=&limit=
 *   DELETE /api/health/meal/:id
 *   POST   /api/health/sleep          body: { sleepDate?, durationMin?, quality?, notes? }
 *   GET    /api/health/sleep
 *   POST   /api/health/mood           body: { energy?, mood?, fatigue?, soreness?, notes? }
 *   GET    /api/health/mood
 *   GET    /api/health/timeline       ?since=&until=    多类型合并 timeline（轻量预览）
 *
 *   单用户 MVP —— 不带认证；后续如果做多用户，把 user_id 从 token 取。
 */

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowISO() { return new Date().toISOString(); }

export function healthRoutes(repo: HealthRepo | null): Hono {
  const r = new Hono();

  if (!repo) {
    r.all("*", c => c.json({ error: "health features require KE_STORAGE=postgres (and the cloud DB tunnel)" }, 503));
    return r;
  }

  // ─── profile ──────────────────────────────────────────────
  r.get("/profile", async c => {
    const p = await repo.getProfile();
    return c.json({ profile: p });
  });

  r.put("/profile", async c => {
    const body = await c.req.json().catch(() => null) as Partial<HealthProfile> | null;
    if (!body) return c.json({ error: "body required" }, 400);
    const profile: HealthProfile = {
      userId: "me",
      heightCm: body.heightCm,
      sex: body.sex,
      dob: body.dob,
      goal: body.goal,
      activityLevel: body.activityLevel,
      targetWeightKg: body.targetWeightKg,
      healthNotes: body.healthNotes,
      allergies: body.allergies,
      updatedAt: nowISO(),
    };
    await repo.putProfile(profile);
    return c.json({ profile });
  });

  // ─── weight ───────────────────────────────────────────────
  r.post("/weight", async c => {
    const body = await c.req.json().catch(() => null) as Partial<WeightEntry> | null;
    if (!body || typeof body.kg !== "number") {
      return c.json({ error: "kg (number) required" }, 400);
    }
    const entry: WeightEntry = {
      id: uid("w"),
      loggedAt: body.loggedAt ?? nowISO(),
      kg: body.kg,
      bodyFatPct: body.bodyFatPct,
      notes: body.notes,
      source: body.source ?? "manual",
      createdAt: nowISO(),
    };
    await repo.appendWeight(entry);
    return c.json({ entry });
  });

  r.get("/weight", async c => {
    const url = new URL(c.req.url);
    const since = url.searchParams.get("since") ?? undefined;
    const until = url.searchParams.get("until") ?? undefined;
    const limit = parseInt(url.searchParams.get("limit") ?? "500", 10);
    const items = await repo.listWeights({ since, until, limit });
    return c.json({ items, count: items.length });
  });

  r.delete("/weight/:id", async c => {
    await repo.deleteWeight(c.req.param("id"));
    return c.json({ ok: true });
  });

  // ─── workout ──────────────────────────────────────────────
  r.post("/workout", async c => {
    const body = await c.req.json().catch(() => null) as
      | (Partial<WorkoutSession> & { sets?: Array<Partial<WorkoutSet>> })
      | null;
    if (!body) return c.json({ error: "body required" }, 400);
    const workoutId = uid("wk");
    const performedAt = body.performedAt ?? nowISO();
    const sets: WorkoutSet[] = (body.sets ?? []).map((s, i) => ({
      id: uid("st"),
      workoutId,
      exercise: s.exercise ?? "Unknown",
      reps: s.reps,
      weightKg: s.weightKg,
      rpe: s.rpe,
      orderIndex: typeof s.orderIndex === "number" ? s.orderIndex : i,
      notes: s.notes,
    }));
    // 自动计算 totalVolume + rpeAvg
    let totalVolume = 0;
    let rpeCount = 0;
    let rpeSum = 0;
    for (const s of sets) {
      if (typeof s.weightKg === "number" && typeof s.reps === "number") {
        totalVolume += s.weightKg * s.reps;
      }
      if (typeof s.rpe === "number") {
        rpeSum += s.rpe;
        rpeCount++;
      }
    }
    const workout: WorkoutSession = {
      id: workoutId,
      sessionName: body.sessionName,
      performedAt,
      durationMin: body.durationMin,
      totalVolume: totalVolume > 0 ? Math.round(totalVolume * 10) / 10 : undefined,
      rpeAvg: rpeCount > 0 ? Math.round((rpeSum / rpeCount) * 10) / 10 : undefined,
      notes: body.notes,
      source: body.source ?? "manual",
      createdAt: nowISO(),
    };
    await repo.appendWorkout(workout, sets);
    return c.json({ workout, sets });
  });

  r.get("/workout", async c => {
    const url = new URL(c.req.url);
    const since = url.searchParams.get("since") ?? undefined;
    const until = url.searchParams.get("until") ?? undefined;
    const limit = parseInt(url.searchParams.get("limit") ?? "200", 10);
    const sessions = await repo.listWorkouts({ since, until, limit });
    // 一并把 sets 拉出来 —— 减少前端 round trip
    const enriched = await Promise.all(sessions.map(async s => ({
      ...s,
      sets: await repo.getWorkoutSets(s.id),
    })));
    return c.json({ items: enriched, count: enriched.length });
  });

  r.delete("/workout/:id", async c => {
    await repo.deleteWorkout(c.req.param("id"));
    return c.json({ ok: true });
  });

  // ─── meal ─────────────────────────────────────────────────
  r.post("/meal", async c => {
    const body = await c.req.json().catch(() => null) as Partial<MealEntry> | null;
    if (!body || !Array.isArray(body.items)) {
      return c.json({ error: "items[] required" }, 400);
    }
    // 自动汇总宏量（如果用户没填 totalKcal 等）
    let totalKcal = 0, totalProtein = 0, totalCarb = 0, totalFat = 0, totalFiber = 0;
    for (const it of body.items) {
      totalKcal += it.kcal ?? 0;
      totalProtein += it.proteinG ?? 0;
      totalCarb += it.carbG ?? 0;
      totalFat += it.fatG ?? 0;
      totalFiber += it.fiberG ?? 0;
    }
    const entry: MealEntry = {
      id: uid("ml"),
      consumedAt: body.consumedAt ?? nowISO(),
      mealType: body.mealType,
      items: body.items,
      totalKcal: body.totalKcal ?? (totalKcal > 0 ? totalKcal : undefined),
      totalProteinG: body.totalProteinG ?? (totalProtein > 0 ? totalProtein : undefined),
      totalCarbG: body.totalCarbG ?? (totalCarb > 0 ? totalCarb : undefined),
      totalFatG: body.totalFatG ?? (totalFat > 0 ? totalFat : undefined),
      totalFiberG: body.totalFiberG ?? (totalFiber > 0 ? totalFiber : undefined),
      photoUrl: body.photoUrl,
      source: body.source ?? "manual",
      notes: body.notes,
      createdAt: nowISO(),
    };
    await repo.appendMeal(entry);
    return c.json({ entry });
  });

  r.get("/meal", async c => {
    const url = new URL(c.req.url);
    const since = url.searchParams.get("since") ?? undefined;
    const until = url.searchParams.get("until") ?? undefined;
    const limit = parseInt(url.searchParams.get("limit") ?? "200", 10);
    const items = await repo.listMeals({ since, until, limit });
    return c.json({ items, count: items.length });
  });

  r.delete("/meal/:id", async c => {
    await repo.deleteMeal(c.req.param("id"));
    return c.json({ ok: true });
  });

  // ─── sleep ────────────────────────────────────────────────
  r.post("/sleep", async c => {
    const body = await c.req.json().catch(() => null) as Partial<SleepEntry> | null;
    if (!body) return c.json({ error: "body required" }, 400);
    const entry: SleepEntry = {
      id: uid("sl"),
      sleepDate: body.sleepDate ?? new Date().toISOString().slice(0, 10),
      durationMin: body.durationMin,
      quality: body.quality,
      bedtime: body.bedtime,
      wakeTime: body.wakeTime,
      notes: body.notes,
      source: body.source ?? "manual",
      createdAt: nowISO(),
    };
    await repo.appendSleep(entry);
    return c.json({ entry });
  });

  r.get("/sleep", async c => {
    const url = new URL(c.req.url);
    const since = url.searchParams.get("since") ?? undefined;
    const until = url.searchParams.get("until") ?? undefined;
    const limit = parseInt(url.searchParams.get("limit") ?? "200", 10);
    const items = await repo.listSleep({ since, until, limit });
    return c.json({ items, count: items.length });
  });

  // ─── mood ─────────────────────────────────────────────────
  r.post("/mood", async c => {
    const body = await c.req.json().catch(() => null) as Partial<MoodEntry> | null;
    if (!body) return c.json({ error: "body required" }, 400);
    const entry: MoodEntry = {
      id: uid("md"),
      loggedAt: body.loggedAt ?? nowISO(),
      energy: body.energy,
      mood: body.mood,
      fatigue: body.fatigue,
      soreness: body.soreness,
      notes: body.notes,
      createdAt: nowISO(),
    };
    await repo.appendMood(entry);
    return c.json({ entry });
  });

  r.get("/mood", async c => {
    const url = new URL(c.req.url);
    const since = url.searchParams.get("since") ?? undefined;
    const until = url.searchParams.get("until") ?? undefined;
    const limit = parseInt(url.searchParams.get("limit") ?? "200", 10);
    const items = await repo.listMoods({ since, until, limit });
    return c.json({ items, count: items.length });
  });

  // ═══════════════════════════════════════════════════════════
  //  Apple Shortcuts intake —— 苹果快捷指令一次性推所有指标
  // ═══════════════════════════════════════════════════════════

  /**
   * POST /api/health/intake/from-apple
   *
   * 快捷指令一次拉所有指标，封装成单个 JSON 推给后端。每个字段都是可选 —
   * 哪个 HealthKit 类型有数据就带哪个，没数据省略。
   *
   * Body schema (示例)：
   * {
   *   "weight":   { "kg": 80.5,         "bodyFatPct": 18,  "loggedAt": "2026-05-25T07:00:00+08:00" },
   *   "sleep":    { "durationMin": 420, "quality": 7,      "sleepDate": "2026-05-24" },
   *   "workout":  { "sessionName": "晨跑", "durationMin": 30, "performedAt": "..." },
   *   "meal":     { "mealType": "lunch", "totalKcal": 650, "totalProteinG": 45 },
   *   "mood":     { "energy": 7, "mood": 8 },
   *   "metadata": { "source": "apple-shortcut", "deviceName": "iPhone 15" }
   * }
   *
   * 返回：{ ingested: { weight: 1, sleep: 1, ... }, errors: [...] }
   */
  r.post("/intake/from-apple", async c => {
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return c.json({ error: "JSON body required" }, 400);
    }
    const ingested: Record<string, number> = {};
    const errors: string[] = [];

    // 体重 / 体脂
    const weight = body.weight as { kg?: number; bodyFatPct?: number; loggedAt?: string } | undefined;
    if (weight && typeof weight.kg === "number" && weight.kg > 20 && weight.kg < 300) {
      try {
        await repo.appendWeight({
          id: uid("w"),
          loggedAt: weight.loggedAt ?? nowISO(),
          kg: weight.kg,
          bodyFatPct: typeof weight.bodyFatPct === "number" ? weight.bodyFatPct : undefined,
          notes: undefined,
          source: "apple-health",
          createdAt: nowISO(),
        });
        ingested.weight = 1;
      } catch (e) { errors.push(`weight: ${e instanceof Error ? e.message : String(e)}`); }
    }

    // 睡眠
    const sleep = body.sleep as { durationMin?: number; quality?: number; sleepDate?: string; bedtime?: string; wakeTime?: string } | undefined;
    if (sleep && (typeof sleep.durationMin === "number" || typeof sleep.quality === "number")) {
      try {
        await repo.appendSleep({
          id: uid("sl"),
          sleepDate: sleep.sleepDate ?? new Date().toISOString().slice(0, 10),
          durationMin: typeof sleep.durationMin === "number" ? sleep.durationMin : undefined,
          quality: typeof sleep.quality === "number" ? sleep.quality : undefined,
          bedtime: typeof sleep.bedtime === "string" ? sleep.bedtime : undefined,
          wakeTime: typeof sleep.wakeTime === "string" ? sleep.wakeTime : undefined,
          source: "apple-health",
          createdAt: nowISO(),
        });
        ingested.sleep = 1;
      } catch (e) { errors.push(`sleep: ${e instanceof Error ? e.message : String(e)}`); }
    }

    // 训练
    const workout = body.workout as { sessionName?: string; performedAt?: string; durationMin?: number; totalVolume?: number; notes?: string } | undefined;
    if (workout && (typeof workout.durationMin === "number" || workout.sessionName)) {
      try {
        await repo.appendWorkout({
          id: uid("wk"),
          sessionName: workout.sessionName,
          performedAt: workout.performedAt ?? nowISO(),
          durationMin: workout.durationMin,
          totalVolume: workout.totalVolume,
          notes: workout.notes,
          source: "apple-watch",
          createdAt: nowISO(),
        }, []);
        ingested.workout = 1;
      } catch (e) { errors.push(`workout: ${e instanceof Error ? e.message : String(e)}`); }
    }

    // 饮食（快捷指令只能拿到 DietaryEnergyConsumed 总量，所以 items 不带）
    const meal = body.meal as { mealType?: string; totalKcal?: number; totalProteinG?: number; totalCarbG?: number; totalFatG?: number; consumedAt?: string; notes?: string } | undefined;
    if (meal && typeof meal.totalKcal === "number") {
      try {
        await repo.appendMeal({
          id: uid("ml"),
          consumedAt: meal.consumedAt ?? nowISO(),
          mealType: meal.mealType as MealEntry["mealType"],
          items: [],
          totalKcal: meal.totalKcal,
          totalProteinG: meal.totalProteinG,
          totalCarbG: meal.totalCarbG,
          totalFatG: meal.totalFatG,
          notes: meal.notes,
          source: "ai-text",                 // 苹果只给总量，跟 ai-text 同档（不准确，需校准）
          createdAt: nowISO(),
        });
        ingested.meal = 1;
      } catch (e) { errors.push(`meal: ${e instanceof Error ? e.message : String(e)}`); }
    }

    // 主观
    const mood = body.mood as { energy?: number; mood?: number; fatigue?: number; soreness?: number; notes?: string; loggedAt?: string } | undefined;
    if (mood && (mood.energy !== undefined || mood.mood !== undefined || mood.fatigue !== undefined || mood.soreness !== undefined)) {
      try {
        await repo.appendMood({
          id: uid("md"),
          loggedAt: mood.loggedAt ?? nowISO(),
          energy: mood.energy,
          mood: mood.mood,
          fatigue: mood.fatigue,
          soreness: mood.soreness,
          notes: mood.notes,
          createdAt: nowISO(),
        });
        ingested.mood = 1;
      } catch (e) { errors.push(`mood: ${e instanceof Error ? e.message : String(e)}`); }
    }

    const totalIngested = Object.values(ingested).reduce((a, b) => a + b, 0);
    if (totalIngested === 0 && errors.length === 0) {
      return c.json({
        ingested: {},
        errors: ["no recognised data — body 里没找到任何可识别的 weight / sleep / workout / meal / mood 字段"],
      }, 400);
    }
    return c.json({ ingested, totalIngested, errors });
  });

  /**
   * GET /api/health/sync/status
   * 汇总苹果（apple-health / apple-watch）来源数据的最近同步状态，给顶部状态徽章用。
   *
   * source 映射：
   *   - 体重：apple-health
   *   - 睡眠：apple-health / apple-watch
   *   - 训练：apple-watch
   *   - 饮食 / 心情：没有 apple 来源字段，跳过
   *
   * 用 createdAt 而非 loggedAt/performedAt —— createdAt 才反映"什么时候写入数据库"，
   * 也就是"什么时候同步成功"。loggedAt 可能是几小时前的实际称重时间。
   */
  r.get("/sync/status", async c => {
    const [weights, sleeps, workouts] = await Promise.all([
      repo.listWeights({ limit: 50 }),
      repo.listSleep({ limit: 50 }),
      repo.listWorkouts({ limit: 50 }),
    ]);
    const appleW = weights.filter(w => w.source === "apple-health");
    const appleS = sleeps.filter(s => s.source === "apple-watch" || s.source === "apple-health");
    const appleK = workouts.filter(w => w.source === "apple-watch");

    function maxAt<T extends { createdAt: string }>(arr: T[]): string | null {
      if (arr.length === 0) return null;
      return arr.reduce((m, x) => x.createdAt > m ? x.createdAt : m, arr[0].createdAt);
    }

    const allLast = [maxAt(appleW), maxAt(appleS), maxAt(appleK)].filter((x): x is string => !!x);
    const lastSyncAt = allLast.length > 0
      ? allLast.reduce((m, x) => x > m ? x : m, allLast[0])
      : null;

    return c.json({
      lastSyncAt,
      hasData: allLast.length > 0,
      byKind: {
        weight:  { count: appleW.length, lastAt: maxAt(appleW) },
        sleep:   { count: appleS.length, lastAt: maxAt(appleS) },
        workout: { count: appleK.length, lastAt: maxAt(appleK) },
      },
    });
  });

  /**
   * GET /api/health/intake/status
   * 返回各类指标的最近 1 条 + 总数 —— 给前端"接入苹果健康"面板展示当前 sync 状态。
   */
  r.get("/intake/status", async c => {
    const [weights, sleeps, workouts, meals, moods] = await Promise.all([
      repo.listWeights({ limit: 1 }),
      repo.listSleep({ limit: 1 }),
      repo.listWorkouts({ limit: 1 }),
      repo.listMeals({ limit: 1 }),
      repo.listMoods({ limit: 1 }),
    ]);
    return c.json({
      weight:  { latest: weights[0]  ?? null, hasData: weights.length > 0 },
      sleep:   { latest: sleeps[0]   ?? null, hasData: sleeps.length > 0 },
      workout: { latest: workouts[0] ?? null, hasData: workouts.length > 0 },
      meal:    { latest: meals[0]    ?? null, hasData: meals.length > 0 },
      mood:    { latest: moods[0]    ?? null, hasData: moods.length > 0 },
    });
  });

  /**
   * GET /api/health/network-info
   * 返回本机 LAN IP + 推荐 intake URL，给前端引导面板显示。
   */
  r.get("/network-info", async c => {
    const port = process.env.PORT ?? "31515";
    const ifaces = networkInterfaces();
    const candidates: string[] = [];
    for (const name of Object.keys(ifaces)) {
      for (const info of ifaces[name] ?? []) {
        if (info.family !== "IPv4" || info.internal) continue;
        // 跳过 link-local 169.254.x.x
        if (info.address.startsWith("169.254.")) continue;
        candidates.push(info.address);
      }
    }
    // 优先 192.168 / 10. / 172. 这种家用 LAN 段
    candidates.sort((a, b) => {
      const pri = (s: string) =>
        s.startsWith("192.168.") ? 0 :
        s.startsWith("10.") ? 1 :
        s.startsWith("172.") ? 2 : 3;
      return pri(a) - pri(b);
    });
    const lanIp = candidates[0] ?? "127.0.0.1";
    return c.json({
      lanIp,
      port: parseInt(port, 10),
      allCandidates: candidates,
      intakeUrl: `http://${lanIp}:${port}/api/health/intake/from-apple`,
      note: candidates.length === 0
        ? "未检测到 LAN IP —— Mac 没连 Wi-Fi 或者全是 link-local 地址"
        : `建议使用 ${lanIp}（自动挑了家用 LAN 段）。出门换 Wi-Fi 后 IP 会变，需要在快捷指令里改一次。`,
    });
  });

  /**
   * GET /api/health/intake/public-info
   * 返回部署在阿里云 ECS 上的公网 intake 服务的 URL + token（如果有）。
   * Token 文件 ~/.rich-health-intake-token 由 deploy.sh 生成。
   * iPhone 走公网时用这个，覆盖 LAN-URL 那条路径。
   */
  r.get("/intake/public-info", async c => {
    // 读 token 文件
    const tokenPath = pathJoin(homedir(), ".rich-health-intake-token");
    let token: string | null = null;
    try {
      token = (await readFile(tokenPath, "utf8")).trim();
    } catch {
      // 没部署过 / 文件不存在
    }
    // ECS 公网 IP（hard-code 你阿里云的；后续可读 ~/.rich-cloud-postgres.env）
    let publicHost = "8.133.193.247";
    let publicPort = 31516;
    try {
      const env = await readFile(pathJoin(homedir(), ".rich-cloud-postgres.env"), "utf8");
      const sshHost = /^RICH_DB_SSH_HOST=(.+)$/m.exec(env)?.[1]?.trim();
      if (sshHost) publicHost = sshHost;
    } catch { /* 用 fallback */ }

    return c.json({
      deployed: !!token,
      publicHost,
      publicPort,
      intakeUrl: `http://${publicHost}:${publicPort}/api/health/intake/from-apple`,
      healthAutoExportUrl: `http://${publicHost}:${publicPort}/api/health/intake/health-auto-export`,
      token,                                 // 完整暴露给本机 UI（敏感，但仅本地访问）
      note: token
        ? "已部署。把上面 URL + token 配到 iPhone 快捷指令。"
        : "未部署。本地 Mac 上跑 cd apps/health-intake && pnpm deploy 一次。",
    });
  });

  // ─── timeline (轻量预览，多类型合并) ─────────────────────────
  r.get("/timeline", async c => {
    const url = new URL(c.req.url);
    const since = url.searchParams.get("since") ?? undefined;
    const until = url.searchParams.get("until") ?? undefined;
    const limit = parseInt(url.searchParams.get("limit") ?? "100", 10);
    const opts = { since, until, limit };
    const [weights, workouts, meals, sleeps, moods] = await Promise.all([
      repo.listWeights(opts),
      repo.listWorkouts(opts),
      repo.listMeals(opts),
      repo.listSleep(opts),
      repo.listMoods(opts),
    ]);
    type Item = { kind: string; at: string; payload: unknown };
    const items: Item[] = [
      ...weights.map(w => ({ kind: "weight", at: w.loggedAt, payload: w })),
      ...workouts.map(w => ({ kind: "workout", at: w.performedAt, payload: w })),
      ...meals.map(m => ({ kind: "meal", at: m.consumedAt, payload: m })),
      ...sleeps.map(s => ({ kind: "sleep", at: s.sleepDate, payload: s })),
      ...moods.map(m => ({ kind: "mood", at: m.loggedAt, payload: m })),
    ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, limit);
    return c.json({ items, count: items.length });
  });

  // ─── 提醒 CRUD ─────────────────────────────────────────────────
  // GET    /api/health/reminders                 → { reminders: HealthReminder[] }
  // POST   /api/health/reminders   body: 部分字段 → { reminder } (新增)
  // PUT    /api/health/reminders/:id body: 部分字段
  // DELETE /api/health/reminders/:id
  // POST   /api/health/reminders/:id/fire-test  → 立即触发一次（测试用）

  const VALID_KINDS: ReminderKind[] = ["workout", "water", "meds", "sleep", "meal", "custom"];
  const VALID_CHANNELS: ReminderChannel[] = ["feishu", "screen", "inapp"];
  const VALID_SCHED: ReminderScheduleKind[] = ["daily", "interval"];

  function sanitizeReminder(body: Partial<HealthReminder>, existing?: HealthReminder): HealthReminder {
    const now = nowISO();
    const kind = (VALID_KINDS.includes(body.kind as ReminderKind) ? body.kind : existing?.kind ?? "custom") as ReminderKind;
    const title = String(body.title ?? existing?.title ?? "").trim().slice(0, 80) || "提醒";
    const bodyText = body.body !== undefined ? String(body.body ?? "").slice(0, 400) : existing?.body;
    const schedKind = VALID_SCHED.includes(body.schedule?.kind as ReminderScheduleKind)
      ? body.schedule!.kind
      : (existing?.schedule.kind ?? "daily");
    const time = body.schedule?.time !== undefined
      ? String(body.schedule.time ?? "").slice(0, 5)
      : existing?.schedule.time;
    const intervalMin = body.schedule?.intervalMin !== undefined
      ? Math.max(1, Math.min(24 * 60, Number(body.schedule.intervalMin) || 60))
      : existing?.schedule.intervalMin;
    const channels = Array.isArray(body.channels)
      ? body.channels.filter((c): c is ReminderChannel => VALID_CHANNELS.includes(c as ReminderChannel))
      : existing?.channels ?? ["inapp"];
    return {
      id: existing?.id ?? `rmd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      kind,
      title,
      body: bodyText,
      schedule: { kind: schedKind, time, intervalMin },
      channels: channels.length > 0 ? channels : ["inapp"],
      enabled: typeof body.enabled === "boolean" ? body.enabled : existing?.enabled ?? true,
      lastFiredAt: existing?.lastFiredAt,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  }

  r.get("/reminders", async c => {
    const reminders = await repo.listReminders();
    return c.json({ reminders });
  });

  r.post("/reminders", async c => {
    const body = await c.req.json().catch(() => ({})) as Partial<HealthReminder>;
    const reminder = sanitizeReminder(body);
    const all = await repo.listReminders();
    all.push(reminder);
    await repo.putReminders(all);
    eventBus.publish("greatme.changed", { detail: { kind: "reminder", op: "create", id: reminder.id } });
    return c.json({ reminder });
  });

  r.put("/reminders/:id", async c => {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({})) as Partial<HealthReminder>;
    const all = await repo.listReminders();
    const idx = all.findIndex(r => r.id === id);
    if (idx === -1) return c.json({ error: "not found" }, 404);
    all[idx] = sanitizeReminder(body, all[idx]);
    await repo.putReminders(all);
    eventBus.publish("greatme.changed", { detail: { kind: "reminder", op: "update", id } });
    return c.json({ reminder: all[idx] });
  });

  r.delete("/reminders/:id", async c => {
    const id = c.req.param("id");
    const all = await repo.listReminders();
    const next = all.filter(r => r.id !== id);
    if (next.length === all.length) return c.json({ error: "not found" }, 404);
    await repo.putReminders(next);
    eventBus.publish("greatme.changed", { detail: { kind: "reminder", op: "delete", id } });
    return c.json({ ok: true });
  });

  r.post("/reminders/:id/fire-test", async c => {
    const id = c.req.param("id");
    const all = await repo.listReminders();
    const rmd = all.find(r => r.id === id);
    if (!rmd) return c.json({ error: "not found" }, 404);
    // 直接发一次 SSE，让前端弹通知；不走完整 ticker（避免污染 lastFiredAt）
    eventBus.publish("greatme.changed", {
      source: "route",
      detail: {
        kind: "reminder.fire",
        id: rmd.id,
        reminderKind: rmd.kind,
        title: rmd.title,
        body: rmd.body ?? "",
        channels: rmd.channels,
        test: true,
      },
    });
    return c.json({ ok: true });
  });

  // ─── 飞书 webhook 配置 ─────────────────────────────────────────
  r.get("/feishu-webhook", async c => {
    const url = await repo.getFeishuWebhook();
    // 不直接返回完整 URL（含 secret）—— 给前端展示用，遮一段
    if (!url) return c.json({ configured: false, masked: null });
    const masked = url.length > 24 ? `${url.slice(0, 20)}…${url.slice(-6)}` : url;
    return c.json({ configured: true, masked });
  });

  r.put("/feishu-webhook", async c => {
    const body = await c.req.json().catch(() => ({})) as { url?: string };
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (url && !/^https?:\/\//i.test(url)) {
      return c.json({ error: "url must be http(s)://..." }, 400);
    }
    await repo.setFeishuWebhook(url || null);
    return c.json({ ok: true, configured: !!url });
  });

  return r;
}
