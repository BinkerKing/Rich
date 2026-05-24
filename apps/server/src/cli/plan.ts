#!/usr/bin/env node
import { openGreatMeRepoFromEnv, runPlanCli } from "./planCli.js";

const rootArgIndex = process.argv.indexOf("--root");
let root: string | undefined;
if (rootArgIndex >= 0) {
  root = process.argv[rootArgIndex + 1];
  process.argv.splice(rootArgIndex, 2);
}

const { repo, close } = await openGreatMeRepoFromEnv(root);
try {
  const result = await runPlanCli(repo, process.argv.slice(2));
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
} finally {
  await close();
}
