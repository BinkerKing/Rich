import { describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildApp } from "../src/index.js";
import type { AIAdapter, GenerateArgs, StreamEvent } from "../src/ai/adapter.js";

process.env.KE_STORAGE = "json";

class FakeHermesAdapter implements AIAdapter {
  readonly name = "hermes" as const;
  prompts: string[] = [];

  async available() { return true; }

  async *stream(args: GenerateArgs): AsyncIterable<StreamEvent> {
    this.prompts.push(args.prompt);
    const mode = args.prompt.includes("week-simulation")
      ? "week-simulation"
      : args.prompt.includes("mission")
        ? "mission"
        : args.prompt.includes("review")
          ? "review"
          : "goal";
    const payload = {
      mode,
      title: mode === "week-simulation" ? "七日推进模拟" : "Hermes 行动判断",
      summary: "Hermes 已读取身份、任务、目标栈与复盘材料，并给出下一轮行动判断。",
      focus: "先完成一个可验证的最小行动。",
      risks: ["目标过大", "证据不足"],
      nextActions: ["拆出最终交付物", "执行 25 分钟", "记录证据"],
      missions: [
        { title: "完成最小验证动作", lane: "主线任务", impact: 88, effort: 31, reason: "制造可复盘证据" },
        { title: "写下下一步阻碍", lane: "能力突破", impact: 72, effort: 18, reason: "降低明天启动成本" },
      ],
      pdca: {
        plan: "今天只推进一个最小动作。",
        do: "",
        check: "是否产生证据。",
        act: "保留有效动作。",
      },
      axisAdjustments: [{ axis: "craft", delta: 4, reason: "任务会提升交付能力" }],
      weekSimulation: mode === "week-simulation"
        ? Array.from({ length: 7 }, (_, i) => ({
          day: i + 1,
          theme: `第 ${i + 1} 天主题`,
          mission: `第 ${i + 1} 天任务`,
          evidence: `第 ${i + 1} 天证据`,
          review: `第 ${i + 1} 天复盘`,
        }))
        : [],
    };
    const text = JSON.stringify(payload);
    yield { type: "delta", text };
    yield { type: "done", fullText: text, sessionId: "great-me-session" };
  }
}

function tempRoot() {
  return mkdtempSync(join(tmpdir(), "ke-great-me-"));
}

describe("GreatMe Hermes brain route", () => {
  it("POST /api/ai/great-me uses Hermes and returns action missions", async () => {
    const hermes = new FakeHermesAdapter();
    const app = buildApp(tempRoot(), [hermes]);
    const res = await app.request("/api/ai/great-me", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: "mission",
        input: "一周内完成产品原型",
        state: { profile: { codename: "伟大的我" }, missions: [] },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.adapter).toBe("hermes");
    expect(body.result.missions).toHaveLength(2);
    expect(body.result.missions[0].title).toBe("完成最小验证动作");
    expect(hermes.prompts[0]).toContain("一周内完成产品原型");
    expect(hermes.prompts[0]).toContain("伟大的我");
  });

  it("can simulate a full 7-day GreatMe loop through Hermes", async () => {
    const hermes = new FakeHermesAdapter();
    const app = buildApp(tempRoot(), [hermes]);
    const state = {
      profile: { codename: "伟大的我", mainGoal: "稳定推进重要项目" },
      missions: [],
      pdca: {},
    };

    for (let day = 1; day <= 7; day += 1) {
      const res = await app.request("/api/ai/great-me", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "week-simulation",
          input: `模拟第 ${day} 天`,
          state: { ...state, day },
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.adapter).toBe("hermes");
      expect(body.result.weekSimulation).toHaveLength(7);
      expect(body.result.weekSimulation[day - 1].day).toBe(day);
      expect(body.result.nextActions.length).toBeGreaterThan(0);
    }
  });
});
