# Rich 部署手册

> 在一台新 Mac（或 macOS 服务器）从零部署 Rich.app + 接通 Hermes + Codex + 云端 Postgres。
> 跟着这份文档一步步执行，预计耗时 30-60 分钟（不含云数据库申请时间）。

## 1. 系统前提

| 项 | 要求 | 验证命令 |
|---|---|---|
| 操作系统 | macOS 13+，Apple Silicon（arm64） | `uname -m` 应输出 `arm64` |
| Node.js | 20+ | `node -v` ≥ `v20.x` |
| pnpm | 9.0.0 | `pnpm -v` ≥ `9.0.0` |
| Git | 任意现代版本 | `git --version` |
| Xcode CLT | 用于 `better-sqlite3` 等原生模块编译 | `xcode-select -p` 非空 |

**装环境**（如果缺）：

```bash
# Homebrew（如未装）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node + pnpm
brew install node@20
corepack enable
corepack prepare pnpm@9.0.0 --activate

# Xcode CLT
xcode-select --install
```

---

## 2. 拉代码

```bash
cd ~/Documents          # 或任何你想放项目的位置
git clone https://github.com/BinkerKing/Rich.git
cd Rich
pnpm install            # 装所有 workspace 依赖
```

`pnpm install` 期间会自动 build `better-sqlite3` 原生模块。如果失败，多半是 Xcode CLT 没装好。

---

## 3. 外部服务

### 3.1 云端 Postgres（必需）

Rich 的所有用户数据（计划/目标/任务/对话/复盘）都存在一个 key/value `state` 表里 —— 任何 Postgres 实例都行，要求：

- Postgres 14+
- 公网可访问（或部署机能访问的内网）
- 可创建表的权限（启动时会自动 `CREATE TABLE IF NOT EXISTS`）

**推荐方案**：

| 服务 | 免费额度 | 特点 |
|---|---|---|
| [Supabase](https://supabase.com) | 500 MB | 一键开 Postgres，UI 友好 |
| [Neon](https://neon.tech) | 3 GB | Serverless Postgres，按使用计费 |
| 自建 | — | docker `postgres:16` 跑本机 |

拿到 connection string（`postgresql://user:pass@host:5432/dbname`）后**记下来**，下一步要用。

### 3.2 Hermes Agent（必需）

Rich 的 AI 大脑是 [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)。它本地跑，对外暴露 OpenAI 兼容的 `/v1/chat/completions` 接口，背后接 Codex 或别的 provider。

**装 Hermes**：

```bash
brew install hermes-agent     # 如果有 tap；否则按 GitHub 仓库 README
# 或：
pip install hermes-agent      # Python 版本
```

**配置 `~/.hermes/config.yaml`**（让 Hermes 用你已经登录的 Codex 账号）：

```yaml
provider: codex
default_model: hermes
mcp_servers:
  rich:
    url: http://127.0.0.1:31515/mcp   # Rich 自己的 MCP server，Hermes 通过它回调 Rich 的工具
```

**启动**：

```bash
hermes serve --port 8642
# 或者用 launchd 让它开机自启（见附录 A）
```

**验证**：

```bash
curl http://127.0.0.1:8642/v1/models
# 期望：JSON 列出可用模型，含 "hermes"
```

### 3.3 Codex CLI（必需）

Rich 也支持直接调用 Codex CLI（不经 Hermes）。Hermes 用的也是同一个 Codex 后端。

**装法**：

```bash
# 方案一（推荐）：装 Codex 桌面 app
# 从 https://chatgpt.com/codex/installation 下载 Codex.app 拖进 /Applications

# 方案二：装命令行版
brew install codex     # 如果有 tap
# 或 npm/pip 装，看 Codex 当前的发布方式
```

**首次登录**：

```bash
/Applications/Codex.app/Contents/Resources/codex auth login
# 或：
codex auth login
```

按提示跳浏览器完成 OAuth。登录态保存到 `~/.codex/`，Hermes 复用这份。

**验证**：

```bash
which codex                        # 应能找到，或
ls /Applications/Codex.app/Contents/Resources/codex   # 文件存在
codex --version                    # 能输出版本
```

> ⚠️ Rich 的 server 启动时会通过 `ensureUserShellPath()` 重新加载 PATH —— macOS 的 GUI 进程不继承终端 PATH，需要这步否则 GUI 启动的 Rich.app 找不到 codex。代码已经处理了这个；你只要保证终端能 `which codex` 即可。

---

## 4. 配置环境变量

在项目根目录创建 `.env`（不要 commit，已在 `.gitignore`）：

```bash
cat > .env <<'EOF'
# === 存储 ===
KE_STORAGE=postgres
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require

# === Hermes ===
HERMES_BASE_URL=http://127.0.0.1:8642
HERMES_MODEL=hermes
# HERMES_API_KEY=...   # 仅当 Hermes 配置了认证才填

# === Codex CLI ===
# KE_CODEX_BIN=/Applications/Codex.app/Contents/Resources/codex  # 自动探测，通常不用填

# === 可选：覆盖数据目录（默认 ~/Library/Application Support/Rich/data） ===
# KE_DATA_DIR=/Users/you/RichData
EOF
```

把 `USER:PASSWORD@HOST:DBNAME` 换成你自己的 Postgres connection string。

> **多机部署关键**：所有部署同一份 `DATABASE_URL` 的机器**共享同一份用户数据**。这就是为什么云端 DB 是必需的。

---

## 5. 一次性 sanity check：终端跑 server

在打包成 .app 前，先在终端跑一次 server，确认环境变量都对：

```bash
# 装一下 dotenv-cli 或自己 source
set -a; source .env; set +a

pnpm --filter @ke/server dev
# 或：
pnpm --filter @ke/web dev    # 在另一个 terminal 起前端 Vite
```

期望日志（带 `KE_STORAGE=postgres`）：

```
[ke-server] booting on port 3001 (or whatever PORT is set)
[ke-server] using Postgres storage: <host>:5432/<db>
[ke-server] Hermes adapter available: yes
[ke-server] Codex CLI: /Applications/Codex.app/Contents/Resources/codex
```

浏览器 http://localhost:5173 应能看到主界面，且 计划管理 → 首页 看到云端的最新 plans。

跑通了再继续打包；跑不通先排查这一步。

---

## 6. 打包成 Rich.app

```bash
pnpm --filter @ke/desktop package
```

这个命令链做了：

1. `build:tray` — 生成菜单栏动画帧
2. `build:web` — Vite 打包前端到 `apps/web/dist/`
3. `build:server` — esbuild 把 `apps/server/src/index.ts` 打包成单文件 `apps/desktop/dist/server.cjs`
4. `build:main` — Electron 主进程 → `dist/main.cjs`
5. `rebuild:native` — better-sqlite3 重编译到 Electron ABI（即使用 Postgres，这个包还是要装好）
6. `electron-builder --mac` — 装箱到 `apps/desktop/release/mac-arm64/Rich.app`

**产物**：`apps/desktop/release/mac-arm64/Rich.app`（约 200-300 MB）

### 6.1 把 Rich.app 拖进 /Applications（可选）

```bash
ln -sfn "$(pwd)/apps/desktop/release/mac-arm64/Rich.app" /Applications/Rich.app
```

这样 Spotlight 和 Dock 都能找到。

### 6.2 启用 dev 模式 web 热更新（可选但推荐）

`electron-builder` 把 `apps/web/dist/` 拷进 .app 作为实拷贝。改前端代码后要重新 package 才能看到效果。**解决方案**：把 .app 里那份 web-dist 改成软链：

```bash
APP=apps/desktop/release/mac-arm64/Rich.app/Contents/Resources
rm -rf "$APP/web-dist" && ln -s "$PWD/apps/web/dist" "$APP/web-dist"
rm -rf "$APP/ai"       && ln -s "$PWD/ai"            "$APP/ai"
```

之后改前端 → `pnpm --filter @ke/web build` → 重启 Rich.app 就能看到。
（**注意**：每次 `pnpm --filter @ke/desktop package` 都会覆盖这两个软链，要重做。）

> 改后端代码（apps/server/）必须 `package` 重打，因为 server.cjs 被压进 app.asar。

---

## 7. 启动 Rich.app

```bash
open /Applications/Rich.app      # 如果做了软链
# 或：
open apps/desktop/release/mac-arm64/Rich.app
```

### 7.1 日志位置

Rich 把 Electron 主进程日志 tee 到 `/tmp/ke-desktop.log`：

```bash
tail -f /tmp/ke-desktop.log
```

启动日志期望出现：

```
[ke-desktop] server booting on port 31515, data=...
[ke-desktop] using Postgres storage: <db host>
[ke-desktop] overlay shortcut CommandOrControl+Shift+0: registered
[ke-desktop] chat shortcut CommandOrControl+Shift+Space: registered
startup ok, port=31515, tray=yes
```

### 7.2 健康检查

```bash
curl -s http://127.0.0.1:31515/api/health
# 期望：{"ok":true}

curl -s http://127.0.0.1:31515/api/great-me/state | head -c 200
# 期望：{"state":{"profile":{...},"plans":[...]}}
```

如果云端 DB 配对了，这里你能直接看到从其它机器同步过来的 plans/goals。

---

## 8. 常见坑

| 现象 | 原因 | 解决 |
|---|---|---|
| Rich.app 启动后秒退 | server.cjs 启动报错 | `tail /tmp/ke-desktop.log` 看具体异常；多半是 `DATABASE_URL` 不对或 Hermes 不通 |
| 计划管理页面看到老数据 / 空数据 | 没配 `KE_STORAGE=postgres`，fallback 到本地 SQLite | 检查 .env，或检查 `process.env` 是否真的被 Rich.app 加载 |
| AI 调用一直转圈 | Hermes 没起或 port 不对 | `curl http://127.0.0.1:8642/v1/models` 应通 |
| Codex 操作报 "codex CLI not found" | PATH 找不到，或 Codex.app 没装 | 设 `KE_CODEX_BIN=/Applications/Codex.app/Contents/Resources/codex` |
| `app.asar` 跑的是老代码 | 改了 server 但只 build 没 package | 必须 `pnpm --filter @ke/desktop package` 重打 |
| 前端改了不生效 | web-dist 是实拷贝不是软链 | 见 6.2 |
| 启动报 NODE_MODULE_VERSION mismatch | Node 主版本变了，better-sqlite3 ABI 不匹配 | `pnpm --filter @ke/desktop rebuild:native` 重新编译 |

---

## 9. 多机部署 Checklist

在第 N 台 Mac 部署时，只需复盘这几项：

- [ ] Node 20 / pnpm 9 / Xcode CLT 装好
- [ ] `git clone` + `pnpm install`
- [ ] 创建 `.env`，用**同一个** `DATABASE_URL`（数据就同步了）
- [ ] 装 Codex.app 并 `auth login`
- [ ] 装 Hermes 并起 `hermes serve --port 8642`
- [ ] `pnpm --filter @ke/desktop package`
- [ ] 可选：建 web-dist 软链（如果你打算这台机器也改代码）
- [ ] 启动 Rich.app，看到云端的计划

---

## 10. 升级流程

```bash
cd Rich
git pull                                       # 拉最新代码
pnpm install                                   # 装新增依赖（如果有）
pnpm --filter @ke/desktop package              # 重打 .app
APP=apps/desktop/release/mac-arm64/Rich.app/Contents/Resources
rm -rf "$APP/web-dist" && ln -s "$PWD/apps/web/dist" "$APP/web-dist"   # 重建软链（如果你之前用了）
# 重启 Rich.app
```

数据库 schema 会在 server 启动时自动 `CREATE TABLE IF NOT EXISTS`，**不需要手工跑迁移**。

> 如果未来某次升级需要破坏性 schema 变更（重命名列/删字段），会单独提供一个 `pnpm db:migrate` 脚本和说明。当前 Stage 2 之前的所有 schema 变更都是加可选字段，向前兼容。

---

## 附录 A · launchd 自动起 Hermes

`~/Library/LaunchAgents/com.binkerking.hermes.plist`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>          <string>com.binkerking.hermes</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/hermes</string>
    <string>serve</string>
    <string>--port</string>
    <string>8642</string>
  </array>
  <key>RunAtLoad</key>      <true/>
  <key>KeepAlive</key>      <true/>
  <key>StandardOutPath</key><string>/tmp/hermes.log</string>
  <key>StandardErrorPath</key><string>/tmp/hermes.log</string>
</dict>
</plist>
```

```bash
launchctl load -w ~/Library/LaunchAgents/com.binkerking.hermes.plist
```

## 附录 B · 数据库 schema 一览

启动时自动建表（`apps/server/src/db/postgres.ts:applySchema`）：

| 表 | 用途 |
|---|---|
| `state` | key/value JSON blob，承载计划管理整个 GreatMe state |
| `elements` | 知识树元 |
| `element_versions` | 元历史快照 |
| `relations` | 元间关系（父子/前置/相关）|
| `paths` | 学习路径 |
| `annotations`, `qa`, `signals` | 其它知识树扩展数据 |

计划管理（plans/goals/tasks）当前都序列化进 `state` 表的单条记录。未来如果重构成 row-level，会新增 `plans` / `goals` / `tasks` 表，迁移脚本会单独提供。

## 附录 C · 关键端口

| 端口 | 服务 | 来源 |
|---|---|---|
| 31515 | Rich 内嵌 Hono server | Rich.app 启动时探测可用端口 |
| 5173 | Vite dev server | `pnpm --filter @ke/web dev` |
| 8642 | Hermes Agent | `hermes serve --port 8642` |
| Cloud | Postgres | 你的云数据库提供商 |

## 附录 D · 项目结构速查

```
Rich/
├── apps/
│   ├── web/          ← React + Vite 前端
│   ├── server/       ← Hono backend + AI adapters
│   └── desktop/      ← Electron 外壳 + 打包配置
├── packages/
│   └── domain/       ← 共享 TS 类型 + 纯函数 + vitest
├── ai/               ← AI 角色手册（system prompts）
├── data/             ← 本地数据兜底（云端模式下基本不用，已 gitignore）
├── docs/
│   ├── DEPLOYMENT.md ← 本文件
│   └── superpowers/specs/  ← 设计文档
│   └── superpowers/plans/  ← 实施计划
└── .env              ← 部署环境变量（gitignore）
```
