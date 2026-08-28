import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  discoverMulticaExecutable,
  parseSupportedMulticaVersion,
} from "../src/mcp-v2/delegation/multica/MulticaExecutableDiscovery.js";
import { MulticaCommandRunner } from "../src/mcp-v2/delegation/multica/MulticaCommandRunner.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function tempDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "rich-multica-runner-"));
  tempDirs.push(directory);
  return directory;
}

function executable(directory: string, name: string, body: string): string {
  const path = join(directory, name);
  writeFileSync(path, `#!${process.execPath}\n${body}\n`, "utf8");
  chmodSync(path, 0o755);
  return path;
}

describe("Multica executable discovery", () => {
  it("prefers explicit configuration over PATH and Desktop bundle", () => {
    const directory = tempDir();
    const explicit = executable(directory, "explicit", "process.exit(0)");
    executable(directory, "multica", "process.exit(0)");

    expect(discoverMulticaExecutable({
      env: { RICH_MULTICA_CLI_PATH: explicit, PATH: directory },
      desktopPath: join(directory, "desktop-multica"),
    })).toBe(explicit);
  });

  it("uses PATH before the Desktop bundle and reports a missing CLI", () => {
    const directory = tempDir();
    const pathExecutable = executable(directory, "multica", "process.exit(0)");
    const desktop = executable(directory, "desktop-multica", "process.exit(0)");

    expect(discoverMulticaExecutable({ env: { PATH: `${directory}${delimiter}/missing` }, desktopPath: desktop }))
      .toBe(pathExecutable);
    expect(() => discoverMulticaExecutable({ env: { PATH: join(directory, "none") }, desktopPath: join(directory, "missing") }))
      .toThrow(/Multica CLI/);
  });

  it("accepts 0.4.35 releases and rejects unsupported versions", () => {
    expect(parseSupportedMulticaVersion("multica version v0.4.35")).toEqual({ major: 0, minor: 4, patch: 35 });
    expect(() => parseSupportedMulticaVersion("v0.4.34")).toThrow(/0\.4\.35/);
    expect(() => parseSupportedMulticaVersion("v0.5.0")).toThrow(/0\.5\.0/);
  });
});

describe("MulticaCommandRunner", () => {
  it("passes global arguments, command arguments and stdin without a shell", async () => {
    const directory = tempDir();
    const cli = executable(directory, "multica", `
let stdin = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => { stdin += chunk; });
process.stdin.on("end", () => process.stdout.write(JSON.stringify({ argv: process.argv.slice(2), stdin })));
`);
    const runner = new MulticaCommandRunner({
      executable: cli,
      profile: "desktop-api.multica.ai",
      workspaceId: "workspace-1",
      timeoutMs: 1_000,
      maxOutputBytes: 10_000,
    });

    await expect(runner.runJson(["issue", "create", "--title", "A; echo unsafe"], { stdin: "line 1\nline 2" }))
      .resolves.toEqual({
        argv: ["--profile", "desktop-api.multica.ai", "--workspace-id", "workspace-1", "issue", "create", "--title", "A; echo unsafe"],
        stdin: "line 1\nline 2",
      });
  });

  it("discovers the only workspace without reading profile credentials", async () => {
    const directory = tempDir();
    const cli = executable(directory, "multica", `
const argv = process.argv.slice(2);
if (argv.includes("workspace") && argv.includes("list")) {
  process.stdout.write(JSON.stringify([{ id: "workspace-1", name: "RichProject", slug: "richproject" }]));
} else {
  process.stdout.write(JSON.stringify({ argv }));
}
`);
    const runner = new MulticaCommandRunner({ executable: cli, profile: "desktop", timeoutMs: 1_000, maxOutputBytes: 10_000 });

    await expect(runner.runJson(["agent", "list", "--output", "json"]))
      .resolves.toEqual({ argv: ["--profile", "desktop", "--workspace-id", "workspace-1", "agent", "list", "--output", "json"] });
  });

  it("rejects non-zero exits, timeouts, oversized output and invalid JSON", async () => {
    const directory = tempDir();
    const failed = executable(directory, "failed", "process.stderr.write('token=secret should not leak'); process.exit(2)");
    const slow = executable(directory, "slow", "setTimeout(() => process.stdout.write('{}'), 500)");
    const large = executable(directory, "large", "process.stdout.write(JSON.stringify({ value: 'x'.repeat(500) }))");
    const invalid = executable(directory, "invalid", "process.stdout.write('not-json')");

    await expect(new MulticaCommandRunner({ executable: failed, workspaceId: "w", timeoutMs: 5_000, maxOutputBytes: 100 }).runJson(["agent", "list"]))
      .rejects.toThrow(/exit code 2/i);
    await expect(new MulticaCommandRunner({ executable: slow, workspaceId: "w", timeoutMs: 20, maxOutputBytes: 100 }).runJson(["agent", "list"]))
      .rejects.toThrow(/timed out/i);
    await expect(new MulticaCommandRunner({ executable: large, workspaceId: "w", timeoutMs: 5_000, maxOutputBytes: 100 }).runJson(["agent", "list"]))
      .rejects.toThrow(/output limit/i);
    await expect(new MulticaCommandRunner({ executable: invalid, workspaceId: "w", timeoutMs: 5_000, maxOutputBytes: 100 }).runJson(["agent", "list"]))
      .rejects.toThrow(/valid JSON/i);
  });
});
