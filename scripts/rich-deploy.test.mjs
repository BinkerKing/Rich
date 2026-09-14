import assert from "node:assert/strict";
import test from "node:test";
import { createDeploymentJob, runDeployment } from "./rich-deploy.mjs";

test("creates an isolated job with a stable log path", () => {
  const job = createDeploymentJob({
    now: () => new Date("2026-09-13T12:34:56.789Z"),
    random: () => "abc123",
    tempDir: "/tmp",
  });

  assert.equal(job.id, "rich-deploy-20260913T123456789Z-abc123");
  assert.equal(job.logPath, "/tmp/rich-deploy-20260913T123456789Z-abc123.log");
});

test("runs package, installation, and relaunch in order", async () => {
  const commands = [];
  await runDeployment({
    run: async (command, args) => commands.push([command, args]),
    source: "/build/Rich.app",
    target: "/Applications/Rich.app",
  });

  assert.deepEqual(commands.map(([command]) => command), ["pnpm", "osascript", "ditto", "rm", "mv", "open"]);
  assert.deepEqual(commands[2][1], ["/build/Rich.app", "/Applications/Rich.app.new"]);
  assert.deepEqual(commands[5][1], ["-n", "/Applications/Rich.app"]);
});
