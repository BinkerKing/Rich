#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const API = (process.env.RICH_API_URL || "http://127.0.0.1:31515").replace(/\/$/, "");

function usage() {
  console.log(`Rich unified CLI

Usage:
  pnpm rich -- health
  pnpm rich -- api <METHOD> <PATH> [--json '<body-json>' | --file body.json]
  pnpm rich -- sse <METHOD> <PATH> [--json '<body-json>' | --file body.json]
  pnpm rich -- upload <PATH> --file <path> [--field files|file] [--value k=v]

Common semantic commands:
  workbench list
  workbench get <taskId>
  workbench create --file task.json
  workbench plan <taskId> --json '{"expectedVersion":1,"input":{"steps":[{"id":"s1","title":"理解需求"}]}}'
  workbench step <taskId> --json '{"expectedVersion":2,"input":{"id":"s1","status":"done","evidence":"已确认需求"}}'
  workbench update|record|resource|confirm|checkpoint|answer <taskId> --file write.json
  workbench history <taskId>

  workbench-document list
  workbench-document get <documentId>
  workbench-document create --file document.json
  workbench-document history <documentId>
  workbench-document outline <documentId> --file operations.json
  workbench-document propose <documentId> --file proposal.json

  elements list
  elements get <id>
  elements create --json '{"title":"X","type":"topic","parentId":"optional"}'
  elements patch <id> --json '{"title":"New"}'
  elements delete <id>
  elements move <id> --json '{"newParentId":"parent-or-null"}'
  elements sections <id> --json '{"sections":[]}'
  elements migrate-sections <id>
  elements history <id>
  elements revert <id> --json '{"timestamp":"..."}'

  relations list [--query 'from=<id>&to=<id>']
  relations reorder --json '{"parentId":"...","childIds":["..."]}'
  paths list [--center <elementId>]
  center get
  center set <elementId>

  ai analyze-input --json '{"text":"...","model":"codex"}'
  ai generate-tree --json '{"topic":"...","model":"codex"}'
  ai refine --json '{"elementId":"...","direction":"..."}'
  ai feedback --json '{"elementId":"...","feedback":"..."}'
  ai section-feedback --json '{"elementId":"...","sectionId":"...","feedback":"..."}'
  ai attach-under --json '{"parentId":"...","mode":"leaf","leafTitle":"...","fullIntent":"..."}'
  ai expand --json '{"elementId":"...","count":3}'
  ai extend --json '{"elementId":"...","direction":"...","count":3}'
  ai path --json '{"elementId":"...","kinds":["prerequisite"]}'
  ai ask --json '{"elementId":"...","question":"..."}'
  ai analyze-mark --json '{"elementId":"...","markedText":"..."}'
  ai news-generate-daily --json '{"date":"2026-05-25","model":"codex"}'
  ai decompose-plan --json '{"title":"...","detail":"..."}'
  ai analyze-progress --json '{"state":{...}}'
  ai draft-review --json '{"state":{...}}'
  ai draft-prd --json '{"practice":{...},"context":{...}}'
  ai draft-child --json '{"practice":{...},"group":{...},"type":"feature","prompt":"..."}'
  ai adjust-child --json '{"child":{...},"feedback":"..."}'
  ai guided-practice --json '{"stage":"goal","userInput":"...","draft":{},"messages":[],"model":"hermes"}'

  mindmaps list
  mindmaps get <id>
  mindmaps attach --json '{"elementId":"...","caption":"optional"}'
  mindmaps detach <elementId> --json '{"deckRootId":"..."}'
  mindmaps toggle-hidden <elementId> --json '{"deckRootId":"..."}'
  mindmaps toggle-image <elementId> --json '{"deckRootId":"..."}'
  mindmaps toggle-text <elementId> --json '{"deckRootId":"..."}'
  mindmaps retry-cover <elementId> --json '{"deckRootId":"...","hint":"optional"}'
  mindmaps generate --json '{"prose":"...","titleHint":"...","model":"codex"}'

  annotations list --query 'elementId=<id>'
  annotations create --json '{"elementId":"...","kind":"highlight","text":"..."}'
  annotations delete <id>
  qa list --query 'elementId=<id>'
  qa delete <id>

  toolbox tools
  toolbox invocations [--query 'limit=100&status=scheduled']
  toolbox invoke --json '{"tool":"lock_screen","args":{}}'
  toolbox cancel <invocationId>

  improvements list [--query 'status=pending&limit=100']
  improvements get <id>
  improvements create --json '{"title":"...","description":"...","priority":"medium"}'
  improvements patch <id> --json '{"status":"ready_to_verify"}'
  improvements delete <id>
  improvements claim <id> --json '{"agentId":"mac-mini-hermes"}'
  improvements release <id> --json '{"agentId":"mac-mini-hermes"}'

  project-health list <projectId>
  project-health create <projectId> --json '{"title":"...","severity":"high","category":"architecture","status":"open","evidence":"...","repairPlan":"...","repairResult":""}'
  project-health patch <projectId> <recordId> --json '{"status":"verified","repairResult":"..."}'

  testing tasks|cases|runs|issues|report <projectId>
  testing create-task|create-case|create-cases <projectId> --json '{...}'
  testing add-step|start-run <projectId> <caseId> --json '{...}'
  testing finish-run|add-evidence <projectId> <runId> --json '{...}'
  testing finish-step <projectId> <runStepId> --json '{...}'
  testing create-issue <projectId> --json '{"caseId":"...",...}'
  testing update-issue|discuss|retest <projectId> <issueId> --json '{...}'

  multica team plan <projectId> --file team.json
  multica team apply <projectId> --confirmed --json '{"planId":"..."}'
  multica work delegate <projectId> --file task.json
  multica work status <projectId> <taskId>
  multica project sync <projectId>

  corpus list
  corpus get <id>
  corpus upsert <id> --json '{"name":"...","scene":"..."}'
  corpus replace-all --json '{"templates":[...]}'
  corpus reset
  corpus delete <id>

  great-me get
  great-me put --json '{"version":1,...}'
  chat send --json '{"messages":[{"role":"user","content":"hi"}]}'
  chat stream --json '{"messages":[{"role":"user","content":"hi"}]}'
  chat-attachments upload --file image.png [--value messageId=<id>]
  chat-attachments bind <id> --json '{"messageId":"..."}'
  chat-attachments get <id>
  chat-attachments by-message <messageId>
  chat-attachments delete <id>

  attachments upload <elementId> --file file.pdf [--field files]
  attachments delete <elementId> <filename>
  admin engine | ops | signals | manuals | manual <name>
  cron jobs
  mascot state | animations | play --json '{"name":"dance","durationMs":3000}'

Flags:
  --json '<json>'        JSON request body
  --file <path>          JSON body file, or upload file for upload commands
  --query 'a=1&b=2'      Query string for list endpoints
  --value k=v            Multipart extra field, repeatable
  --raw                  Print raw response text instead of pretty JSON
  --api <url>            Override RICH_API_URL for this call
`);
}

function parse(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--") continue;
    if (!token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      flags[key] = true;
    } else if (flags[key] === undefined) {
      flags[key] = next;
      i += 1;
    } else if (Array.isArray(flags[key])) {
      flags[key].push(next);
      i += 1;
    } else {
      flags[key] = [flags[key], next];
      i += 1;
    }
  }
  return { positional, flags };
}

function apiBase(flags) {
  return String(flags.api || API).replace(/\/$/, "");
}

function withQuery(path, flags) {
  const q = typeof flags.query === "string" ? flags.query.replace(/^\?/, "") : "";
  if (!q) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${q}`;
}

async function bodyFromFlags(flags) {
  if (typeof flags.json === "string") return JSON.parse(flags.json);
  if (typeof flags.file === "string") return JSON.parse(await readFile(flags.file, "utf8"));
  return undefined;
}

async function request(method, path, flags = {}, body = undefined) {
  const url = `${apiBase(flags)}${path.startsWith("/") ? path : `/${path}`}`;
  const hasBody = body !== undefined;
  const res = await fetch(url, {
    method,
    headers: hasBody ? { "content-type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    let err = text;
    try { err = JSON.parse(text).error || text; } catch { /* raw */ }
    throw new Error(`${method} ${path} failed: ${res.status} ${err}`);
  }
  print(text, flags);
}

async function sse(method, path, flags = {}, body = undefined) {
  const url = `${apiBase(flags)}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok || !res.body) {
    throw new Error(`${method} ${path} failed: ${res.status} ${await res.text()}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let final = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const dataLine = chunk.split("\n").find(line => line.startsWith("data: "));
      if (!dataLine) continue;
      const data = JSON.parse(dataLine.slice(6));
      if (data.type === "delta" && data.text && !flags.jsonOnly) process.stderr.write(data.text);
      if (data.type === "done") final = data.result ?? data;
      if (data.type === "error") throw new Error(data.message || "SSE error");
    }
  }
  if (!flags.jsonOnly) process.stderr.write("\n");
  console.log(JSON.stringify(final, null, 2));
}

function print(text, flags = {}) {
  if (flags.raw) {
    process.stdout.write(text);
    if (!text.endsWith("\n")) process.stdout.write("\n");
    return;
  }
  if (!text) return;
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    process.stdout.write(text);
    if (!text.endsWith("\n")) process.stdout.write("\n");
  }
}

async function multipart(path, flags, fileField = "files") {
  const file = flags.file;
  if (typeof file !== "string") throw new Error("--file is required");
  const form = new FormData();
  const bytes = await readFile(file);
  const blob = new Blob([bytes], { type: mimeFor(file) });
  form.append(String(flags.field || fileField), blob, basename(file));
  const values = flags.value === undefined ? [] : Array.isArray(flags.value) ? flags.value : [flags.value];
  for (const value of values) {
    const [k, ...rest] = String(value).split("=");
    form.append(k, rest.join("="));
  }
  const res = await fetch(`${apiBase(flags)}${path}`, { method: "POST", body: form });
  const text = await res.text();
  if (!res.ok) throw new Error(`upload ${path} failed: ${res.status} ${text}`);
  print(text, flags);
}

function mimeFor(file) {
  const lower = file.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

const id = (v, name = "id") => {
  if (!v) throw new Error(`missing ${name}`);
  return encodeURIComponent(v);
};

async function semantic(positional, flags) {
  const [domain, action, a, b] = positional;
  const body = await bodyFromFlags(flags);

  if (domain === "health") return request("GET", "/api/health", flags);
  if (domain === "agent-id") return request("GET", "/api/agent-id", flags);

  if (domain === "multica") {
    const operation = a;
    const projectId = id(b, "projectId");
    const base = `/api/project-management/${projectId}/multica`;
    if (action === "team" && operation === "plan") return request("POST", `${base}/team/plan`, flags, body ?? {});
    if (action === "team" && operation === "apply") {
      if (flags.confirmed !== true) throw new Error("multica team apply requires --confirmed");
      return request("POST", `${base}/team/apply`, flags, { ...(body ?? {}), confirmed: true });
    }
    if (action === "work" && operation === "delegate") return request("POST", `${base}/work/delegate`, flags, body ?? {});
    if (action === "work" && operation === "status") return request("GET", `${base}/work/${id(positional[4], "taskId")}`, flags);
    if (action === "project" && operation === "sync") return request("POST", `${base}/sync`, flags, body ?? {});
  }

  if (domain === "workbench") {
    if (action === "list") return request("GET", "/api/workbench", flags);
    if (action === "create") return request("POST", "/api/workbench", flags, body ?? {});
    if (action === "get") return request("GET", `/api/workbench/${id(a)}`, flags);
    if (action === "history") return request("GET", `/api/workbench/${id(a)}/history`, flags);
    if (["update", "plan", "step", "record", "resource", "confirm", "checkpoint", "answer"].includes(action)) return request("POST", `/api/workbench/${id(a)}/write`, flags, { ...(body ?? {}), action });
  }
  if (domain === "workbench-document") {
    if (action === "list") return request("GET", "/api/workbench-documents", flags);
    if (action === "create") return request("POST", "/api/workbench-documents", flags, body ?? {});
    if (action === "get") return request("GET", `/api/workbench-documents/${id(a)}`, flags);
    if (action === "history") return request("GET", `/api/workbench-documents/${id(a)}/history`, flags);
    if (action === "outline") return request("POST", `/api/workbench-documents/${id(a)}/outline`, flags, body ?? {});
    if (action === "propose") return request("POST", `/api/workbench-documents/${id(a)}/proposals`, flags, body ?? {});
  }
  if (domain === "elements") {
    if (action === "list") return request("GET", withQuery("/api/elements", flags), flags);
    if (action === "get") return request("GET", `/api/elements/${id(a)}`, flags);
    if (action === "create") return request("POST", "/api/elements", flags, body ?? {});
    if (action === "patch") return request("PATCH", `/api/elements/${id(a)}`, flags, body ?? {});
    if (action === "delete") return request("DELETE", `/api/elements/${id(a)}`, flags);
    if (action === "move") return request("POST", `/api/elements/${id(a)}/move`, flags, body ?? {});
    if (action === "sections") return request("PUT", `/api/elements/${id(a)}/sections`, flags, body ?? {});
    if (action === "migrate-sections") return request("POST", `/api/elements/${id(a)}/sections/migrate`, flags);
    if (action === "history") return request("GET", `/api/elements/${id(a)}/history`, flags);
    if (action === "revert") return request("POST", `/api/elements/${id(a)}/revert`, flags, body ?? {});
  }

  if (domain === "relations") {
    if (action === "list") return request("GET", withQuery("/api/relations", flags), flags);
    if (action === "reorder") return request("POST", "/api/relations/reorder-children", flags, body ?? {});
  }
  if (domain === "paths") {
    if (action === "list") return request("GET", withQuery(flags.center ? `/api/paths?center=${encodeURIComponent(flags.center)}` : "/api/paths", flags), flags);
  }
  if (domain === "center") {
    if (action === "get") return request("GET", "/api/state/center", flags);
    if (action === "set") return request("POST", "/api/state/center", flags, { elementId: a });
  }

  if (domain === "ai") {
    const sseMap = {
      "generate-tree": "/api/ai/generate-tree",
      refine: "/api/ai/refine",
      feedback: "/api/ai/feedback",
      "section-feedback": "/api/ai/section-feedback",
      "attach-under": "/api/ai/attach-under",
      expand: "/api/ai/expand",
      extend: "/api/ai/extend",
      path: "/api/ai/path",
      ask: "/api/ai/ask",
      "analyze-mark": "/api/ai/analyze-mark",
      "news-generate-daily": "/api/ai/news/generate-daily",
      review: "/api/ai/review",
    };
    const postMap = {
      "great-me": "/api/ai/great-me",
      "decompose-plan": "/api/ai/decompose-plan",
      "analyze-progress": "/api/ai/analyze-progress",
      "draft-review": "/api/ai/draft-review",
      "draft-prd": "/api/ai/draft-prd",
      "draft-child": "/api/ai/draft-child",
      "adjust-child": "/api/ai/adjust-child",
      "guided-practice": "/api/ai/guided-practice",
      "analyze-input": "/api/ai/analyze-input",
    };
    if (action === "models") return request("GET", "/api/ai/models", flags);
    if (action === "richness-spec") return request("GET", "/api/ai/richness-spec", flags);
    if (sseMap[action]) return sse("POST", sseMap[action], flags, body ?? {});
    if (postMap[action]) return request("POST", postMap[action], flags, body ?? {});
  }

  if (domain === "mindmaps") {
    if (action === "list") return request("GET", "/api/mindmaps", flags);
    if (action === "get") return request("GET", `/api/mindmaps/${id(a)}`, flags);
    if (action === "attach") return request("POST", "/api/mindmaps/attach", flags, body ?? {});
    if (action === "detach") return request("POST", `/api/mindmaps/${id(a)}/detach`, flags, body ?? {});
    if (action === "toggle-hidden") return request("POST", `/api/mindmaps/${id(a)}/toggle-hidden`, flags, body ?? {});
    if (action === "toggle-image") return request("POST", `/api/mindmaps/${id(a)}/toggle-image-disabled`, flags, body ?? {});
    if (action === "toggle-text") return request("POST", `/api/mindmaps/${id(a)}/toggle-text-disabled`, flags, body ?? {});
    if (action === "retry-cover") return request("POST", `/api/mindmaps/${id(a)}/retry-cover`, flags, body ?? {});
    if (action === "generate") return sse("POST", "/api/mindmaps/generate", flags, body ?? {});
    if (action === "delete") return request("DELETE", `/api/mindmaps/${id(a)}`, flags);
  }

  if (domain === "annotations") {
    if (action === "list") return request("GET", withQuery("/api/annotations", flags), flags);
    if (action === "create") return request("POST", "/api/annotations", flags, body ?? {});
    if (action === "delete") return request("DELETE", `/api/annotations/${id(a)}`, flags);
  }
  if (domain === "qa") {
    if (action === "list") return request("GET", withQuery("/api/ai/qa", flags), flags);
    if (action === "delete") return request("DELETE", `/api/ai/qa/${id(a)}`, flags);
  }
  if (domain === "signals") {
    if (action === "list") return request("GET", withQuery("/api/signals", flags), flags);
    if (action === "count") return request("GET", "/api/signals/count", flags);
    if (action === "create") return request("POST", "/api/signals", flags, body ?? {});
  }

  if (domain === "toolbox") {
    if (action === "tools") return request("GET", "/api/toolbox/tools", flags);
    if (action === "invocations") return request("GET", withQuery("/api/toolbox/invocations", flags), flags);
    if (action === "invoke") return request("POST", "/api/toolbox/invoke", flags, body ?? {});
    if (action === "cancel") return request("POST", `/api/toolbox/invocations/${id(a)}/cancel`, flags);
  }

  if (domain === "improvements") {
    if (action === "list") return request("GET", withQuery("/api/improvements", flags), flags);
    if (action === "get") return request("GET", `/api/improvements/${id(a)}`, flags);
    if (action === "create") return request("POST", "/api/improvements", flags, body ?? {});
    if (action === "patch") return request("PATCH", `/api/improvements/${id(a)}`, flags, body ?? {});
    if (action === "delete") return request("DELETE", `/api/improvements/${id(a)}`, flags);
    if (action === "claim") return request("POST", `/api/improvements/${id(a)}/claim`, flags, body ?? {});
    if (action === "release") return request("POST", `/api/improvements/${id(a)}/release`, flags, body ?? {});
  }

  if (domain === "project-health") {
    const projectId = id(a);
    if (action === "list") return request("GET", `/api/project-management/${encodeURIComponent(projectId)}/modules/healthChecks/items?all=1`, flags);
    if (action === "create") {
      const input = body ?? {};
      const title = typeof input.title === "string" ? input.title : "待 AI 补充的健康检查发现";
      return request("POST", `/api/project-management/${encodeURIComponent(projectId)}/modules/healthChecks/items`, flags, {
        title,
        subtitle: `${input.severity ?? "medium"} · ${input.category ?? "architecture"}`,
        content: { original: { ...input, title, checkedAt: input.checkedAt ?? new Date().toISOString() } },
      });
    }
    if (action === "patch") return request("PATCH", `/api/project-management/${encodeURIComponent(projectId)}/health-checks/${encodeURIComponent(id(b))}`, flags, body ?? {});
  }

  if (domain === "testing") {
    const projectId = id(a, "projectId");
    const base = `/api/project-management/testing/${projectId}`;
    if (action === "tasks") return request("GET", `${base}/tasks`, flags);
    if (action === "cases") return request("GET", `${base}/cases`, flags);
    if (action === "runs") return request("GET", `${base}/runs`, flags);
    if (action === "issues") return request("GET", `${base}/issues`, flags);
    if (action === "report") return request("GET", `${base}/report`, flags);
    if (action === "create-task") return request("POST", `${base}/tasks`, flags, body ?? {});
    if (action === "create-case") return request("POST", `${base}/cases`, flags, body ?? {});
    if (action === "create-cases") return request("POST", `${base}/cases/batch`, flags, body ?? {});
    if (action === "add-step") return request("POST", `${base}/cases/${id(b, "caseId")}/steps`, flags, body ?? {});
    if (action === "start-run") return request("POST", `${base}/cases/${id(b, "caseId")}/runs`, flags);
    if (action === "finish-run") return request("POST", `${base}/runs/${id(b, "runId")}/finish`, flags, body ?? {});
    if (action === "finish-step") return request("POST", `${base}/run-steps/${id(b, "runStepId")}/finish`, flags, body ?? {});
    if (action === "add-evidence") return request("POST", `${base}/runs/${id(b, "runId")}/evidence`, flags, body ?? {});
    if (action === "create-issue") return request("POST", `${base}/issues`, flags, body ?? {});
    if (action === "update-issue") return request("PATCH", `${base}/issues/${id(b, "issueId")}`, flags, body ?? {});
    if (action === "discuss") return request("POST", `${base}/issues/${id(b, "issueId")}/discussions`, flags, body ?? {});
    if (action === "retest") return request("POST", `${base}/issues/${id(b, "issueId")}/retest`, flags);
  }

  if (domain === "corpus") {
    if (action === "list") return request("GET", "/api/admin/corpus", flags);
    if (action === "get") return request("GET", `/api/admin/corpus/${id(a)}`, flags);
    if (action === "upsert") return request("PUT", `/api/admin/corpus/${id(a)}`, flags, body ?? {});
    if (action === "replace-all") return request("PUT", "/api/admin/corpus", flags, body ?? {});
    if (action === "reset") return request("POST", "/api/admin/corpus/reset", flags);
    if (action === "delete") return request("DELETE", `/api/admin/corpus/${id(a)}`, flags);
  }

  if (domain === "great-me") {
    if (action === "get") return request("GET", "/api/great-me/state", flags);
    if (action === "put") return request("PUT", "/api/great-me/state", flags, body ?? {});
  }
  if (domain === "chat") {
    if (action === "send") return request("POST", "/api/chat", flags, body ?? {});
    if (action === "stream") return sse("POST", "/api/chat/stream", flags, body ?? {});
  }
  if (domain === "chat-attachments") {
    if (action === "upload") return multipart("/api/chat/attachments", { ...flags, field: flags.field || "file" }, "file");
    if (action === "bind") return request("POST", `/api/chat/attachments/${id(a)}/bind`, flags, body ?? {});
    if (action === "get") return request("GET", `/api/chat/attachments/${id(a)}`, flags);
    if (action === "by-message") return request("GET", `/api/chat/attachments/by-message/${id(a, "messageId")}`, flags);
    if (action === "delete") return request("DELETE", `/api/chat/attachments/${id(a)}`, flags);
  }
  if (domain === "attachments") {
    if (action === "upload") return multipart(`/api/attachments/${id(a, "elementId")}`, flags, "files");
    if (action === "delete") return request("DELETE", `/api/attachments/${id(a, "elementId")}/${id(b, "filename")}`, flags);
  }

  if (domain === "admin") {
    if (["engine", "ops", "signals", "manuals"].includes(action)) return request("GET", withQuery(`/api/admin/${action}`, flags), flags);
    if (action === "op") return request("GET", `/api/admin/ops/${id(a)}`, flags);
    if (action === "manual") return request("GET", `/api/admin/manuals/${id(a, "name")}`, flags);
  }
  if (domain === "cron" && action === "jobs") return request("GET", "/api/cron/jobs", flags);
  if (domain === "mascot") {
    if (action === "state") return request("GET", "/api/mascot/state", flags);
    if (action === "animations") return request("GET", "/api/mascot/animations", flags);
    if (action === "play") return request("POST", "/api/mascot/play", flags, body ?? {});
  }

  throw new Error(`unknown command: ${positional.join(" ")}`);
}

async function main() {
  const { positional, flags } = parse(process.argv.slice(2));
  if (positional.length === 0 || positional[0] === "-h" || positional[0] === "--help") {
    usage();
    return;
  }
  const [cmd, method, path] = positional;
  if (cmd === "api") {
    if (!method || !path) throw new Error("api requires <METHOD> <PATH>");
    return request(method.toUpperCase(), path, flags, await bodyFromFlags(flags));
  }
  if (cmd === "sse") {
    if (!method || !path) throw new Error("sse requires <METHOD> <PATH>");
    return sse(method.toUpperCase(), path, flags, await bodyFromFlags(flags));
  }
  if (cmd === "upload") {
    if (!method) throw new Error("upload requires <PATH>");
    return multipart(method, flags, String(flags.field || "files"));
  }
  return semantic(positional, flags);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
