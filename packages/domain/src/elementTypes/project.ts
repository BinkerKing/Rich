/**
 * 项目管理 · 元类型 content schemas
 *
 * 与「项目实战 (practice)」区分：practice 是学习+练手项目（PRD/dev-task 拆解、整改建议）；
 * 这里是「生产项目」的运维侧信息（部署、凭证、代码、待办、答疑、文件夹、报告）。
 *
 * 数据布局：
 *   project (顶层)
 *     ├─ deployment-env × 1-N (dev/staging/prod)
 *     │   ├─ server × 1-N
 *     │   ├─ credential × 0-N（也可挂 project 下作为通用凭证）
 *     ├─ deployment-step × 1-N（真正的部署步骤，按环境 + 版本拆分）
 *     ├─ repo × 0-N
 *     ├─ version-release × 0-N
 *     ├─ faq × 0-N
 *     ├─ folder-snapshot × 0-N（每次扫描一条）
 *     ├─ dev-task × 0-N（待办，复用现有 dev-task）
 *     └─ report × 0-N（日报/周报，复用现有 report）
 */

/** project 元 content —— 顶层项目节点 */
export interface ProjectContent {
  /** 兼容早期自由文本分组；新项目分区使用 groupId。 */
  group?: string;
  /** 项目选择页分区记录的 id。空值归入“未分组”。 */
  groupId?: string;
  /** 同一分区内的展示顺序。 */
  groupPosition?: number;
  /** Rich 窗口内快速打开此项目的组合键。 */
  shortcut?: string;
  description?: string;            // 项目简介 (markdown)
  status?: "active" | "paused" | "archived";
  /** 本地代码 / 文件根目录路径，供文件夹整理用 */
  localFolder?: string;
  /** 项目目录内新建交付物的默认根目录。 */
  defaultDeliverablesDirectory?: string;
  /** 项目目录内版本控制文件的默认根目录。 */
  defaultVersionControlDirectory?: string;
  /** 项目 SVN 仓库路径或 URL，仅记录绑定信息，不保存凭据。 */
  svnPath?: string;
  /** 项目 GitHub 仓库路径或 URL，仅记录绑定信息，不保存凭据。 */
  githubPath?: string;
  /** 业务负责人 / 项目角色 */
  owner?: string;
  /** 起始日 / 上线日 */
  startedAt?: string;
  launchedAt?: string;
  /** 自动报告排程 (V0.1 V0.2 占位)。cron 表达式或简单 HH:mm */
  reportSchedule?: {
    /** 日报：HH:mm，默认 18:00；空字符串 = 关闭 */
    daily?: string;
    /** 周报：weekday + HH:mm，默认周日 18:00 */
    weekly?: { weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; time: string };
  };
  /** 文件夹页最后一次扫描结果，用于再次进入项目时直接展示当前结构 */
  lastFolderScan?: unknown;
}

/** deployment-env 元 —— 一个部署环境（dev / staging / prod） */
export interface DeploymentEnvContent {
  /** 环境标识：dev / staging / prod / preview / 自定义字符串 */
  envName: string;
  description?: string;
  /** 该环境的入口 URL（如 https://app.example.com） */
  publicUrl?: string;
  /** 部署重点 / 注意事项 (markdown) */
  attention?: string;
}

/** deployment-step 元 —— 一组可执行部署步骤（按环境 + 版本独立存储） */
export interface DeploymentStepContent {
  /** SIT / UAT / PROD / 运维 / 通用 */
  environment: string;
  /** v1.0 / 2026.06.16 / build-xxx；同一环境可有多套版本步骤 */
  version: string;
  /** 阶段：创建账号 / Mysql安装 / 应用部署 / NAS配置 ... */
  phase: string;
  /** 目标服务器或区域：可信区应用服务器、报送区应用服务器等 */
  target?: string;
  /** 来源 sheet 或文档名，方便追溯 */
  source?: string;
  /** 每一步的操作说明 */
  steps: Array<{
    n: number;
    actor?: string;
    action: string;
    command?: string;
    check?: string;
    notes?: string;
  }>;
  /** 每次部署前/中/后可勾选的 checklist，状态持久化在 content 内 */
  checklist: Array<{
    id: string;
    label: string;
    done?: boolean;
  }>;
  importedAt?: string;
}

/** server 元 —— 一台服务器 */
export interface ServerContent {
  ip: string;
  /** 服务器职责：前置机 / 应用服务器 / 数据库 / 虚拟VIP / 路由 */
  serverRole?: "front" | "app" | "database" | "vip" | "router";
  port?: number;                   // SSH 端口，默认 22
  hostname?: string;
  os?: string;                     // Aliyun Linux 8 / Ubuntu 22.04 / ...
  region?: string;                 // 阿里云杭州 / AWS us-east-1 / ...
  /** 备注：跑啥服务、配置规格、续费日期 */
  notes?: string;
}

/** credential 元 —— 一组账号密码 / Key */
export interface CredentialContent {
  /** ssh / db / web-admin / api-key / 其他 */
  kind: "ssh" | "db" | "web" | "api" | "other";
  /** 显示名（例：阿里云 RAM / Rich DB / 公司 Gmail） */
  label: string;
  username?: string;
  password?: string;               // 明文存（按用户决策）
  /** 私钥/Token 文本 */
  privateKey?: string;
  /** 登录入口 URL */
  url?: string;
  notes?: string;
}

/** repo 元 —— 代码仓库 */
export interface RepoContent {
  url: string;                     // git URL / https URL
  defaultBranch?: string;          // main / master / develop
  vendor?: "github" | "gitee" | "gitlab" | "bitbucket" | "self";
  /** 本地 clone 路径（可选） */
  localPath?: string;
  notes?: string;
}

/** version-release 元 —— 一次发布 */
export interface VersionReleaseContent {
  version: string;                 // v1.2.0 / 2026.05.25 / build-456
  releasedAt: string;              // ISO datetime
  /** 部署到哪几个环境（envName 列表） */
  deployedTo?: string[];
  /** changelog (markdown) */
  changelog: string;
  /** 关联 commit / PR / tag */
  refUrl?: string;
}

/** faq 元 —— 一条业务答疑 */
export interface FaqContent {
  question: string;
  answer: string;                  // markdown
  /** 分类：业务 / 技术 / 流程 / 其他 */
  category?: string;
  /** 谁问的 / 从哪儿来（客户/同事/工单号） */
  source?: string;
}

/** folder-snapshot 元 —— 一次文件夹 AI 分析快照 */
export interface FolderMove {
  from: string;                    // 相对 rootPath 的路径
  to: string;
  reason: string;                  // AI 给的迁移理由
}

/** connection 元 —— 服务器之间的端口连接 / 防火墙规则 */
export interface ConnectionContent {
  /** 源服务器元 id */
  fromServerId: string;
  /** 目标服务器元 id */
  toServerId: string;
  /** 目标端口（被访问的端口） */
  port: number;
  /** 协议：tcp / udp / http / https / grpc / 自定义 */
  protocol?: string;
  /** 用途 / 业务名（如 "ETL→数仓 Oracle 查询"） */
  purpose?: string;
  /** 防火墙状态：open=已放通，pending=申请中，blocked=被拦，unknown=未确认 */
  firewall?: "open" | "pending" | "blocked" | "unknown";
  notes?: string;
}

export interface FolderSnapshotContent {
  /** 根目录绝对路径 */
  rootPath: string;
  scannedAt: string;               // ISO
  totalFiles: number;
  totalSize: number;               // bytes
  /** AI 给的 markdown 总报告（结构、问题、建议） */
  report: string;
  /** 建议的迁移动作（dry-run plan） */
  proposedMoves?: FolderMove[];
  /** 已应用时间。null/undefined = 还是 dry-run */
  appliedAt?: string;
}
