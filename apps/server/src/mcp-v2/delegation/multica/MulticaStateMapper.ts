import type { WorkDelegationStatus } from "../WorkDelegationPort.js";
import type { MulticaIssue, MulticaRun } from "./types.js";

const QUEUED_RUNS = new Set(["deferred", "queued", "dispatched"]);
const WAITING_RUNS = new Set(["waiting_local_directory", "waiting_input"]);
const ACTIVE_RUNS = new Set(["deferred", "queued", "dispatched", "waiting_local_directory", "waiting_input", "running"]);
const COMPLETED_ISSUES = new Set(["done", "completed", "succeeded", "closed"]);
const CANCELLED_ISSUES = new Set(["cancelled", "canceled"]);
const FAILED_ISSUES = new Set(["failed"]);
const REVIEW_ISSUES = new Set(["in_review", "review"]);

export function aggregateMulticaStatus(issue: MulticaIssue, runs: MulticaRun[]): WorkDelegationStatus {
  const issueStatus = normalize(issue.status);
  const counts = countRuns(runs);
  const progressSummary = summary(issue, counts);
  const resultRefs = resultReferences(runs);

  if (CANCELLED_ISSUES.has(issueStatus)) return { status: "cancelled", progressSummary, resultRefs };
  if (FAILED_ISSUES.has(issueStatus)) {
    return { status: "failed", progressSummary, resultRefs, error: latestError(runs) ?? "Multica Issue failed." };
  }
  if (COMPLETED_ISSUES.has(issueStatus)) return { status: "succeeded", progressSummary, resultRefs };
  if (REVIEW_ISSUES.has(issueStatus)) return { status: "waiting_input", progressSummary, resultRefs };
  if (runs.some(run => normalize(run.status) === "running")) return { status: "running", progressSummary, resultRefs };
  if (runs.some(run => WAITING_RUNS.has(normalize(run.status)))) return { status: "waiting_input", progressSummary, resultRefs };
  if (runs.some(run => QUEUED_RUNS.has(normalize(run.status)))) return { status: "queued", progressSummary, resultRefs };
  if (issueStatus === "in_progress" || issueStatus === "started") return { status: "running", progressSummary, resultRefs };
  return { status: "queued", progressSummary, resultRefs };
}

export function isActiveMulticaRun(run: MulticaRun): boolean {
  return ACTIVE_RUNS.has(normalize(run.status));
}

function countRuns(runs: MulticaRun[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const run of runs) {
    const status = normalize(run.status);
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

function summary(issue: MulticaIssue, counts: Record<string, number>): string {
  const runSummary = Object.entries(counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => `${count} ${status}`)
    .join(", ");
  const label = issue.identifier || issue.id;
  return runSummary ? `${label}: ${issue.status}; runs: ${runSummary}` : `${label}: ${issue.status}; no runs yet`;
}

function resultReferences(runs: MulticaRun[]): WorkDelegationStatus["resultRefs"] {
  const refs: NonNullable<WorkDelegationStatus["resultRefs"]> = [];
  const seen = new Set<string>();
  for (const run of runs) {
    const output = run.result?.output?.trim();
    if (output) pushUnique(refs, seen, { type: "multica_run", id: run.id, label: output.slice(0, 120) });
    const pullRequest = run.result?.pr_url?.trim();
    if (pullRequest) pushUnique(refs, seen, { type: "pull_request", id: pullRequest, label: "Multica pull request" });
  }
  return refs;
}

function pushUnique(
  refs: NonNullable<WorkDelegationStatus["resultRefs"]>,
  seen: Set<string>,
  ref: NonNullable<WorkDelegationStatus["resultRefs"]>[number],
): void {
  const key = `${ref.type}:${ref.id}`;
  if (seen.has(key)) return;
  seen.add(key);
  refs.push(ref);
}

function latestError(runs: MulticaRun[]): string | undefined {
  return [...runs].reverse().find(run => run.error?.trim())?.error?.trim() || undefined;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}
