import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Icon } from "../components/Icon.js";
import { TopBar } from "../components/TopBar.js";
import { FooterTaskStrip } from "../components/FooterTaskStrip.js";
import { api, type ProjectModuleItem } from "../api/client.js";
import { useStore } from "../state/store.js";
import { normalizeProjectHealthRecord, type ProjectHealthCategory, type ProjectHealthSeverity, type ProjectHealthStatus } from "./project-health/projectHealthRecord.js";
import "./AdminView.css";

type Tab = "health" | "traces" | "workflows" | "delegations" | "agents" | "ops" | "signals" | "manuals" | "prompts" | "corpus" | "learning" | "cron" | "improvements" | "projectHealth";

interface OpListItem {
  id: string;
  ts: string;
  op: string;
  model: string;
  scenario?: string;
  elementId?: string;
  scope?: Record<string, unknown>;
  status: "running" | "done" | "error";
  durationMs?: number;
  promptPreview: string;
  outputPreview: string;
  promptLen: number;
  outputLen: number;
  error?: string;
  sessionId?: string;
}

interface OpDetail extends OpListItem {
  prompt: string;
  output?: string;
}

interface SignalItem {
  ts: string;
  type: string;
  manual?: string;
  elementId?: string;
  op?: string;
  adapter?: string;
  data?: Record<string, unknown>;
}

interface ManualItem {
  name: string;
  file: string;
  length: number;
  content: string;
}

interface PromptTemplateItem {
  key: string;
  name: string;
  kind: "common" | "scene";
  description: string;
  content: string;
  includes: string[];
  enabled: boolean;
  updatedAt: string;
}

interface PromptMigrationItem { key: string; label: string; status: string; source: string; }

interface LearningManualModule {
  id: string;
  page: string;
  scene: string;
  manual: string[];
  cli: string[];
}

const OP_FILTERS = ["", "generate", "refine", "section-refine", "expand", "extend", "path", "review", "analyze-mark"];

const LEARNING_MANUAL_MODULES: LearningManualModule[] = [
  {
    id: "home-chat",
    page: "首页 / 全局输入框",
    scene: "用户直接向 Rich 或 Hermes 下达任务、查询状态、触发系统级动作。",
    manual: [
      "先识别任务属于查询、整理、精确管理、规划、委派或验收；对象不明确时先搜索。",
      "需要保存事实、决定或需求时使用知识/项目整理能力，不能只在对话里口头确认。",
      "输出面向用户的内容前匹配语料模板；密钥与本机配置绝不写入聊天或任务记录。",
    ],
    cli: [
      "MCP: rich_context_search / rich_context_get_overview",
      "MCP: rich_knowledge_capture / rich_project_organize_conversation",
      "CLI: pnpm rich -- chat stream --json '{\"messages\":[...]}'",
      "CLI: pnpm corpus list / pnpm corpus prompt <template-id>",
    ],
  },
  {
    id: "knowledge-tree",
    page: "知识树",
    scene: "管理概念、主题、关系、学习路径；补充、细化、扩展已有知识元。",
    manual: [
      "只给关键词时先用上下文搜索；目标元已明确后再读取、更新或删除。",
      "每次写入提供唯一 requestId；重试同一次写入时复用 requestId，并检查 verification。",
      "内容块只用支持的 block.style；推荐列表使用 dot-list 或 markdown。",
    ],
    cli: [
      "MCP: rich_context_search / rich_knowledge_manage",
      "MCP: rich_knowledge_capture（沉淀新事实、决定或经验）",
      "CLI: pnpm rich -- elements list/get/create/patch/delete/move",
      "CLI: pnpm rich -- sse POST /api/ai/refine --json '{\"elementId\":\"...\"}'",
    ],
  },
  {
    id: "daily-news",
    page: "AI 早报",
    scene: "生成每日 AI 新闻、补充热门 Skill、把新闻转成可行动建议。",
    manual: [
      "生成前先确认日期和目标早报元素；修改既有内容时只改用户指定的区块。",
      "热门 Skill 推荐使用 dot-list 或 markdown，不能使用不支持的 style=list。",
      "信息汇报类内容使用 information-briefing 语料；不确定的新闻来源必须标注待核验。",
    ],
    cli: [
      "CLI: pnpm rich -- ai news-generate-daily --json '{\"date\":\"YYYY-MM-DD\",\"model\":\"codex\"}'",
      "CLI: pnpm rich -- elements sections <id> --json '{\"sections\":[...]}'",
      "pnpm corpus prompt information-briefing",
      "MCP: get_element / update_section_blocks",
    ],
  },
  {
    id: "mindmap-ppt",
    page: "导图 PPT",
    scene: "把文稿或知识树生成可播放导图，管理封面、隐藏、图片、文本显示。",
    manual: [
      "PPT 是 element-backed，优先修改底层元素和 mindmap-embed section。",
      "导图加载慢时先区分是图片生成、元素树过大，还是前端渲染问题。",
      "不要绕过元素树另建孤立 PPT 数据。",
    ],
    cli: [
      "CLI: pnpm rich -- mindmaps list/get/attach/detach/toggle-hidden/toggle-image/toggle-text/retry-cover",
      "CLI: pnpm rich -- mindmaps generate --json '{\"prose\":\"...\",\"titleHint\":\"...\"}'",
      "MCP: get_element / get_subtree / update_section_blocks",
    ],
  },
  {
    id: "plan-management",
    page: "计划管理",
    scene: "目标拆解、任务推进、每日任务、每周复盘、AI 推进建议。",
    manual: [
      "读取当前状态再操作；整体替换计划状态属于破坏性写入，必须取得明确确认。",
      "用户确认完成任务时，要实际写回状态并读取验证，不能只回复鼓励。",
      "批量维护前备份完整 GreatMe state；只清理 plans/goals/tasks，不动其他健康与复盘信息。",
    ],
    cli: [
      "CLI: pnpm rich -- great-me get",
      "CLI: pnpm rich -- ai decompose-plan/analyze-progress/draft-review --json '{...}'",
      "MCP: rich_planning_manage（读取或经确认后整体替换）",
      "MCP: rich_context_search（先定位相关计划与知识）",
      "CLI: pnpm --filter @ke/server run plan -- list plans --status all --json",
      "CLI: pnpm --filter @ke/server run plan -- clear all --yes --json",
    ],
  },
  {
    id: "practice-project",
    page: "应用开发",
    scene: "创建实战项目、维护知识点/需求/功能/PRD/开发任务/整改建议/提问。",
    manual: [
      "应用开发复用 knowledge element 与 child relation，不另建孤立数据。",
      "先读取实战项目与分组，再创建或更新明确的子项；写入后检查返回的引用和验证结果。",
      "起草 PRD、开发任务或整改项时，必须带上当前项目上下文与验收标准。",
    ],
    cli: [
      "CLI: pnpm rich -- elements create/patch/delete --json '{...}'",
      "CLI: pnpm rich -- ai draft-prd/draft-child/adjust-child --json '{...}'",
      "MCP: rich_practice_manage",
      "MCP: rich_context_search（对象或分组不明确时）",
      "CLI: pnpm rich -- ai draft-prd/draft-child/adjust-child --json '{...}'",
    ],
  },
  {
    id: "project-dashboard",
    page: "项目管理 / 驾驶舱",
    scene: "查看项目交付、待办和模块状态，判断当前最需要处理的工作。",
    manual: [
      "先读取项目汇总，再判断哪些模块为空、逾期或需要更新；驾驶舱只用于发现问题，不应成为重复记录的地方。",
      "从驾驶舱得出的行动，要回到对应菜单维护，并在写入后重新读取验证。",
      "进度、风险和下一步必须区分已确认事实与待核验判断。",
    ],
    cli: [
      "MCP: project_management_summary",
      "MCP: project_management_search（对象尚未定位时）",
      "DOC: docs/PROJECT_MANAGEMENT_MCP_MANUAL.md",
    ],
  },
  {
    id: "project-delivery-plan",
    page: "项目管理 / 交付计划",
    scene: "拆分交付阶段、里程碑和责任，跟踪计划与实际偏差。",
    manual: [
      "先读当前计划、依赖和完成状态，再新增或调整节点；不要用新计划覆盖既有进度。",
      "每个计划项写清可验收产出、负责人、截止时间和前置条件。",
      "计划变化同步到项目待办、报告或交付物，但只更新确有变化的对象。",
    ],
    cli: ["MCP: project_management_list_items / project_management_update_item", "MCP: project_management_reorder_items", "CLI: pnpm rich -- api GET /api/projects/<projectId>/management/summary"],
  },
  {
    id: "project-deliverables",
    page: "项目管理 / 交付物",
    scene: "登记交付物、准备验收材料，并追踪与计划、文件和任务的关联。",
    manual: [
      "先核对交付物名称、版本、验收标准和实际文件，再记录状态。",
      "交付物状态不能替代文件事实；文件路径、版本和验收证据应可追溯。",
      "涉及对外发送、覆盖或删除文件时，先确认目标、影响范围和可恢复性。",
    ],
    cli: ["MCP: project_management_list_items / project_management_update_item", "MCP: project_management_search", "CLI: pnpm rich -- api POST /api/projects/<projectId>/folder/scan"],
  },
  {
    id: "project-reports",
    page: "项目管理 / 报告",
    scene: "沉淀日报、周报、月报和会议纪要，输出可追溯的项目状态。",
    manual: [
      "先读取已有报告和项目事实；报告应标出报告周期、来源、风险和下一步。",
      "区分已完成、进行中、阻塞和待确认，不能把计划写成事实。",
      "生成后核对报告归档目录和链接的项目对象。",
    ],
    cli: ["MCP: project_management_list_items / project_management_create_item", "MCP: project_management_search", "CLI: pnpm rich -- api POST /api/projects/<projectId>/reports"],
  },
  {
    id: "project-description",
    page: "项目管理 / 项目说明",
    scene: "维护项目目标、范围、干系人、约束、目录和接手上下文。",
    manual: [
      "先读现有说明，只更新用户确认的字段；未知信息明确标为待确认。",
      "说明应提供后续 Agent 接手所需的事实入口，而非复制所有执行细节。",
      "本地目录、敏感配置和外部系统权限只记录引用与责任人，不记录密钥。",
    ],
    cli: ["MCP: project_management_list_items / project_management_update_item", "MCP: project_management_search", "DOC: docs/PROJECT_MANAGEMENT_MCP_MANUAL.md"],
  },
  {
    id: "project-dictionary",
    page: "项目管理 / 数据字典",
    scene: "维护系统、表、字段、码值、Mapping 和场景的受控定义。",
    manual: [
      "先读取当前 published 模板和证据；属性缺失或固定码值不合法时停止写入，不猜业务含义。",
      "字段逻辑、场景口径和临时表属于受控结构，不能以备注或自由文本替代。",
      "模板外的新属性、枚举或语义先创建变更记录，发布后再录入。",
    ],
    cli: ["MCP: rich_dictionary_manage", "MCP: project_dictionary_search_fields / project_dictionary_get_field", "DOC: docs/PROJECT_DICTIONARY_MAPPING_RULES.md"],
  },
  {
    id: "project-automation",
    page: "项目管理 / 数据自动化",
    scene: "编排字典已有的同步、验证、抽取与运行步骤，跟踪执行结果。",
    manual: [
      "自动化只编排已定义的规则，不在此菜单改写 Mapping 语义。",
      "运行前确认环境、目标库、写入模式和影响范围；生产写入必须明确确认。",
      "失败时记录运行时间、错误、影响范围和 table_id，并回到数据字典或环境配置定位。",
    ],
    cli: ["MCP: rich_automation_manage", "MCP: project_management_list_items", "DOC: docs/PROJECT_MANAGEMENT_MAINTENANCE_MANUAL.md"],
  },
  {
    id: "project-workflow",
    page: "项目管理 / 作业流程",
    scene: "维护标准作业步骤、输入输出、责任边界和质量检查点。",
    manual: [
      "流程按可执行顺序描述，明确触发条件、输入、输出、责任人和验收点。",
      "变更流程前先确认受影响的场景、自动化和交付物。",
      "流程异常要记录实际偏差和处置结果，不用理想步骤掩盖问题。",
    ],
    cli: ["MCP: project_management_list_items / project_management_update_item", "MCP: project_management_reorder_items", "MCP: project_management_search"],
  },
  {
    id: "project-scenarios",
    page: "项目管理 / 场景手册",
    scene: "把跨菜单的任务组织成可复用流程，并明确每一步的输入、输出和验证。",
    manual: [
      "场景引用已有菜单中的事实，不复制或制造第二份配置。",
      "按顺序写明前置条件、执行动作、输出和失败处理，步骤完成后再进入下一步。",
      "场景涉及环境、部署、版本或外部系统时，必须标注确认点与回滚入口。",
    ],
    cli: ["MCP: project_management_list_items / project_management_create_item", "MCP: project_management_search", "DOC: docs/PROJECT_MANAGEMENT_MCP_MANUAL.md"],
  },
  {
    id: "project-environments",
    page: "项目管理 / 环境配置",
    scene: "登记本地、测试和生产环境的依赖、变量引用、服务地址和准备状态。",
    manual: [
      "先确认环境名称、用途和所有者；配置只记录非敏感值或凭据引用。",
      "本地环境的依赖版本、启动命令和校验方式必须可复现。",
      "环境差异、缺失依赖和访问限制要显式记录，不能默认本地等同生产。",
    ],
    cli: ["MCP: project_management_list_items / project_management_update_item", "MCP: project_management_search", "DOC: docs/PROJECT_MANAGEMENT_MAINTENANCE_MANUAL.md"],
  },
  {
    id: "project-deployment-steps",
    page: "项目管理 / 部署步骤",
    scene: "维护部署、回滚和验证步骤，保证不同环境的发布过程可执行。",
    manual: [
      "部署前读取目标环境、当前版本、依赖和变更范围；缺少前置条件时停止。",
      "每一步包含执行命令或动作、预期结果、验证方式和失败后的回滚动作。",
      "部署记录要写入实际结果和版本号，不能把计划步骤标记为已完成。",
    ],
    cli: ["MCP: project_management_list_items / project_management_update_item", "MCP: project_management_reorder_items", "MCP: project_management_search"],
  },
  {
    id: "project-monitoring",
    page: "项目管理 / 监控预警",
    scene: "维护监控项、阈值、告警渠道、值班责任和故障处置。",
    manual: [
      "先确认指标来源、采样范围和阈值依据；没有证据的阈值标为待确认。",
      "告警必须关联负责人、响应时限和处置流程，避免只有通知没有行动。",
      "监控异常先保留事实与时间线，再判断根因；不要直接改监控记录掩盖故障。",
    ],
    cli: ["MCP: project_management_list_items / project_management_update_item", "MCP: project_management_search", "DOC: docs/PROJECT_MANAGEMENT_MAINTENANCE_MANUAL.md"],
  },
  {
    id: "project-code-versions",
    page: "项目管理 / 版本控制",
    scene: "登记代码仓库、分支、版本、变更说明和发布关联。",
    manual: [
      "先读取当前版本和目标环境，明确本次变更对应的 commit、分支或发布包。",
      "不要把未验证的工作区状态标成可发布版本；版本记录必须能回溯来源。",
      "涉及合并、打标签、推送或回滚时，先确认仓库、分支和影响范围。",
    ],
    cli: ["MCP: project_management_list_items / project_management_update_item", "MCP: project_management_search", "CLI: git status / git log --oneline"],
  },
  {
    id: "project-todos",
    page: "项目管理 / 项目待办",
    scene: "管理项目行动项、负责人、截止时间、阻塞原因和完成验证。",
    manual: [
      "待办要足够具体，可由负责人验收；避免用模糊标题代替行动。",
      "完成待办时实际写回状态，并记录交付证据或关联产物。",
      "阻塞项写清等待对象与下一步，不把未完成工作直接关闭。",
    ],
    cli: ["MCP: project_management_list_items / project_management_create_item / project_management_update_item", "MCP: project_management_search", "MCP: project_management_reorder_items"],
  },
  {
    id: "project-folder",
    page: "项目管理 / 文件夹",
    scene: "扫描和维护项目目录，定位资料、补充备注并验证交付文件。",
    manual: [
      "先扫描目录并读取文件/目录备注，再新增说明或建立目录。",
      "新建路径必须位于项目根目录下，使用约定业务目录；不覆盖同名文件。",
      "移动、删除或对外发送文件前，确认精确路径、关联交付物和恢复方案。",
    ],
    cli: ["CLI: pnpm rich -- api POST /api/projects/<projectId>/folder/scan", "CLI: pnpm rich -- api POST /api/projects/<projectId>/folder/mkdirs", "MCP: project_management_search"],
  },
  {
    id: "project-local-environment-scenario",
    page: "项目管理 / 场景 / 搭建项目本地环境",
    scene: "将环境配置、部署步骤、版本控制与项目启动串成一次可验证的本地接手流程。",
    manual: [
      "1. 环境配置：读取本地环境所需的运行时、依赖、变量引用与服务地址；敏感值只从凭据系统或本机环境变量取得。",
      "2. 版本控制：确认仓库、目标分支或提交、工作区状态和依赖锁文件；不在不明状态下覆盖本地改动。",
      "3. 部署步骤：按项目记录安装依赖、准备配置和初始化服务；每一步完成后执行其验证，不跳过失败步骤。",
      "4. 启动：执行记录的启动命令，验证健康检查、关键页面或接口；将实际版本、结果、阻塞和下一步写回对应菜单。",
    ],
    cli: ["关联菜单：环境配置 → 版本控制 → 部署步骤 → 驾驶舱 / 项目待办", "MCP: project_management_search / project_management_list_items", "CLI: git status / git rev-parse --short HEAD", "CLI: pnpm install && pnpm dev（以项目记录的命令为准）"],
  },
  {
    id: "project-dictionary-template",
    page: "项目管理 / 数据字典 / 受控模板",
    scene: "维护库元、表元、字段元、码值元、场景和 Mapping；变更 Mapping 模板规范。",
    manual: [
      "写入前必须读取当前 published 数据字典模板版本；draft/review 版本不能作为正式录入依据。",
      "属性缺失、类型或固定码值不合法时，返回缺失项并停止写入，不得自行补业务含义。",
      "模板外的新属性、枚举值或填写方式，必须先创建变更记录，再发布新模板版本。",
      "整改项先绑定到具体元和属性；同类整改反复出现时，汇总整改要求和修复结果，形成模板改进建议，确认后才发布新版本。",
      "字段、表、库、码值、场景和 Mapping 的详细规则见 docs/PROJECT_DICTIONARY_MAPPING_RULES.md。",
    ],
    cli: [
      "MCP: rich_dictionary_manage（已知系统、表或字段的精确读写）",
      "MCP: rich_context_search（对象尚未定位时）",
      "DB: pm_dictionary_template_versions / pm_dictionary_template_rules",
      "DB: pm_dictionary_template_changes / pm_dictionary_rectifications",
      "DOC: docs/PROJECT_DICTIONARY_MAPPING_RULES.md",
    ],
  },
  {
    id: "toolbox",
    page: "工具箱",
    scene: "锁屏、延迟执行、小工具调用、系统动作。",
    manual: [
      "先读取可用工具及参数 schema，不能猜工具名或参数。",
      "有 delay_minutes / delay_seconds 时可创建延迟调用。",
      "执行结果会写入 tool_invocations，后台可审计。",
    ],
    cli: [
      "CLI: pnpm rich -- toolbox tools",
      "CLI: pnpm rich -- toolbox invoke --json '{\"tool\":\"...\",\"args\":{}}'",
      "CLI: pnpm rich -- toolbox cancel <invocationId>",
      "MCP: rich_automation_manage（项目自动化计划）",
      "CLI: pnpm rich -- api GET /api/toolbox/tools",
    ],
  },
  {
    id: "health-advisor",
    page: "健康顾问",
    scene: "查看苹果健康同步、体重、训练、睡眠、饮食及健康建议。",
    manual: [
      "先读时间线和采集状态，再判断数据是否缺失；前端未展示不代表数据没有入库。",
      "健康建议必须区分记录事实与推断，避免把不完整样本当作结论。",
      "解释苹果健康指标前先查指标说明；原始数据排查不应修改用户健康记录。",
    ],
    cli: [
      "CLI: pnpm rich -- api GET /api/health/intake/status",
      "CLI: pnpm rich -- api GET /api/health/timeline",
      "DOC: docs/APPLE_HEALTH_METRICS.md",
    ],
  },
  {
    id: "admin-corpus",
    page: "后台 / AI 语料管理 / AI 学习手册",
    scene: "沉淀 AI 表达模板、系统使用手册、Agent 自我改进经验。",
    manual: [
      "语料模板规定怎么表达，学习手册规定如何安全使用 Rich；两者都应与实际能力同步。",
      "风格反馈写回语料模板；工作中的可复用经验在验收后用 rich_learning_capture 沉淀。",
      "发现能力缺口时创建改造任务，不要假装已有接口或执行结果。",
    ],
    cli: [
      "CLI: pnpm rich -- corpus list/get/upsert/delete/reset",
      "CLI: pnpm rich -- improvements list/create/claim/release/patch/delete",
      "CLI: pnpm rich -- admin engine/ops/signals/manuals",
      "pnpm corpus list",
      "pnpm corpus patch <id> --field <name> --value <value>",
      "MCP: get_rich_system_manual / rich_learning_capture",
      "CLI: pnpm rich -- improvements list/create/claim/release/patch/delete",
    ],
  },
  {
    id: "cli-coverage",
    page: "全部按钮 CLI 覆盖",
    scene: "AI 员工需要像点击 UI 一样执行 Rich 的所有后端操作。",
    manual: [
      "数据写入、AI 生成、上传、工具调用、删除必须有 MCP 或 CLI；纯 UI 展开、筛选、弹窗无需覆盖。",
      "优先场景化 MCP；本机自动化或 MCP 未覆盖能力时使用 pnpm rich 的语义命令。",
      "新按钮没有语义命令时用 api/sse 兜底，并同步 docs/RICH_CLI_COVERAGE.md。",
    ],
    cli: [
      "CLI: pnpm rich -- api <METHOD> /api/<path> --json '{...}'",
      "CLI: pnpm rich -- sse POST /api/<stream-path> --json '{...}'",
      "DOC: docs/RICH_CLI_COVERAGE.md",
    ],
  },
];

export function AdminView() {
  const [tab, setTab] = useState<Tab>("health");
  return (
    <div className="tree-view admin-shell">
      <TopBar breadcrumb={null} />

      <aside className="learning-sidebar admin-sidebar" aria-label="后台分区">
        <section>
          <div className="sidebar-list">
            <button
              type="button"
              className={`sidebar-node ${tab === "health" ? "is-active" : ""}`}
              onClick={() => setTab("health")}
              aria-current={tab === "health" ? "page" : undefined}
            >
              <span className="sidebar-node__title">服务健康</span>
            </button>
            <button type="button" className={`sidebar-node ${tab === "traces" ? "is-active" : ""}`} onClick={() => setTab("traces")} aria-current={tab === "traces" ? "page" : undefined}>
              <span className="sidebar-node__title">对话追踪</span>
            </button>
            <button type="button" className={`sidebar-node ${tab === "workflows" ? "is-active" : ""}`} onClick={() => setTab("workflows")} aria-current={tab === "workflows" ? "page" : undefined}>
              <span className="sidebar-node__title">内嵌 AI 工作流</span>
            </button>
            <button type="button" className={`sidebar-node ${tab === "delegations" ? "is-active" : ""}`} onClick={() => setTab("delegations")} aria-current={tab === "delegations" ? "page" : undefined}>
              <span className="sidebar-node__title">任务委派闭环</span>
            </button>
            <button type="button" className={`sidebar-node ${tab === "agents" ? "is-active" : ""}`} onClick={() => setTab("agents")} aria-current={tab === "agents" ? "page" : undefined}>
              <span className="sidebar-node__title">Agent 与 MCP</span>
            </button>
            <button
              type="button"
              className={`sidebar-node ${tab === "ops" ? "is-active" : ""}`}
              onClick={() => setTab("ops")}
            >
              <span className="sidebar-node__title">AI 任务历史</span>
            </button>
            <button
              type="button"
              className={`sidebar-node ${tab === "signals" ? "is-active" : ""}`}
              onClick={() => setTab("signals")}
            >
              <span className="sidebar-node__title">信号日志</span>
            </button>
            <button
              type="button"
              className={`sidebar-node ${tab === "manuals" ? "is-active" : ""}`}
              onClick={() => setTab("manuals")}
            >
              <span className="sidebar-node__title">知识手册 · 反思</span>
            </button>
            <button type="button" className={`sidebar-node ${tab === "prompts" ? "is-active" : ""}`} onClick={() => setTab("prompts")}>
              <span className="sidebar-node__title">提示词库</span>
            </button>
            <button
              type="button"
              className={`sidebar-node ${tab === "corpus" ? "is-active" : ""}`}
              onClick={() => setTab("corpus")}
            >
              <span className="sidebar-node__title">AI 语料管理</span>
            </button>
            <button
              type="button"
              className={`sidebar-node ${tab === "learning" ? "is-active" : ""}`}
              onClick={() => setTab("learning")}
            >
              <span className="sidebar-node__title">AI 学习手册</span>
            </button>
            <button
              type="button"
              className={`sidebar-node ${tab === "cron" ? "is-active" : ""}`}
              onClick={() => setTab("cron")}
            >
              <span className="sidebar-node__title">定时任务监控</span>
            </button>
            <button
              type="button"
              className={`sidebar-node ${tab === "improvements" ? "is-active" : ""}`}
              onClick={() => setTab("improvements")}
            >
              <span className="sidebar-node__title">系统改造任务</span>
            </button>
            <button
              type="button"
              className={`sidebar-node ${tab === "projectHealth" ? "is-active" : ""}`}
              onClick={() => setTab("projectHealth")}
            >
              <span className="sidebar-node__title">项目健康检查</span>
            </button>
          </div>
        </section>
      </aside>

      <main className={`tv-main tv-main--home admin-main ${tab === "workflows" ? "admin-main--workflows" : ""}`}>
        {tab === "health" && <ServiceHealthTab />}
        {tab === "traces" && <TraceTab />}
        {tab === "workflows" && <WorkflowsTab />}
        {tab === "delegations" && <DelegationsTab />}
        {tab === "agents" && <AgentsMcpTab />}
        {tab === "ops" && <OpsTab />}
        {tab === "signals" && <SignalsTab />}
        {tab === "manuals" && <ManualsTab />}
        {tab === "prompts" && <PromptLibraryTab />}
        {tab === "corpus" && <CorpusTab />}
        {tab === "learning" && <LearningManualTab />}
        {tab === "cron" && <CronTab />}
        {tab === "improvements" && <ImprovementsTab />}
        {tab === "projectHealth" && <ProjectHealthTab />}
      </main>

      <footer className="tv-footer">
        <div>后台管理 · 仅用于观察系统运行</div>
        <FooterTaskStrip />
      </footer>
    </div>
  );
}

/* ---------------------------------- Tabs ---------------------------------- */

interface ServiceHealthItem {
  id: string;
  label: string;
  kind: "server" | "adapter" | "mcp" | "delegation";
  state: "healthy" | "degraded" | "offline" | "not_configured";
  checkedAt: string;
  detail: string;
  latencyMs?: number;
  lastSuccessAt?: string;
  lastError?: string;
}

interface TraceItem {
  id: string;
  ts: string;
  op: string;
  model: string;
  scenario?: string;
  status: string;
  durationMs?: number;
  kind: "chat" | "workflow" | "delegation";
}

interface TraceDetail extends TraceItem {
  hasOutput: boolean;
  outputLength: number;
  events: { ts: string; type: string; summary: string; data?: { tool?: string; status?: string } }[];
}

interface WorkflowItem {
  operation: string;
  scenario: string;
  sources: string[];
  memory: "durable" | "request" | "none";
  notes: string;
  entryType?: "http" | "async-queue" | "route-only";
  usesMcp: boolean;
  recent: { total: number; done: number; error: number; latestAt?: string };
}

interface DelegationItem {
  id: string;
  title: string;
  status: string;
  backend: string;
  externalTaskId?: string;
  resultRefs?: { type: string; id: string }[];
  reviewStatus?: string;
  createdAt: string;
  startedAt?: string;
  updatedAt: string;
  finishedAt?: string;
  lastSyncedAt?: string;
  hasError: boolean;
  errorLength: number;
  hasProgress: boolean;
  progress: "available" | "none";
}

interface EngineSettingsPayload {
  scenarios?: string[];
  adapters?: string[];
  settings?: { routes?: Record<string, string> };
}

interface EngineRoutingPayload {
  routing?: { scenarios?: { scenario: string; adapter: string; source: string }[] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeObservabilityResponse<T>(value: unknown): T | null {
  return isRecord(value) ? value as T : null;
}

function listFrom<T>(value: unknown, key: string): T[] {
  return isRecord(value) && Array.isArray(value[key]) ? value[key] as T[] : [];
}

function useObservabilityJson<T>(path: string, autoRefresh: boolean) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const load = () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError(null);
    void fetch(path, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(`请求失败（${response.status}）`);
        return response.json();
      })
      .then(json => { if (!controller.signal.aborted) setData(normalizeObservabilityResponse<T>(json)); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "请求失败"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  };

  useEffect(() => {
    load();
    if (!autoRefresh) return () => controllerRef.current?.abort();
    const timer = window.setInterval(load, 5_000);
    return () => { window.clearInterval(timer); controllerRef.current?.abort(); };
  }, [path, autoRefresh]);
  return { data, loading, error, load };
}

function ObservabilityHeader({ title, refresh }: { title: string; refresh: () => void }) {
  return <header className="admin-pane__head"><h1>{title}</h1><div className="admin-filters"><span>自动刷新（5s）</span><button type="button" onClick={refresh}>立即刷新</button></div></header>;
}

function ServiceHealthTab() {
  const { data, loading, error, load } = useObservabilityJson<{ items: ServiceHealthItem[] }>("/api/admin/ai-observability/health", true);
  return <div className="admin-pane"><ObservabilityHeader title="服务健康" refresh={load} /><ObservabilityContent loading={loading} error={error}>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>服务</th><th>状态</th><th>检查时间</th><th>延迟</th><th>最近成功</th><th>详情 / 最近错误</th></tr></thead><tbody>{listFrom<ServiceHealthItem>(data, "items").map(item => <tr key={item.id}><td><strong>{item.label}</strong><span className="admin-scope">{item.kind}</span></td><td><span className={`observability-state observability-state--${item.state}`}>{serviceStateLabel(item.state)}</span></td><td className="admin-cell-mono">{formatTs(item.checkedAt)}</td><td>{item.latencyMs === undefined ? "—" : `${item.latencyMs} ms`}</td><td className="admin-cell-mono">{item.lastSuccessAt ? formatTs(item.lastSuccessAt) : "—"}</td><td>{item.detail}{item.lastError ? <span className="admin-scope">最近错误：{item.lastError}</span> : null}</td></tr>)}</tbody></table></div>
  </ObservabilityContent></div>;
}

function TraceTab() {
  const list = useObservabilityJson<{ items: TraceItem[] }>("/api/admin/ai-observability/traces?kind=chat", true);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<TraceDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  useEffect(() => {
    if (!selected) { setDetail(null); setDetailLoading(false); return; }
    const controller = new AbortController(); setDetail(null); setDetailError(null); setDetailLoading(true);
    void fetch(`/api/admin/ai-observability/traces/${encodeURIComponent(selected)}`, { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(`请求失败（${response.status}）`); return response.json() as Promise<TraceDetail>; })
      .then(json => { if (!controller.signal.aborted) setDetail(normalizeObservabilityResponse<TraceDetail>(json)); })
      .catch(reason => { if (!controller.signal.aborted) setDetailError(reason instanceof Error ? reason.message : "请求失败"); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selected]);
  return <div className="admin-pane"><ObservabilityHeader title="对话追踪" refresh={list.load} /><ObservabilityContent loading={list.loading} error={list.error}>
    <div className="observability-traces"><div className="observability-trace-list">{listFrom<TraceItem>(list.data, "items").map(item => <button key={item.id} type="button" className={selected === item.id ? "is-active" : ""} aria-pressed={selected === item.id} onClick={() => { setDetail(null); setDetailError(null); setSelected(item.id); }}><strong>{item.op}</strong><span>{item.model} · {item.scenario ?? "—"}</span><small>{formatTs(item.ts)} · {item.status}</small></button>)}</div>
      <TraceDetailPanel detail={detail} error={detailError} loading={detailLoading} />
    </div>
  </ObservabilityContent></div>;
}

function TraceDetailPanel({ detail, error, loading }: { detail: TraceDetail | null; error: string | null; loading: boolean }) {
  if (error) return <div className="admin-detail"><div className="admin-detail__inner admin-detail__error">{error}</div></div>;
  if (loading) return <div className="admin-detail"><div className="admin-loading" role="status" aria-live="polite">正在加载追踪详情…</div></div>;
  if (!detail) return <div className="admin-detail"><div className="admin-empty">选择一条对话追踪以查看安全时间线。</div></div>;
  return <div className="admin-detail"><div className="admin-detail__inner"><section><h3>用户 / 请求元数据（安全）</h3><p className="observability-inline">{detail.id} · {detail.op} · {detail.model} · {detail.scenario ?? "—"} · {detail.status}</p></section><section><h3>执行时间线</h3><ol className="observability-timeline">{listFrom<TraceDetail["events"][number]>(detail, "events").map((event, index) => <li key={`${event.ts}-${index}`}><time>{formatTs(event.ts)}</time><strong>{traceEventLabel(event.type, event.data)}</strong><span>{event.data?.tool ? `工具：${event.data.tool}` : ""}{event.data?.status ? ` · 状态：${event.data.status}` : ""}</span></li>)}</ol></section><section><h3>最终安全状态</h3><p>{detail.status === "done" ? "已完成" : detail.status === "error" ? "执行失败（错误详情受保护）" : "执行中"}；输出：{detail.hasOutput ? `有（${detail.outputLength} 字符）` : "无"}。原始回复受保护，不在监控页展示。</p></section></div></div>;
}

function WorkflowsTab() {
  const workflowsRequest = useObservabilityJson<{ items: WorkflowItem[] }>("/api/admin/ai-observability/workflows", false);
  const routingRequest = useObservabilityJson<EngineRoutingPayload>("/api/admin/engine", false);
  const { data, loading, error, load } = workflowsRequest;
  const workflows = listFrom<WorkflowItem>(data, "items").filter(item => !item.usesMcp);
  const routes = listFrom<{ scenario: string; adapter: string; source: string }>(routingRequest.data?.routing, "scenarios");
  const grouped = workflows.reduce<Record<string, WorkflowItem[]>>((groups, workflow) => {
    (groups[workflow.scenario] ??= []).push(workflow);
    return groups;
  }, {});
  return <div className="admin-pane admin-pane--workflows"><header className="admin-pane__head"><h1>内嵌 AI 工作流</h1><div className="admin-filters"><span>清晰区分调度职责与执行产出职责</span><button type="button" onClick={() => { load(); routingRequest.load(); }}>立即刷新</button></div></header><ObservabilityContent loading={loading || routingRequest.loading} error={error ?? routingRequest.error}>
    <section className="workflow-directory">
      <div className="workflow-directory__intro"><div><strong>{workflows.length}</strong><span>条内嵌工作流</span></div><ol aria-label="内嵌工作流通用链路"><li>功能入口触发</li><li>调度层分流</li><li>执行 Agent 产出</li><li>结构化结果回到功能页</li></ol><p>此页描述职责与路由；不展示或保存具体调用内容。</p></div>
      {Object.entries(grouped).map(([scenario, items]) => <section className="workflow-group" key={scenario}><header><div><span className="workflow-group__eyebrow">业务场景</span><h2>{workflowScenarioLabel(scenario)}</h2></div><span>{items.length} 个操作入口</span></header><div className="workflow-group__head" aria-hidden="true"><span>操作入口</span><span>如何触发</span><span>调度层</span><span>执行 Agent / 产出模型</span><span>处理方式</span></div><div className="workflow-group__rows">{items.map(item => { const route = routes.find(candidate => candidate.scenario === item.scenario); return <details className="workflow-row" key={item.operation}><summary><div className="workflow-row__name"><strong>{item.operation}</strong><span>{workflowEntryLabel(item.operation)}</span></div><div className="workflow-row__trigger">{workflowTrigger(item)}</div><div className="workflow-row__agent"><strong>{workflowDispatcher(item)}</strong><span>{workflowDispatchType(item)}</span></div><div className="workflow-row__executor"><strong>{workflowExecutor(route)}</strong><span>{route ? `场景 ${item.scenario} · ${route.source}` : `场景 ${item.scenario} · 路由加载中`}</span></div><div className="workflow-row__handling">{workflowHandling(item)}</div></summary><div className="workflow-row__details"><span><b>请求上下文</b>{Array.isArray(item.sources) ? item.sources.join("、") : "—"} · {memoryLabel(item.memory)}</span><span><b>调度责任</b>{workflowDispatcherDetail(item)}</span><span><b>执行产出责任</b>{workflowExecutorDetail(route)}</span><span><b>完整处理说明</b>{item.notes}</span><span><b>链路边界</b>{workflowBoundary(item)}</span></div></details>; })}</div></section>)}
    </section>
  </ObservabilityContent></div>;
}

function DelegationsTab() {
  const { data, loading, error, load } = useObservabilityJson<{ total: number; items: DelegationItem[] }>("/api/admin/ai-observability/delegations", true);
  return <div className="admin-pane"><ObservabilityHeader title="任务委派闭环" refresh={load} /><ObservabilityContent loading={loading} error={error}><div className="observability-summary">总计 {data?.total ?? 0} 项；当前接口快照最多展示 50 项。</div><div className="observability-list">{listFrom<DelegationItem>(data, "items").map(item => <article className="observability-card" key={item.id}><header><strong>{item.title}</strong><span className="observability-state">{item.status}</span></header><dl><dt>后端 / 外部 ID</dt><dd>{item.backend} / {item.externalTaskId ?? "—"}</dd><dt>进度</dt><dd>{item.hasProgress ? "可用（内容受保护）" : "无"}</dd><dt>复核</dt><dd>{item.reviewStatus ?? "—"}</dd><dt>结果引用</dt><dd>{listFrom<{ type: string; id: string }>(item, "resultRefs").map(ref => `${ref.type} · ${ref.id}`).join("、") || "—"}</dd><dt>错误</dt><dd>{item.hasError ? `有（${item.errorLength} 字符，内容受保护）` : "无"}</dd><dt>时间</dt><dd>创建 {formatTs(item.createdAt)} · 更新 {formatTs(item.updatedAt)}{item.finishedAt ? ` · 完成 ${formatTs(item.finishedAt)}` : ""}</dd></dl></article>)}</div></ObservabilityContent></div>;
}

function AgentsMcpTab() {
  const health = useObservabilityJson<{ items: ServiceHealthItem[] }>("/api/admin/ai-observability/health", true);
  const delegations = useObservabilityJson<{ total: number; items: DelegationItem[] }>("/api/admin/ai-observability/delegations", true);
  const relevant = listFrom<ServiceHealthItem>(health.data, "items").filter(item => item.kind === "adapter" || item.id === "rich-mcp" || item.id === "rich-server");
  return <div className="admin-pane"><ObservabilityHeader title="Agent 与 MCP" refresh={() => { health.load(); delegations.load(); }} /><ObservabilityContent loading={health.loading || delegations.loading} error={health.error ?? delegations.error}><div className="observability-summary">当前委派任务 {delegations.data?.total ?? 0} 项（快照 {listFrom<DelegationItem>(delegations.data, "items").length} 项）。</div><div className="observability-list">{relevant.map(item => <article className="observability-card" key={item.id}><header><strong>{item.label}</strong><span className={`observability-state observability-state--${item.state}`}>{serviceStateLabel(item.state)}</span></header><p>{item.detail}</p><dl><dt>传输 / 就绪</dt><dd>{item.detail}</dd><dt>最近成功</dt><dd>{item.lastSuccessAt ? formatTs(item.lastSuccessAt) : "—"}</dd>{item.lastError && <><dt>最近错误</dt><dd>{item.lastError}</dd></>}</dl></article>)}</div><ModelRoutingSection /></ObservabilityContent></div>;
}

function ModelRoutingSection() {
  const [settings, setSettings] = useState<EngineSettingsPayload | null>(null);
  const [routing, setRouting] = useState<EngineRoutingPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);
  const routesRef = useRef<Record<string, string>>({});
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const load = () => {
    controllerRef.current?.abort();
    const controller = new AbortController(); controllerRef.current = controller;
    if (mountedRef.current) setError(null);
    void Promise.all([fetch("/api/admin/engine/settings", { signal: controller.signal }), fetch("/api/admin/engine", { signal: controller.signal })])
      .then(async ([settingsResponse, engineResponse]) => {
        if (!settingsResponse.ok || !engineResponse.ok) throw new Error("模型路由配置加载失败");
        return Promise.all([settingsResponse.json(), engineResponse.json()]);
      }).then(([nextSettings, nextRouting]) => {
        if (!controller.signal.aborted && mountedRef.current) {
          const normalizedSettings = normalizeObservabilityResponse<EngineSettingsPayload>(nextSettings);
          routesRef.current = isRecord(normalizedSettings?.settings?.routes) ? normalizedSettings.settings.routes as Record<string, string> : {};
          setSettings(normalizedSettings); setRouting(normalizeObservabilityResponse<EngineRoutingPayload>(nextRouting));
        }
      })
      .catch(reason => { if (!controller.signal.aborted && mountedRef.current) setError(reason instanceof Error ? reason.message : "模型路由配置加载失败"); });
  };
  useEffect(() => { mountedRef.current = true; load(); return () => { mountedRef.current = false; controllerRef.current?.abort(); }; }, []);
  const routes = routesRef.current;
  const scenarios = listFrom<string>(settings, "scenarios");
  const adapters = listFrom<string>(settings, "adapters");
  const resolved = listFrom<{ scenario: string; adapter: string; source: string }>(routing?.routing, "scenarios");
  const saveRoute = (scenario: string, adapter: string) => {
    const nextRoutes = { ...routes };
    if (adapter) nextRoutes[scenario] = adapter; else delete nextRoutes[scenario];
    routesRef.current = nextRoutes;
    if (mountedRef.current) { setSettings(current => current ? { ...current, settings: { ...current.settings, routes: nextRoutes } } : current); setError(null); setSaving(true); }
    const save = saveQueueRef.current.catch(() => undefined).then(async () => {
      const response = await fetch("/api/admin/engine/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ routes: nextRoutes }) });
      if (!response.ok) throw new Error("模型路由保存失败");
    });
    saveQueueRef.current = save;
    void save.catch(reason => { if (mountedRef.current) setError(reason instanceof Error ? reason.message : "模型路由保存失败"); })
      .finally(() => { if (mountedRef.current && saveQueueRef.current === save) setSaving(false); });
  };
  return <section className="observability-routing"><header><strong>模型路由配置</strong><button type="button" onClick={load} disabled={saving}>刷新配置</button></header>{error && <div className="admin-detail__error">{error}</div>}<div>{scenarios.map(scenario => { const route = resolved.find(item => item.scenario === scenario); return <label key={scenario}><span>{scenario}</span><em>{routes[scenario] ?? route?.adapter ?? "默认"} · {routes[scenario] ? "settings" : route?.source ?? "default"}</em><select value={routes[scenario] ?? ""} aria-label={`${scenario} 模型`} disabled={saving} onChange={event => saveRoute(scenario, event.target.value)}><option value="">默认 / 环境变量</option>{adapters.map(adapter => <option key={adapter} value={adapter}>{adapter}</option>)}</select></label>; })}</div></section>;
}

function ObservabilityContent({ loading, error, children }: { loading: boolean; error: string | null; children: React.ReactNode }) {
  return <div className="admin-engine">{error && <div className="admin-detail__error">监控数据加载失败：{error}</div>}{loading && <div className="admin-loading">加载中…</div>}{children}</div>;
}

function serviceStateLabel(state: ServiceHealthItem["state"]) { return ({ healthy: "健康", degraded: "降级", offline: "离线", not_configured: "未配置" })[state]; }
function workflowScenarioLabel(scenario: string) { return ({ chat: "对话", planning: "规划", analysis: "分析", review: "复核", "project-practice": "项目实战", "agent-task": "Agent 任务", knowledge: "知识", content: "内容", mindmap: "导图", image: "图片", coding: "编码" })[scenario] ?? scenario; }
function memoryLabel(memory: string) { return ({ durable: "长期记忆", request: "请求上下文", none: "无记忆" })[memory] ?? memory; }
function workflowEntryLabel(operation: string) { return ({ "/api/chat": "同步对话", "/api/chat/stream": "流式对话", "/api/ai/great-me": "个人计划推演", "/api/ai/decompose-plan": "目标拆解", "/api/ai/analyze-progress": "进度分析", "/api/ai/draft-review": "复盘草案", "/api/ai/draft-prd": "PRD 草案", "/api/ai/draft-child": "项目子项草案", "/api/ai/guided-practice": "项目实战引导", "/api/ai/adjust-child": "子项调整", "/api/ai/analyze-input": "首页输入解析", "/api/ai/generate-tree": "知识树生成", "/api/ai/refine": "知识深化", "/api/ai/expand": "知识扩展", "/api/ai/extend": "概念延展", "/api/ai/path": "学习路径", "/api/ai/ask": "知识问答", "/api/ai/analyze-mark": "划线分析", "/api/ai/news-generate-daily": "AI 早报", "/api/mindmaps/generate": "导图 PPT 生成", "image-queue": "图片与封面生成队列", coding: "编码场景（待接入）" })[operation] ?? "内嵌操作"; }
function workflowTrigger(item: WorkflowItem) { if (item.entryType === "async-queue") return "内容或导图写入图片占位块后自动触发"; if (item.entryType === "route-only") return "当前没有 Rich 功能入口"; return ({ "/api/chat": "首页或快捷聊天提交", "/api/chat/stream": "对话框发起流式回复", "/api/ai/great-me": "计划页请求推演", "/api/ai/decompose-plan": "用户提交目标拆解", "/api/ai/analyze-progress": "计划页请求进度分析", "/api/ai/draft-review": "复盘页请求起草", "/api/ai/draft-prd": "项目实战页起草 PRD", "/api/ai/draft-child": "项目实战页新增子项", "/api/ai/guided-practice": "项目实战引导步骤", "/api/ai/adjust-child": "项目子项调整操作", "/api/ai/analyze-input": "首页输入框提交", "/api/ai/generate-tree": "创建知识树操作", "/api/ai/refine": "知识元深化操作", "/api/ai/expand": "知识元扩展子项", "/api/ai/extend": "知识元横向延展", "/api/ai/path": "生成学习路径操作", "/api/ai/ask": "知识元问答操作", "/api/ai/analyze-mark": "用户选中内容后分析", "/api/ai/news-generate-daily": "早报页面或定时任务触发", "/api/mindmaps/generate": "导图 PPT 页面提交文稿" })[item.operation] ?? "功能页或 API 请求触发"; }
function workflowDispatcher(item: WorkflowItem) { if (item.entryType === "async-queue") return "Rich 图片队列"; if (item.entryType === "route-only") return "尚未接入调度层"; return item.operation.startsWith("/api/chat") ? "Rich 对话调度器" : "无额外调度 Agent"; }
function workflowDispatchType(item: WorkflowItem) { if (item.entryType === "async-queue") return "进程内串行任务队列"; if (item.entryType === "route-only") return "仅模型路由配置"; return item.operation.startsWith("/api/chat") ? "对话路由与任务分流" : "功能接口直达执行层"; }
function workflowDispatcherDetail(item: WorkflowItem) { if (item.entryType === "async-queue") return "Rich 图片队列负责将图片占位任务串行调度给执行 Agent，并将结果回写到原内容。"; if (item.entryType === "route-only") return "当前没有调用入口或调度实现；这里只展示已配置的执行模型路由。"; return item.operation.startsWith("/api/chat") ? "Rich 对话调度器负责识别对话类型、组装上下文和选择后续链路；任务型对话才会转入 Agent / MCP。" : "该功能不经过独立规划或工具调度；功能接口将已组装的业务上下文直接交给执行 Agent。"; }
function workflowExecutor(route?: { adapter: string; source: string }) { return route ? `${route.adapter} · 执行 Agent` : "路由加载中"; }
function workflowExecutorDetail(route?: { adapter: string; source: string }) { return route ? `${route.adapter} 负责实际生成内容与结构化结果；当前选择来自 ${route.source} 路由。` : "正在读取当前场景的执行 Agent 路由。"; }
function workflowHandling(item: WorkflowItem) { if (item.entryType === "async-queue") return "扫描图片占位块，串行生成图片并回写元素内容"; if (item.entryType === "route-only") return "当前未执行；等待 Rich 功能入口接入"; if (item.operation.startsWith("/api/chat")) return "组装会话上下文，按场景选择模型并返回对话结果"; if (item.scenario === "mindmap") return "生成导图树与嵌入内容，完成后可继续触发封面图片队列"; if (item.scenario === "knowledge") return "读取知识数据与手册，生成后校验结构并写回功能结果"; if (item.scenario === "project-practice") return "组装项目/子项上下文，生成草案或调整建议"; if (item.scenario === "planning" || item.scenario === "analysis" || item.scenario === "review") return "组装请求与状态快照，选择场景模型并生成页面所需结果"; return "组装请求上下文，选择场景模型后生成结构化结果"; }
function workflowBoundary(item: WorkflowItem) { if (item.entryType === "async-queue") return "不经 MCP；图片任务在 Rich 服务进程内排队，执行完成后回写原元素。"; if (item.entryType === "route-only") return "不是可执行工作流；仅表示模型路由已准备好，不能由用户界面直接触发。"; return item.operation.startsWith("/api/chat") ? "普通对话由调度器直接选模型；任务型对话才会进入 Agent/MCP 链路。" : "不经过 Agent 调度层或 Rich MCP；由功能页直接调用执行 Agent，并将结果返回当前功能。"; }
function traceEventLabel(type: string, data?: { tool?: string; status?: string }) {
  if (type === "turn.plan") return "计划";
  if (type === "adapter.selected") return "已选择适配器";
  if (type === "agent.started") return "Agent 已启动";
  if (type === "mcp.tool") return `MCP 工具${data?.status === "error" ? "出错" : data?.status === "completed" ? "完成" : "启动"}`;
  if (type === "fallback") return "已回退";
  return type === "output" ? "输出已记录（受保护）" : "错误已记录（受保护）";
}

function OpsTab() {
  const [items, setItems] = useState<OpListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterOp, setFilterOp] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OpDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterOp) params.set("op", filterOp);
      if (filterStatus) params.set("status", filterStatus);
      params.set("limit", "200");
      const res = await fetch(`/api/admin/ops?${params}`);
      const json = await res.json();
      setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [filterOp, filterStatus]);

  async function openDetail(id: string) {
    setActiveId(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/ops/${encodeURIComponent(id)}`);
      const json = await res.json();
      setDetail(json);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="admin-pane">
      <header className="admin-pane__head">
        <h1>AI 任务历史</h1>
        <div className="admin-filters">
          <label>
            操作
            <select value={filterOp} onChange={e => setFilterOp(e.target.value)}>
              {OP_FILTERS.map(o => <option key={o} value={o}>{o || "全部"}</option>)}
            </select>
          </label>
          <label>
            状态
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">全部</option>
              <option value="running">running</option>
              <option value="done">done</option>
              <option value="error">error</option>
            </select>
          </label>
          <button type="button" onClick={() => void load()}>刷新</button>
        </div>
      </header>

      <div className="admin-split">
        <div className="admin-table-wrap">
          {loading && <div className="admin-loading">加载中…</div>}
          {!loading && items.length === 0 && <div className="admin-empty">暂无任务记录。先在主界面跑一次 AI 操作，再回来看。</div>}
          {!loading && items.length > 0 && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>操作</th>
                  <th>场景</th>
                  <th>模型</th>
                  <th>元 / 范围</th>
                  <th>状态</th>
                  <th>耗时</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr
                    key={item.id}
                    className={activeId === item.id ? "is-active" : ""}
                    onClick={() => void openDetail(item.id)}
                  >
                    <td className="admin-cell-mono">{formatTs(item.ts)}</td>
                    <td><span className={`admin-op admin-op--${item.op}`}>{item.op}</span></td>
                    <td>{item.scenario ?? "—"}</td>
                    <td>{item.model}</td>
                    <td className="admin-cell-mono">
                      {item.elementId ?? "—"}
                      {item.scope && <em className="admin-scope">{summarizeScope(item.scope)}</em>}
                    </td>
                    <td><span className={`admin-status admin-status--${item.status}`}>{item.status}</span></td>
                    <td className="admin-cell-mono">{item.durationMs ? formatDuration(item.durationMs) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <aside className="admin-detail">
          {!activeId && <div className="admin-empty">点击左侧一行查看完整 prompt 与返回。</div>}
          {activeId && detailLoading && <div className="admin-loading">加载中…</div>}
          {activeId && !detailLoading && detail && <OpDetailView detail={detail} />}
        </aside>
      </div>
    </div>
  );
}

function OpDetailView({ detail }: { detail: OpDetail }) {
  return (
    <div className="admin-detail__inner">
      <header className="admin-detail__head">
        <strong className={`admin-op admin-op--${detail.op}`}>{detail.op}</strong>
        <span className={`admin-status admin-status--${detail.status}`}>{detail.status}</span>
        <span className="admin-cell-mono">{formatTs(detail.ts)}</span>
        {detail.durationMs !== undefined && <span className="admin-cell-mono">{formatDuration(detail.durationMs)}</span>}
        {detail.scenario && <span>{detail.scenario}</span>}
        {detail.model && <span>{detail.model}</span>}
      </header>
      {detail.elementId && (
        <div className="admin-detail__meta"><strong>元：</strong><code>{detail.elementId}</code></div>
      )}
      {detail.scope && Object.keys(detail.scope).length > 0 && (
        <div className="admin-detail__meta"><strong>范围：</strong><code>{JSON.stringify(detail.scope)}</code></div>
      )}
      {detail.sessionId && (
        <div className="admin-detail__meta"><strong>Session：</strong><code>{detail.sessionId}</code></div>
      )}
      {detail.error && (
        <div className="admin-detail__error"><strong>错误：</strong>{detail.error}</div>
      )}
      <section>
        <h3>Prompt（{detail.prompt?.length ?? 0} 字符）</h3>
        <pre className="admin-pre">{detail.prompt}</pre>
      </section>
      <section>
        <h3>Output（{detail.output?.length ?? 0} 字符）</h3>
        <pre className="admin-pre">{detail.output || "—"}</pre>
      </section>
    </div>
  );
}

/* ---------------------------------- Signals ---------------------------------- */

function SignalsTab() {
  const [items, setItems] = useState<SignalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (filterType) params.set("type", filterType);
      const res = await fetch(`/api/admin/signals?${params}`);
      const json = await res.json();
      setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [filterType]);

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const s of items) set.add(s.type);
    return Array.from(set).sort();
  }, [items]);

  return (
    <div className="admin-pane">
      <header className="admin-pane__head">
        <h1>信号日志</h1>
        <div className="admin-filters">
          <label>
            类型
            <select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">全部</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void load()}>刷新</button>
        </div>
      </header>

      <div className="admin-table-wrap admin-table-wrap--full">
        {loading && <div className="admin-loading">加载中…</div>}
        {!loading && items.length === 0 && <div className="admin-empty">还没有信号。</div>}
        {!loading && items.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>类型</th>
                <th>元</th>
                <th>操作</th>
                <th>数据</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s, i) => (
                <tr key={`${s.ts}-${i}`}>
                  <td className="admin-cell-mono">{formatTs(s.ts)}</td>
                  <td><span className={`admin-signal admin-signal--${s.type.split(".")[0]}`}>{s.type}</span></td>
                  <td className="admin-cell-mono">{s.elementId ?? "—"}</td>
                  <td>{s.op ?? "—"}</td>
                  <td className="admin-cell-mono admin-cell-truncate">{s.data ? JSON.stringify(s.data).slice(0, 300) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------- Manuals ---------------------------------- */

function ManualsTab() {
  const [items, setItems] = useState<ManualItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeName, setActiveName] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/manuals");
      const json = await res.json();
      setItems(json.items ?? []);
      if (json.items?.length > 0 && !activeName) setActiveName(json.items[0].name);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  const active = items.find(m => m.name === activeName);

  return (
    <div className="admin-pane">
      <header className="admin-pane__head">
        <h1>知识手册 · 反思结果</h1>
        <div className="admin-filters">
          <button type="button" onClick={() => void load()}>刷新</button>
        </div>
      </header>
      <div className="admin-manuals">
        <div className="admin-manuals-list">
          {loading && <div className="admin-loading">加载中…</div>}
          {!loading && items.map(m => (
            <button
              key={m.name}
              type="button"
              className={`sidebar-node ${activeName === m.name ? "is-active" : ""}`}
              onClick={() => setActiveName(m.name)}
            >
              <span className="sidebar-node__title">{m.name}</span>
              <em className="admin-manual-len">{m.length}</em>
            </button>
          ))}
        </div>
        <div className="admin-manual-detail">
          {!active && <div className="admin-empty">没有手册文件。</div>}
          {active && (
            <>
              <header className="admin-detail__head">
                <strong>{active.name}.md</strong>
                <span className="admin-cell-mono">{active.length} 字符</span>
              </header>
              <pre className="admin-pre admin-manual-pre">{active.content}</pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Prompt library ---------------------------- */

function PromptLibraryTab() {
  const [templates, setTemplates] = useState<PromptTemplateItem[]>([]);
  const [migrationCatalog, setMigrationCatalog] = useState<PromptMigrationItem[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<PromptTemplateItem | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const active = templates.find(item => item.key === activeKey) ?? null;

  async function load() {
    const response = await fetch("/api/prompt-library/templates");
    const data = await response.json() as { templates?: PromptTemplateItem[]; migrationCatalog?: PromptMigrationItem[] };
    const items = data.templates ?? [];
    setTemplates(items); setMigrationCatalog(data.migrationCatalog ?? []);
    const selected = items.find(item => item.key === activeKey) ?? items[0] ?? null;
    setActiveKey(selected?.key ?? null); setDraft(selected ? { ...selected, includes: [...selected.includes] } : null);
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => { if (active) setDraft({ ...active, includes: [...active.includes] }); }, [activeKey]);

  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/prompt-library/templates/${encodeURIComponent(draft.key)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: draft.name, description: draft.description, content: draft.content, includes: draft.includes, enabled: draft.enabled }) });
      if (!response.ok) throw new Error("保存失败");
      await load();
    } finally { setBusy(false); }
  }
  async function renderPreview() {
    if (!draft || draft.kind !== "scene") return;
    setBusy(true);
    try {
      const response = await fetch("/api/prompt-library/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key: draft.key, variables: { modeLabel: "交付物分析", page: "项目管理 / 交付物", businessKind: "交付物", businessTitle: "示例交付物", project: "示例项目", projectId: "project-example", deliverableId: "deliverable-example", deliverableContext: "（此处为当前交付物的实时资料）" } }) });
      const data = await response.json() as { content?: string; error?: string };
      setPreview(data.content ?? data.error ?? "无法生成预览");
    } finally { setBusy(false); }
  }
  return <div className="admin-pane">
    <header className="admin-pane__head"><div><h1>提示词库</h1><p className="admin-pane__desc">场景显式引用通用模板。保存后，下一次运行即时使用新内容；历史消息不会变化。</p></div><button type="button" onClick={() => void load()}>刷新</button></header>
    <div className="admin-manuals">
      <div className="admin-manuals-list">{templates.map(item => <button key={item.key} type="button" className={`sidebar-node ${activeKey === item.key ? "is-active" : ""}`} onClick={() => setActiveKey(item.key)}><span className="sidebar-node__title">{item.name}</span><em className="admin-manual-len">{item.kind === "scene" ? "场景" : "通用"}</em></button>)}</div>
      <div className="admin-manual-detail">{draft && <>
        <header className="admin-detail__head"><strong>{draft.key}</strong><label><input type="checkbox" checked={draft.enabled} onChange={event => setDraft({ ...draft, enabled: event.target.checked })} /> 启用</label></header>
        <label>名称<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <label>说明<input value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
        <label>引用模板（以逗号分隔，按顺序展开）<input value={draft.includes.join(", ")} onChange={event => setDraft({ ...draft, includes: event.target.value.split(",").map(value => value.trim()).filter(Boolean) })} /></label>
        <label>Markdown 提示词<textarea rows={18} value={draft.content} onChange={event => setDraft({ ...draft, content: event.target.value })} /></label>
        <div className="admin-filters"><button type="button" disabled={busy} onClick={() => void save()}>保存并即时生效</button>{draft.kind === "scene" && <button type="button" disabled={busy} onClick={() => void renderPreview()}>预览最终提示词</button>}</div>
        {preview && <pre className="admin-pre admin-manual-pre">{preview}</pre>}
      </>}</div>
    </div>
    <section className="admin-pane" style={{ marginTop: 24 }}><h2>迁移清单</h2><table className="admin-table"><thead><tr><th>场景</th><th>状态</th><th>当前来源</th></tr></thead><tbody>{migrationCatalog.map(item => <tr key={item.key}><td>{item.label}<br /><code>{item.key}</code></td><td>{item.status}</td><td>{item.source}</td></tr>)}</tbody></table></section>
  </div>;
}

/* ---------------------------- Learning Manual ----------------------------- */

function LearningManualTab() {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(LEARNING_MANUAL_MODULES[0].id);
  const q = query.trim().toLowerCase();
  const modules = q
    ? LEARNING_MANUAL_MODULES.filter(m =>
        [m.page, m.scene, ...m.manual, ...m.cli].join("\n").toLowerCase().includes(q),
      )
    : LEARNING_MANUAL_MODULES;
  const active = modules.find(module => module.id === activeId) ?? modules[0];

  useEffect(() => {
    if (active && active.id !== activeId) setActiveId(active.id);
  }, [active, activeId]);

  return (
    <div className="admin-pane">
      <header className="admin-pane__head">
        <h1>AI 学习手册</h1>
        <div className="admin-filters">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索页面 / 场景 / CLI"
          />
        </div>
      </header>
      <p className="admin-pane__desc">
        给 Hermes、Codex 与其他 Agent 的操作索引。先定位对象，再选择场景化 MCP；仅在本机自动化或未覆盖功能时使用 CLI。
      </p>

      <div className="learning-manual-layout">
        <nav className="learning-manual-nav" aria-label="学习手册目录">
          <div className="learning-manual-nav__summary">{modules.length} 个模块</div>
          {modules.map(module => (
            <button
              key={module.id}
              type="button"
              className={active?.id === module.id ? "is-active" : ""}
              aria-current={active?.id === module.id ? "page" : undefined}
              onClick={() => setActiveId(module.id)}
            >
              <span>{module.page}</span>
              <em>{module.id}</em>
            </button>
          ))}
          {modules.length === 0 && <div className="admin-empty">没有匹配的学习模块。</div>}
        </nav>

        {active && (
          <article className="learning-manual-detail">
            <header className="learning-manual-detail__head">
              <div>
                <span>{active.id}</span>
                <h2>{active.page}</h2>
              </div>
              <small>操作索引</small>
            </header>
            <section className="learning-manual-detail__scene">
              <h3>适用场景</h3>
              <p>{active.scene}</p>
            </section>
            <section>
              <h3>执行准则</h3>
              <ol>
                {active.manual.map(item => <li key={item}>{item}</li>)}
              </ol>
            </section>
            <section>
              <h3>可用工具</h3>
              <div className="learning-manual-cli">
                {active.cli.map(item => <code key={item}>{item}</code>)}
              </div>
            </section>
            <footer className="learning-manual-detail__footer">
              写入操作使用唯一 requestId；删除、取消与整体替换必须先获得明确确认，并检查返回的 verification。
            </footer>
          </article>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Corpus Tab ------------------------------ */

type CorpusTone = "concise" | "warm" | "executive" | "diagnostic" | "narrative";
type CorpusAccent = "teal" | "blue" | "violet" | "amber" | "rose";

interface CorpusTemplate {
  id: string;
  name: string;
  scene: string;
  intent: string;
  tone: CorpusTone;
  accent: CorpusAccent;
  mustInclude: string;
  styleGuide: string;
  template: string;
  sample: string;
  updatedAt: string;
}

const CORPUS_STORAGE_KEY = "rich.aiCorpusTemplates.v1";

const TONE_LABELS: Record<CorpusTone, string> = {
  concise: "短促清晰",
  warm: "温和陪伴",
  executive: "管理层汇报",
  diagnostic: "诊断复盘",
  narrative: "叙事解释",
};

const ACCENT_OPTIONS: Array<{ key: CorpusAccent; label: string; color: string; glow: string }> = [
  { key: "teal", label: "青绿", color: "#40e7dc", glow: "rgba(64, 231, 220, .18)" },
  { key: "blue", label: "蓝色", color: "#62b7ff", glow: "rgba(98, 183, 255, .18)" },
  { key: "violet", label: "紫色", color: "#aa8cff", glow: "rgba(170, 140, 255, .18)" },
  { key: "amber", label: "琥珀", color: "#f3bd58", glow: "rgba(243, 189, 88, .18)" },
  { key: "rose", label: "玫红", color: "#ef78b8", glow: "rgba(239, 120, 184, .18)" },
];

const DEFAULT_CORPUS_ACCENT: CorpusAccent = "teal";

const DEFAULT_CORPUS_TEMPLATES: CorpusTemplate[] = [
  {
    id: "system-status-report",
    name: "系统运行情况汇报",
    scene: "后台 / Hermes 定时汇报 / Rich 自检",
    intent: "把系统当前运行状态讲清楚：哪些正常、哪些异常、下一步要不要处理。",
    tone: "diagnostic",
    accent: "blue",
    mustInclude: "总体状态、关键指标、异常/风险、最近变化、建议动作",
    styleGuide: "先给结论，再给证据。避免堆日志；只保留用户需要做决策的信息。语气稳定，不夸张。",
    template: "【结论】\n{overall_status}\n\n【关键状态】\n- 服务：{service_status}\n- 数据：{data_status}\n- AI / Hermes：{agent_status}\n\n【异常与风险】\n{risks}\n\n【建议动作】\n{next_actions}",
    sample: "【结论】\nRich 当前可用，云数据库连接正常；Hermes 有 1 个定时任务上次投递超时，需要观察。\n\n【建议动作】\n先不做大改，下一次 cron 后再看是否重复超时。",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "information-briefing",
    name: "信息汇报",
    scene: "AI 早报 / 调研摘要 / 热点信息归纳",
    intent: "把收集到的信息变成可读、可判断、可行动的简报。",
    tone: "executive",
    accent: "amber",
    mustInclude: "一句话结论、信息来源/时间、为什么重要、对 Rich/用户的启发、建议关注点",
    styleGuide: "不要流水账。每条信息都要解释价值，不只是复述新闻。尽量用短段落和明确标题。",
    template: "【一句话】\n{one_liner}\n\n【发生了什么】\n{facts}\n\n【为什么重要】\n{why_it_matters}\n\n【可以怎么用】\n{application}\n\n【继续关注】\n{watchlist}",
    sample: "【一句话】\n今天值得关注的不是参数榜，而是多个产品把 agent 能力做成了稳定工作流。\n\n【可以怎么用】\nRich 的 AI 早报应该增加“可直接上手的 Skill 推荐”。",
    updatedAt: new Date().toISOString(),
  },
];

function loadCorpusTemplates(): CorpusTemplate[] {
  if (typeof window === "undefined") return DEFAULT_CORPUS_TEMPLATES;
  const raw = window.localStorage.getItem(CORPUS_STORAGE_KEY);
  if (!raw) return DEFAULT_CORPUS_TEMPLATES;
  try {
    const parsed = JSON.parse(raw) as CorpusTemplate[];
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed.map(t => ({ ...t, accent: t.accent ?? DEFAULT_CORPUS_ACCENT }))
      : DEFAULT_CORPUS_TEMPLATES;
  } catch {
    return DEFAULT_CORPUS_TEMPLATES;
  }
}

async function fetchCorpusTemplates(): Promise<CorpusTemplate[]> {
  const res = await fetch("/api/admin/corpus");
  if (!res.ok) throw new Error(`load corpus templates failed: ${res.status}`);
  const body = await res.json() as { templates?: CorpusTemplate[] };
  return Array.isArray(body.templates) && body.templates.length > 0
    ? body.templates.map(t => ({ ...t, accent: t.accent ?? DEFAULT_CORPUS_ACCENT }))
    : DEFAULT_CORPUS_TEMPLATES;
}

async function saveCorpusTemplates(templates: CorpusTemplate[]): Promise<void> {
  const res = await fetch("/api/admin/corpus", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ templates }),
  });
  if (!res.ok) throw new Error(`save corpus templates failed: ${res.status}`);
}

function createCorpusTemplate(): CorpusTemplate {
  return {
    id: `corpus-${Date.now().toString(36)}`,
    name: "新的答复模板",
    scene: "填写适用场景",
    intent: "说明这个模板要解决什么表达任务",
    tone: "concise",
    accent: "teal",
    mustInclude: "列出必须汇报的信息点",
    styleGuide: "说明语气、结构、禁忌和偏好的表达方式",
    template: "【结论】\n{summary}\n\n【关键事实】\n{facts}\n\n【建议】\n{next_step}",
    sample: "",
    updatedAt: new Date().toISOString(),
  };
}

function CorpusTab() {
  const [templates, setTemplates] = useState<CorpusTemplate[]>(DEFAULT_CORPUS_TEMPLATES);
  const [activeId, setActiveId] = useState(DEFAULT_CORPUS_TEMPLATES[0]?.id ?? "");
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const skipNextSave = useRef(true);

  useEffect(() => {
    let cancelled = false;
    void fetchCorpusTemplates()
      .then(next => {
        if (cancelled) return;
        setTemplates(next);
        setActiveId(next[0]?.id ?? "");
        setLoaded(true);
        window.localStorage.setItem(CORPUS_STORAGE_KEY, JSON.stringify(next));
      })
      .catch(err => {
        if (cancelled) return;
        const fallback = loadCorpusTemplates();
        setTemplates(fallback);
        setActiveId(fallback[0]?.id ?? "");
        setLoaded(true);
        setSaveError(err instanceof Error ? err.message : String(err));
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void saveCorpusTemplates(templates)
        .then(() => {
          setSaveError(null);
          window.localStorage.setItem(CORPUS_STORAGE_KEY, JSON.stringify(templates));
        })
        .catch(err => setSaveError(err instanceof Error ? err.message : String(err)));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [templates, loaded]);

  const active = templates.find(t => t.id === activeId) ?? templates[0] ?? null;
  const activeAccent = getCorpusAccent(active?.accent);
  const activeAccentStyle = getCorpusAccentStyle(active?.accent);

  function updateActive(patch: Partial<CorpusTemplate>) {
    if (!active) return;
    setTemplates(prev => prev.map(t => (
      t.id === active.id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t
    )));
  }

  function addTemplate() {
    const next = createCorpusTemplate();
    setTemplates(prev => [next, ...prev]);
    setActiveId(next.id);
  }

  function duplicateTemplate() {
    if (!active) return;
    const next = {
      ...active,
      id: `corpus-${Date.now().toString(36)}`,
      name: `${active.name} 副本`,
      updatedAt: new Date().toISOString(),
    };
    setTemplates(prev => [next, ...prev]);
    setActiveId(next.id);
  }

  function removeTemplate() {
    if (!active) return;
    if (!confirm(`删除「${active.name}」？`)) return;
    setTemplates(prev => {
      const next = prev.filter(t => t.id !== active.id);
      setActiveId(next[0]?.id ?? "");
      return next;
    });
  }

  function resetDefaults() {
    if (!confirm("恢复默认语料模板？当前自定义模板会被覆盖。")) return;
    setTemplates(DEFAULT_CORPUS_TEMPLATES);
    setActiveId(DEFAULT_CORPUS_TEMPLATES[0]?.id ?? "");
  }

  return (
    <div className="admin-pane">
      <header className="admin-pane__head">
        <h1>AI 语料管理</h1>
        <div className="admin-filters">
          <button type="button" onClick={addTemplate}>+ 新建模板</button>
          <button type="button" onClick={duplicateTemplate} disabled={!active}>复制当前</button>
          <button type="button" onClick={resetDefaults}>恢复默认</button>
        </div>
      </header>

      <p className="admin-pane__desc">
        用来沉淀 Rich / Hermes 在不同场景下的答复方式。先把「场景 → 必须汇报的信息 → 风格约束 → 模板」
        固化下来，后续接入具体 AI 调用时，就可以直接按这里的语料生成你的专属表达风格。
      </p>
      {saveError && <p className="admin-pane__desc corpus-error">语料同步异常：{saveError}</p>}

      <div className="corpus-layout">
        <aside className="corpus-list" aria-label="AI 语料模板">
          {templates.map(t => (
            <button
              key={t.id}
              type="button"
              className={`corpus-item ${active?.id === t.id ? "is-active" : ""}`}
              style={getCorpusAccentStyle(t.accent)}
              onClick={() => setActiveId(t.id)}
            >
              <strong>{t.name}</strong>
              <span>{t.scene}</span>
              <em>{TONE_LABELS[t.tone]}</em>
            </button>
          ))}
        </aside>

        <section className="corpus-editor" style={activeAccentStyle}>
          {!active && <div className="admin-empty">还没有语料模板，点右上角新建一个。</div>}
          {active && (
            <>
              <div className="corpus-editor__grid">
                <label className="corpus-field">
                  <span>模板名称</span>
                  <input value={active.name} onChange={e => updateActive({ name: e.target.value })} />
                </label>
                <label className="corpus-field">
                  <span>风格</span>
                  <select value={active.tone} onChange={e => updateActive({ tone: e.target.value as CorpusTone })}>
                    {(Object.keys(TONE_LABELS) as CorpusTone[]).map(tone => (
                      <option key={tone} value={tone}>{TONE_LABELS[tone]}</option>
                    ))}
                  </select>
                </label>
                <label className="corpus-field corpus-field--wide">
                  <span>正文颜色</span>
                  <div className="corpus-color-row" role="radiogroup" aria-label="正文颜色">
                    {ACCENT_OPTIONS.map(option => (
                      <button
                        key={option.key}
                        type="button"
                        role="radio"
                        aria-checked={active.accent === option.key}
                        className={`corpus-color ${active.accent === option.key ? "is-active" : ""}`}
                        style={getCorpusAccentStyle(option.key)}
                        onClick={() => updateActive({ accent: option.key })}
                      >
                        <span aria-hidden="true" />
                        {option.label}
                      </button>
                    ))}
                  </div>
                </label>
                <label className="corpus-field corpus-field--wide">
                  <span>适用场景</span>
                  <input value={active.scene} onChange={e => updateActive({ scene: e.target.value })} />
                </label>
                <label className="corpus-field corpus-field--wide">
                  <span>这个模板要完成什么</span>
                  <textarea rows={2} value={active.intent} onChange={e => updateActive({ intent: e.target.value })} />
                </label>
                <label className="corpus-field corpus-field--wide">
                  <span>必须汇报的信息</span>
                  <textarea rows={3} value={active.mustInclude} onChange={e => updateActive({ mustInclude: e.target.value })} />
                </label>
                <label className="corpus-field corpus-field--wide">
                  <span>风格规则</span>
                  <textarea rows={3} value={active.styleGuide} onChange={e => updateActive({ styleGuide: e.target.value })} />
                </label>
                <label className="corpus-field corpus-field--wide">
                  <span>答复模板</span>
                  <textarea rows={9} value={active.template} onChange={e => updateActive({ template: e.target.value })} />
                </label>
                <label className="corpus-field corpus-field--wide">
                  <span>示例答复</span>
                  <textarea rows={5} value={active.sample} onChange={e => updateActive({ sample: e.target.value })} />
                </label>
              </div>

              <aside className="corpus-preview" style={activeAccentStyle}>
                <header>
                  <strong>模板卡片</strong>
                  <span>更新于 {formatTs(active.updatedAt)}</span>
                </header>
                <div className="corpus-preview__accent">
                  <span style={activeAccentStyle} />
                  {activeAccent.label} 正文强调色
                </div>
                <dl>
                  <dt>场景</dt>
                  <dd>{active.scene || "—"}</dd>
                  <dt>风格</dt>
                  <dd>{TONE_LABELS[active.tone]}</dd>
                  <dt>必须包含</dt>
                  <dd>{active.mustInclude || "—"}</dd>
                </dl>
                <div className="corpus-template-preview" aria-label="带颜色的答复模板预览">
                  {renderCorpusTemplatePreview(active.template)}
                </div>
                <div className="corpus-actions">
                  <button type="button" className="imp-ghost" onClick={removeTemplate}>删除模板</button>
                </div>
              </aside>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function getCorpusAccent(accent?: CorpusAccent) {
  return ACCENT_OPTIONS.find(option => option.key === accent) ?? ACCENT_OPTIONS[0];
}

function getCorpusAccentStyle(accent?: CorpusAccent): CSSProperties {
  const option = getCorpusAccent(accent);
  return {
    "--corpus-accent": option.color,
    "--corpus-accent-glow": option.glow,
  } as CSSProperties;
}

function renderCorpusTemplatePreview(template: string) {
  return template.split("\n").map((line, lineIndex) => {
    const parts = line.split(/(\{[^{}]+\}|【[^】]+】|-\s*)/g);
    return (
      <div
        key={`${lineIndex}-${line}`}
        className={`corpus-template-line ${line.trim() === "" ? "is-empty" : ""}`}
      >
        {parts.map((part, partIndex) => {
          if (!part) return null;
          if (/^【[^】]+】$/.test(part)) {
            return <span key={partIndex} className="corpus-token corpus-token--heading">{part}</span>;
          }
          if (/^\{[^{}]+\}$/.test(part)) {
            return <span key={partIndex} className="corpus-token corpus-token--slot">{part}</span>;
          }
          if (/^-\s*$/.test(part)) {
            return <span key={partIndex} className="corpus-token corpus-token--bullet">{part}</span>;
          }
          return <span key={partIndex}>{part}</span>;
        })}
      </div>
    );
  });
}

/* ---------------------------------- helpers ---------------------------------- */

function formatTs(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", { hour12: false });
  } catch { return iso; }
}
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 100) / 10;
  return `${s}s`;
}
function summarizeScope(scope: Record<string, unknown>): string {
  const pieces: string[] = [];
  if ("direction" in scope && scope.direction) {
    const d = String(scope.direction);
    pieces.push(d.length > 36 ? d.slice(0, 36) + "…" : d);
  }
  if ("sectionId" in scope && scope.sectionId) pieces.push(`section=${scope.sectionId}`);
  if ("targetRichness" in scope && scope.targetRichness) pieces.push(`r=${scope.targetRichness}`);
  return pieces.length > 0 ? ` · ${pieces.join(" · ")}` : "";
}

/* -------------------------------- Cron Tab -------------------------------- */

interface CronJob {
  id: string;
  name: string;
  prompt_preview: string;
  schedule: string;
  repeat: string | null;
  state: "scheduled" | "paused" | "unknown";
  enabled: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_delivery_error: string | null;
  deliver: string;
  skills: string[];
  model: string | null;
  provider: string | null;
}

function CronTab() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastLoaded, setLastLoaded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/cron/jobs");
      const j = await r.json() as { ok: boolean; jobs: CronJob[]; error?: string };
      if (!j.ok) throw new Error(j.error ?? "未知错误");
      setJobs(j.jobs);
      setLastLoaded(new Date().toLocaleString("zh-CN", { hour12: false }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!autoRefresh) return;
    const t = window.setInterval(() => { void load(); }, 30_000);
    return () => window.clearInterval(t);
  }, [autoRefresh]);

  return (
    <div className="admin-pane">
      <header className="admin-pane__head">
        <h1>定时任务监控</h1>
        <div className="admin-filters">
          <span className="admin-meta">{lastLoaded ? `更新于 ${lastLoaded}` : ""}</span>
          <label>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
            /> 自动刷新（30s）
          </label>
          <button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "加载中…" : "立即刷新"}
          </button>
        </div>
      </header>

      <p className="admin-pane__desc">
        Hermes 的定时任务清单（读自 <code>~/.hermes/cron/jobs.json</code>）。要新增 / 暂停 / 删除任务，
        请在首页输入框中唤起 Hermes 对话，比如：
        <em>「帮我每天早上 10 点生成当天的 AI 早报」</em>。
      </p>

      {error && <div className="admin-error">⚠ {error}</div>}

      {jobs.length === 0 && !loading && !error && (
        <div className="admin-empty">
          目前没有任何定时任务。<br />
          可以在 Hermes 对话框里说一句话来添加，例如「每周一晚上 22 点给我生成本周复盘」。
        </div>
      )}

      <div className="cron-list">
        {jobs.map(job => (
          <article key={job.id} className={`cron-card cron-card--${job.state}`}>
            <header className="cron-card__head">
              <div className="cron-card__title">
                <strong>{job.name}</strong>
                <span className={`cron-card__state cron-card__state--${job.state}`}>
                  {job.state === "scheduled" ? "运行中" : job.state === "paused" ? "已暂停" : "未知"}
                </span>
              </div>
              <div className="cron-card__schedule">
                <span className="cron-card__schedule-icon" aria-hidden="true">⏰</span>
                {job.schedule}
                {job.repeat && <span className="cron-card__repeat"> · {job.repeat}</span>}
              </div>
            </header>

            {job.prompt_preview && (
              <div className="cron-card__prompt">
                <span className="cron-card__label">指令</span>
                <p>{job.prompt_preview}</p>
              </div>
            )}

            <div className="cron-card__meta">
              <div>
                <span className="cron-card__label">下次执行</span>
                <em>{job.next_run_at ? formatTs(job.next_run_at) : "—"}</em>
              </div>
              <div>
                <span className="cron-card__label">上次执行</span>
                <em>{job.last_run_at ? formatTs(job.last_run_at) : "—"}</em>
              </div>
              <div>
                <span className="cron-card__label">上次结果</span>
                <em className={job.last_status === "error" ? "is-error" : ""}>
                  {job.last_status ?? "—"}
                </em>
              </div>
              <div>
                <span className="cron-card__label">输出去向</span>
                <em>{job.deliver}</em>
              </div>
            </div>

            {(job.skills.length > 0 || job.model) && (
              <footer className="cron-card__footer">
                {job.skills.length > 0 && (
                  <div className="cron-card__skills">
                    <span className="cron-card__label">挂载技能</span>
                    {job.skills.map(s => <span key={s} className="cron-card__chip">{s}</span>)}
                  </div>
                )}
                {job.model && (
                  <div className="cron-card__model">
                    <span className="cron-card__label">模型</span>
                    <em>{job.provider ? `${job.provider} · ` : ""}{job.model}</em>
                  </div>
                )}
              </footer>
            )}

            {job.last_delivery_error && (
              <div className="cron-card__error">⚠ 投递失败：{job.last_delivery_error}</div>
            )}

            <div className="cron-card__id" title={job.id}>ID: {job.id.slice(0, 16)}</div>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Improvements Tab ---------------------------- */

type ImpStatus = "pending" | "ready_to_develop" | "ready_to_verify" | "verified" | "rejected";
type ImpPriority = "low" | "medium" | "high";

interface ImprovementDevTask {
  id: string;
  title: string;
  detail?: string;
  status?: "todo" | "doing" | "done" | "blocked";
  priority?: ImpPriority;
}

interface Improvement {
  id: string;
  title: string;
  description: string;
  reason: string;
  prdContent: string;
  tasks: ImprovementDevTask[];
  status: ImpStatus;
  priority?: ImpPriority;
  category?: string;
  createdBy: "hermes" | "user";
  relatedFiles?: string[];
  verifications: Array<{ ts: string; result: "pass" | "fail"; notes?: string }>;
  requestedAt: string;
  updatedAt: string;
  /** 当前接管人 agent-id；undefined = 未认领 */
  assignedAgentId?: string;
  assignedAt?: string;
}

const STATUS_LABEL: Record<ImpStatus, string> = {
  pending: "待分析",
  ready_to_develop: "待开发",
  ready_to_verify: "已改造 · 待验证",
  verified: "已验证",
  rejected: "验证未通过",
};

const DEV_TASK_STATUS_LABEL: Record<NonNullable<ImprovementDevTask["status"]>, string> = {
  todo: "待做",
  doing: "进行中",
  done: "完成",
  blocked: "阻塞",
};

function parseDevTasksText(text: string): ImprovementDevTask[] {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 100)
    .map((line, index) => ({
      id: `task-${index + 1}`,
      title: line.replace(/^\d+[.)、\s-]*/, ""),
      status: "todo",
    }));
}

function devTasksToText(tasks: ImprovementDevTask[] | undefined): string {
  return (tasks ?? []).map(task => task.title).join("\n");
}

function ImprovementsTab() {
  const [items, setItems] = useState<Improvement[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [statusFilter, setStatusFilter] = useState<ImpStatus | "all">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPrdContent, setNewPrdContent] = useState("");
  const [newTasksText, setNewTasksText] = useState("");
  const [newPriority, setNewPriority] = useState<ImpPriority>("medium");
  /** 本机 Rich.app 的 agent-id（点"认领"时默认用它）；启动时从 /api/agent-id 拉一次。 */
  const [myAgentId, setMyAgentId] = useState<string>("");

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/agent-id");
        if (r.ok) {
          const { agentId } = await r.json() as { agentId: string };
          setMyAgentId(agentId);
        }
      } catch { /* 失败就让按钮 disabled，下面会处理 */ }
    })();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qs = statusFilter === "all" ? "" : `?status=${statusFilter}`;
      const r = await fetch(`/api/improvements${qs}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json() as { items: Improvement[]; counts: Record<string, number> };
      setItems(j.items);
      setCounts(j.counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [statusFilter]);

  async function patchStatus(id: string, status: ImpStatus, notes?: string) {
    const body: Record<string, unknown> = { status };
    if (notes) body.verificationNotes = notes;
    await fetch(`/api/improvements/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    await load();
  }

  async function updatePlanning(item: Improvement) {
    const prdContent = prompt("PRD 内容", item.prdContent ?? "");
    if (prdContent == null) return;
    const tasksText = prompt("Task 列表（一行一个）", devTasksToText(item.tasks));
    if (tasksText == null) return;
    await fetch(`/api/improvements/${item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prdContent,
        tasks: parseDevTasksText(tasksText),
      }),
    });
    await load();
  }

  async function removeItem(id: string) {
    if (!confirm("确定删除？审计痕迹会丢失，更建议把状态改成已验证或未通过。")) return;
    await fetch(`/api/improvements/${id}`, { method: "DELETE" });
    await load();
  }

  /** 认领：抢到了就刷新；被别人占着就弹 toast 提示。 */
  async function claimItem(id: string) {
    if (!myAgentId) { alert("还没拿到本机 agent-id，刷新一下页面再试"); return; }
    const r = await fetch(`/api/improvements/${id}/claim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: myAgentId }),
    });
    if (r.status === 409) {
      const { conflict } = await r.json() as { conflict?: { currentAgentId: string; assignedAt: string } };
      alert(`已被「${conflict?.currentAgentId ?? "未知"}」认领\n时间：${conflict?.assignedAt ?? "—"}`);
    } else if (!r.ok) {
      const { error: err } = await r.json().catch(() => ({ error: r.statusText }));
      alert(`认领失败：${err}`);
    }
    await load();
  }

  /** 释放：用户主动放弃自己持有的认领。 */
  async function releaseItem(id: string, currentAssignee: string | undefined) {
    if (!myAgentId) { alert("还没拿到本机 agent-id"); return; }
    // 如果不是自己持有的，问一下要不要强制释放（用于其它机器 crash 卡住时手动 unstick）
    const force = currentAssignee !== myAgentId;
    if (force && !confirm(`这条任务现在被「${currentAssignee}」认领，确定要强制释放吗？\n（一般只在对方机器卡死时用）`)) return;
    await fetch(`/api/improvements/${id}/release`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(force ? { force: true } : { agentId: myAgentId }),
    });
    await load();
  }

  async function submitNew() {
    if (!newTitle.trim()) return;
    await fetch("/api/improvements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: newTitle.trim(),
        reason: newReason.trim() || undefined,
        description: newDescription.trim() || undefined,
        prdContent: newPrdContent.trim() || undefined,
        tasks: parseDevTasksText(newTasksText),
        priority: newPriority,
        createdBy: "user",
      }),
    });
    setNewTitle("");
    setNewReason("");
    setNewDescription("");
    setNewPrdContent("");
    setNewTasksText("");
    setShowNew(false);
    await load();
  }

  return (
    <div className="admin-pane">
      <header className="admin-pane__head">
        <h1>系统改造任务</h1>
        <div className="admin-filters">
          <button type="button" onClick={() => setShowNew(s => !s)}>
            {showNew ? "取消" : "+ 新建"}
          </button>
          <button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "加载中…" : "刷新"}
          </button>
        </div>
      </header>

      <div className="imp-scroll">
        <p className="admin-pane__desc">
          当 Hermes 想做某事但发现 Rich 缺能力时，会通过 MCP 工具 <code>create_improvement</code> 在这里
          建一条「待改造」。你改完后点「已改造」按钮，Hermes 下次会自己来验证（或你直接跟 Hermes 说
          <em>「id=imp-xxx 改好了帮我验证」</em>）。
        </p>

        <nav className="imp-filters">
          {(["all", "pending", "ready_to_develop", "ready_to_verify", "verified", "rejected"] as const).map(s => (
            <button
              key={s}
              type="button"
              className={`imp-filter${statusFilter === s ? " is-active" : ""}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "全部" : STATUS_LABEL[s]}
              {s !== "all" && counts[s] != null && <span className="imp-filter__count">{counts[s]}</span>}
            </button>
          ))}
        </nav>

        {showNew && (
          <div className="imp-new">
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="任务标题，例如：新增 attach_mindmap MCP 工具"
            />
            <textarea
              value={newReason}
              onChange={e => setNewReason(e.target.value)}
              placeholder="为什么需要这个改造？缺什么能力 / 受阻于什么？"
              rows={2}
            />
            <textarea
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              placeholder="详细描述（可选）"
              rows={3}
            />
            <textarea
              value={newPrdContent}
              onChange={e => setNewPrdContent(e.target.value)}
              placeholder="PRD 内容（可选）：AI 优化需求后沉淀在这里"
              rows={5}
            />
            <textarea
              value={newTasksText}
              onChange={e => setNewTasksText(e.target.value)}
              placeholder="Task 拆分（可选）：一行一个任务，保存后会结构化"
              rows={4}
            />
            <div className="imp-new-row">
              <label>
                优先级
                <select value={newPriority} onChange={e => setNewPriority(e.target.value as ImpPriority)}>
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                </select>
              </label>
              <button type="button" className="imp-primary" onClick={() => void submitNew()} disabled={!newTitle.trim()}>
                建立任务
              </button>
            </div>
          </div>
        )}

        {error && <div className="admin-error">⚠ {error}</div>}

        {items.length === 0 && !loading && !error && (
          <div className="admin-empty">
            目前没有改造任务。<br />
            Hermes 在 chat 里碰到能力缺口时会自动建一条。或者点上面「+ 新建」手动建。
          </div>
        )}

        <div className="imp-list">
          {items.map(item => (
          <article key={item.id} className={`imp-card imp-card--${item.status}`}>
            <header className="imp-card__head">
              <div className="imp-card__title">
                <strong>{item.title}</strong>
                <span className={`imp-status imp-status--${item.status}`}>{STATUS_LABEL[item.status]}</span>
              </div>
              <div className="imp-card__meta">
                {item.priority && <span className={`imp-prio imp-prio--${item.priority}`}>P · {item.priority}</span>}
                {item.category && <span className="imp-cat">{item.category}</span>}
                <span className="imp-by">由 {item.createdBy === "hermes" ? "Hermes" : "你"} 发起</span>
                {item.assignedAgentId ? (
                  <span
                    className={`imp-assignee${item.assignedAgentId === myAgentId ? " is-mine" : ""}`}
                    title={`认领时间：${item.assignedAt ? formatTs(item.assignedAt) : "—"}`}
                  >
                    🔒 接管人：{item.assignedAgentId}
                    {item.assignedAgentId === myAgentId && <em> · 本机</em>}
                  </span>
                ) : (
                  <span className="imp-assignee imp-assignee--free">🔓 未认领</span>
                )}
              </div>
            </header>

            {item.reason && (
              <div className="imp-card__section">
                <span className="imp-card__label">原因</span>
                <p>{item.reason}</p>
              </div>
            )}
            {item.description && (
              <div className="imp-card__section">
                <span className="imp-card__label">描述</span>
                <p>{item.description}</p>
              </div>
            )}
            {item.prdContent && (
              <div className="imp-card__section imp-card__section--prd">
                <span className="imp-card__label">PRD</span>
                <p>{item.prdContent}</p>
              </div>
            )}
            {item.tasks && item.tasks.length > 0 && (
              <div className="imp-card__section">
                <span className="imp-card__label">Task</span>
                <ol className="imp-devtasks">
                  {item.tasks.map(task => (
                    <li key={task.id}>
                      <span className={`imp-devtask-status imp-devtask-status--${task.status ?? "todo"}`}>
                        {DEV_TASK_STATUS_LABEL[task.status ?? "todo"]}
                      </span>
                      <strong>{task.title}</strong>
                      {task.detail && <p>{task.detail}</p>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {item.relatedFiles && item.relatedFiles.length > 0 && (
              <div className="imp-card__section">
                <span className="imp-card__label">相关文件</span>
                <ul className="imp-files">
                  {item.relatedFiles.map(f => <li key={f}><code>{f}</code></li>)}
                </ul>
              </div>
            )}

            {item.verifications.length > 0 && (
              <div className="imp-card__section">
                <span className="imp-card__label">验证记录</span>
                <ul className="imp-verifs">
                  {item.verifications.map((v, i) => (
                    <li key={i} className={`imp-verif imp-verif--${v.result}`}>
                      <span className="imp-verif__ts">{formatTs(v.ts)}</span>
                      <span className="imp-verif__result">{v.result === "pass" ? "✓ 通过" : "✗ 未通过"}</span>
                      {v.notes && <span className="imp-verif__notes">{v.notes}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <footer className="imp-card__footer">
              <div className="imp-card__times">
                创建 {formatTs(item.requestedAt)} · 更新 {formatTs(item.updatedAt)} · ID {item.id}
              </div>
              <div className="imp-card__actions">
                {/* Agent 认领 / 释放：跨机 Agent 互斥用 */}
                {!item.assignedAgentId && (
                  <button type="button" className="imp-claim" onClick={() => void claimItem(item.id)}>
                    认领
                  </button>
                )}
                {item.assignedAgentId && (
                  <button type="button" className="imp-release" onClick={() => void releaseItem(item.id, item.assignedAgentId)}>
                    {item.assignedAgentId === myAgentId ? "释放" : "强制释放"}
                  </button>
                )}
                {item.status === "pending" && (
                  <button type="button" className="imp-primary" onClick={() => void patchStatus(item.id, "ready_to_develop")}>
                    开发
                  </button>
                )}
                {item.status === "ready_to_develop" && (
                  <button type="button" onClick={() => void patchStatus(item.id, "ready_to_verify")}>
                    标记已改造
                  </button>
                )}
                {item.status === "ready_to_verify" && (
                  <>
                    <button type="button" className="imp-primary" onClick={() => {
                      const notes = prompt("验证通过的说明（可选）", "");
                      void patchStatus(item.id, "verified", notes ?? undefined);
                    }}>
                      验证通过
                    </button>
                    <button type="button" className="imp-danger" onClick={() => {
                      const notes = prompt("验证不通过的原因 / 还差什么", "");
                      if (notes == null) return;
                      void patchStatus(item.id, "rejected", notes);
                    }}>
                      不通过
                    </button>
                  </>
                )}
                {(item.status === "verified" || item.status === "rejected") && (
                  <button type="button" onClick={() => void patchStatus(item.id, item.status === "rejected" ? "ready_to_develop" : "ready_to_verify")}>
                    {item.status === "rejected" ? "重新开发" : "重新待验证"}
                  </button>
                )}
                <button type="button" onClick={() => void updatePlanning(item)}>
                  编辑PRD/Task
                </button>
                <button type="button" className="imp-ghost" onClick={() => void removeItem(item.id)}>
                  删除
                </button>
              </div>
            </footer>
          </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectHealthTab() {
  const projects = Array.from(useStore(s => s.elements).values()).filter(item => item.type === "project");
  const [projectId, setProjectId] = useState("");
  const [records, setRecords] = useState<ProjectModuleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (!projectId && projects[0]) setProjectId(projects[0].id); }, [projectId, projects]);
  useEffect(() => {
    if (!projectId) { setRecords([]); return; }
    setLoading(true);
    void api.listProjectManagementModuleItems(projectId, "healthChecks", undefined, true)
      .then(setRecords)
      .catch(value => setError(value instanceof Error ? value.message : String(value)))
      .finally(() => setLoading(false));
  }, [projectId]);

  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  records.forEach(item => { counts[normalizeProjectHealthRecord(recordOf(item)).severity]++; });
  const save = async (item: ProjectModuleItem, patch: Record<string, unknown>) => {
    const original = { ...recordOf(item), ...patch };
    const updated = await api.updateProjectManagementModuleItem(projectId, item.id, { title: typeof original.title === "string" && original.title.trim() ? original.title : item.title, subtitle: `${severityLabel(normalizeProjectHealthRecord(original).severity)} · ${categoryLabel(normalizeProjectHealthRecord(original).category)}`, content: { ...item.content, original } });
    setRecords(current => current.map(row => row.id === updated.id ? updated : row));
  };
  const create = async () => {
    const original = { title: "待 AI 补充的健康检查发现", severity: "medium", category: "architecture", status: "open", evidence: "", repairPlan: "", repairResult: "", checkedAt: new Date().toISOString() };
    const created = await api.createProjectManagementModuleItem(projectId, "healthChecks", { title: original.title, subtitle: "中 · 架构", sortOrder: records.length, content: { original } });
    setRecords(current => [created, ...current]);
  };
  return <div className="admin-pane project-health">
    <header className="admin-pane__head"><div><h1>项目健康检查</h1><p>AI 检查结果的治理台：按风险记录证据、修复计划与验证结果；本页面不自行执行扫描。</p></div><div className="admin-filters"><select value={projectId} onChange={event => setProjectId(event.target.value)}>{projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select><button type="button" className="imp-primary" disabled={!projectId} onClick={() => void create()}>+ 新建记录</button></div></header>
    {!projects.length ? <div className="admin-empty">还没有项目可供检查。</div> : <>
      <section className="project-health__summary"><HealthMetric tone="critical" label="紧急" value={counts.critical} /><HealthMetric tone="high" label="高" value={counts.high} /><HealthMetric tone="medium" label="中" value={counts.medium} /><HealthMetric tone="low" label="低" value={counts.low} /><div className="project-health__cli"><strong>AI 写入 CLI</strong><code>pnpm rich -- project-health create &lt;项目ID&gt; --json '&#123;...&#125;'</code></div></section>
      {error && <div className="admin-error">{error}</div>}
      {loading ? <div className="admin-loading">加载检查记录…</div> : <div className="project-health__list">{records.length === 0 ? <div className="admin-empty">尚未记录检查发现。请让 AI 使用 CLI 写入扫描结果。</div> : records.sort((a, b) => severityRank(normalizeProjectHealthRecord(recordOf(a)).severity) - severityRank(normalizeProjectHealthRecord(recordOf(b)).severity)).map(item => <ProjectHealthCard key={item.id} item={item} onSave={save} />)}</div>}
    </>}
  </div>;
}

function ProjectHealthCard({ item, onSave }: { item: ProjectModuleItem; onSave: (item: ProjectModuleItem, patch: Record<string, unknown>) => Promise<void> }) {
  const original = recordOf(item);
  const record = normalizeProjectHealthRecord(original);
  const update = (patch: Record<string, unknown>) => void onSave(item, patch).catch(() => undefined);
  return <article className={`project-health-card project-health-card--${record.severity}`}>
    <header><div><span className={`project-health-badge project-health-badge--${record.severity}`}>{severityLabel(record.severity)}</span><span>{categoryLabel(record.category)}</span><select value={record.status} onChange={event => update({ status: event.target.value })}>{(["open", "planned", "fixing", "verified"] as ProjectHealthStatus[]).map(status => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></div><small>{record.checkedAt ? formatTs(record.checkedAt) : "等待 AI 检查"}</small></header>
    <input className="project-health-card__title" value={typeof original.title === "string" ? original.title : item.title} onChange={event => update({ title: event.target.value })} aria-label="问题标题" />
    <HealthText label="问题与证据" value={record.evidence} placeholder="AI 应说明架构、单文件、逻辑或数据存放问题的具体证据。" onChange={value => update({ evidence: value })} />
    <HealthText label="修复计划" value={record.repairPlan} placeholder="分步骤说明应如何整改、验证与回滚。" onChange={value => update({ repairPlan: value })} />
    <HealthText label="修复结果" value={record.repairResult} placeholder="AI 完成修复后记录变更、验证命令和遗留风险。" onChange={value => update({ repairResult: value })} />
  </article>;
}

function HealthMetric({ tone, label, value }: { tone: ProjectHealthSeverity; label: string; value: number }) { return <div className={`project-health-metric project-health-metric--${tone}`}><strong>{value}</strong><span>{label}</span></div>; }
function HealthText({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) { return <label className="project-health-card__field"><span>{label}</span><textarea value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} /></label>; }
function recordOf(item: ProjectModuleItem): Record<string, unknown> { const value = item.content.original; return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function severityRank(value: ProjectHealthSeverity): number { return ({ critical: 0, high: 1, medium: 2, low: 3 })[value]; }
function severityLabel(value: ProjectHealthSeverity): string { return ({ critical: "紧急", high: "高", medium: "中", low: "低" })[value]; }
function categoryLabel(value: ProjectHealthCategory): string { return ({ architecture: "架构设计", code: "代码质量", data: "数据治理", dependency: "依赖边界", security: "安全风险", delivery: "交付运维" })[value]; }
function statusLabel(value: ProjectHealthStatus): string { return ({ open: "待规划", planned: "已计划", fixing: "修复中", verified: "已验证" })[value]; }

// satisfy lint
void Icon;
