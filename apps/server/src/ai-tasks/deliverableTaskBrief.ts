import type { AiTaskRequest } from "./types.js";

export function plainTaskText(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&(quot|amp|lt|gt|nbsp);/gi, (_match, entity: string) => ({ quot: '"', amp: "&", lt: "<", gt: ">", nbsp: " " })[entity.toLowerCase()] ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function effectiveAcceptanceCriteria(request: AiTaskRequest): string[] {
  if (request.acceptanceCriteria.length > 0) return request.acceptanceCriteria;
  return [
    "Read every frozen material relevant to the requested comparison before concluding.",
    "Provide a traceability result for each baseline item: item, analysis status, evidence, and gap or reason.",
    "If a required material cannot be read, report its exact path and access failure; do not complete with a generic insufficient-evidence conclusion.",
  ];
}

export function deliverableTaskBrief(request: AiTaskRequest): string {
  const snapshot = request.contextSnapshot;
  const records = snapshot.records.map(record => `- [${record.kind}] ${plainTaskText(record.text)}`).join("\n") || "- None";
  const files = snapshot.files.map(file => `- [${file.type}] ${file.relativePath}${file.note ? ` — ${file.note}` : ""}`).join("\n") || "- None";
  return [
    "## Requested outcome", plainTaskText(request.instructions),
    "", "## Delivery requirement", plainTaskText(snapshot.deliverable.requirementHtml) || "- None",
    "", "## Frozen delivery inputs (read before concluding)",
    `- Deliverable folder: ${snapshot.deliverable.folderPath}`,
    records,
    files,
    "", "## Evidence rule",
    "Treat frozen material files as primary evidence. Do not conclude that evidence is missing before reading every relevant frozen material and checking the listed navigation, source, and analysis paths.",
  ].join("\n");
}
