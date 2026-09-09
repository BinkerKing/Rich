import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rikingProjectsRoutes } from "../src/routes/rikingProjects.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createProjectStore(status: "running" | "stopped", appUrl = "", customCommand = "", logPath = "") {
  const root = await mkdtemp(join(tmpdir(), "riking-projects-"));
  temporaryRoots.push(root);
  await writeFile(join(root, "riking-projects.json"), JSON.stringify({
    projects: [{
      id: "project-1", name: "测试启动项", location: "local", launchMethod: "command", status,
      projectPath: "", jarPath: "", tomcatPath: "", startupScript: "", shutdownScript: "", customCommand,
      appUrl, logPath, db: {}, login: {}, remote: {}, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    }],
  }), "utf8");
  return root;
}

describe("rikingProjectsRoutes", () => {
  it("persists an AI manual field on a startup project", async () => {
    const root = await mkdtemp(join(tmpdir(), "riking-projects-"));
    temporaryRoots.push(root);
    const aiManual = "# ETL AI 使用手册\n\n先检查日志。";

    const response = await rikingProjectsRoutes(root).request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "ETL", aiManual }),
    });

    expect((await response.json()).project.aiManual).toBe(aiManual);
    const saved = JSON.parse(await readFile(join(root, "riking-projects.json"), "utf8"));
    expect(saved.projects[0].aiManual).toBe(aiManual);
  });

  it("marks a persisted running status as stopped when no live evidence exists", async () => {
    const root = await createProjectStore("running");
    const response = await rikingProjectsRoutes(root).request("http://localhost/");

    expect((await response.json()).projects[0].status).toBe("stopped");
    const saved = JSON.parse(await readFile(join(root, "riking-projects.json"), "utf8"));
    expect(saved.projects[0].status).toBe("stopped");
  });

  it("keeps a project running when its configured application endpoint responds", async () => {
    const server = createServer((_request, response) => response.end());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const root = await createProjectStore("running", `http://127.0.0.1:${port}/health`);
      const response = await rikingProjectsRoutes(root).request("http://localhost/");

      expect((await response.json()).projects[0].status).toBe("running");
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("marks a redirecting application as stopped when its destination returns an error", async () => {
    const server = createServer((request, response) => {
      if (request.url === "/") {
        response.writeHead(302, { location: "/broken" });
        response.end();
        return;
      }
      response.statusCode = 500;
      response.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const root = await createProjectStore("running", `http://127.0.0.1:${port}/`);
      const response = await rikingProjectsRoutes(root).request("http://localhost/");

      expect((await response.json()).projects[0].status).toBe("stopped");
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("detects a stopped project as running when its configured TCP service port accepts connections", async () => {
    const server = createTcpServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      const root = await createProjectStore("stopped", `tcp://127.0.0.1:${port}`);
      const response = await rikingProjectsRoutes(root).request("http://localhost/");

      expect((await response.json()).projects[0].status).toBe("running");
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("keeps the startup list readable immediately after a project is started", async () => {
    const root = await createProjectStore("stopped", "", "sleep 5");
    const app = rikingProjectsRoutes(root);

    const started = await app.request("http://localhost/project-1/start", { method: "POST" });
    expect(started.ok).toBe(true);
    const saved = JSON.parse(await readFile(join(root, "riking-projects.json"), "utf8"));
    expect(saved.projects[0].status).toBe("starting");

    const listed = await app.request("http://localhost/");
    const projects = (await listed.json()).projects;
    expect(projects).toHaveLength(1);
    expect(projects[0].status).toBe("starting");
    await app.request("http://localhost/project-1/stop", { method: "POST" });
  });

  it("stops a launched command after the Rich process restarts", async () => {
    const root = await createProjectStore("stopped", "", "sleep 30");
    const started = await rikingProjectsRoutes(root).request("http://localhost/project-1/start", { method: "POST" });
    expect(started.ok).toBe(true);
    const saved = JSON.parse(await readFile(join(root, "riking-projects.json"), "utf8"));
    const pid = saved.projects[0].processId;
    expect(pid).toEqual(expect.any(Number));

    vi.resetModules();
    const { rikingProjectsRoutes: routesAfterRestart } = await import("../src/routes/rikingProjects.js");
    await routesAfterRestart(root).request("http://localhost/project-1/stop", { method: "POST" });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(() => process.kill(pid, 0)).toThrow();
  });

  it("clears only the configured local log file", async () => {
    const root = await mkdtemp(join(tmpdir(), "riking-log-"));
    temporaryRoots.push(root);
    const logPath = join(root, "application.log");
    await writeFile(logPath, "old log line\n", "utf8");
    await rm(join(root, "riking-projects.json"), { force: true });
    const storeRoot = await createProjectStore("stopped", "", "", logPath);
    const response = await rikingProjectsRoutes(storeRoot).request("http://localhost/project-1/clear-log", { method: "POST" });

    expect(response.ok).toBe(true);
    expect(await readFile(logPath, "utf8")).toBe("");
  });

  it("returns the latest 2000 log lines", async () => {
    const root = await mkdtemp(join(tmpdir(), "riking-log-lines-"));
    temporaryRoots.push(root);
    const logPath = join(root, "application.log");
    await writeFile(logPath, Array.from({ length: 2100 }, (_, index) => `line-${index + 1}`).join("\n") + "\n", "utf8");
    const storeRoot = await createProjectStore("stopped", "", "", logPath);
    const response = await rikingProjectsRoutes(storeRoot).request("http://localhost/project-1/logs?lines=5000");
    const logs = (await response.json()).logs.split("\n");

    expect(logs).toHaveLength(2000);
    expect(logs[0]).toBe("line-101");
    expect(logs.at(-1)).toBe("line-2100");
  });
});
