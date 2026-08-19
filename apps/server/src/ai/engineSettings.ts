import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { dataDir } from "../lib/paths.js";
import {
  getModelRouteOverrides,
  listAIScenarios,
  normalizeAdapterName,
  normalizeScenario,
  setModelRouteOverrides,
  type AIScenario,
  type AdapterName,
} from "./modelRouter.js";

export interface AIEngineSettings {
  routes: Partial<Record<AIScenario, AdapterName>>;
  updatedAt?: string;
}

const SETTINGS_FILE = "ai-engine-settings.json";

function settingsPath(): string {
  return join(dataDir(), SETTINGS_FILE);
}

export function readAIEngineSettings(): AIEngineSettings {
  try {
    const raw = readFileSync(settingsPath(), "utf8");
    const parsed = JSON.parse(raw) as { routes?: Record<string, unknown>; updatedAt?: string };
    const routes: Partial<Record<AIScenario, AdapterName>> = {};
    for (const [scenarioValue, adapterValue] of Object.entries(parsed.routes ?? {})) {
      const scenario = normalizeScenario(scenarioValue);
      const adapter = normalizeAdapterName(adapterValue);
      if (scenario && adapter) routes[scenario] = adapter;
    }
    return { routes, updatedAt: parsed.updatedAt };
  } catch {
    return { routes: {} };
  }
}

export function loadAIEngineSettings(): AIEngineSettings {
  const settings = readAIEngineSettings();
  setModelRouteOverrides(settings.routes);
  return settings;
}

export function writeAIEngineSettings(routes: Partial<Record<AIScenario, AdapterName>>): AIEngineSettings {
  const clean: Partial<Record<AIScenario, AdapterName>> = {};
  for (const scenario of listAIScenarios()) {
    const adapter = routes[scenario];
    if (adapter) clean[scenario] = adapter;
  }
  const next: AIEngineSettings = {
    routes: clean,
    updatedAt: new Date().toISOString(),
  };
  const file = settingsPath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  setModelRouteOverrides(clean);
  return next;
}

export function currentAIEngineSettings(): AIEngineSettings {
  return {
    routes: getModelRouteOverrides(),
    updatedAt: readAIEngineSettings().updatedAt,
  };
}
