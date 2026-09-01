import type { AgentTaskScenario } from "./types.js";

export class ScenarioRegistry {
  private readonly scenarios = new Map<string, AgentTaskScenario>();

  constructor(scenarios: AgentTaskScenario[]) {
    for (const scenario of scenarios) this.scenarios.set(scenario.id, scenario);
  }

  get(id: string): AgentTaskScenario {
    const scenario = this.scenarios.get(id);
    if (!scenario) throw new Error(`Unknown AI task scenario: ${id}.`);
    return scenario;
  }
}
