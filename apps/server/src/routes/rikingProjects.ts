import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Hono } from "hono";

type RikingLaunchMethod = "jar" | "tomcat" | "command" | "remote";
type RikingProjectLocation = "local" | "server";
type RikingProjectStatus = "stopped" | "starting" | "running" | "error" | "unknown";

interface RikingProject {
  id: string;
  name: string;
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
  await writeFile(storePath(root), `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeProject(input: Partial<RikingProject>): RikingProject {
  const now = new Date().toISOString();
  return {
    id: text(input.id) || randomUUID(),
    name: text(input.name) || "未命名 Riking 项目",
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

function projectWithRuntime(project: RikingProject) {
  const state = runtime.get(project.id);
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

function startProject(root: string, project: RikingProject) {
  const startedAt = new Date().toISOString();

  if (project.location === "server" || project.launchMethod === "remote") {
    if (!project.remote.host || !project.remote.startCommand) {
      throw new Error("服务器项目需要配置远程主机和启动命令");
    }
    const child = spawnDetached("ssh", sshArgs(project, project.remote.startCommand));
    runtime.set(project.id, { status: "running", pid: child.pid, startedAt });
    void persistStatus(root, project.id, "running", { lastStartedAt: startedAt, lastError: undefined });
    return child.pid;
  }

  if (project.launchMethod === "jar") {
    const jarPath = project.jarPath || project.projectPath;
    if (!jarPath || !existsSync(jarPath)) throw new Error("Jar 包路径不存在");
    const child = spawnDetached("java", ["-jar", jarPath], dirname(jarPath));
    runtime.set(project.id, { status: "running", pid: child.pid, startedAt });
    void persistStatus(root, project.id, "running", { lastStartedAt: startedAt, lastError: undefined });
    return child.pid;
  }

  if (project.launchMethod === "tomcat") {
    if (project.customCommand) {
      const child = spawnDetached("sh", ["-lc", project.customCommand], project.projectPath || project.tomcatPath || undefined);
      runtime.set(project.id, { status: "running", pid: child.pid, startedAt });
      void persistStatus(root, project.id, "running", { lastStartedAt: startedAt, lastError: undefined });
      return child.pid;
    }
    const script = project.startupScript || (project.tomcatPath ? join(project.tomcatPath, "bin", "startup.sh") : "");
    if (!script || !existsSync(script)) throw new Error("Tomcat 启动脚本不存在");
    const child = spawnDetached(script, [], project.tomcatPath || project.projectPath || undefined);
    runtime.set(project.id, { status: "running", pid: child.pid, startedAt });
    void persistStatus(root, project.id, "running", { lastStartedAt: startedAt, lastError: undefined });
    return child.pid;
  }

  if (!project.customCommand) throw new Error("自定义启动命令为空");
  const child = spawnDetached("sh", ["-lc", project.customCommand], project.projectPath || undefined);
  runtime.set(project.id, { status: "running", pid: child.pid, startedAt });
  void persistStatus(root, project.id, "running", { lastStartedAt: startedAt, lastError: undefined });
  return child.pid;
}

function stopProject(root: string, project: RikingProject) {
  const state = runtime.get(project.id);

  if ((project.location === "server" || project.launchMethod === "remote") && project.remote.host && project.remote.stopCommand) {
    spawnDetached("ssh", sshArgs(project, project.remote.stopCommand));
  } else if (project.launchMethod === "tomcat" && project.shutdownScript && existsSync(project.shutdownScript)) {
    spawnDetached(project.shutdownScript, [], project.tomcatPath || project.projectPath || undefined);
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
  void persistStatus(root, project.id, "stopped");
}

async function readLocalLog(logPath: string, maxLines: number) {
  if (!logPath || !existsSync(logPath)) return "";
  const raw = await readFile(logPath, "utf8");
  return raw.split(/\r?\n/).slice(-maxLines).join("\n");
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
    return c.json({ projects: store.projects.map(projectWithRuntime) });
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
    return c.json({ project: projectWithRuntime(updated) });
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
      const pid = startProject(root, project);
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
    stopProject(root, project);
    return c.json({ ok: true });
  });

  app.get("/:id/logs", async (c) => {
    const id = c.req.param("id");
    const lines = Number(c.req.query("lines") || "200");
    const maxLines = Number.isFinite(lines) ? Math.min(Math.max(lines, 20), 1000) : 200;
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
