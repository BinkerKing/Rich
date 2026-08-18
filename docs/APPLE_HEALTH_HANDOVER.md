# 苹果健康接入 · 交接手册

> 给接手的另一个 AI / 工程师看 —— 直接拎起来就能干。
> 最后更新：2026-05-25

## 一、目标与现状

**目标**：iPhone 苹果健康 → 快捷指令 → 公网 ECS → Postgres → Rich 健康档案视图全闭环。

**当前进度**：服务器侧已完成，公网入口已验证可写入 Postgres；剩下是用户在 iPhone 上配置并实际运行快捷指令。

```
✓ 1. 后端 schema + repo + REST          —— 数据层完整
✓ 2. 主 Rich 服务里 /api/health/*       —— 本地 LAN 可用
✓ 3. ECS 环境探勘（Node v22 + pg 13 + systemd 都在）
✓ 4. 独立 slim 服务 apps/health-intake  —— 258KB 单文件 bundle
✓ 5. deploy.sh 一键部署（systemd + token 生成）
✓ 6. ECS 上 rich-health-intake.service active running
✓ 7. healthz / intake POST 本地直连验证通过
✓ 8. 前端面板显示公网 URL + token + 6 步教程
✓ 9. 阿里云安全组开 31516 入站
✓ 10. 公网 healthz / intake POST 写入云 Postgres 验证通过
✗ 11. iPhone 快捷指令实际跑通
```

## 二、关键资源清单

### 阿里云 ECS

| 项 | 值 |
|---|---|
| Host | `8.133.193.247` |
| SSH key | `~/.ssh/rich-aliyun-ecs`（已 chmod 600）|
| OS | Aliyun Linux 8（RHEL/CentOS 系）|
| Node | `/usr/local/bin/node` v22.16.0 |
| Postgres | `localhost:5432`，db=`rich`，user=`rich_app`，已 active |
| Service | `rich-health-intake.service`，端口 `31516`，bind `0.0.0.0` |
| 部署目录 | `/opt/rich-health-intake/` |
| .env 文件 | `/opt/rich-health-intake/.env`（含 token + DATABASE_URL）chmod 600 |
| Logs | `journalctl -u rich-health-intake -f` |

### Token（鉴权）

文件：`~/.rich-health-intake-token`（本地 Mac，chmod 600）

不要把 token 写进仓库或聊天记录；需要时直接从本机或 ECS 读取。

iPhone 快捷指令请求要带：`Authorization: Bearer <token>`

### 公网入口（用户 iPhone POST 这里）

```
POST http://8.133.193.247:31516/api/health/intake/from-apple
GET  http://8.133.193.247:31516/api/health/intake/status
GET  http://8.133.193.247:31516/healthz                (无鉴权，健康检查)
```

## 三、Body 协议（关键）

iPhone 快捷指令打 POST 的 JSON body 结构 —— 全字段可选，有啥发啥：

```json
{
  "weight":   { "kg": 80.5,  "bodyFatPct": 18,  "loggedAt": "2026-05-25T07:00:00+08:00" },
  "sleep":    { "durationMin": 420, "quality": 7, "sleepDate": "2026-05-24",
                "bedtime": "23:00", "wakeTime": "06:30" },
  "workout":  { "sessionName": "晨跑", "performedAt": "...", "durationMin": 30,
                "totalVolume": null,  "notes": "5km" },
  "meal":     { "mealType": "lunch", "totalKcal": 650,
                "totalProteinG": 45,  "totalCarbG": 60, "totalFatG": 20 },
  "mood":     { "energy": 7, "mood": 8, "fatigue": 4, "soreness": 3, "notes": "..." },
  "metadata": { "source": "apple-shortcut", "deviceName": "iPhone 15" }
}
```

返回：
```json
{ "ingested": { "weight": 1, "sleep": 1 }, "totalIngested": 2, "errors": [] }
```

每个顶层 key 对应一张表：
- `weight` → `health_weight_log`
- `sleep` → `health_sleep_log`
- `workout` → `health_workout_log`
- `meal` → `health_meal_log`（items 是 `[]`，因为 Apple 只给总量）
- `mood` → `health_mood_log`

## 四、剩下要做的事（接手清单）

### Step 9（已完成）阿里云安全组

阿里云控制台 → 实例 `iZuf6g829ie43km022f1o3Z` → 安全组 → **入方向规则** → 添加：

| 协议 | 端口 | 授权对象 | 描述 |
|---|---|---|---|
| TCP | 31516/31516 | 0.0.0.0/0 | rich-health-intake |

已在安全组 `sg-uf6a936zj8j5lk5sub48` 增加这条入方向规则。当前 Mac 没装 aliyun CLI；ECS 上有 aliyun CLI 但未配置 AccessKey，所以本次是用阿里云控制台完成。

### Step 10（已完成）验证公网可达性

公网 healthz 已通过：

```bash
curl --max-time 10 http://8.133.193.247:31516/healthz
```

公网 POST 已用临时 `mood` 记录验证：接口返回 `{"ingested":{"mood":1},"totalIngested":1,"errors":[]}`，随后已按临时 notes 标记删除测试记录，确认剩余 0 条。

以后需要复测可以跑：

```bash
TOKEN=$(cat ~/.rich-health-intake-token)
curl -X POST http://8.133.193.247:31516/api/health/intake/from-apple \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"weight":{"kg":80.5}}'
```

预期返回 `{"ingested":{"weight":1},...}`。如果 timeout / connection refused → 安全组规则没生效或方向错。

### Step 11 帮用户配 iPhone 快捷指令

前端 Rich → Cmd+8 → 🍎 接入苹果健康 已经有完整 6 步教程 + URL + token 一键复制。用户照着做就行。

**关键动作清单**：
1. 「查找健康样本」（每指标一个）—— BodyMass / SleepAnalysis / Workout / DietaryEnergyConsumed / RestingHeartRate
2. 「获取数值」从样本取数字
3. 「字典」嵌套构造 JSON body
4. 「获取 URL 的内容」POST，URL + Authorization 表头
5. 自动化每天 7am 跑

如果用户嫌一步步配麻烦，下一步可以**生成 .shortcut 文件**让他扫码导入（参考 [Apple Shortcuts file format](https://github.com/sebj/iOS-Shortcuts-Reference)），但这事不太轻量。

## 五、后续可选增强

### A. Health Auto Export ZIP 导入（已可用）

用户可以从 Health Auto Export 导出 ZIP，然后用本机脚本导入云 Postgres：

```bash
pnpm --filter @ke/health-intake import:health-auto-export /path/to/HealthAutoExport.zip
```

脚本会做两层落库：
- `health_raw_import`：完整保存 CSV 每一行原始字段，避免 Rich 暂时不认识的指标丢失。
- `health_weight_log` / `health_workout_log` / `health_sleep_log` / `health_meal_log`：解析 Rich 当前认识的指标。

本次导入文件：`HealthAutoExport_20260525184214.zip`。

导入结果：
- 原始记录：31 条
- 体重/体脂：5 条
- 活动摘要：5 条
- 睡眠：0 条（本次导出睡眠列为空）
- 饮食：0 条（本次导出饮食列为空）

导入是幂等的，重复导入同一个 ZIP 不会产生重复记录。

### B. Health Auto Export REST 自动同步（已可用）

Health Auto Export 可以直接 POST JSON 到 ECS：

```text
POST http://8.133.193.247:31516/api/health/intake/health-auto-export
Authorization: Bearer <token>
```

服务端会：
- 完整归档 `metrics` / `workouts` 原始 JSON 到 `health_raw_import`
- 尽量解析成 Rich 现有的 `health_weight_log` / `health_sleep_log` / `health_meal_log` / `health_workout_log`
- 对未知字段保持原样，不丢数据

Health Auto Export App 推荐配置：

```text
Automations → REST API
Format: JSON
Date Range: Since Last Sync
Data Types: Health Metrics + Workouts
Headers:
  authorization = Bearer <token>
Batch Requests: on
```

公网样例验证已通过：测试 payload 写入 raw 9 条，结构化写入 weight/sleep/meal/activity/workout 后已清理测试数据。

当前用户真实 REST 同步已经进库。原始层 `health_raw_import` 里可见 8 类指标：`step_count`、`walking_running_distance`、`walking_speed`、`walking_step_length`、`walking_double_support_percentage`、`walking_asymmetry_percentage`、`headphone_audio_exposure`、`flights_climbed`。这些指标已经回填到结构化样本表 `health_metric_sample` 和每日汇总表 `health_daily_activity_summary`。指标含义、单位、聚合方式和 Rich 当前解析状态见 `docs/APPLE_HEALTH_METRICS.md`。

### C. TLS（HTTPS）—— 推荐尽快做

当前 HTTP，存在风险：
- 部分手机网络运营商劫持 HTTP
- token 明文走网络
- iOS 19+ 可能限制 HTTP 后台请求

方案：ECS 装 Caddy → 自动 Let's Encrypt cert：
```bash
ssh root@8.133.193.247
dnf install -y caddy   # 或 yum
# /etc/caddy/Caddyfile:
#   health.<domain>.com {
#     reverse_proxy localhost:31516
#   }
systemctl enable --now caddy
```
需要前置：用户有域名指向 8.133.193.247，安全组开 80/443。

### D. Apple Health XML 全量导入（S15）

V1 计划项。用户 iPhone → 健康 → 导出所有健康数据 → ZIP（含 export.xml，10MB-1GB）→ 解析后批量灌进 health_* 表。最大价值：拿到历史几年的数据，趋势分析立刻有素材。

代码骨架：在 `apps/server/src/routes/health.ts` 加 `POST /api/health/import/apple-xml`，multipart 接收 ZIP，用 `node-stream-zip` + `sax` 流式解析（避免 1GB XML 全部 load 内存）。

### E. iOS 原生配套 app

要 Apple Developer 账号（$99/年）或免费证书（每 7 天重签）。HKObserverQuery 准实时推送。代码可以写 Swift / SwiftUI，几百行。这个是 V2 范围。

## 六、代码地图

```
apps/health-intake/                        ← 这次新建的独立服务
  src/index.ts                             ← slim server：Shortcuts + Health Auto Export REST
  scripts/deploy.sh                        ← scp + systemd 部署脚本
  scripts/import-health-auto-export.mjs    ← Health Auto Export ZIP 导入云 Postgres
  package.json                             ← 依赖：hono + @hono/node-server + pg
  dist/server.cjs                          ← esbuild bundle (258KB)

apps/server/src/
  routes/health.ts                         ← Rich 主服务的 /api/health/* 路由
    GET  /profile  / weight / workout / meal / sleep / mood / timeline
    POST 同上
    DELETE 同上
    POST /intake/from-apple                ← 跟 ECS slim 服务相同协议（双写）
    GET  /intake/status                    ← 同步状态
    GET  /intake/public-info               ← 读 ~/.rich-health-intake-token 返公网信息给 UI
    GET  /network-info                     ← LAN IP 探测

  repos/HealthRepo.ts                      ← 接口
  repos/PostgresHealthRepo.ts              ← 实现（CRUD + 时间范围）
  db/postgres.ts                           ← 10 张 health_* 表的 schema
  db/sqlite.ts                             ← 同上（sqlite 镜像，目前用户走 postgres）

packages/domain/src/types/health.ts        ← HealthProfile / WeightEntry / ... 全部类型

apps/web/src/
  views/HealthView.tsx                     ← UI 主入口，5 个 tab（档案/打卡/趋势/计划/苹果接入）
  views/HealthView.css
  api/healthClient.ts                      ← Rich UI 跟主服务通信的 fetch wrapper

云 postgres 上 10 张表：
  health_profile / health_weight_log / health_workout_log / health_workout_set /
  health_meal_log / health_sleep_log / health_mood_log /
  health_weekly_plan / health_weekly_report / health_alert
  health_raw_import                        ← Health Auto Export 原始记录归档
  health_metric_sample                     ← Apple Health 指标标准化样本
  health_daily_activity_summary            ← Apple Health 每日活动/步态/听力汇总
```

## 七、踩过的坑

1. **本地 dev 启 Rich**：必须带 `KE_STORAGE=postgres DATABASE_URL=...`，否则会跑 sqlite 看不到云数据。完整命令：
   ```bash
   cd apps/desktop && set -a && source ~/.rich-cloud-postgres.env && set +a \
     && KE_STORAGE=postgres DATABASE_URL="$RICH_DB_URL" pnpm exec electron dist/main.cjs
   ```

2. **打包版 Rich.app 会反复占用 31515**：用户偶尔会双击 dock 上的 Rich.app（packaged 版本），覆盖你启的 dev 版。识别方法：
   ```bash
   ps -p $(lsof -iTCP:31515 -sTCP:LISTEN -P -t) -o command
   # 如果路径是 release/mac-arm64/Rich.app —— 是 packaged
   # 如果是 node_modules/.pnpm/electron@... —— 是 dev
   ```

3. **ECS 上 postgres 连接**：跟 Mac 走 SSH tunnel 不同，ECS 内部直连 `postgres://rich_app:<pw>@127.0.0.1:5432/rich`。`deploy.sh` 会自动从 `~/.rich-cloud-postgres.env` 抠出密码生成。

4. **systemd 重启**：`apps/health-intake/scripts/deploy.sh` 已改成每次部署后都会 `systemctl restart rich-health-intake`。如果手动上传了 `server.cjs`，再跑：
   ```bash
   ssh root@8.133.193.247 'systemctl restart rich-health-intake'
   ```

5. **token 文件丢了怎么办**：
   ```bash
   ssh root@8.133.193.247 'cat /opt/rich-health-intake/.env | grep HEALTH_INTAKE_TOKEN'
   ```
   能从 ECS 读回。或者 `rm ~/.rich-health-intake-token && pnpm deploy` 生成新的（但 iPhone 快捷指令需要同步更新）。

6. **DATABASE_URL 密码转义**：云数据库密码里有特殊字符，`deploy.sh` 必须 URL-encode 密码后写入 ECS `.env`。当前脚本已经处理，不要改回直接拼接密码。

## 八、给接手 AI 的话

- 用户偏好：**直接干，先跑通再调**，不要长篇 plan
- 每个改动后 `pnpm build` + 重启 Rich + 让用户看效果
- 实战项目 ID `e-mpkjbab9-ocft3` 是这个项目（Rich 私人健康档案 · Body Insights），所有重要决策记到那里的"整改建议" group 里
- 当前任务一旦 Step 9-11 完成，就可以推进批次 3（S05 / S06 AI 文字解析）和批次 4（S09 趋势 / S11 cron 周报 / S13 异常检测）
- 全套 18 个开发任务在云 postgres 的 element 表里，查 `practice_get` MCP 工具或 `SELECT * FROM elements WHERE id LIKE 'e-mpkjbab9%'`
