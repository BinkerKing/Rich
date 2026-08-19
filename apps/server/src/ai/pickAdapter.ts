import type { AIAdapter } from "./adapter.js";
import { pickAdapterForScenario, type AIScenario } from "./modelRouter.js";

export function pickAdapter(
  adapters: AIAdapter[],
  preference?: AIAdapter["name"],
): AIAdapter {
  return pickAdapterForScenario(adapters, "default", preference);
}

export function pickScenarioAdapter(
  adapters: AIAdapter[],
  scenario: AIScenario,
  preference?: AIAdapter["name"],
): AIAdapter {
  return pickAdapterForScenario(adapters, scenario, preference);
}
