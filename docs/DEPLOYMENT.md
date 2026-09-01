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

Rich 把所有用户数据（profile / plans / goals / tasks / daily / events / conversations）序列化成 JSON，存进 `state` 表的一行 key/value 里。任何 Postgres 14+ 实例都行，要求：

- Postgres 14+
- 部署机能访问（公网或同 VPC）
- 可 `CREATE TABLE IF NOT EXISTS` 的权限（Rich 启动时自动建表，见附录 B）

下面三个候选挑一个，逐步走完即可拿到 `DATABASE_URL`。

---

#### 选项 A · Supabase（最快，推荐新手）

1. 开浏览器到 https://supabase.com → Sign in（GitHub OAuth 最快）
2. 顶部 **New project** → 填：
   - **Name**: `rich`
   - **Database password**: 自己想一个长随机串，**立刻复制保存**（页面关掉就拿不回来）
   - **Region**: 选离你最近的（亚洲一般 Singapore 或 Tokyo）
3. 点 **Create new project**，等 2 分钟 provisioning
4. 控制台左侧 ⚙ **Project Settings** → **Database** → 看 **Connection string** 区
5. **Connection type 选 `URI`**，**Mode 选 `Session`**（不要选 Transaction，Rich 用 connection pool 自带）
6. 拷贝出形如：
   ```
   postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```
   （把 `<password>` 那段换成你刚才记的真实密码）
7. **验证连接**：本机装 `psql`（`brew install libpq && brew link --force libpq`），然后：
   ```bash
   psql 'postgresql://...你的 URI...' -c 'SELECT version();'
   ```
   能输出 `PostgreSQL 15.x ...` 就通了。

> Supabase 免费额度：500 MB 存储 + 2 GB 流量/月。Rich 单用户一年都用不到 50 MB。

---

#### 选项 B · Neon（serverless，免费额度更大）

1. 浏览器到 https://neon.tech → Sign in
2. **Create project** → Name `rich`，Region 选最近，Postgres version 选 16
3. 创建完进控制台，左侧 **Connection Details** → Copy 那个 connection string（默认就是 pooled，可以直接用）
4. 同样的 `psql -c 'SELECT version();'` 验证

> Neon 免费额度：3 GB 存储 + 191.9 compute hours/月，serverless 闲置不收费。

---

#### 选项 C · 本地 docker postgres（不想用云）

```bash
# 拉镜像 + 起容器（数据持久化到 ~/rich-pg-data）
docker run -d \
  --name rich-pg \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=rich_local_dev \
  -e POSTGRES_DB=rich \
  -v ~/rich-pg-data:/var/lib/postgresql/data \
  postgres:16

# 验证
docker exec rich-pg psql -U postgres -d rich -c 'SELECT version();'
```

连接串就是 `postgresql://postgres:rich_local_dev@127.0.0.1:5432/rich`。

> ⚠️ 本地 docker 模式失去多机同步价值——只适合单机测试 / 离线开发。

---

无论用哪一个，**最终产物**：一个 `postgresql://...` 字符串，下面 §4 写进 `.env`。

---

### 3.2 Hermes Agent（必需）

Rich 调用 LLM 的默认通道是 **Hermes** —— 一个 OpenAI 兼容的本地 HTTP 服务（`/v1/chat/completions`），背后用你已有的 Codex OAuth 当 provider。Rich 通过它做：知识树生成、计划拆解（Stage 3）、对话、复盘草稿等。

**Rich 对 Hermes 的硬要求**（这些不会变）：

| 项 | 要求 |
|---|---|
| 监听地址 | 默认 `http://127.0.0.1:8642`（可以通过 `HERMES_BASE_URL` 改）|
| API 协议 | OpenAI Chat Completions v1（`POST /v1/chat/completions` 流式 SSE）|
| `/v1/models` | Rich 启动时 `GET` 这个端点做可达性探测（2 秒超时）|
| MCP 配置 | `~/.hermes/config.yaml` 里要把 `rich` 加进 `mcp_servers`，url 指向 Rich 的 MCP 端点 |

#### 步骤一：装 Hermes 二进制

> ⚠️ **我没有验证过的统一安装命令**。Hermes 来自 [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)（也可能更新到了别处）；上游的发布方式会变。**请按上游仓库当前 README 的指引装**，目标是终端里能跑出 `hermes serve --port 8642` 或等效命令。
>
> 常见三种发布形态，按上游公告对照：
> - **Homebrew tap**：`brew tap NousResearch/hermes && brew install hermes`
> - **pip**：`pip install hermes-agent` 然后 `hermes serve --port 8642`
> - **源码**：`git clone https://github.com/NousResearch/hermes-agent && cd hermes-agent && <按 README>`
>
> 装完后随便挑一个目录跑 `hermes --help`，能输出帮助即装好。

#### 步骤二：建配置文件 `~/.hermes/config.yaml`

```bash
mkdir -p ~/.hermes
cat > ~/.hermes/config.yaml <<'EOF'
provider: codex                 # 用 Codex OAuth 作为底层 LLM
default: codex

mcp_servers:
  rich:
    url: http://127.0.0.1:31515/mcp
EOF
```

> 31515 是 Rich.app 启动时的首选端口。如果你机器上这个端口已被占用，Rich 会自动上移；启动后真实的 MCP url 写在 `~/Library/Application Support/Rich/data/.mcp-url`。Hermes 配置文件里写的就是个**期望值**，可以等 Rich 跑起来再 `cat` 那个文件验证。

#### 步骤三：起 Hermes 服务

```bash
# 前台跑（debug 用）：
hermes serve --port 8642

# 后台自启（推荐）：见本文档附录 A 的 launchd plist
```

#### 步骤四：三项验证（**全部必须通过**）

```bash
# 1. /v1/models 能 200（Rich 用这个判断 Hermes 可达）
curl -i http://127.0.0.1:8642/v1/models
# 期望：HTTP/1.1 200 OK，body 是 JSON 列出模型

# 2. /v1/chat/completions 能流式返回（Rich 实际调用的端点）
curl -N http://127.0.0.1:8642/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"hermes","messages":[{"role":"user","content":"say hello in 5 words"}],"stream":true}'
# 期望：陆续吐 data: {...} 行，最后一个是 data: [DONE]

# 3. Hermes 真的连上 Codex 了
# 看 hermes 的日志（前台跑的话直接看终端；launchd 看 /tmp/hermes.log）
# 第一次请求应出现 "loaded codex provider" 之类字样
```

任何一步过不去就**别继续装 Rich**——肯定 Hermes 自己没配好。

#### Agent 会话权限与审批

Rich 的 `/agent` 是长期会话模式，但默认只开放 `chat_only`：Hermes 可以持续回复和复用 `session_id`，不能调用工作区、Shell、浏览器、网络或 MCP 工具。这个限制由 Rich 运行时和 Hermes 适配器共同执行，**提示词不是权限边界**。

| 档位 | 当前可用性 | 运行时条件 |
|---|---|---|
| `chat_only` | 可用 | Hermes 调用必须禁用原生工具 |
| `workspace_agent` | 不开放 | Hermes 必须能按会话限制工具集合和真实工作目录，并能在 Rich 审批后恢复同一工具调用 |
| `extended_agent` | 不开放 | 另需限制浏览器、网络和指定 MCP 服务 |

不要通过修改系统提示词或前端隐藏按钮来“开启”后两档。只有适配器证明上述限制可强制执行，并通过对应集成测试后，才能开放。

所有 Git push、部署、外部消息、Rich 业务数据写入和其他高风险动作都会创建一条持久化审批记录，绑定会话、回合、工具调用和规范化参数摘要。用户在界面看到参数预览后只能批准或拒绝该精确动作；参数、回合或调用 ID 变更都会使审批失效。当前 Hermes 不支持暂停并恢复原生工具调用，因此不会进入会产生此类动作的权限档位。

---

### 3.3 Codex CLI（必需）

Codex 是 Rich 实际调用的 LLM 后端（Hermes 转发给它，Rich 也会直接 spawn 它跑某些图片生成任务）。它是 OpenAI 的 ChatGPT Codex 桌面产品。

**Rich 对 Codex 的硬要求**：

| 项 | 要求 |
|---|---|
| 可执行文件路径 | 一个能跑 `codex` 子命令的 binary |
| 探测顺序 | (1) 环境变量 `KE_CODEX_BIN` (2) `which codex` (3) `/Applications/Codex.app/Contents/Resources/codex` |
| 登录态 | 已经 `codex auth login` 过，凭据存在 `~/.codex/` |

#### 步骤一：装 Codex.app（推荐）

1. 浏览器到 ChatGPT 的 Codex 下载页（搜「ChatGPT Codex download」，URL 可能随产品更新而变）
2. 下载 macOS arm64 版本的 `.dmg` 或 `.zip`
3. 把 `Codex.app` 拖进 `/Applications`
4. 第一次打开右键 → 打开 → 同意 Gatekeeper 警告

验证文件存在：
```bash
ls -la /Applications/Codex.app/Contents/Resources/codex
# 期望：能列出来这个文件
```

#### 步骤二：登录

打开 Codex.app（图形界面），里面应该有 "Sign in" 之类的按钮，跳浏览器走 OAuth。
登录态写到 `~/.codex/`，Hermes 自动复用同一份。

或者从命令行：
```bash
/Applications/Codex.app/Contents/Resources/codex auth login
# 按提示跳浏览器完成
```

#### 步骤三：让命令行也能找到 codex

Rich 的 macOS 主进程通过 [`ensureUserShellPath`](apps/desktop/src/main.ts) 重新加载 PATH，但更省心的做法是直接给个软链：

```bash
sudo ln -sf /Applications/Codex.app/Contents/Resources/codex /usr/local/bin/codex
```

或者把那段路径加进你的 `~/.zshrc`：
```bash
echo 'export PATH="/Applications/Codex.app/Contents/Resources:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

#### 步骤四：验证

```bash
# 1. 路径存在
which codex
# 或：ls -la /Applications/Codex.app/Contents/Resources/codex

# 2. 能跑
codex --version
# 期望：能输出某个版本号

# 3. 已登录
codex auth status   # 子命令名可能因版本不同
# 或：尝试 codex 跑一句简单对话；登录态正确就不会报 401
```

> 如果以上都通过，但是 Rich.app GUI 启动后报 "codex CLI not found"，说明 GUI 进程的 PATH 没有 Codex.app 的路径。**最稳的修复**：在 `.env` 里直接写死：
> ```
> KE_CODEX_BIN=/Applications/Codex.app/Contents/Resources/codex
> ```

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

# === Agent capability grants ===
# 多实例或重启后需保持签名有效时必须设置为长期随机值（不要提交）
RICH_AGENT_CAPABILITY_SECRET=replace-with-a-long-random-secret

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

> **原生模块 ABI 注意事项**：打包命令会把 `better-sqlite3` 重编译为 Electron 内置 Node 可加载的版本。这是 Rich.app 正常启动所必需的，但不能直接用于终端 Node 的服务端或路由集成测试。打包后若要运行这类测试，先执行 `nvm use && pnpm rebuild:sqlite`，再运行测试命令。

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
| `/agent` 提示权限档位不可用 | Hermes 不能强制工具/工作目录边界，或不能恢复审批的工具调用 | 保持 `chat_only`；不要用提示词绕过，待 Hermes 提供可验证能力后再开放 |
| Agent 审批失败或已过期 | 回合、工具调用或参数摘要与审批记录不一致；审批只能消费一次 | 重新发起该动作，核对 UI 参数预览；不要重放旧审批链接 |
| Codex 操作报 "codex CLI not found" | PATH 找不到，或 Codex.app 没装 | 设 `KE_CODEX_BIN=/Applications/Codex.app/Contents/Resources/codex` |
| `app.asar` 跑的是老代码 | 改了 server 但只 build 没 package | 必须 `pnpm --filter @ke/desktop package` 重打 |
| 前端改了不生效 | web-dist 是实拷贝不是软链 | 见 6.2 |
| Rich.app 启动报 NODE_MODULE_VERSION mismatch | Electron ABI 与 `better-sqlite3` 不匹配 | `pnpm --filter @ke/desktop rebuild:native` 重新编译 |
| 路由集成测试报 NODE_MODULE_VERSION mismatch（通常发生在打包后） | `better-sqlite3` 仍是 Electron ABI，终端 Node 无法加载 | `nvm use && pnpm rebuild:sqlite`，再重新运行测试 |

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
