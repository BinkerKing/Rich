import { describe, it, expect } from "vitest";
import { migrateLegacyGoals } from "../src/plan.js";

interface MinState {
  plans?: Array<{ id: string; title: string; status: string }>;
  goals: Array<{ id: string; title: string; planId?: string }>;
}

describe("migrateLegacyGoals", () => {
  it("creates an unsorted plan and assigns orphan goals", () => {
    const before: MinState = {
      goals: [
        { id: "g1", title: "old goal A" },
        { id: "g2", title: "old goal B" },
      ],
    };
    const after = migrateLegacyGoals(before);
    expect(after.plans).toHaveLength(1);
    expect(after.plans?.[0].id).toBe("unsorted");
    expect(after.plans?.[0].title).toBe("未分组");
    expect(after.goals[0].planId).toBe("unsorted");
    expect(after.goals[1].planId).toBe("unsorted");
  });

  it("is idempotent: running twice yields same result", () => {
    const before: MinState = { goals: [{ id: "g1", title: "x" }] };
    const once = migrateLegacyGoals(before);
    const twice = migrateLegacyGoals(once);
    expect(twice.plans).toHaveLength(1);
    expect(twice.goals[0].planId).toBe("unsorted");
  });

  it("leaves already-tagged goals untouched", () => {
    const before: MinState = {
      plans: [{ id: "p-real", title: "减肥", status: "active" }],
      goals: [
        { id: "g1", title: "已挂", planId: "p-real" },
        { id: "g2", title: "孤儿" },
      ],
    };
    const after = migrateLegacyGoals(before);
    expect(after.plans?.map(p => p.id).sort()).toEqual(["p-real", "unsorted"]);
    expect(after.goals.find(g => g.id === "g1")?.planId).toBe("p-real");
    expect(after.goals.find(g => g.id === "g2")?.planId).toBe("unsorted");
  });

  it("creates no unsorted plan when all goals already tagged", () => {
    const before: MinState = {
      plans: [{ id: "p-real", title: "x", status: "active" }],
      goals: [{ id: "g1", title: "x", planId: "p-real" }],
    };
    const after = migrateLegacyGoals(before);
    expect(after.plans).toEqual([{ id: "p-real", title: "x", status: "active" }]);
  });

  it("handles empty goals array safely", () => {
    const before: MinState = { goals: [] };
    const after = migrateLegacyGoals(before);
    expect(after.plans).toEqual([]);
    expect(after.goals).toEqual([]);
  });
});
