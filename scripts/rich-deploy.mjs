#!/usr/bin/env node

import { appendFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceApp = join(repositoryRoot, "apps/desktop/release/mac-arm64/Rich.app");
const installedApp = "/Applications/Rich.app";

export function createDeploymentJob({ now = () => new Date(), random = () => Math.random().toString(36).slice(2, 8), tempDir = tmpdir() } = {}) {
  const timestamp = now().toISOString().replace(/[-:.]/g, "").replace("Z", "Z");
  const id = `rich-deploy-${timestamp}-${random()}`;
  return { id, logPath: join(tempDir, `${id}.log`) };
}

function runCommand(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: repositoryRoot, stdio: "ignore", ...options });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolvePromise() : reject(new Error(`${command} exited with code ${code}`)));
  });
}

async function log(logPath, message) {
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, `[${new Date().toISOString()}] ${message}\n`);
}

export async function runDeployment({ run = runCommand, logPath, source = sourceApp, target = installedApp, skipQuit = false } = {}) {
  const stagedApp = `${target}.new`;
  const report = message => logPath ? log(logPath, message) : Promise.resolve();
  await report("Packaging Rich.app");
  await run("pnpm", ["--filter", "@ke/desktop", "package"]);
  if (!skipQuit) {
    await report("Quitting Rich");
    await run("osascript", ["-e", 'tell application "Rich" to quit']).catch(() => undefined);
  }
  await report("Staging new Rich.app");
  await run("ditto", [source, stagedApp]);
  await report("Replacing installed Rich.app");
  await run("rm", ["-rf", target]);
  await run("mv", [stagedApp, target]);
  await report("Launching Rich");
  const launchEnvironment = { ...process.env };
  delete launchEnvironment.ELECTRON_RUN_AS_NODE;
  await run("open", [target], { env: launchEnvironment });
  await report("Deployment finished");
}

export function startDeployment() {
  const job = createDeploymentJob();
  const script = fileURLToPath(import.meta.url);
  const child = spawn(process.execPath, [script, "--worker", job.logPath], {
    cwd: repositoryRoot,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return job;
}

if (process.argv[2] === "--worker") {
  const logPath = process.argv[3];
  const skipQuit = process.argv.includes("--skip-quit");
  runDeployment({ logPath, skipQuit }).catch(async error => {
    await log(logPath, `Deployment failed: ${error instanceof Error ? error.stack || error.message : String(error)}`);
    process.exitCode = 1;
  });
} else if (process.argv[1] && basename(process.argv[1]) === "rich-deploy.mjs") {
  const job = startDeployment();
  console.log(`Rich deployment started: ${job.id}\nLog: ${job.logPath}`);
}
