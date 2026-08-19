import type { AIAdapter } from "./adapter.js";

export type AdapterName = AIAdapter["name"];

export type AIScenario =
  | "default"
  | "chat"
  | "agent-task"
  | "content"
  | "analysis"
  | "document"
  | "data"
  | "coding"
  | "planning"
  | "review"
  | "mindmap"
  | "image"
  | "project-practice"
  | "knowledge";

export interface ModelRoute {
  scenario: AIScenario;
  adapter: AdapterName;
  source: "request" | "settings" | "env" | "default" | "fallback";
}

const ADAPTER_NAMES: readonly AdapterName[] = ["hermes", "codex", "claude-code", "bailian"];

const SCENARIO_ENV: Record<AIScenario, string> = {
  default: "RICH_AI_DEFAULT_MODEL",
  chat: "RICH_AI_CHAT_MODEL",
  "agent-task": "RICH_AI_AGENT_MODEL",
  content: "RICH_AI_CONTENT_MODEL",
  analysis: "RICH_AI_ANALYSIS_MODEL",
  document: "RICH_AI_DOCUMENT_MODEL",
  data: "RICH_AI_DATA_MODEL",
  coding: "RICH_AI_CODING_MODEL",
  planning: "RICH_AI_PLANNING_MODEL",
  review: "RICH_AI_REVIEW_MODEL",
  mindmap: "RICH_AI_MINDMAP_MODEL",
  image: "RICH_AI_IMAGE_MODEL",
  "project-practice": "RICH_AI_PROJECT_PRACTICE_MODEL",
  knowledge: "RICH_AI_KNOWLEDGE_MODEL",
};

const DEFAULT_SCENARIO_MODEL: Record<AIScenario, AdapterName> = {
  default: "hermes",
  chat: "hermes",
  "agent-task": "hermes",
  content: "hermes",
  analysis: "hermes",
  document: "hermes",
  data: "hermes",
  coding: "codex",
  planning: "hermes",
  review: "hermes",
  mindmap: "codex",
  image: "codex",
  "project-practice": "hermes",
  knowledge: "hermes",
};

let routeOverrides: Partial<Record<AIScenario, AdapterName>> = {};

export function normalizeAdapterName(value: unknown): AdapterName | undefined {
  if (typeof value !== "string") return undefined;
  return ADAPTER_NAMES.find(name => name === value);
}

export function normalizeScenario(value: unknown): AIScenario | undefined {
  if (typeof value !== "string") return undefined;
  return (Object.keys(DEFAULT_SCENARIO_MODEL) as AIScenario[]).find(scenario => scenario === value);
}

export function listAIScenarios(): AIScenario[] {
  return Object.keys(DEFAULT_SCENARIO_MODEL) as AIScenario[];
}

export function setModelRouteOverrides(overrides: Partial<Record<AIScenario, AdapterName>>): void {
  routeOverrides = { ...overrides };
}

export function getModelRouteOverrides(): Partial<Record<AIScenario, AdapterName>> {
  return { ...routeOverrides };
}

function pickExisting(adapters: AIAdapter[], name: AdapterName | undefined): AIAdapter | undefined {
  if (!name) return undefined;
  return adapters.find(adapter => adapter.name === name);
}

function envModelForScenario(scenario: AIScenario): AdapterName | undefined {
  return normalizeAdapterName(process.env[SCENARIO_ENV[scenario]])
    ?? normalizeAdapterName(process.env.RICH_AI_DEFAULT_MODEL);
}

export function resolveModelRoute(
  adapters: AIAdapter[],
  scenario: AIScenario = "default",
  preference?: AdapterName,
): ModelRoute {
  if (pickExisting(adapters, preference)) {
    return { scenario, adapter: preference!, source: "request" };
  }

  const envModel = envModelForScenario(scenario);
  const settingsModel = routeOverrides[scenario] ?? routeOverrides.default;
  if (pickExisting(adapters, settingsModel)) {
    return { scenario, adapter: settingsModel!, source: "settings" };
  }

  if (pickExisting(adapters, envModel)) {
    return { scenario, adapter: envModel!, source: "env" };
  }

  const scenarioDefault = DEFAULT_SCENARIO_MODEL[scenario];
  if (pickExisting(adapters, scenarioDefault)) {
    return { scenario, adapter: scenarioDefault, source: "default" };
  }

  const first = adapters[0]?.name;
  if (!first) throw new Error("No AI adapters configured");
  return { scenario, adapter: first, source: "fallback" };
}

export function pickAdapterForScenario(
  adapters: AIAdapter[],
  scenario: AIScenario = "default",
  preference?: AdapterName,
): AIAdapter {
  const route = resolveModelRoute(adapters, scenario, preference);
  const adapter = pickExisting(adapters, route.adapter);
  if (!adapter) throw new Error(`AI adapter ${route.adapter} not configured`);
  return adapter;
}

export async function describeModelRouting(adapters: AIAdapter[]) {
  const adapterAvailability = await Promise.all(adapters.map(async adapter => ({
    name: adapter.name,
    available: await adapter.available(),
  })));

  return {
    adapters: adapterAvailability,
    scenarios: (Object.keys(DEFAULT_SCENARIO_MODEL) as AIScenario[]).map(scenario => {
      const route = resolveModelRoute(adapters, scenario);
      return {
        scenario,
        adapter: route.adapter,
        source: route.source,
        env: SCENARIO_ENV[scenario],
      };
    }),
  };
}
