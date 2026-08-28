import type { z } from "zod";
import { buildToolCatalog, measureToolCatalog, type RichToolDefinition, type RichToolExample } from "./catalog.js";
import { richFailure, toRichToolFailure } from "./response.js";
import type {
  RichToolAnnotations,
  RichToolCategory,
  RichToolResponse,
} from "./types.js";

const RICH_TOOL_NAME = /^rich_[a-z0-9]+_[a-z0-9_]+$/;

export interface RichToolRegistration<TInput = unknown> {
  name: string;
  title: string;
  description: string;
  category: RichToolCategory;
  inputSchema: z.ZodType<TInput>;
  annotations: RichToolAnnotations;
  examples: RichToolExample[];
  verification: string;
  handler: (input: TInput) => Promise<RichToolResponse<unknown>>;
}

export interface RichToolRegistryOptions {
  maxTools?: number;
}

export class RichToolRegistry {
  private readonly maxTools: number;
  private readonly registrations = new Map<string, RichToolRegistration<any>>();

  constructor(options: RichToolRegistryOptions = {}) {
    this.maxTools = options.maxTools ?? 40;
  }

  register<TInput>(registration: RichToolRegistration<TInput>): void {
    validateRegistration(registration);
    if (this.registrations.has(registration.name)) {
      throw new Error(`Tool ${registration.name} is already registered.`);
    }
    if (this.registrations.size >= this.maxTools) {
      throw new Error(`Rich MCP registry cannot contain more than ${this.maxTools} tools.`);
    }
    this.registrations.set(registration.name, registration);
  }

  listDefinitions(): RichToolDefinition[] {
    return buildToolCatalog(Array.from(this.registrations.values()));
  }

  listRegistrations(): ReadonlyArray<RichToolRegistration> {
    return Array.from(this.registrations.values()).sort((left, right) => left.name.localeCompare(right.name));
  }

  measure() {
    return measureToolCatalog(this.listDefinitions());
  }

  async invoke(name: string, input: unknown): Promise<RichToolResponse<unknown>> {
    const registration = this.registrations.get(name);
    if (!registration) {
      return richFailure(name, {
        code: "NOT_FOUND",
        message: `Tool ${name} was not found.`,
        retryable: false,
      });
    }
    const parsed = registration.inputSchema.safeParse(input);
    if (!parsed.success) {
      return richFailure(name, {
        code: "VALIDATION_ERROR",
        message: "Tool input did not match the required schema.",
        retryable: false,
        details: { issues: parsed.error.issues },
      });
    }
    try {
      return await registration.handler(parsed.data);
    } catch (error) {
      return toRichToolFailure(name, error);
    }
  }
}

function validateRegistration<TInput>(registration: RichToolRegistration<TInput>): void {
  if (!RICH_TOOL_NAME.test(registration.name)) {
    throw new Error(`Tool name must match rich_<domain>_<action>: ${registration.name}`);
  }
  if (!registration.title?.trim()) throw new Error(`Tool ${registration.name} requires a title.`);
  if (!registration.description?.trim()) throw new Error(`Tool ${registration.name} requires a description.`);
  if (!registration.inputSchema || typeof registration.inputSchema.safeParse !== "function") {
    throw new Error(`Tool ${registration.name} requires a Zod input schema.`);
  }
  const annotations = registration.annotations;
  if (!annotations || [annotations.readOnly, annotations.destructive, annotations.idempotent].some(value => typeof value !== "boolean")) {
    throw new Error(`Tool ${registration.name} requires complete annotations.`);
  }
  if (!Array.isArray(registration.examples) || registration.examples.length === 0) {
    throw new Error(`Tool ${registration.name} requires at least one example.`);
  }
  if (!registration.examples.every(example => example.description?.trim())) {
    throw new Error(`Tool ${registration.name} contains an invalid example.`);
  }
  if (!registration.verification?.trim()) {
    throw new Error(`Tool ${registration.name} requires verification metadata.`);
  }
  if (typeof registration.handler !== "function") {
    throw new Error(`Tool ${registration.name} requires a handler.`);
  }
}
