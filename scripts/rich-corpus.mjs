#!/usr/bin/env node

const API = (process.env.RICH_API_URL || "http://127.0.0.1:31515").replace(/\/$/, "");
const endpoint = `${API}/api/admin/corpus`;

function usage() {
  console.log(`Rich AI corpus CLI

Usage:
  node scripts/rich-corpus.mjs list [query]
  node scripts/rich-corpus.mjs get <id>
  node scripts/rich-corpus.mjs prompt <id>
  node scripts/rich-corpus.mjs upsert --json '<template-json>'
  node scripts/rich-corpus.mjs upsert --file template.json
  node scripts/rich-corpus.mjs patch <id> --field <name> --value <value>
  node scripts/rich-corpus.mjs delete <id>
  node scripts/rich-corpus.mjs reset

Env:
  RICH_API_URL  Rich server URL, default http://127.0.0.1:31515
`);
}

async function request(path, options = {}) {
  const res = await fetch(`${endpoint}${path === "/" ? "" : path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const body = await res.text();
  const json = body ? JSON.parse(body) : {};
  if (!res.ok) {
    throw new Error(json.error || `${res.status} ${res.statusText}`);
  }
  return json;
}

function argValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return null;
  return process.argv[idx + 1];
}

async function readJsonInput() {
  const rawJson = argValue("--json");
  if (rawJson) return JSON.parse(rawJson);

  const file = argValue("--file");
  if (file) {
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(await readFile(file, "utf8"));
  }
  throw new Error("upsert requires --json or --file");
}

function print(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  const cmd = process.argv[2];
  if (!cmd || cmd === "-h" || cmd === "--help") {
    usage();
    return;
  }

  if (cmd === "list") {
    const query = process.argv.slice(3).join(" ").trim().toLowerCase();
    const data = await request("/");
    const templates = query
      ? data.templates.filter(t => [t.id, t.name, t.scene, t.intent, t.mustInclude, t.styleGuide]
        .join("\n").toLowerCase().includes(query))
      : data.templates;
    print({ count: templates.length, templates });
    return;
  }

  if (cmd === "get") {
    const id = process.argv[3];
    if (!id) throw new Error("get requires <id>");
    print(await request(`/${encodeURIComponent(id)}`));
    return;
  }

  if (cmd === "prompt") {
    const id = process.argv[3];
    if (!id) throw new Error("prompt requires <id>");
    const data = await request(`/${encodeURIComponent(id)}`);
    console.log(data.prompt);
    return;
  }

  if (cmd === "upsert") {
    const template = await readJsonInput();
    if (!template.id) throw new Error("template json requires id");
    print(await request(`/${encodeURIComponent(template.id)}`, {
      method: "PUT",
      body: JSON.stringify(template),
    }));
    return;
  }

  if (cmd === "patch") {
    const id = process.argv[3];
    const field = argValue("--field");
    const value = argValue("--value");
    if (!id || !field || value == null) throw new Error("patch requires <id> --field <name> --value <value>");
    print(await request(`/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ [field]: value }),
    }));
    return;
  }

  if (cmd === "delete") {
    const id = process.argv[3];
    if (!id) throw new Error("delete requires <id>");
    print(await request(`/${encodeURIComponent(id)}`, { method: "DELETE" }));
    return;
  }

  if (cmd === "reset") {
    print(await request("/reset", { method: "POST" }));
    return;
  }

  usage();
  throw new Error(`unknown command: ${cmd}`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
