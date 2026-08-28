import { z } from "zod";
import type { GreatMeRepo } from "../../repos/GreatMeRepo.js";
import type { McpOperationRepo } from "../../repos/McpOperationRepo.js";
import { richSuccess } from "../registry/response.js";
import type { RichToolRegistry } from "../registry/toolRegistry.js";
import { executeSafeWrite } from "../registry/writeSafety.js";
import { richContextSchema, richOptionsSchema } from "./schemas.js";

export function registerPlanningTools(registry: RichToolRegistry, planning: GreatMeRepo, operationRepo?: McpOperationRepo): void {
  registry.register({
    name: "rich_planning_manage",
    title: "Manage planning state",
    description: "Read Rich planning state or replace the complete state when an exact new state is explicitly provided.",
    category: "manage",
    inputSchema: z.object({
      action: z.enum(["get_state", "replace_state"]),
      input: z.unknown().optional(),
      context: richContextSchema,
      options: richOptionsSchema,
    }).superRefine((input, issues) => {
      if (input.action === "replace_state" && input.input === undefined) issues.addIssue({ code: "custom", path: ["input"], message: "input is required." });
    }),
    annotations: { readOnly: false, destructive: true, idempotent: true },
    examples: [
      { description: "Read the current plan state.", input: { action: "get_state" } },
      { description: "Replace an explicitly confirmed plan state.", input: { action: "replace_state", input: { plans: [], version: 1 }, context: { requestId: "replace-plan-state-1" }, options: { confirmDestructive: true } } },
    ],
    verification: "Replacement is verified by reading the full planning state back.",
    handler: async ({ action, input, context, options }) => {
      if (action === "get_state") return richSuccess("rich_planning_manage", { state: await planning.get() });
      return executeSafeWrite({
        toolName: "rich_planning_manage",
        operationRepo,
        context,
        options,
        destructive: true,
        inputForHash: { action, input },
        changes: [{ operation: "replace", resource: "planningState" }],
        execute: async () => {
          await planning.put(input);
          return { state: input };
        },
        verify: async result => ({
          status: JSON.stringify(await planning.get()) === JSON.stringify(result.state) ? "verified" : "failed",
          details: "Planning state was read back after replacement.",
        }),
      });
    },
  });
}
