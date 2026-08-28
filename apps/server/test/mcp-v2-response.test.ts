import { describe, expect, it } from "vitest";
import { RichMcpError } from "../src/mcp-v2/registry/errors.js";
import {
  richFailure,
  richSuccess,
  toRichToolFailure,
} from "../src/mcp-v2/registry/response.js";

describe("MCP 2.0 response boundary", () => {
  it("returns structured data, references, changes, verification, and warnings", () => {
    expect(richSuccess("rich_project_manage", { id: "project-1" }, {
      refs: [{ type: "project", id: "project-1", label: "Rich" }],
      changes: [{ operation: "update", resource: "project", id: "project-1" }],
      verification: { status: "verified", details: "Project was read back." },
      warnings: ["One optional description was omitted."],
    })).toEqual({
      ok: true,
      action: "rich_project_manage",
      data: { id: "project-1" },
      refs: [{ type: "project", id: "project-1", label: "Rich" }],
      changes: [{ operation: "update", resource: "project", id: "project-1" }],
      verification: { status: "verified", details: "Project was read back." },
      warnings: ["One optional description was omitted."],
    });
  });

  it("returns an explicitly constructed failure", () => {
    expect(richFailure("rich_project_manage", {
      code: "VALIDATION_ERROR",
      message: "Project id is required.",
      retryable: false,
      details: { field: "id" },
    })).toEqual({
      ok: false,
      action: "rich_project_manage",
      error: {
        code: "VALIDATION_ERROR",
        message: "Project id is required.",
        retryable: false,
        details: { field: "id" },
      },
    });
  });

  it("preserves safe domain errors", () => {
    const response = toRichToolFailure(
      "rich_project_manage",
      new RichMcpError("NOT_FOUND", "Project project-1 was not found.", {
        retryable: false,
        details: { id: "project-1" },
      }),
    );

    expect(response).toMatchObject({
      ok: false,
      action: "rich_project_manage",
      error: {
        code: "NOT_FOUND",
        message: "Project project-1 was not found.",
        retryable: false,
        details: { id: "project-1" },
      },
    });
  });

  it("redacts unknown exceptions at the MCP boundary", () => {
    const response = toRichToolFailure(
      "rich_project_manage",
      new Error("database password is secret"),
    );

    expect(response).toMatchObject({
      ok: false,
      action: "rich_project_manage",
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred.",
        retryable: false,
      },
    });
    expect(JSON.stringify(response)).not.toContain("database password is secret");
    expect(response.error).not.toHaveProperty("details");
  });
});
