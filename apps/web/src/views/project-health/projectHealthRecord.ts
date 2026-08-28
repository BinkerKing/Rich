export type ProjectHealthSeverity = "critical" | "high" | "medium" | "low";
export type ProjectHealthStatus = "open" | "planned" | "fixing" | "verified";
export type ProjectHealthCategory = "architecture" | "code" | "data" | "dependency" | "security" | "delivery";

export type ProjectHealthRecord = {
  severity: ProjectHealthSeverity;
  category: ProjectHealthCategory;
  status: ProjectHealthStatus;
  evidence: string;
  repairPlan: string;
  repairResult: string;
  checkedAt: string;
};

const severities: readonly string[] = ["critical", "high", "medium", "low"];
const statuses: readonly string[] = ["open", "planned", "fixing", "verified"];
const categories: readonly string[] = ["architecture", "code", "data", "dependency", "security", "delivery"];

export function normalizeProjectHealthRecord(value: Record<string, unknown>): ProjectHealthRecord {
  return {
    severity: severities.includes(value.severity as string) ? value.severity as ProjectHealthSeverity : "medium",
    category: categories.includes(value.category as string) ? value.category as ProjectHealthCategory : "architecture",
    status: statuses.includes(value.status as string) ? value.status as ProjectHealthStatus : "open",
    evidence: typeof value.evidence === "string" ? value.evidence : "",
    repairPlan: typeof value.repairPlan === "string" ? value.repairPlan : "",
    repairResult: typeof value.repairResult === "string" ? value.repairResult : "",
    checkedAt: typeof value.checkedAt === "string" ? value.checkedAt : "",
  };
}
