import { describe, expect, it, vi } from "vitest";
import { aiTaskRoutes } from "../src/routes/aiTasks.js";

describe("aiTaskRoutes", () => {
  it("rejects an unavailable executor before publication", async () => {
    const app = aiTaskRoutes({ availability: async () => ({ hermes: true, multica: false }), publish: vi.fn() });
    const response = await app.request("http://localhost/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ executor: "multica" }) });
    expect(response.status).toBe(409);
  });
});
