export type DeliverableStatus = "draft" | "preparing" | "ready" | "accepted";
export type DeliverableVersionPolicy = "latest" | "versioned";
export type DeliverableRecordKind = "requirement" | "status" | "change" | "information" | "material" | "ai_task";
export type DeliverableRecordInformationType = "information" | "material";
export type DeliverableFileType = "deliverable" | "material" | "intermediate";

export type DeliverableRecordAttachment = {
  fileName: string;
  relativePath: string;
  size: number;
};

export type DeliverableRecord = {
  id: string;
  kind: DeliverableRecordKind;
  text: string;
  createdAt: string;
  informationType: DeliverableRecordInformationType;
  attachments: DeliverableRecordAttachment[];
  author?: string;
  aiTask?: { id: string; status: string; executor: "hermes" | "multica" };
};

export type DeliverableVersion = {
  id: string;
  fileName: string;
  relativePath: string;
  size: number;
  createdAt: string;
  note?: string;
};

export type DeliverableFileMeta = {
  relativePath: string;
  type: DeliverableFileType;
  version: string;
  note?: string;
};

export const DELIVERABLE_FOCUS_EVENT = "rich:open-deliverable";
const DELIVERABLE_FOCUS_KEY = "rich-project-deliverable-focus";

export function requestDeliverableFocus(taskId: string, activityId: string) {
  const target = { linkedActivityKey: `${taskId}:${activityId}` };
  window.dispatchEvent(new CustomEvent(DELIVERABLE_FOCUS_EVENT, { detail: target }));
}

export function storeDeliverableFocus(projectId: string, linkedActivityKey: string) {
  const target = { projectId, linkedActivityKey };
  try { window.sessionStorage.setItem(DELIVERABLE_FOCUS_KEY, JSON.stringify(target)); } catch {}
}

export function consumeDeliverableFocus(projectId: string) {
  try {
    const target = JSON.parse(window.sessionStorage.getItem(DELIVERABLE_FOCUS_KEY) || "null") as { projectId?: unknown; linkedActivityKey?: unknown } | null;
    if (target?.projectId !== projectId || typeof target.linkedActivityKey !== "string") return undefined;
    window.sessionStorage.removeItem(DELIVERABLE_FOCUS_KEY);
    return target.linkedActivityKey;
  } catch { return undefined; }
}

export type DeliverableContent = {
  recordType: "deliverable";
  status: DeliverableStatus;
  folderPath: string;
  versionPolicy: DeliverableVersionPolicy;
  descriptionHtml: string;
  records: DeliverableRecord[];
  versions: DeliverableVersion[];
  fileMeta: DeliverableFileMeta[];
  linkedActivityKey?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function records(value: unknown): DeliverableRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => {
    if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.text !== "string" || typeof entry.createdAt !== "string") return [];
    if (entry.kind !== "requirement" && entry.kind !== "status" && entry.kind !== "change" && entry.kind !== "information" && entry.kind !== "material" && entry.kind !== "ai_task") return [];
    const attachments = Array.isArray(entry.attachments) ? entry.attachments.flatMap(file => {
      if (!isRecord(file) || typeof file.fileName !== "string" || typeof file.relativePath !== "string" || typeof file.size !== "number") return [];
      return [{ fileName: file.fileName, relativePath: file.relativePath, size: file.size }];
    }) : [];
    const aiTask = isRecord(entry.aiTask) && typeof entry.aiTask.id === "string" && typeof entry.aiTask.status === "string" && (entry.aiTask.executor === "hermes" || entry.aiTask.executor === "multica")
      ? { id: entry.aiTask.id, status: entry.aiTask.status, executor: entry.aiTask.executor as "hermes" | "multica" }
      : undefined;
    return [{ id: entry.id, kind: entry.informationType === "material" ? "material" : entry.kind, text: entry.text, createdAt: entry.createdAt, informationType: entry.informationType === "material" ? "material" : "information", attachments, author: typeof entry.author === "string" ? entry.author : undefined, aiTask }];
  });
}

function versions(value: unknown): DeliverableVersion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => {
    if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.fileName !== "string" || typeof entry.relativePath !== "string" || typeof entry.size !== "number" || typeof entry.createdAt !== "string") return [];
    return [{ id: entry.id, fileName: entry.fileName, relativePath: entry.relativePath, size: entry.size, createdAt: entry.createdAt, note: typeof entry.note === "string" ? entry.note : undefined }];
  });
}

function fileMeta(value: unknown): DeliverableFileMeta[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(entry => {
    if (!isRecord(entry) || typeof entry.relativePath !== "string") return [];
    if (entry.type !== "deliverable" && entry.type !== "material" && entry.type !== "intermediate") return [];
    return [{ relativePath: entry.relativePath, type: entry.type, version: typeof entry.version === "string" ? entry.version : "", note: typeof entry.note === "string" ? entry.note : undefined }];
  });
}

export function normalizeDeliverableContent(value: unknown): DeliverableContent {
  const source = isRecord(value) ? value : {};
  const sourceVersions = versions(source.versions).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const legacyMeta = sourceVersions.map((version, index) => ({ relativePath: version.relativePath, type: "deliverable" as const, version: `V${sourceVersions.length - index}` }));
  const metaByPath = new Map<string, DeliverableFileMeta>(legacyMeta.map(meta => [meta.relativePath, meta]));
  for (const meta of fileMeta(source.fileMeta)) metaByPath.set(meta.relativePath, meta);
  return {
    recordType: "deliverable",
    status: source.status === "preparing" || source.status === "ready" || source.status === "accepted" ? source.status : "draft",
    folderPath: typeof source.folderPath === "string" ? source.folderPath : "",
    versionPolicy: source.versionPolicy === "versioned" ? "versioned" : "latest",
    descriptionHtml: typeof source.descriptionHtml === "string" ? source.descriptionHtml : "",
    records: records(source.records).sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    versions: sourceVersions,
    fileMeta: [...metaByPath.values()],
    linkedActivityKey: typeof source.linkedActivityKey === "string" ? source.linkedActivityKey : undefined,
  };
}

function folderName(value: string, fallback: string) {
  return value.trim().replace(/[\\/:*?"<>|]/g, "-") || fallback;
}

export function deliverableFolderPath(taskCode: string, taskTitle: string, deliverableNumber: number, deliverableTitle: string, rootDirectory = "07-交付") {
  const task = `${folderName(taskCode, "未编号任务")}-${folderName(taskTitle, "未命名任务")}`;
  const deliverable = `${String(deliverableNumber).padStart(2, "0")}-${folderName(deliverableTitle, "未命名交付物")}`;
  const root = rootDirectory.trim().replaceAll("\\", "/").replace(/^\/+|\/+$/g, "") || "07-交付";
  return `${root}/${task}/${deliverable}`;
}

export function linkedDeliverableContent(taskId: string, activity: { id: string; text: string; createdAt: string }, folderPath = `07-交付/${folderName(activity.text, "未命名交付物")}`): DeliverableContent {
  return { ...normalizeDeliverableContent({}), status: "preparing", folderPath, linkedActivityKey: `${taskId}:${activity.id}` };
}

export function addDeliverableRecord(content: DeliverableContent, record: DeliverableRecord): DeliverableContent {
  return { ...content, records: [...content.records, record].sort((left, right) => left.createdAt.localeCompare(right.createdAt)) };
}

export function addDeliverableVersion(content: DeliverableContent, version: DeliverableVersion): DeliverableContent {
  const kept = content.versionPolicy === "latest"
    ? content.versions.filter(current => current.fileName !== version.fileName)
    : content.versions;
  const nextVersions = [version, ...kept].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return { ...content, versions: nextVersions, fileMeta: [...content.fileMeta.filter(meta => meta.relativePath !== version.relativePath), { relativePath: version.relativePath, type: "deliverable", version: `V${nextVersions.length}` }] };
}

export function updateDeliverableFileMeta(content: DeliverableContent, relativePath: string, patch: Partial<Pick<DeliverableFileMeta, "type" | "version" | "note">>): DeliverableContent {
  const existing = content.fileMeta.find(meta => meta.relativePath === relativePath);
  const versionIndex = content.versions.findIndex(version => version.relativePath === relativePath);
  const fallback: DeliverableFileMeta = { relativePath, type: versionIndex >= 0 ? "deliverable" : "material", version: versionIndex >= 0 ? `V${content.versions.length - versionIndex}` : "" };
  const next = { ...(existing || fallback), ...patch, relativePath };
  return { ...content, fileMeta: [...content.fileMeta.filter(meta => meta.relativePath !== relativePath), next] };
}
