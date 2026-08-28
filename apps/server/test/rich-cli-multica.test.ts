import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolveClose => server.close(() => resolveClose()))));
});

describe("Rich Multica CLI", () => {
  it("maps semantic team, work and sync commands to project-scoped HTTP", async () => {
    const requests: Array<{ method?: string; url?: string; body: unknown }> = [];
    const server = createServer((request, response) => {
      let body = "";
      request.on("data", chunk => { body += String(chunk); });
      request.on("end", () => {
        requests.push({ method: request.method, url: request.url, body: body ? JSON.parse(body) : undefined });
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: true, data: { planId: "plan-1" } }));
      });
    });
    servers.push(server);
    await new Promise<void>(resolveListen => server.listen(0, "127.0.0.1", resolveListen));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("missing test address");
    const api = `http://127.0.0.1:${address.port}`;
    const directory = await mkdtemp(join(tmpdir(), "rich-cli-multica-"));
    const requestFile = join(directory, "request.json");
    await writeFile(requestFile, JSON.stringify({ richProjectName: "VTB", goal: "分析", capabilities: [{ key: "pm" }] }));

    await runCli(["multica", "team", "plan", "vtb-二代safe", "--file", requestFile, "--raw"], api);
    await runCli(["multica", "team", "apply", "vtb-二代safe", "--confirmed", "--json", JSON.stringify({ planId: "plan-1" })], api);
    await runCli(["multica", "work", "delegate", "vtb-二代safe", "--file", requestFile], api);
    await runCli(["multica", "work", "status", "vtb-二代safe", "task-1"], api);
    await runCli(["multica", "project", "sync", "vtb-二代safe"], api);

    expect(requests).toEqual([
      { method: "POST", url: "/api/project-management/vtb-%E4%BA%8C%E4%BB%A3safe/multica/team/plan", body: { richProjectName: "VTB", goal: "分析", capabilities: [{ key: "pm" }] } },
      { method: "POST", url: "/api/project-management/vtb-%E4%BA%8C%E4%BB%A3safe/multica/team/apply", body: { planId: "plan-1", confirmed: true } },
      { method: "POST", url: "/api/project-management/vtb-%E4%BA%8C%E4%BB%A3safe/multica/work/delegate", body: { richProjectName: "VTB", goal: "分析", capabilities: [{ key: "pm" }] } },
      { method: "GET", url: "/api/project-management/vtb-%E4%BA%8C%E4%BB%A3safe/multica/work/task-1", body: undefined },
      { method: "POST", url: "/api/project-management/vtb-%E4%BA%8C%E4%BB%A3safe/multica/sync", body: {} },
    ]);
  });

  it("rejects team apply without explicit confirmation before HTTP", async () => {
    const result = await runCli(["multica", "team", "apply", "vtb", "--json", JSON.stringify({ planId: "plan-1" })], "http://127.0.0.1:1", false);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/requires --confirmed/);
    expect(result.stderr).not.toMatch(/fetch failed/);
  });
});

async function runCli(args: string[], api: string, expectSuccess = true): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const script = resolve(process.cwd(), "../../scripts/rich-cli.mjs");
  const child = spawn(process.execPath, [script, ...args], { env: { ...process.env, RICH_API_URL: api }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", chunk => { stdout += String(chunk); });
  child.stderr.on("data", chunk => { stderr += String(chunk); });
  const code = await new Promise<number | null>(resolveExit => child.on("close", resolveExit));
  if (expectSuccess && code !== 0) throw new Error(`CLI failed (${code}): ${stderr}`);
  return { code, stdout, stderr };
}
