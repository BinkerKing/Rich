import { hostname } from "node:os";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/**
 * 每台跑 Rich.app 的机器有一个稳定的 agent-id，用于 improvement_tasks 的认领去重。
 *
 * 命名约定（用户偏好）：`<hostname>-<provider>`
 *   例：mac-mini.local-hermes / macbook-pro.local-ui
 *
 * - provider="ui"     : 用户在 Rich.app 的 admin UI 里手动点"认领"
 * - provider="hermes" : Hermes 通过 MCP 调用 Rich 服务认领
 * - provider="codex"  : Codex agent 直接调 HTTP 认领
 *
 * 第一次启动时如果不存在 ~/.rich/agent-id 文件就写一个，之后稳定不变。
 *
 * provider 在 RICH_AGENT_PROVIDER 环境变量里覆盖，默认 "ui"。
 */

const RICH_DIR = join(homedir(), ".rich");
const AGENT_ID_FILE = join(RICH_DIR, "agent-id");

let cached: string | null = null;

/** 返回本机此 Rich.app 实例的 agent-id。 */
export function getAgentId(): string {
  if (cached) return cached;
  const provider = (process.env.RICH_AGENT_PROVIDER || "ui").trim() || "ui";
  // 兼容性：如果文件已存在就直接用，保证多次启动同一个 id；只有第一次写入。
  try {
    if (existsSync(AGENT_ID_FILE)) {
      const raw = readFileSync(AGENT_ID_FILE, "utf8").trim();
      if (raw) {
        cached = raw;
        return raw;
      }
    }
  } catch { /* 读不出就重建 */ }

  const host = hostname() || "unknown-host";
  const id = `${host}-${provider}`;
  try {
    mkdirSync(RICH_DIR, { recursive: true });
    writeFileSync(AGENT_ID_FILE, id, "utf8");
  } catch { /* 写不进去也无所谓，下次重新生成同样的 id 也 OK */ }
  cached = id;
  return id;
}

/** 仅供测试 / 重置。重置后下一次 getAgentId() 会重新读文件或生成。 */
export function _resetAgentIdCache(): void {
  cached = null;
}
