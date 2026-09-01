import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { connect } from "node:net";
import { dirname, join } from "node:path";
import { Hono } from "hono";

type RikingLaunchMethod = "jar" | "tomcat" | "command" | "remote";
type RikingProjectLocation = "local" | "server";
type RikingProjectStatus = "stopped" | "starting" | "running" | "error" | "unknown";
type RikingProjectKind = "application" | "service";

interface RikingProject {
  id: string;
  name: string;
  kind: RikingProjectKind;
  location: RikingProjectLocation;
  launchMethod: RikingLaunchMethod;
  status: RikingProjectStatus;
  projectPath: string;
  jarPath: string;
  tomcatPath: string;
  startupScript: string;
  shutdownScript: string;
  customCommand: string;
  appUrl: string;
  logPath: string;
  db: {
    type: string;
    host: string;
    port: string;
    database: string;
    username: string;
    note: string;
  };
  login: {
    url: string;
    username: string;
    passwordHint: string;
    note: string;
  };
  remote: {
    host: string;
    user: string;
    port: string;
    projectPath: string;
    startCommand: string;
    stopCommand: string;
    logCommand: string;
  };
  createdAt: string;
  updatedAt: string;
  lastStartedAt?: string;
  lastError?: string;
}

interface RikingProjectStore {
  projects: RikingProject[];
}

const runtime = new Map<
  string,
  { status: RikingProjectStatus; pid?: number; startedAt?: string; error?: string }
>();

const startupTimeoutMs = 60_000;

const defaultStore: RikingProjectStore = { projects: [] };

function storePath(root: string) {
  return join(root, "riking-projects.json");
}

async function readStore(root: string): Promise<RikingProjectStore> {
  try {
    const raw = await readFile(storePath(root), "utf8");
    const parsed = JSON.parse(raw) as Partial<RikingProjectStore>;
    return { projects: Array.isArray(parsed.projects) ? parsed.projects.map(normalizeProject) : [] };
  } catch {
    return defaultStore;
  }
}

async function writeStore(root: string, store: RikingProjectStore) {
  await mkdir(root, { recursive: true });
  const target = storePath(root);
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await rename(temporary, target);
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeProject(input: Partial<RikingProject>): RikingProject {
  const now = new Date().toISOString();
  return {
    id: text(input.id) || randomUUID(),
    name: text(input.name) || "未命名 Riking 项目",
    kind: input.kind === "service" ? "service" : "application",
    location: input.location === "server" ? "server" : "local",
    launchMethod: ["jar", "tomcat", "command", "remote"].includes(String(input.launchMethod))
      ? (input.launchMethod as RikingLaunchMethod)
      : "jar",
    status: ["stopped", "starting", "running", "error", "unknown"].includes(String(input.status))
      ? (input.status as RikingProjectStatus)
      : "stopped",
    projectPath: text(input.projectPath),
    jarPath: text(input.jarPath),
    tomcatPath: text(input.tomcatPath),
    startupScript: text(input.startupScript),
    shutdownScript: text(input.shutdownScript),
    customCommand: text(input.customCommand),
    appUrl: text(input.appUrl),
    logPath: text(input.logPath),
    db: {
      type: text(input.db?.type),
      host: text(input.db?.host),
      port: text(input.db?.port),
      database: text(input.db?.database),
      username: text(input.db?.username),
      note: text(input.db?.note),
    },
    login: {
      url: text(input.login?.url),
      username: text(input.login?.username),
      passwordHint: text(input.login?.passwordHint),
      note: text(input.login?.note),
    },
    remote: {
      host: text(input.remote?.host),
      user: text(input.remote?.user),
      port: text(input.remote?.port) || "22",
      projectPath: text(input.remote?.projectPath),
      startCommand: text(input.remote?.startCommand),
      stopCommand: text(input.remote?.stopCommand),
      logCommand: text(input.remote?.logCommand),
    },
    createdAt: text(input.createdAt) || now,
    updatedAt: text(input.updatedAt) || now,
    lastStartedAt: text(input.lastStartedAt) || undefined,
    lastError: text(input.lastError) || undefined,
  };
}

function mergeProject(existing: RikingProject | undefined, patch: Partial<RikingProject>) {
  const base = existing ?? normalizeProject({});
  return normalizeProject({
    ...base,
    ...patch,
    db: { ...base.db, ...patch.db },
    login: { ...base.login, ...patch.login },
    remote: { ...base.remote, ...patch.remote },
    id: existing?.id ?? (text(patch.id) || randomUUID()),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function isAppAvailable(appUrl: string) {
  if (!appUrl) return false;
  try {
    const url = new URL(appUrl);
    if (url.protocol === "tcp:") {
      const port = Number(url.port);
      if (!url.hostname || !Number.isInteger(port) || port < 1 || port > 65535) return false;
      return await new Promise<boolean>((resolve) => {
        const socket = connect({ host: url.hostname, port });
        const finish = (available: boolean) => {
          socket.destroy();
          resolve(available);
        };
        socket.setTimeout(2000);
        socket.once("connect", () => finish(true));
        socket.once("error", () => finish(false));
        socket.once("timeout", () => finish(false));
      });
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try {
      const response = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
      response.body?.cancel();
      return response.status < 400;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

async function projectWithRuntime(project: RikingProject): Promise<RikingProject> {
  const state = runtime.get(project.id);
  // Tomcat's startup script exits before the JVM is ready. Keep the launch in
  // the "starting" state until the background monitor reaches its conclusion.
  if (state?.status === "starting") {
    return {
      ...project,
      status: state.status,
      lastStartedAt: state.startedAt ?? project.lastStartedAt,
      lastError: state.error ?? project.lastError,
    };
  }

  // A service is running only when its configured endpoint currently responds.
  // This also lets a service that was already running be detected after it is added.
  if (project.appUrl && await isAppAvailable(project.appUrl)) {
    return { ...project, status: "running" };
  }

  if (project.status === "running" || project.status === "starting") {
    return { ...project, status: "stopped" };
  }

  if (!state) return project;
  return {
    ...project,
    status: state.status,
    lastStartedAt: state.startedAt ?? project.lastStartedAt,
    lastError: state.error ?? project.lastError,
  };
}

async function persistStatus(
  root: string,
  id: string,
  status: RikingProjectStatus,
  patch: Partial<RikingProject> = {},
) {
  const store = await readStore(root);
  store.projects = store.projects.map((project) =>
    project.id === id ? mergeProject(project, { ...patch, status }) : project,
  );
  await writeStore(root, store);
}

async function monitorStartup(root: string, project: RikingProject, pid: number | undefined, startedAt: string) {
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    const state = runtime.get(project.id);
    if (!state || state.status !== "starting" || state.startedAt !== startedAt) return;
    if (await isAppAvailable(project.appUrl)) {
      runtime.set(project.id, { status: "running", pid, startedAt });
      await persistStatus(root, project.id, "running", { lastStartedAt: startedAt, lastError: undefined });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const state = runtime.get(project.id);
  if (!state || state.status !== "starting" || state.startedAt !== startedAt) return;
  const error = "启动后 60 秒内应用入口仍不可用";
  runtime.set(project.id, { status: "stopped", error });
  await persistStatus(root, project.id, "stopped", { lastError: error });
}

async function markStarting(root: string, project: RikingProject, pid: number | undefined, startedAt: string) {
  runtime.set(project.id, { status: "starting", pid, startedAt });
  await persistStatus(root, project.id, "starting", { lastStartedAt: startedAt, lastError: undefined });
  void monitorStartup(root, project, pid, startedAt);
}

function sshArgs(project: RikingProject, command: string) {
  const target = project.remote.user ? `${project.remote.user}@${project.remote.host}` : project.remote.host;
  return ["-p", project.remote.port || "22", target, command];
}

function spawnDetached(command: string, args: string[], cwd?: string) {
  const child = spawn(command, args, {
    cwd: cwd || undefined,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return child;
}

async function startProject(root: string, project: RikingProject) {
  const startedAt = new Date().toISOString();

  if (project.location === "server" || project.launchMethod === "remote") {
    if (!project.remote.host || !project.remote.startCommand) {
      throw new Error("服务器项目需要配置远程主机和启动命令");
    }
    const child = spawnDetached("ssh", sshArgs(project, project.remote.startCommand));
    await markStarting(root, project, child.pid, startedAt);
    return child.pid;
  }

  if (project.launchMethod === "jar") {
    const jarPath = project.jarPath || project.projectPath;
    if (!jarPath || !existsSync(jarPath)) throw new Error("Jar 包路径不存在");
    const child = spawnDetached("java", ["-jar", jarPath], dirname(jarPath));
    await markStarting(root, project, child.pid, startedAt);
    return child.pid;
  }

  if (project.launchMethod === "tomcat") {
    if (project.customCommand) {
      const child = spawnDetached("sh", ["-lc", project.customCommand], project.projectPath || project.tomcatPath || undefined);
      await markStarting(root, project, child.pid, startedAt);
      return child.pid;
    }
    const script = project.startupScript || (project.tomcatPath ? join(project.tomcatPath, "bin", "startup.sh") : "");
    if (!script || !existsSync(script)) throw new Error("Tomcat 启动脚本不存在");
    const child = spawnDetached(script, [], project.tomcatPath || project.projectPath || undefined);
    await markStarting(root, project, child.pid, startedAt);
    return child.pid;
  }

  if (!project.customCommand) throw new Error("自定义启动命令为空");
  const child = spawnDetached("sh", ["-lc", project.customCommand], project.projectPath || undefined);
  await markStarting(root, project, child.pid, startedAt);
  return child.pid;
}

async function stopProject(root: string, project: RikingProject) {
  const state = runtime.get(project.id);

  if ((project.location === "server" || project.launchMethod === "remote") && project.remote.host && project.remote.stopCommand) {
    spawnDetached("ssh", sshArgs(project, project.remote.stopCommand));
  } else if (project.launchMethod === "tomcat" && project.shutdownScript && existsSync(project.shutdownScript)) {
    spawnDetached(project.shutdownScript, [], project.tomcatPath || project.projectPath || undefined);
  } else if (project.launchMethod === "command" && project.shutdownScript) {
    spawnDetached("sh", ["-lc", project.shutdownScript], project.projectPath || undefined);
  } else if (state?.pid) {
    try {
      process.kill(-state.pid, "SIGTERM");
    } catch {
      try {
        process.kill(state.pid, "SIGTERM");
      } catch {
        // The process may already have exited. Persisting stopped is still correct for the UI action.
      }
    }
  }

  runtime.set(project.id, { status: "stopped" });
  await persistStatus(root, project.id, "stopped");
}

async function readLocalLog(logPath: string, maxLines: number) {
  if (!logPath || !existsSync(logPath)) return "";
  const raw = await readFile(logPath, "utf8");
  const lines = raw.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines.slice(-maxLines).join("\n");
}

function openLocalLog(logPath: string) {
  if (!logPath || !existsSync(logPath)) throw new Error("日志文件不存在");
  const command = process.platform === "darwin"
    ? "open"
    : process.platform === "win32"
      ? "cmd"
      : "xdg-open";
  const args = process.platform === "darwin"
    ? ["-t", logPath]
    : process.platform === "win32"
      ? ["/c", "start", "", logPath]
      : [logPath];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

async function readRemoteLog(project: RikingProject, maxLines: number) {
  if (!project.remote.host || !project.remote.logCommand) return "";
  const command = project.remote.logCommand.includes("tail")
    ? project.remote.logCommand
    : `${project.remote.logCommand} | tail -n ${maxLines}`;

  return new Promise<string>((resolve, reject) => {
    const child = spawn("ssh", sshArgs(project, command), { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let error = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("读取远程日志超时"));
    }, 8000);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      error += chunk.toString();
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else reject(new Error(error || `ssh exited with ${code}`));
    });
  });
}

export function rikingProjectsRoutes(root: string) {
  const app = new Hono();

  app.get("/", async (c) => {
    const store = await readStore(root);
    const projects = await Promise.all(store.projects.map(projectWithRuntime));
    const hasStatusChanges = projects.some((project, index) => project.status !== store.projects[index].status);
    if (hasStatusChanges) {
      store.projects = projects;
      await writeStore(root, store);
    }
    return c.json({ projects });
  });

  app.post("/", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Partial<RikingProject>;
    const store = await readStore(root);
    const project = mergeProject(undefined, body);
    store.projects.unshift(project);
    await writeStore(root, store);
    return c.json({ project });
  });

  app.patch("/:id", async (c) => {
    const id = c.req.param("id");
    const body = (await c.req.json().catch(() => ({}))) as Partial<RikingProject>;
    const store = await readStore(root);
    const existing = store.projects.find((project) => project.id === id);
    if (!existing) return c.json({ error: "project not found" }, 404);
    const updated = mergeProject(existing, body);
    store.projects = store.projects.map((project) => (project.id === id ? updated : project));
    await writeStore(root, store);
    return c.json({ project: await projectWithRuntime(updated) });
  });

  app.delete("/:id", async (c) => {
    const id = c.req.param("id");
    const store = await readStore(root);
    const exists = store.projects.some((project) => project.id === id);
    if (!exists) return c.json({ error: "project not found" }, 404);
    runtime.delete(id);
    store.projects = store.projects.filter((project) => project.id !== id);
    await writeStore(root, store);
    return c.json({ ok: true });
  });

  app.post("/:id/start", async (c) => {
    const id = c.req.param("id");
    const store = await readStore(root);
    const project = store.projects.find((item) => item.id === id);
    if (!project) return c.json({ error: "project not found" }, 404);

    try {
      const pid = await startProject(root, project);
      return c.json({ ok: true, pid });
    } catch (error) {
      const message = error instanceof Error ? error.message : "启动失败";
      runtime.set(project.id, { status: "error", error: message });
      await persistStatus(root, project.id, "error", { lastError: message });
      return c.json({ error: message }, 400);
    }
  });

  app.post("/:id/stop", async (c) => {
    const id = c.req.param("id");
    const store = await readStore(root);
    const project = store.projects.find((item) => item.id === id);
    if (!project) return c.json({ error: "project not found" }, 404);
    await stopProject(root, project);
    return c.json({ ok: true });
  });

  app.post("/:id/open-log", async (c) => {
    const store = await readStore(root);
    const project = store.projects.find((item) => item.id === c.req.param("id"));
    if (!project) return c.json({ error: "project not found" }, 404);
    if (project.location === "server" || project.launchMethod === "remote") {
      return c.json({ error: "远程日志不支持通过本地编辑器打开" }, 400);
    }
    try {
      openLocalLog(project.logPath);
      return c.json({ ok: true });
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "打开日志失败" }, 400);
    }
  });

  app.post("/:id/clear-log", async (c) => {
    const store = await readStore(root);
    const project = store.projects.find((item) => item.id === c.req.param("id"));
    if (!project) return c.json({ error: "project not found" }, 404);
    if (project.location === "server" || project.launchMethod === "remote") {
      return c.json({ error: "远程日志不支持在此清空" }, 400);
    }
    if (!project.logPath || !existsSync(project.logPath)) return c.json({ error: "日志文件不存在" }, 400);
    await writeFile(project.logPath, "", "utf8");
    return c.json({ ok: true });
  });

  app.get("/:id/logs", async (c) => {
    const id = c.req.param("id");
    const lines = Number(c.req.query("lines") || "200");
    const maxLines = Number.isFinite(lines) ? Math.min(Math.max(lines, 20), 2000) : 200;
    const store = await readStore(root);
    const project = store.projects.find((item) => item.id === id);
    if (!project) return c.json({ error: "project not found" }, 404);

    try {
      const logs =
        project.location === "server" || project.launchMethod === "remote"
          ? await readRemoteLog(project, maxLines)
          : await readLocalLog(project.logPath, maxLines);
      return c.json({ logs });
    } catch (error) {
      const message = error instanceof Error ? error.message : "读取日志失败";
      return c.json({ logs: "", error: message }, 400);
    }
  });

  return app;
}
